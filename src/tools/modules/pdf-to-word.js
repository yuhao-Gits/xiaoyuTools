/* PDF 转 Word —— 本项目独立编写的实现。
 *
 * 实现路径（与任何第三方转换引擎无关，也未参考其源码）：
 *   1. 本地 pdf.js 读取 PDF 的文本层，拿到每个文本片段的文字、坐标、字号、字体名；
 *   2. 本项目自写的版面重排：按基线聚类成行、按横坐标排序、按间隙还原空格，
 *      再依据行距 / 缩进 / 字号 / 列表符号推断段落、标题与缩进；
 *   3. 本项目自写的 WordprocessingML 生成器：把上述段落模型写成 OOXML 部件；
 *   4. 本地 JSZip 把部件打包成 .docx。
 *
 * 无文本层（扫描件 / 图片型）的页面不做 OCR，改为整页渲染成图片嵌入文档，
 * 保证「能打开、能看」，但那部分不可编辑。所有处理都在浏览器内完成，不上传文件。
 *
 * 库中依赖只有项目已本地化的 pdfjs-dist(Apache-2.0) 与 jszip(MIT)，无新增依赖。
 */
import {
  panel, filePicker, sel, btn, actions, resultBox, labeled, hint, el,
  toast, downloadBlob, downloadText, copyText, formatBytes,
} from '../../core/ui.js';
import { renderPdfPage, num, clamp } from './shared.js';
import { handoffBanner, nextStepsBox, offerNextSteps } from '../../core/handoff.js';

const MAX_PAGES = 40;
const MAX_BYTES = 40 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ---------------- 通用小工具 ---------------- */

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function xmlText(value) {
  return String(value ?? '')
    // XML 1.0 不允许的控制字符必须剔除，否则 Word 会提示文件损坏
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"']/g, ch => XML_ESCAPES[ch]);
}

const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.size === b.size;

/* ---------------- 版面重排（纯函数，便于单独测试） ---------------- */

/**
 * 把 pdf.js 的 getTextContent().items 还原成段落模型。
 * @param {Array} items pdf.js 文本项
 * @param {object} options { splitParagraphs }
 * @returns {{ blocks: Array, lineCount: number, charCount: number, bodySize: number }}
 */
export function layoutTextContent(items, options = {}) {
  const splitParagraphs = options.splitParagraphs !== false;
  const valid = (items || []).filter(item =>
    item && typeof item.str === 'string' && item.str.length > 0 && Array.isArray(item.transform));
  if (!valid.length) return { blocks: [], lineCount: 0, charCount: 0, bodySize: 10 };

  const sizeOf = item => {
    const fromMatrix = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 0;
    return clamp(fromMatrix || item.height || 10, 4, 200);
  };
  // 正文基准字号用「按字符数加权的众数」而不是中位数：
  // 标题字大但字少，短页面上用中位数会被标题带偏。
  const votes = new Map();
  for (const item of valid) {
    const key = Math.round(sizeOf(item) * 2) / 2;
    votes.set(key, (votes.get(key) || 0) + Math.max(1, item.str.length));
  }
  let bodySize = 10;
  let bestVotes = -1;
  for (const [size, count] of votes) {
    if (count > bestVotes) { bestVotes = count; bodySize = size; }
  }
  // 整页只有一行大字时，按 0.75 倍估正文，让它仍能被识别为标题
  const totalChars = valid.reduce((sum, item) => sum + item.str.length, 0);
  if (votes.size === 1 && totalChars < 60) bodySize = Math.max(4, bodySize * 0.75);

  // 1) 按基线 y 聚类成行（PDF 坐标自下而上，y 越大越靠上）
  const ordered = [...valid].sort((a, b) =>
    b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  const rows = [];
  for (const item of ordered) {
    const y = item.transform[5];
    let row = null;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (Math.abs(rows[i].y - y) <= Math.max(2, sizeOf(item) * 0.45)) { row = rows[i]; break; }
    }
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  rows.sort((a, b) => b.y - a.y);

  // 2) 行内按 x 排序、还原空格、分段生成带样式的 run
  const leftEdge = Math.min(...valid.map(item => item.transform[4]));
  const lines = rows.map(row => {
    row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    const runs = [];
    const append = (text, style) => {
      if (!text) return;
      const last = runs[runs.length - 1];
      if (last && sameStyle(last, style)) last.text += text;
      else runs.push({ text, ...style });
    };
    let prev = null;
    let peakSize = 0;
    let weightedSize = 0;
    let boldVotes = 0;
    for (const item of row.items) {
      const size = sizeOf(item);
      peakSize = Math.max(peakSize, size);
      weightedSize += size * item.str.length;
      const font = String(item.fontName || '');
      const bold = /bold|black|heavy|semibold/i.test(font);
      const italic = /italic|oblique/i.test(font);
      if (bold) boldVotes += item.str.length;
      const halfPoints = clamp(Math.round(size * 2), 12, 72);
      const style = { bold, italic, size: Math.abs(halfPoints - bodySize * 2) < 3 ? 0 : halfPoints };
      if (prev) {
        const prevRight = prev.transform[4] + (prev.width || 0);
        const gap = item.transform[4] - prevRight;
        const threshold = size * 0.26;
        // 中文排版里字间距很小，不轻易插空格；明显留白才补一个空格
        if (gap > threshold) append(gap > size * 1.7 ? '  ' : ' ', { bold: false, italic: false, size: 0 });
      }
      append(item.str, style);
      prev = item;
    }
    const text = runs.map(r => r.text).join('');
    const avgSize = weightedSize / Math.max(1, text.length);
    const x = row.items[0].transform[4];
    return {
      y: row.y, x, runs, text,
      size: peakSize, avgSize,
      indentTwips: Math.max(0, Math.round((x - leftEdge) * 0.55)),
      boldRatio: boldVotes / Math.max(1, text.length),
    };
  });

  // 3) 行 → 段落
  const listPattern = /^\s*(?:[•·▪◦*\-–—]|\d{1,3}[.)、]|[a-zA-Z][.)]|[（(]\d{1,3}[)）])\s+/;
  const blocks = [];
  let paragraph = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const prevLine = lines[i - 1];
    const gap = prevLine ? prevLine.y - line.y : 0;
    const bigGap = prevLine && gap > bodySize * 1.75;
    const indented = line.indentTwips > bodySize * 12;
    const isList = listPattern.test(line.text);
    const heading = line.size > bodySize * 1.35 ? 'Heading1'
      : line.size > bodySize * 1.12 ? 'Heading2'
        : (line.boldRatio > 0.85 && line.text.replace(/\s/g, '').length <= 40 ? 'Heading2' : '');
    const startNew = !paragraph || heading || isList || (splitParagraphs && (bigGap || indented));

    if (startNew) {
      paragraph = {
        kind: 'paragraph', lines: [], style: heading || (isList ? 'ListParagraph' : ''),
        indent: isList ? 420 : 0,
      };
      blocks.push(paragraph);
    }
    paragraph.lines.push({ runs: line.runs });
  }

  const nonEmpty = lines.filter(line => line.text.trim());
  return {
    blocks,
    lineCount: nonEmpty.length,
    charCount: nonEmpty.reduce((sum, line) => sum + line.text.length, 0),
    bodySize,
  };
}

/* ---------------- OOXML 部件生成（纯函数） ---------------- */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS = `xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const FONTS = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei" w:cs="Calibri"/>';

function runXml(run) {
  const props = [
    FONTS,
    run.bold ? '<w:b/><w:bCs/>' : '',
    run.italic ? '<w:i/><w:iCs/>' : '',
    run.size ? `<w:sz w:val="${run.size}"/><w:szCs w:val="${run.size}"/>` : '',
  ].join('');
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xmlText(run.text)}</w:t></w:r>`;
}

function paragraphXml(paragraph) {
  const pPr = [
    paragraph.style ? `<w:pStyle w:val="${paragraph.style}"/>` : '',
    paragraph.list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '',
    `<w:spacing w:before="${paragraph.spaceBefore || 0}" w:after="80" w:line="300" w:lineRule="auto"/>`,
    paragraph.indent ? `<w:ind w:left="${paragraph.indent}"/>` : '',
  ].join('');
  const parts = [];
  paragraph.lines.forEach((line, index) => {
    if (index > 0) parts.push('<w:r><w:br/></w:r>');
    for (const run of line.runs) parts.push(runXml(run));
  });
  if (!parts.length) parts.push('<w:r><w:t xml:space="preserve"></w:t></w:r>');
  return `<w:p><w:pPr>${pPr}</w:pPr>${parts.join('')}</w:p>`;
}

function pageBreakXml() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function imageXml(image, relId, index) {
  const cx = image.cx, cy = image.cy;
  const extent = `<wp:extent cx="${cx}" cy="${cy}"/>`;
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">${extent}<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${100 + index}" name="${xmlText(image.name)}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xmlText(image.name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function stylesXml() {
  const style = (id, name, extra, runPr, basedOn = 'Normal') =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="${basedOn}"/><w:qFormat/>${extra}${runPr}</w:style>`;
  return XML_HEAD + `<w:styles ${NS}>` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${FONTS}<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
    style('Normal', 'Normal', '', `<w:rPr>${FONTS}<w:sz w:val="21"/></w:rPr>`, 'Normal').replace('<w:basedOn w:val="Normal"/>', '') +
    style('Heading1', 'heading 1', '<w:pPr><w:spacing w:before="280" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr>', '<w:rPr><w:b/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr>') +
    style('Heading2', 'heading 2', '<w:pPr><w:spacing w:before="220" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>', '<w:rPr><w:b/><w:sz w:val="27"/><w:szCs w:val="27"/></w:rPr>') +
    style('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="420"/></w:pPr>', '') +
    '</w:styles>';
}

/**
 * 生成 .docx 内部的全部 OOXML 部件。
 * model: { title, blocks: [{kind:'paragraph'|'image'|'pageBreak', ...}] }
 * 返回 [{ path, data: string | Uint8Array }]
 */
export function buildDocxParts(model) {
  const blocks = model.blocks || [];
  const images = [];
  const relIds = new Map();
  blocks.forEach(block => {
    if (block.kind === 'image' && block.bytes && !relIds.has(block.name)) {
      relIds.set(block.name, `rId${10 + images.length}`);
      images.push(block);
    }
  });

  const body = [];
  let imageIndex = 0;
  for (const block of blocks) {
    if (block.kind === 'pageBreak') body.push(pageBreakXml());
    else if (block.kind === 'image') {
      body.push(imageXml(block, relIds.get(block.name), imageIndex));
      imageIndex += 1;
    } else if (block.kind === 'paragraph') body.push(paragraphXml(block));
  }
  const documentXml = XML_HEAD + `<w:document ${NS}><w:body>${body.join('')}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';

  const contentTypes = XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="jpg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const rootRels = XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/>` +
    '</Relationships>';

  const docRels = XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/>` +
    [...relIds].map(([name, id]) =>
      `<Relationship Id="${id}" Type="${R}/image" Target="media/${xmlText(name)}"/>`).join('') +
    '</Relationships>';

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const coreXml = XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xmlText(model.title || 'Converted document')}</dc:title>` +
    '<dc:creator>xiaoyuTools</dc:creator><cp:lastModifiedBy>xiaoyuTools</cp:lastModifiedBy>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>';
  const appXml = XML_HEAD +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>xiaoyuTools</Application><AppVersion>1.0</AppVersion></Properties>';

  const parts = [
    { path: '[Content_Types].xml', data: contentTypes },
    { path: '_rels/.rels', data: rootRels },
    { path: 'word/document.xml', data: documentXml },
    { path: 'word/styles.xml', data: stylesXml() },
    { path: 'word/_rels/document.xml.rels', data: docRels },
    { path: 'docProps/core.xml', data: coreXml },
    { path: 'docProps/app.xml', data: appXml },
    ...images.map(image => ({ path: `word/media/${image.name}`, data: image.bytes })),
  ];
  return parts;
}

/** 用注入的 JSZip 构造器把部件打包成 .docx 字节。返回 Uint8Array。 */
export async function buildDocxBytes(JSZip, model) {
  if (!JSZip) throw new Error('打包库不可用');
  // 浏览器 UMD 挂的是构造器；某些打包环境会包一层 default，这里做兼容
  const Ctor = typeof JSZip === 'function' ? JSZip : (JSZip.default || JSZip.JSZip);
  if (typeof Ctor !== 'function') throw new Error('打包库构造器不可用');
  const zip = new Ctor();
  for (const part of buildDocxParts(model)) zip.file(part.path, part.data);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/* ---------------- 浏览器端流程 ---------------- */

function localLibs(keys) {
  const map = { pdfjs: () => window.pdfjsLib, jszip: () => window.JSZip };
  const out = {};
  for (const key of keys) {
    const value = map[key]();
    if (!value) { toast(`本地库未加载：vendor/${key}`, 'warn'); return null; }
    out[key] = value;
  }
  try { out.pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js'; } catch { /* 已预置 */ }
  return out;
}

const canvasToPngBytes = async canvas => {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('页面图片生成失败');
  return new Uint8Array(await blob.arrayBuffer());
};

const pdfToWord = {
  id: 'pdf-to-word', name: 'PDF 转 Word', category: 'pdf',
  desc: '按文本层重排为可编辑 docx，扫描页自动转为图片',
  keywords: ['PDF', 'Word', 'docx', '转换', '可编辑', '文本层', 'OOXML'],
  steps: [
    '选择一个 PDF（单次最多 40 页 / 40 MB）',
    '选转换方式：自动 / 仅文本 / 整页图片',
    '点「转换并下载 .docx」，有文本层的页面输出可编辑文字',
  ],
  faq: [
    ['扫描件能转成文字吗？', '不能。无文本层的页面整页渲染成图片嵌入，不做 OCR。'],
    ['版式能完全还原吗？', '不能。这是近似版面重建，多栏、表格、脚注、公式不完整还原。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'application/pdf,.pdf' });
    const mode = sel([
      { value: 'auto', label: '自动（有文本取文字，无文本用图片）' },
      { value: 'text', label: '仅文本层（可编辑）' },
      { value: 'image', label: '整页图片（保真但不可编辑）' },
    ], 'auto', null);
    const scale = sel([
      { value: '1.2', label: '1.2×（较快）' },
      { value: '1.6', label: '1.6×（推荐）' },
      { value: '2', label: '2.0×（更清晰）' },
    ], '1.6', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const preview = el('div', { class: 'palette-grid' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('pdf-to-word', picker);
    if (banner) root.append(banner);
    let plainText = '';

    const convert = async () => {
      const lib = localLibs(['pdfjs', 'jszip']);
      if (!lib) { output.set('本地 PDF / 打包库不可用'); return; }
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 PDF 文件'); return; }
      if (file.size > MAX_BYTES) { output.set(`文件超过 ${formatBytes(MAX_BYTES)} 上限，请先拆分`); return; }

      status.textContent = '正在本机解析…';
      preview.replaceChildren();
      const report = [];
      const blocks = [];
      let textPages = 0, imagePages = 0, lineCount = 0, charCount = 0;
      try {
        const pdf = await lib.pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const limit = Math.min(pdf.numPages, MAX_PAGES);
        for (let i = 1; i <= limit; i += 1) {
          const page = await pdf.getPage(i);
          if (i > 1) blocks.push({ kind: 'pageBreak' });

          const wantImage = mode.value === 'image';
          const content = wantImage ? null : await page.getTextContent();
          const hasText = content && content.items && content.items.some(item => item.str && item.str.trim());

          if (hasText && mode.value !== 'image') {
            const layout = layoutTextContent(content.items);
            lineCount += layout.lineCount;
            charCount += layout.charCount;
            textPages += 1;
            if (layout.blocks.length) blocks.push(...layout.blocks);
            else blocks.push({ kind: 'paragraph', lines: [{ runs: [{ text: '', bold: false, italic: false, size: 0 }] }] });
            plainText += (plainText ? '\n\n' : '') + `── 第 ${i} 页 ──\n` +
              content.items.map(item => item.str).join(' ').replace(/\s{3,}/g, '\n');
            report.push(`第 ${i} 页  文本层  ${layout.lineCount} 行 / ${layout.blocks.length} 段`);
          } else {
            const canvas = await renderPdfPage(page, num(scale.value, 1.6));
            const bytes = await canvasToPngBytes(canvas);
            const viewport = page.getViewport({ scale: 1 });
            // pt → EMU(1pt=12700)，并等比缩放到 A4 可打印区域内
            const maxCx = 5700000, maxCy = 8000000;
            let cx = Math.round(viewport.width * 12700);
            let cy = Math.round(viewport.height * 12700);
            const ratio = Math.min(1, maxCx / cx, maxCy / cy);
            cx = Math.max(1, Math.round(cx * ratio));
            cy = Math.max(1, Math.round(cy * ratio));
            blocks.push({
              kind: 'image', name: `page-${String(i).padStart(3, '0')}.png`,
              bytes, cx, cy,
            });
            imagePages += 1;
            report.push(`第 ${i} 页  图片页  ${canvas.width}×${canvas.height}`);
            if (imagePages <= 4) {
              const blob = new Blob([bytes], { type: 'image/png' });
              preview.append(el('img', { class: 'palette-chip', src: URL.createObjectURL(blob), title: `第 ${i} 页（图片型）` }));
            }
          }
          status.textContent = `处理中 ${i}/${limit}…`;
        }

        const bytes = await buildDocxBytes(lib.jszip, {
          title: file.name.replace(/\.[^.]+$/, ''), blocks,
        });
        const outName = `${file.name.replace(/\.[^.]+$/, '')}.docx`;
        downloadBlob(new Blob([bytes], { type: DOCX_MIME }), outName);
        offerNextSteps(nextBox, new File([bytes], outName, { type: DOCX_MIME }), 'pdf-to-word');

        output.set([
          `源文件    ${file.name}  ${formatBytes(file.size)}`,
          `页数      ${pdf.numPages}（本次处理前 ${limit} 页）`,
          `文本页    ${textPages} 页  ${lineCount} 行 / ${charCount} 字符`,
          `图片页    ${imagePages} 页`,
          `段落/块   ${blocks.length}`,
          `输出      ${formatBytes(bytes.length)}`,
          '',
          ...report,
          '',
          '实现方式：读取 PDF 文本层与坐标 → 自写规则重排段落 / 标题 / 列表 → 生成 OOXML 的 .docx。',
          '可编辑文字只来自文本层；扫描页以整页图片嵌入，不做 OCR。',
          imagePages ? '图片页可查看但不可编辑；复杂版式（多栏、表格、脚注、公式）不会完整还原。' : '',
          pdf.numPages > limit ? `注意：单次最多处理 ${MAX_PAGES} 页，剩余 ${pdf.numPages - limit} 页未转换。` : '',
        ].filter(Boolean).join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`转换失败：${error.message}\n加密、受损或使用特殊嵌入字体的 PDF 可能无法解析。`);
        status.textContent = '';
      }
    };

    root.append(panel('选择 PDF', picker,
      el('div', { class: 'inline-fields' }, labeled('转换方式', mode), labeled('图片页清晰度', scale)),
      actions(btn('转换并下载 .docx', convert, 'primary'),
        btn('复制提取文本', () => copyText(plainText)),
        btn('下载 TXT', () => downloadText(plainText + '\n', 'pdf-text.txt'))),
      preview, output.node, status, nextBox,
      hint('全程在本机完成：pdf.js 读文本层、自写规则重排、JSZip 打包 docx。单次最多 40 页 / 40 MB；不上传文件、不做 OCR、不使用任何第三方转换引擎。')));
  },
};

export const pdfToWordTools = [pdfToWord];

/* PDF / 文档类：依赖本地 vendor 的 pdf.js(Apache-2.0)、pdf-lib(MIT)、JSZip(MIT)。
   所有库全局只在点击后检查，缺失时给出提示，不影响其他工具。 */
import {
  panel, inp, sel, filePicker, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadBlob, downloadText, formatBytes, escapeHtml,
} from '../../core/ui.js';
import {
  num, clamp, pad, pdfjs, renderPdfPage, makeCanvas, zipBlobs,
} from './shared.js';
import { handoffBanner, nextStepsBox, offerNextSteps } from '../../core/handoff.js';

function libs(which = []) {
  const globals = {
    pdfjs: () => window.pdfjsLib,
    pdfLib: () => window.PDFLib,
    jszip: () => window.JSZip,
  };
  const out = {};
  for (const key of which) {
    const value = globals[key]();
    if (!value) { toast(`本地库未加载：vendor/${key}`, 'warn'); return null; }
    out[key] = value;
  }
  if (out.pdfjs) {
    try { out.pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js'; } catch { /* noop */ }
  }
  return out;
}

const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

const pdfToImage = {
  id: 'pdf-to-image', name: 'PDF 转图片', category: 'pdf',
  desc: '逐页渲染为 PNG / JPEG 并打包下载', keywords: ['PDF', '图片', '渲染', '导出', '页面'],
  steps: [
    '选择一个 PDF',
    '选输出格式（PNG 无损 / JPEG 更小）与渲染缩放',
    '点「渲染并打包」，逐页导出并打包 ZIP 下载',
  ],
  faq: [
    ['一次能导出多少页？', '单次最多 30 页，超出部分会在结果里注明。'],
    ['导出的图片能搜索文字吗？', '不能。输出是位图，不含文本层。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'application/pdf,.pdf' });
    const format = sel([{ value: 'image/png', label: 'PNG（无损）' }, { value: 'image/jpeg', label: 'JPEG（更小）' }], 'image/jpeg', null);
    const scale = sel([{ value: '1', label: '1.0×' }, { value: '1.5', label: '1.5×' }, { value: '2', label: '2.0×' }], '1.5', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const preview = el('div', { class: 'palette-grid' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('pdf-to-image', picker);
    if (banner) root.append(banner);

    const run = async () => {
      const lib = libs(['pdfjs']);
      if (!lib) { output.set('本地 PDF 渲染库不可用'); return; }
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 PDF'); return; }
      status.textContent = '正在本机渲染…';
      try {
        const pdf = await lib.pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const type = format.value, ext = type === 'image/png' ? 'png' : 'jpg';
        const entries = [], lines = [];
        preview.replaceChildren();
        const limit = Math.min(pdf.numPages, 30);
        for (let i = 1; i <= limit; i += 1) {
          const page = await pdf.getPage(i);
          const canvas = await renderPdfPage(page, num(scale.value, 1.5));
          const blob = await toBlob(canvas, type, 0.9);
          if (!blob) throw new Error('导出图像失败');
          entries.push([`page-${pad(i, 3)}.${ext}`, blob]);
          lines.push(`第 ${pad(i, 3)} 页  ${canvas.width}×${canvas.height}  ${formatBytes(blob.size)}`);
          if (i <= 6) preview.append(el('img', { class: 'palette-chip', src: URL.createObjectURL(blob), title: `第 ${i} 页` }));
          status.textContent = `渲染中 ${i}/${limit}…`;
        }
        await zipBlobs(entries, 'pdf-pages.zip');
        if (entries.length === 1) {
          offerNextSteps(nextBox, new File([entries[0][1]], entries[0][0], { type }), 'pdf-to-image');
        }
        output.set([
          `文件  ${file.name}  ${formatBytes(file.size)}`,
          `页数  ${pdf.numPages}（本次导出前 ${limit} 页）`,
          `格式  ${type}  缩放 ${scale.value}×`,
          '', ...lines,
          pdf.numPages > limit ? `\n注意：单次最多导出 30 页，剩余 ${pdf.numPages - limit} 页未导出。` : '',
        ].filter(Boolean).join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`渲染失败：${error.message}\n加密、受损或使用特殊字体的 PDF 可能无法解析。`);
        status.textContent = '';
      }
    };
    root.append(panel('PDF 转图片', picker,
      el('div', { class: 'inline-fields' }, labeled('输出格式', format), labeled('渲染缩放', scale)),
      actions(btn('渲染并打包', run, 'primary')),
      preview, output.node, status, nextBox,
      hint('由本地 pdf.js 逐页绘制到 Canvas；图片型输出不含可搜索文本层，单次最多 30 页。')));
  },
};

const compressPdf = {
  id: 'compress-pdf', name: '压缩 PDF', category: 'pdf',
  desc: '重渲染为 JPEG 后重组，降低扫描件体积', keywords: ['PDF', '压缩', '体积', '重渲染'],
  steps: [
    '选择一个 PDF',
    '调 JPEG 质量与渲染倍率',
    '点「压缩并下载」，对比原始与输出体积',
  ],
  faq: [
    ['为什么压缩后反而变大？', '这是重渲染压缩：纯文字 PDF 原本很小，变成图片后可能更大；对扫描件通常明显变小。'],
    ['文字还能选中吗？', '不能。页面变成图片，文本层丢失——这是有损方案，页内已明示。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'application/pdf,.pdf' });
    const quality = inp({ type: 'range', min: '0.3', max: '0.95', step: '0.05', value: '0.65' });
    const scale = sel([{ value: '1', label: '1.0×（原尺寸）' }, { value: '0.8', label: '0.8×' }, { value: '1.2', label: '1.2×' }], '1', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('compress-pdf', picker);
    if (banner) root.append(banner);

    const run = async () => {
      const lib = libs(['pdfjs', 'pdfLib']);
      if (!lib) { output.set('本地 PDF 库不可用'); return; }
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 PDF'); return; }
      status.textContent = '正在本机重渲染…';
      try {
        const src = await lib.pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const out = await lib.pdfLib.PDFDocument.create();
        const q = num(quality.value, 0.65);
        const limit = Math.min(src.numPages, 30);
        for (let i = 1; i <= limit; i += 1) {
          const page = await src.getPage(i);
          const canvas = await renderPdfPage(page, num(scale.value, 1) * 1.333);
          const jpg = await toBlob(canvas, 'image/jpeg', q);
          if (!jpg) throw new Error('JPEG 编码失败');
          const embedded = await out.embedJpg(await jpg.arrayBuffer());
          const pt = page.getViewport({ scale: 1 });
          const pdfPage = out.addPage([pt.width, pt.height]);
          pdfPage.drawImage(embedded, { x: 0, y: 0, width: pt.width, height: pt.height });
          status.textContent = `重渲染 ${i}/${limit}…`;
        }
        const bytes = await out.save();
        const outName = `${file.name.replace(/\.[^.]+$/, '')}-compressed.pdf`;
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
        offerNextSteps(nextBox, new File([bytes], outName, { type: 'application/pdf' }), 'compress-pdf');
        const saved = file.size - bytes.length;
        output.set([
          `源文件    ${file.name}  ${formatBytes(file.size)}`,
          `页数      ${src.numPages}（本次处理前 ${limit} 页）`,
          `JPEG 质量 ${(q * 100).toFixed(0)}%`,
          `输出      ${formatBytes(bytes.length)}`,
          `体积变化  ${saved >= 0 ? '减少' : '增加'} ${formatBytes(Math.abs(saved))}（${(bytes.length / file.size * 100).toFixed(1)}%）`,
          '',
          '这是「重渲染压缩」：页面变成图片，文本层会丢失、文字不再可搜索 / 可选中。',
          '对扫描件 / 图片型 PDF 通常明显变小；对纯文字 PDF 可能反而变大，属正常现象。',
        ].join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`压缩失败：${error.message}`);
        status.textContent = '';
      }
    };
    root.append(panel('重渲染压缩', picker,
      el('div', { class: 'inline-fields' }, labeled('JPEG 质量', quality), labeled('渲染倍率', scale)),
      actions(btn('压缩并下载', run, 'primary')),
      output.node, status, nextBox,
      hint('有损方案：先用 pdf.js 画成 JPEG，再用 pdf-lib 重组 PDF。无法保留文本层与矢量图形。')));
  },
};

/* docx / xlsx / pptx 都是 zip，用 JSZip 读取内部 XML 抽取文本。 */
async function readOfficeText(file) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('本地 JSZip 未加载');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const xmlText = async name => {
    const entry = zip.file(name);
    return entry ? parser.parseFromString(await entry.async('string'), 'application/xml') : null;
  };
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.docx')) {
    const doc = await xmlText('word/document.xml');
    if (!doc) throw new Error('未找到 word/document.xml');
    const paras = [...doc.getElementsByTagName('w:p')];
    return paras.map(p => [...p.getElementsByTagName('w:t')].map(t => t.textContent).join('')).filter(Boolean).join('\n');
  }
  if (lower.endsWith('.xlsx')) {
    const shared = await xmlText('xl/sharedStrings.xml');
    const strings = shared ? [...shared.getElementsByTagName('si')]
      .map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    const names = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
    const blocks = [];
    for (const name of names) {
      const sheet = await xmlText(name);
      if (!sheet) continue;
      blocks.push(`── ${name.split('/').pop()} ──`);
      for (const row of [...sheet.getElementsByTagName('row')]) {
        const cells = [...row.getElementsByTagName('c')].map(c => {
          const value = c.getElementsByTagName('v')[0];
          const inline = c.getElementsByTagName('is')[0];
          let text = value ? value.textContent : '';
          if (c.getAttribute('t') === 's') text = strings[Number(text)] || '';
          if (inline) text = [...inline.getElementsByTagName('t')].map(t => t.textContent).join('');
          return text;
        });
        blocks.push(cells.join('\t'));
      }
    }
    return blocks.join('\n');
  }
  if (lower.endsWith('.pptx')) {
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]));
    const blocks = [];
    for (const name of names) {
      const slide = await xmlText(name);
      if (!slide) continue;
      blocks.push(`── ${name.split('/').pop()} ──`);
      blocks.push([...slide.getElementsByTagName('a:t')].map(t => t.textContent).join('\n'));
    }
    return blocks.join('\n');
  }
  throw new Error('不支持的 Office 格式');
}

const wordToPdf = {
  id: 'word-to-pdf', name: 'Word 转 PDF', category: 'pdf',
  desc: '读取 docx 文字，按 A4 排版成图片型 PDF', keywords: ['Word', 'docx', 'PDF', '转换', '排版'],
  steps: [
    '选择一个 .docx 文件',
    '调正文字号',
    '点「转换并下载」，按 A4 排版输出 PDF',
  ],
  faq: [
    ['保留原格式吗？', '不保留。只提取段落文字重新排版，字体、表格、图片、页眉页脚不保留。'],
    ['输出能搜索吗？', '不能。页面以 JPEG 嵌入，是图片型 PDF。'],
  ],
  render(root) {
    const picker = filePicker({ accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const fontSize = inp({ type: 'range', min: '14', max: '30', value: '20' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const preview = el('div', { class: 'palette-grid' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('word-to-pdf', picker);
    if (banner) root.append(banner);

    const run = async () => {
      const lib = libs(['jszip', 'pdfLib']);
      if (!lib) { output.set('本地库不可用'); return; }
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 .docx 文件'); return; }
      status.textContent = '正在本机解析与排版…';
      try {
        const text = await readOfficeText(file);
        if (!text.trim()) throw new Error('文档中没有可提取的文字');
        const W = 794, H = 1123, margin = 64, lineHeight = Number(fontSize.value) * 1.9;
        const font = `${fontSize.value}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        const pages = [];
        let canvas = makeCanvas(W, H), ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#17171a'; ctx.font = font; ctx.textBaseline = 'top';
        let y = margin;
        const newPage = () => {
          pages.push(canvas);
          canvas = makeCanvas(W, H);
          ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#17171a'; ctx.font = font; ctx.textBaseline = 'top';
          y = margin;
        };
        for (const paragraph of text.split('\n')) {
          if (!paragraph.trim()) { y += lineHeight * 0.6; continue; }
          let line = '';
          for (const ch of paragraph) {
            if (ctx.measureText(line + ch).width > W - margin * 2) {
              ctx.fillText(line, margin, y); y += lineHeight; line = ch;
              if (y > H - margin - lineHeight) newPage();
            } else line += ch;
          }
          if (line) { ctx.fillText(line, margin, y); y += lineHeight; }
          if (y > H - margin - lineHeight) newPage();
        }
        if (y > margin) pages.push(canvas);
        const pdf = await lib.pdfLib.PDFDocument.create();
        preview.replaceChildren();
        for (let i = 0; i < pages.length; i += 1) {
          const jpg = await toBlob(pages[i], 'image/jpeg', 0.92);
          const embedded = await pdf.embedJpg(await jpg.arrayBuffer());
          const page = pdf.addPage([595, 842]);
          page.drawImage(embedded, { x: 0, y: 0, width: 595, height: 842 });
          if (i < 4) preview.append(el('img', { class: 'palette-chip', src: URL.createObjectURL(jpg), title: `第 ${i + 1} 页` }));
        }
        const bytes = await pdf.save();
        const outName = `${file.name.replace(/\.[^.]+$/, '')}.pdf`;
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
        offerNextSteps(nextBox, new File([bytes], outName, { type: 'application/pdf' }), 'word-to-pdf');
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `文字    ${text.length} 字符 / ${text.split('\n').filter(x => x.trim()).length} 段`,
          `页数    ${pages.length}`,
          `输出    ${formatBytes(bytes.length)}`,
          '',
          '简化实现：只提取 docx 的段落文字并按 A4 排版，页面以 JPEG 嵌入 PDF。',
          '不保留字体、字号、表格、图片、页眉页脚与超链接；文字不可搜索。复杂版式请用专业软件。',
        ].join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`转换失败：${error.message}`);
        status.textContent = '';
      }
    };
    root.append(panel('Word 转 PDF', picker,
      el('div', { class: 'inline-fields' }, labeled('正文字号', fontSize)),
      actions(btn('转换并下载', run, 'primary')),
      preview, output.node, status, nextBox,
      hint('用 JSZip 读取 docx 内部 XML，再用 Canvas 排版、pdf-lib 组装；中文依赖系统字体。')));
  },
};

const extractText = {
  id: 'extract-text', name: '提取文本', category: 'text',
  desc: '从 PDF / docx / xlsx / pptx / 纯文本里取文字', keywords: ['提取文本', 'PDF', 'docx', 'OCR', '文档'],
  steps: [
    '选择 PDF / docx / xlsx / pptx / 纯文本等文件',
    '点「提取文本」',
    '预览、复制全文或下载 TXT / HTML',
  ],
  faq: [
    ['扫描件能提取吗？', '不能。只读 PDF 文本层，不做 OCR。'],
    ['一次提取多少页？', 'PDF 单次最多 50 页。'],
  ],
  render(root) {
    const picker = filePicker({ accept: '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.md,.json,.xml,.html,.srt,.vtt' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const banner = handoffBanner('extract-text', picker);
    if (banner) root.append(banner);
    let text = '';

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择文件'); return; }
      const lower = file.name.toLowerCase();
      status.textContent = '正在本机提取…';
      try {
        if (lower.endsWith('.pdf')) {
          const lib = libs(['pdfjs']);
          if (!lib) { output.set('本地 PDF 库不可用'); return; }
          const pdf = await lib.pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
          const blocks = [];
          for (let i = 1; i <= Math.min(pdf.numPages, 50); i += 1) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            blocks.push(`── 第 ${i} 页 ──\n${content.items.map(item => item.str).join(' ').replace(/\s{3,}/g, '\n')}`);
            status.textContent = `提取中 ${i}/${Math.min(pdf.numPages, 50)}…`;
          }
          text = blocks.join('\n\n');
        } else if (/\.(docx|xlsx|pptx)$/.test(lower)) {
          const lib = libs(['jszip']);
          if (!lib) { output.set('本地 JSZip 不可用'); return; }
          text = await readOfficeText(file);
        } else {
          text = await file.text();
          if (/\.(html?|xml)$/.test(lower)) text = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n');
        }
        output.set(text.length > 20000 ? `${text.slice(0, 20000)}\n\n…（预览截断，复制/下载为完整内容）` : (text || '（未提取到文本）'));
        status.textContent = `提取到 ${text.length} 字符`;
      } catch (error) {
        output.set(`提取失败：${error.message}`);
        status.textContent = '';
      }
    };
    root.append(panel('选择文件', picker,
      actions(btn('提取文本', run, 'primary'), btn('复制全文', () => copyText(text)),
        btn('下载 TXT', () => downloadText(text + '\n', 'extracted.txt')),
        btn('下载 HTML', () => downloadText(
          `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>提取结果</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`,
          'extracted.html', 'text/html;charset=utf-8'))),
      output.node, status,
      hint('PDF 读取的是文本层（扫描件无文本层时无法提取，不做 OCR）；Office 读取内部 XML 文字，不含图片与复杂排版。')));
  },
};

export const pdfExtraTools = [pdfToImage, compressPdf, wordToPdf, extractText];

import {
  panel, filePicker, btn, actions, resultBox, hint, downloadBlob, toast, el, readDataURL, loadImage, formatBytes,
} from '../../core/ui.js';
import { handoffBanner, nextStepsBox, offerNextSteps } from '../../core/handoff.js';

/* 使用本地 vendor/pdf-lib/pdf-lib.min.js（MIT），不联网、不上传文件。 */
function pdfLib() {
  const lib = typeof window !== 'undefined' ? window.PDFLib : null;
  if (!lib) {
    toast('本地 PDF 库未加载，请检查 vendor/pdf-lib', 'warn');
    return null;
  }
  return lib;
}

async function imageToJpegDataUrl(file) {
  const src = await readDataURL(file);
  const image = await loadImage(src);
  const canvas = el('canvas', { width: image.width, height: image.height });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return { data: canvas.toDataURL('image/jpeg', 0.92), width: image.width, height: image.height };
}

const imageToPdf = {
  id: 'image-to-pdf',
  name: '图片转 PDF',
  category: 'pdf',
  desc: '把多张图片按原尺寸合成一个 PDF',
  keywords: ['图片', 'PDF', '合成', 'jpg', 'png'],
  steps: [
    '选择一张或多张图片（PNG / JPEG / WebP 等浏览器可解码格式）',
    '点「生成 PDF」，每张图片按原尺寸成为一页',
    '结果自动下载；在「接着处理」里可直接交给压缩、合并等下一步',
  ],
  faq: [
    ['透明背景怎么处理？', '图片先经 Canvas 转为 JPEG，透明区域补白底。'],
    ['页面尺寸是多少？', '每页与对应图片的像素尺寸一致，不做统一缩放。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('image-to-pdf', picker, { multiple: true });
    if (banner) root.append(banner);

    const run = async () => {
      const lib = pdfLib();
      if (!lib) { output.set('本地 PDF 库不可用'); return; }
      const files = [...(picker.files || [])];
      if (!files.length) { output.set('请先选择图片'); return; }
      status.textContent = '正在本机合成…';
      try {
        const pdf = await lib.PDFDocument.create();
        const lines = [];
        for (const file of files) {
          const { data, width, height } = await imageToJpegDataUrl(file);
          const image = await pdf.embedJpg(data);
          const page = pdf.addPage([width, height]);
          page.drawImage(image, { x: 0, y: 0, width, height });
          lines.push(`${file.name}  ${width}×${height}  ${formatBytes(file.size)}`);
        }
        const bytes = await pdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadBlob(blob, 'images.pdf');
        offerNextSteps(nextBox, new File([bytes], 'images.pdf', { type: 'application/pdf' }), 'image-to-pdf');
        lines.push('', `共 ${files.length} 页，输出 ${formatBytes(bytes.length)}`);
        output.set(lines.join('\n'));
        status.textContent = '已生成并下载';
      } catch (error) {
        status.textContent = '';
        output.set(`合成失败：${error.message}`);
        toast('合成失败', 'warn');
      }
    };

    root.append(panel('选择图片', picker,
      actions(btn('生成 PDF', run, 'primary')),
      output.node, status, nextBox,
      hint('图片先经 Canvas 转为 JPEG 再嵌入，透明区域补白底；全程在本机完成。')));
  },
};

const mergePdf = {
  id: 'merge-pdf',
  name: '合并 PDF',
  category: 'pdf',
  desc: '按顺序把多个 PDF 合成一个文件',
  keywords: ['PDF', '合并', 'merge', '文档'],
  steps: [
    '选择两个或更多 PDF 文件',
    '按选择顺序合并为一个文档',
    '结果自动下载，可接着压缩或提取文本',
  ],
  faq: [
    ['合并顺序怎么定？', '按文件选择顺序；需要调整时重新按目标顺序选择。'],
    ['加密 PDF 能合并吗？', '加密或受损的 PDF 可能无法读取，会给出失败提示。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'application/pdf,.pdf', multiple: true });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const nextBox = nextStepsBox();
    const banner = handoffBanner('merge-pdf', picker, { multiple: true });
    if (banner) root.append(banner);

    const run = async () => {
      const lib = pdfLib();
      if (!lib) { output.set('本地 PDF 库不可用'); return; }
      const files = [...(picker.files || [])];
      if (files.length < 2) { output.set('请至少选择两个 PDF 文件'); return; }
      status.textContent = '正在本机合并…';
      try {
        const merged = await lib.PDFDocument.create();
        const lines = [];
        for (const file of files) {
          const source = await lib.PDFDocument.load(await file.arrayBuffer());
          const pages = await merged.copyPages(source, source.getPageIndices());
          pages.forEach(page => merged.addPage(page));
          lines.push(`${file.name}  ${pages.length} 页  ${formatBytes(file.size)}`);
        }
        const bytes = await merged.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadBlob(blob, 'merged.pdf');
        offerNextSteps(nextBox, new File([bytes], 'merged.pdf', { type: 'application/pdf' }), 'merge-pdf');
        lines.push('', `合计 ${merged.getPageCount()} 页，输出 ${formatBytes(bytes.length)}`);
        output.set(lines.join('\n'));
        status.textContent = '已生成并下载';
      } catch (error) {
        status.textContent = '';
        output.set(`合并失败：${error.message}`);
        toast('合并失败', 'warn');
      }
    };

    root.append(panel('选择 PDF', picker,
      actions(btn('合并并下载', run, 'primary')),
      output.node, status, nextBox,
      hint('按文件选择顺序合并；加密或受损的 PDF 可能无法读取。')));
  },
};

export const pdfTools = [imageToPdf, mergePdf];

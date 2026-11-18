/* 链式处理：一个工具的结果直接交给下一个兼容工具，不必重新选文件。
   结果只保存在当前标签页的内存里——刷新即清空，不写 localStorage、不上传。
   兼容关系按输出格式声明；下一个工具不接受该格式时不会自动填入。 */
import { el, toast } from './ui.js';
import { glyphNode } from './icons.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* 各工具接受的输入格式（MIME 前缀或扩展名） */
const ACCEPTS = {
  'image-to-pdf': { mimes: ['image/'], exts: [] },
  'merge-pdf': { mimes: ['application/pdf'], exts: ['.pdf'] },
  'compress-pdf': { mimes: ['application/pdf'], exts: ['.pdf'] },
  'pdf-to-image': { mimes: ['application/pdf'], exts: ['.pdf'] },
  'pdf-to-word': { mimes: ['application/pdf'], exts: ['.pdf'] },
  'word-to-pdf': { mimes: [DOCX_MIME], exts: ['.docx'] },
  'extract-text': {
    mimes: ['application/pdf', DOCX_MIME, 'text/'],
    exts: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.md', '.json', '.xml', '.html', '.srt', '.vtt'],
  },
};

/* 链式处理涉及的工具名（避免与注册表形成循环依赖，这里只登记事实） */
const NAMES = {
  'image-to-pdf': '图片转 PDF',
  'merge-pdf': '合并 PDF',
  'compress-pdf': '压缩 PDF',
  'pdf-to-image': 'PDF 转图片',
  'pdf-to-word': 'PDF 转 Word',
  'word-to-pdf': 'Word 转 PDF',
  'extract-text': '提取文本',
};

let pending = null;

export function setHandoff(file, fromId) {
  pending = { file, fromId, fromName: NAMES[fromId] || fromId };
}

export function getHandoff() {
  return pending;
}

export function clearHandoff() {
  pending = null;
}

export function fileAccepted(toolId, file) {
  const rule = ACCEPTS[toolId];
  if (!rule || !file) return false;
  const mime = file.type || '';
  const lower = (file.name || '').toLowerCase();
  return rule.mimes.some(m => mime.startsWith(m)) || rule.exts.some(ext => lower.endsWith(ext));
}

/* 接收端横幅：上一步结果兼容本工具时出现，点「载入文件」写进文件选择框。 */
export function handoffBanner(toolId, picker, { multiple = false } = {}) {
  const handoff = getHandoff();
  if (!handoff || !fileAccepted(toolId, handoff.file)) return null;

  const banner = el('div', { class: 'handoff-bar' },
    glyphNode('bolt'),
    el('div', { class: 'handoff-text' },
      el('strong', { text: `已带入上一步结果：${handoff.file.name}` }),
      el('span', { text: `来自「${handoff.fromName}」，仍留在当前标签页，未上传` })),
    el('div', { class: 'handoff-actions' },
      el('button', {
        class: 'btn btn-primary', type: 'button', text: '载入文件',
        onclick: () => {
          try {
            const transfer = new DataTransfer();
            if (multiple && picker.files) {
              for (const existing of picker.files) transfer.items.add(existing);
            }
            transfer.items.add(handoff.file);
            picker.files = transfer.files;
            picker.dispatchEvent(new Event('change', { bubbles: true }));
            toast('已载入上一步结果', 'ok');
            banner.remove();
          } catch {
            toast('当前浏览器不支持自动载入，请手动选择文件', 'warn');
          }
        },
      }),
      el('button', {
        class: 'btn', type: 'button', text: '忽略',
        onclick: () => banner.remove(),
      })));
  return banner;
}

/* 输出端：结果生成后列出兼容的下一步工具。点击即携带结果跳转。 */
export function nextStepsBox() {
  return el('div', { class: 'next-steps' });
}

export function offerNextSteps(box, file, fromId) {
  box.replaceChildren();
  const next = Object.keys(ACCEPTS).filter(id => id !== fromId && fileAccepted(id, file));
  if (!next.length) return;
  setHandoff(file, fromId);
  box.append(
    el('span', { class: 'next-label' }, glyphNode('arrow'), el('span', { text: '接着处理' })),
    ...next.map(id => el('a', {
      class: 'chip', href: `#/tool/${id}`,
      onclick: () => setHandoff(file, fromId),
    }, el('span', { text: NAMES[id] || id }))),
    el('span', { class: 'next-note', text: '结果只留在当前标签页，可随时下载' }));
}
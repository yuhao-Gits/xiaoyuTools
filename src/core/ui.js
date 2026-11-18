export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

let toastHost = null;

export function toast(message, kind = 'info') {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.append(toastHost);
  }
  const item = el('div', { class: `toast toast-${kind}`, text: message });
  toastHost.append(item);
  setTimeout(() => item.remove(), 2800);
}

export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) {
    toast('没有可复制的内容', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast('已复制到剪贴板', 'ok');
  } catch {
    const area = el('textarea', { value, style: { position: 'fixed', left: '-9999px' } });
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('已复制到剪贴板', 'ok');
    } catch {
      toast('复制失败，请手动选择文本', 'warn');
    }
    area.remove();
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), filename);
}

export function btn(label, onClick, variant = '') {
  return el('button', {
    class: `btn ${variant ? 'btn-' + variant : ''}`,
    type: 'button',
    text: label,
    onclick: onClick,
  });
}

export function txt(props = {}) {
  return el('textarea', { class: 'input textarea', spellcheck: false, ...props });
}

export function inp(props = {}) {
  return el('input', { class: 'input', ...props });
}

export function sel(options, value, onChange) {
  const node = el('select', { class: 'input select' },
    ...options.map(o => el('option', { value: o.value, text: o.label, selected: o.value === value })));
  if (onChange) node.addEventListener('change', event => onChange(event.target.value));
  return node;
}

export function panel(title, ...children) {
  return el('section', { class: 'panel' },
    title ? el('h3', { class: 'panel-title', text: title }) : null,
    ...children);
}

export function actions(...children) {
  return el('div', { class: 'panel-actions' }, ...children);
}

export function hint(text) {
  return el('p', { class: 'hint', text });
}

export function resultBox() {
  const node = el('pre', { class: 'result' });
  node.textContent = '（暂无输出）';
  return {
    node,
    set(value) { node.textContent = value === '' ? '（无输出）' : String(value); },
    clear() { node.textContent = '（暂无输出）'; },
  };
}

export function labeled(label, control) {
  return el('label', { class: 'field' }, el('span', { class: 'field-label', text: label }), control);
}

export function filePicker(props = {}) {
  return inp({ type: 'file', class: 'input file', ...props });
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败'));
    image.src = src;
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), type, quality));
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

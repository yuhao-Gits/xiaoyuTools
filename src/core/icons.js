/* 内联线性图标：全部手写路径，不引用任何图标库或外部字体。
   统一 24×24 视框、1.5px 描边、圆头圆角，跟随 currentColor。 */

export const GLYPHS = {
  home: '<path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.2v-6.2H9.2V21H5a1 1 0 0 1-1-1z"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2.6"/><path d="M8.6 8V6.2a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2V8"/><path d="M3 13.2h18"/><path d="M10.4 13.2v2.4h3.2v-2.4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.4h18"/><circle cx="16.6" cy="14.6" r="1.1"/>',
  pen: '<path d="M4 20h4.2L20 8.2 15.8 4 4 15.8z"/><path d="m13.8 6 4.2 4.2"/><path d="M4 20l.6-3.4"/>',
  gamepad: '<rect x="2.4" y="7" width="19.2" height="10.6" rx="4.6"/><path d="M7 10.6v3.2M5.4 12.2h3.2"/><circle cx="15.8" cy="11.4" r="1"/><circle cx="18" cy="13.8" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 1.9"/>',
  dev: '<path d="M8 7 3.4 12 8 17"/><path d="m16 7 4.6 5L16 17"/><path d="m13.6 4.4-3.2 15.2"/>',
  text: '<path d="M4.5 6.5h15M4.5 12h10.5M4.5 17.5h15"/>',
  calc: '<rect x="4.4" y="2.8" width="15.2" height="18.4" rx="3"/><path d="M8 7.4h8"/><path d="M8.4 12h1.8m3.6 0h1.8M8.4 16.4h1.8m3.6 0h1.8"/>',
  image: '<rect x="3" y="4.4" width="18" height="15.2" rx="3"/><circle cx="8.6" cy="9.6" r="1.5"/><path d="m4.4 17.2 4.8-4.6 3.4 3.2 2.6-2.4 4.4 4.2"/>',
  spark: '<path d="M12 3.4v3.2m0 11.2v3.2M3.4 12h3.2m11.2 0h3.2M5.9 5.9l2.2 2.2m7.8 7.8 2.2 2.2m0-12.2-2.2 2.2m-7.8 7.8-2.2 2.2"/><circle cx="12" cy="12" r="3"/>',
  audio: '<path d="M3 12h2.2l2-5 3 10 3-13.4 3 10.4 2-2h3.8"/>',
  video: '<rect x="3" y="5.4" width="18" height="13.2" rx="3"/><path d="m10.4 9.6 4.6 2.4-4.6 2.4z"/>',
  pdf: '<path d="M6.4 3h7.2L18 7.4V21H6.4z"/><path d="M13.6 3v4.4H18"/><path d="M9.2 13.4h5.6M9.2 17h3.6"/>',
  cpu: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4"/><path d="M9.4 2.6v3.8m5.2-3.8v3.8M9.4 17.6v3.8m5.2-3.8v3.8M2.6 9.4h3.8m-3.8 5.2h3.8M17.6 9.4h3.8m-3.8 5.2h3.8"/><circle cx="12" cy="12" r="1.8"/>',
  roadmap: '<path d="M4.5 6.4h12.4M4.5 12h9.6M4.5 17.6h11.4"/><circle cx="19.2" cy="6.4" r="1.5"/><circle cx="16.6" cy="12" r="1.5"/><circle cx="18.4" cy="17.6" r="1.5"/>',
  heart: '<path d="M12 20.2s-7.4-4.5-7.4-9.5A4.1 4.1 0 0 1 12 8.3a4.1 4.1 0 0 1 7.4 2.4c0 5-7.4 9.5-7.4 9.5z"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.4 4.4"/>',
  rows: '<rect x="4" y="5" width="16" height="4.6" rx="1.6"/><rect x="4" y="14.4" width="16" height="4.6" rx="1.6"/>',
  dense: '<rect x="4" y="5" width="16" height="2.6" rx="1.3"/><rect x="4" y="10.7" width="16" height="2.6" rx="1.3"/><rect x="4" y="16.4" width="16" height="2.6" rx="1.3"/>',
  arrow: '<path d="M4.8 12h14.4m-5.8-5.8L19.2 12l-5.8 5.8"/>',
  arrowUp: '<path d="M7 17 17 7M8.4 7h8.6v8.6"/>',
  back: '<path d="M19 12H5m6.2 6.2L5 12l6.2-6.2"/>',
  down: '<path d="M12 4.6v14.8m-6-6L12 19.4l6-5.8"/>',
  dice: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4"/><circle cx="8.6" cy="8.6" r="1"/><circle cx="15.4" cy="15.4" r="1"/><circle cx="12" cy="12" r="1"/>',
  moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.4m0 14v2.4M2.6 12H5m14 0h2.4M5.4 5.4l1.7 1.7m9.8 9.8 1.7 1.7m0-13.2-1.7 1.7m-9.8 9.8-1.7 1.7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  bolt: '<path d="M13.4 3 5.6 13.4h5.2L10 21l8-10.6h-5.2z"/>',
  shield: '<path d="M12 3.4 19 6v6c0 4.4-3 7.2-7 8.6-4-1.4-7-4.2-7-8.6V6z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
  book: '<path d="M4 5.4A2 2 0 0 1 6 3.4h12.6v17.2H6a2 2 0 0 0-2 2z"/><path d="M4 5.4v15.2"/><path d="M8 8h6.6M8 12h6.6"/>',
};

export function glyphNode(name, extraClass = '') {
  const span = document.createElement('span');
  span.className = `glyph ${extraClass}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] || GLYPHS.grid}</svg>`;
  return span;
}

export const CATEGORY_GLYPH = {
  dev: 'dev',
  text: 'text',
  calc: 'calc',
  image: 'image',
  time: 'clock',
  creative: 'spark',
  audio: 'audio',
  video: 'video',
  pdf: 'pdf',
};

/* 二次开发共享助手：所有实现均为本项目独立编写，只调用浏览器标准 API。
   被各分类模块复用；不依赖任何第三方库（库能力由调用方按需检查 vendor 全局）。 */
import {
  el, readDataURL, loadImage, downloadBlob, toast,
} from '../../core/ui.js';

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
export const pad = (n, size = 2) => String(n).padStart(size, '0');
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const clockText = ms => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
};
export const dateText = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const money = n => `¥ ${n.toFixed(2)}`;

export function makeCanvas(width, height) {
  return el('canvas', { width, height });
}

/* 读文件为 HTMLImageElement 并画到指定尺寸的 canvas，返回 canvas。 */
export async function canvasFromImageFile(file, opts = {}) {
  const image = await loadImage(await readDataURL(file));
  const max = opts.max || 0;
  const ratio = max ? Math.min(1, max / Math.max(image.width, image.height)) : 1;
  const width = Math.max(1, Math.round((opts.width || image.width * ratio)));
  const height = Math.max(1, Math.round((opts.height || image.height * ratio)));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

export function downloadCanvas(canvas, filename, type = 'image/png', quality = 0.92) {
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, filename);
    else toast('导出失败：浏览器未生成图像数据', 'warn');
  }, type, quality);
}

export function pixelIndex(r, g, b) {
  return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
}

/* ---------- CSV ---------- */
export function parseCsv(text, sep = ',') {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const src = String(text || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/* ---------- 字幕 ---------- */
export function parseCues(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const blocks = src.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const cues = [];
  const time = s => {
    const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/);
    if (!m) return null;
    return ((Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000
      + Number(m[4].padEnd(3, '0'));
  };
  for (const block of blocks) {
    const lines = block.split('\n');
    const lineIndex = lines.findIndex(l => l.includes('-->'));
    if (lineIndex < 0) continue;
    const [a, b] = lines[lineIndex].split('-->');
    const start = time(a || ''), end = time(b || '');
    if (start === null || end === null) continue;
    let content = lines.slice(lineIndex + 1).join('\n').trim();
    if (!content && lineIndex > 0 && !/^\d+$/.test(lines[0])) content = lines.slice(0, lineIndex).join('\n');
    cues.push({ start, end, text: content });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function cueStamp(ms, sep = ',', withHours = true) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const milli = Math.floor(ms % 1000);
  return (withHours ? `${pad(h)}:` : '') + `${pad(m)}:${pad(s)}${sep}${String(milli).padStart(3, '0')}`;
}

export function formatCues(cues, kind = 'srt') {
  const sep = kind === 'vtt' ? '.' : ',';
  const head = kind === 'vtt' ? 'WEBVTT\n\n' : '';
  return head + cues.map((c, i) => {
    const start = cueStamp(c.start, sep);
    const end = cueStamp(c.end, sep);
    if (kind === 'vtt') return `${start} --> ${end}\n${c.text}`;
    if (kind === 'lrc') return `[${pad(Math.floor(c.start / 60000))}:${pad(Math.floor(c.start / 1000) % 60)}.${String(Math.floor(c.start % 1000 / 10)).padStart(2, '0')}]${c.text.replace(/\n/g, ' ')}`;
    return `${i + 1}\n${start} --> ${end}\n${c.text}`;
  }).join(kind === 'lrc' ? '\n' : '\n\n') + '\n';
}

/* ---------- 音频 ---------- */
export function audioContext() {
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!Ctor) { toast('当前浏览器不支持 Web Audio', 'warn'); return null; }
  return new Ctor();
}

export async function decodeAudioFile(file) {
  const ctx = audioContext();
  if (!ctx) return null;
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  await ctx.close();
  return buffer;
}

export function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const length = buffer.length;
  const bytes = 44 + length * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (off, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, length * channels * 2, true);
  const data = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const s = clamp(data[c][i], -1, 1);
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/* ---------- GIF 编码器（自行实现的 GIF89a + LZW，避免 LGPL 编码器） ----------
   采用 3-3-2 全局色表；字典上限 510 使码长恒为 9 位，编码器与解码器严格同步。 */
function lzwEncode(indices) {
  const clear = 256, eoi = 257, maxCode = 510;
  const out = [];
  let dict = new Map(), next = 258, acc = 0, bits = 0;
  const emit = code => {
    acc |= code << bits;
    bits += 9;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  };
  const reset = () => { dict = new Map(); next = 258; };
  const codeOf = key => key.includes(',') ? dict.get(key) : Number(key);
  emit(clear);
  if (!indices.length) {
    emit(eoi);
    if (bits > 0) out.push(acc & 255);
    return out;
  }
  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i += 1) {
    const key = String(indices[i]);
    const combined = `${prefix},${key}`;
    if (dict.has(combined)) { prefix = combined; continue; }
    emit(codeOf(prefix));
    if (next < maxCode) dict.set(combined, next++);
    else { emit(clear); reset(); }
    prefix = key;
  }
  emit(codeOf(prefix));
  emit(eoi);
  if (bits > 0) out.push(acc & 255);
  return out;
}

export function encodeGif(frames, width, height, delayCs = 10, opts = {}) {
  const palette = opts.palette || null; // 256×3，0 号固定为透明占位
  const delays = opts.delays || null;
  const nearest = palette ? makeNearestMapper(palette) : null;
  const bytes = [];
  const push = (...values) => { for (const v of values) bytes.push(v & 255); };
  const u16 = n => push(n & 255, (n >> 8) & 255);
  const ascii = s => { for (let i = 0; i < s.length; i += 1) push(s.charCodeAt(i)); };
  ascii('GIF89a');
  u16(width); u16(height);
  push(0xf7, 0, 0); // 全局色表 256 色
  for (let i = 0; i < 256; i += 1) {
    if (palette) push(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]);
    else push(Math.round(((i >> 5) & 7) * 255 / 7), Math.round(((i >> 2) & 7) * 255 / 7), Math.round((i & 3) * 255 / 3));
  }
  push(0x21, 0xff, 0x0b); ascii('NETSCAPE2.0'); push(0x03, 0x01, 0x00, 0x00, 0x00);
  frames.forEach((frame, fi) => {
    push(0x21, 0xf9, 0x04, 0x00); u16(delays ? delays[fi] : delayCs); push(0x00, 0x00);
    push(0x2c); u16(0); u16(0); u16(width); u16(height); push(0x00);
    const indices = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p += 1) {
      const o = p * 4;
      indices[p] = frame[o + 3] < 128 ? 0 : (nearest ? nearest(frame[o], frame[o + 1], frame[o + 2]) : pixelIndex(frame[o], frame[o + 1], frame[o + 2]));
    }
    const packed = lzwEncode(indices);
    push(0x08);
    for (let off = 0; off < packed.length; off += 255) {
      const chunk = packed.slice(off, off + 255);
      push(chunk.length);
      for (const b of chunk) push(b);
    }
    push(0x00);
  });
  push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

/* ---------- 中位切分调色板：比 3-3-2 固定色表更贴近原图 ---------- */
export function quantizePalette(frames, width, height, maxColors = 256) {
  const bins = new Map();
  const stride = Math.max(1, Math.floor(width * height / 20000));
  for (const frame of frames) {
    for (let p = 0; p < width * height; p += stride) {
      const o = p * 4;
      if (frame[o + 3] < 128) continue;
      const key = ((frame[o] >> 3) << 10) | ((frame[o + 1] >> 3) << 5) | (frame[o + 2] >> 3);
      const bin = bins.get(key);
      if (bin) { bin[0] += frame[o]; bin[1] += frame[o + 1]; bin[2] += frame[o + 2]; bin[3] += 1; }
      else bins.set(key, [frame[o], frame[o + 1], frame[o + 2], 1]);
    }
  }
  let boxes = [[...bins.values()]];
  if (!boxes[0].length) boxes = [[[0, 0, 0, 1]]];
  while (boxes.length < maxColors - 1) {
    let bi = -1, best = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c += 1) {
        let lo = 255, hi = 0;
        for (const b of box) { const v = b[c] / b[3]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const range = (hi - lo) * Math.cbrt(box.reduce((s, b) => s + b[3], 0));
        if (range > best) { best = range; bi = i; }
      }
    });
    if (bi < 0) break;
    const box = boxes[bi];
    let ch = 0, chRange = -1;
    for (let c = 0; c < 3; c += 1) {
      let lo = 255, hi = 0;
      for (const b of box) { const v = b[c] / b[3]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > chRange) { chRange = hi - lo; ch = c; }
    }
    box.sort((a, b) => a[ch] / a[3] - b[ch] / b[3]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  const palette = new Uint8Array(256 * 3); // 0 号留作透明
  boxes.forEach((box, i) => {
    const n = box.reduce((s, b) => s + b[3], 0) || 1;
    const o = (i + 1) * 3;
    palette[o] = Math.round(box.reduce((s, b) => s + b[0], 0) / n);
    palette[o + 1] = Math.round(box.reduce((s, b) => s + b[1], 0) / n);
    palette[o + 2] = Math.round(box.reduce((s, b) => s + b[2], 0) / n);
  });
  return palette;
}

function makeNearestMapper(palette) {
  const cache = new Map();
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 1, bestD = Infinity;
    for (let i = 1; i < 256; i += 1) {
      const o = i * 3;
      if (!palette[o] && !palette[o + 1] && !palette[o + 2]) continue;
      const dr = r - palette[o], dg = g - palette[o + 1], db = b - palette[o + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    cache.set(key, best);
    return best;
  };
}

/* ---------- GIF 解码器（自写 GIF89a + LZW，含帧 disposal 合成） ---------- */
function lzwDecode(data, minCode, pixelCount) {
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1;
  let dict = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i += 1) dict[i] = [i];
    next = eoi + 1; codeSize = minCode + 1;
  };
  reset();
  const out = new Uint8Array(pixelCount);
  let op = 0, acc = 0, bits = 0, dp = 0, prev = null;
  while (op < pixelCount) {
    while (bits < codeSize) {
      if (dp >= data.length) return out;
      acc |= data[dp++] << bits; bits += 8;
    }
    const code = acc & ((1 << codeSize) - 1);
    acc >>>= codeSize; bits -= codeSize;
    if (code === clear) { reset(); prev = null; continue; }
    if (code === eoi) break;
    let entry;
    if (code < next && dict[code]) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else break;
    for (const v of entry) { if (op < pixelCount) out[op++] = v; }
    if (prev && next < 4096) {
      dict[next++] = [...prev, entry[0]];
      if (next === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    prev = entry;
  }
  return out;
}

export function decodeGif(buffer) {
  const u8 = new Uint8Array(buffer);
  let p = 0;
  const rd = () => u8[p++];
  const rd16 = () => { const v = u8[p] | (u8[p + 1] << 8); p += 2; return v; };
  const sig = String.fromCharCode(...u8.slice(0, 6));
  if (sig !== 'GIF89a' && sig !== 'GIF87a') throw new Error('不是有效的 GIF 文件');
  p = 6;
  const width = rd16(), height = rd16();
  const packed = rd(); rd(); rd();
  const readPalette = n => { const t = new Uint8Array(n * 3); for (let i = 0; i < n * 3; i += 1) t[i] = rd(); return t; };
  const gct = (packed & 0x80) ? readPalette(2 << (packed & 7)) : null;
  const frames = [];
  let gce = null;
  const canvas = new Uint8ClampedArray(width * height * 4);
  let saved = null, prevRect = null, prevDisposal = 0;
  while (p < u8.length) {
    const b = rd();
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = rd();
      if (label === 0xf9) {
        rd(); const flags = rd(); const delay = rd16(); const trans = rd(); rd();
        gce = { delay, disposal: (flags >> 2) & 7, transparent: (flags & 1) ? trans : -1 };
      } else {
        for (;;) { const n = rd(); if (!n) break; p += n; }
      }
      continue;
    }
    if (b !== 0x2c) continue;
    const left = rd16(), top = rd16(), w = rd16(), h = rd16();
    const ip = rd();
    const pal = (ip & 0x80) ? readPalette(2 << (ip & 7)) : gct;
    const interlace = !!(ip & 0x40);
    const minCode = rd();
    const data = [];
    for (;;) { const n = rd(); if (!n) break; for (let i = 0; i < n; i += 1) data.push(u8[p++]); }
    let indices = lzwDecode(data, minCode, w * h);
    if (interlace) {
      const ordered = new Uint8Array(w * h);
      const passes = [[0, 8], [4, 8], [2, 4], [1, 2]];
      let row = 0;
      for (const [start, step] of passes) {
        for (let y = start; y < h; y += step) {
          ordered.set(indices.subarray(row * w, (row + 1) * w), y * w);
          row += 1;
        }
      }
      indices = ordered;
    }
    /* 上一帧的 disposal 处理 */
    if (prevRect) {
      if (prevDisposal === 2) {
        for (let y = prevRect.top; y < prevRect.top + prevRect.h; y += 1) {
          canvas.fill(0, (y * width + prevRect.left) * 4, (y * width + prevRect.left + prevRect.w) * 4);
        }
      } else if (prevDisposal === 3 && saved) {
        canvas.set(saved);
      }
    }
    if (gce && gce.disposal === 3) saved = canvas.slice();
    const transparent = gce ? gce.transparent : -1;
    if (pal) {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const idx = indices[y * w + x];
          if (idx === transparent) continue;
          const o = ((top + y) * width + (left + x)) * 4;
          canvas[o] = pal[idx * 3]; canvas[o + 1] = pal[idx * 3 + 1]; canvas[o + 2] = pal[idx * 3 + 2]; canvas[o + 3] = 255;
        }
      }
    }
    frames.push({ data: canvas.slice(), delayCs: gce ? gce.delay : 10, left, top, width: w, height: h });
    prevRect = { left, top, w, h };
    prevDisposal = gce ? gce.disposal : 0;
    gce = null;
  }
  if (!frames.length) throw new Error('GIF 中没有可解码的帧');
  return { width, height, frames };
}

/* 把解码帧画到 canvas 数组（供编辑/再编码） */
export function gifFrameCanvases(decoded) {
  return decoded.frames.map(frame => {
    const canvas = makeCanvas(decoded.width, decoded.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(frame.data, decoded.width, decoded.height), 0, 0);
    return canvas;
  });
}

/* ---------- 按需加载本地 UMD 脚本（ort / piexif 等，只在用到时加载） ---------- */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = el('script', { src });
    script.onload = () => { script.dataset.loaded = '1'; resolve(); };
    script.onerror = () => reject(new Error(`本地库加载失败：${src}`));
    document.head.append(script);
  });
}

/* ---------- 可选：用本地 JSZip 把多个文件打包 ---------- */
export async function zipBlobs(entries, filename) {
  const JSZip = typeof window !== 'undefined' ? window.JSZip : null;
  if (!JSZip) {
    for (const [name, blob] of entries) downloadBlob(blob, name);
    toast('打包库未加载，已改为逐个下载', 'warn');
    return false;
  }
  const zip = new JSZip();
  for (const [name, blob] of entries) zip.file(name, blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, filename);
  return true;
}

/* ---------- 可选：本地 pdf.js ---------- */
export function pdfjs() {
  const lib = typeof window !== 'undefined' ? window.pdfjsLib : null;
  if (!lib) { toast('本地 PDF 渲染库未加载，请检查 vendor/pdfjs', 'warn'); return null; }
  try {
    lib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js';
  } catch { /* 某些环境已预置 worker */ }
  return lib;
}

export async function renderPdfPage(page, scale = 1.2) {
  const viewport = page.getViewport({ scale });
  const canvas = makeCanvas(Math.max(1, Math.round(viewport.width)), Math.max(1, Math.round(viewport.height)));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

/* 判断 Blob / ArrayBuffer 是否含 PDF 头，并返回从 %PDF 起的字节 */
export function extractPdfBytes(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let start = -1;
  for (let i = 0; i < Math.min(bytes.length - 5, 4096); i += 1) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) {
      start = i; break;
    }
  }
  if (start < 0) return null;
  const tail = new TextDecoder('latin1').decode(bytes.slice(Math.max(0, bytes.length - 2048)));
  const eof = tail.lastIndexOf('%%EOF');
  const end = eof >= 0 ? Math.max(0, bytes.length - 2048) + eof + 5 : bytes.length;
  return bytes.slice(start, Math.min(bytes.length, end));
}

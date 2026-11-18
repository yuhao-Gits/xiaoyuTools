/* EXIF 与 DPI：piexifjs（MIT，本地按需加载）读写 EXIF；
   DPI 直接补丁 JFIF / pHYs 字节，不重编码图像。 */
import {
  el, inp, sel, btn, panel, actions, hint, toast, filePicker,
  readDataURL, downloadBlob, formatBytes, resultBox, labeled,
} from '../../core/ui.js';
import { loadScript, num } from './shared.js';

const baseName = name => (name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
const dataUrlToBlob = async dataUrl => {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:([^;]+)/)[1];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
};

async function piexif() {
  await loadScript('./vendor/piexif/piexif.js');
  if (!window.piexif) throw new Error('EXIF 库未加载');
  return window.piexif;
}

/* ---------- EXIF 查看 / 编辑 / 清除 ---------- */
const exifTool = {
  id: 'exif-tool', name: 'EXIF 查看 / 清除', category: 'image',
  desc: '读取 GPS / 相机参数，改拍摄日期与作者，一键去 GPS 或全部元数据',
  keywords: ['EXIF', 'GPS', '元数据', '隐私', '拍摄日期', '相机', '清除'],
  steps: ['选择 JPG 照片', '查看元数据（GPS、日期、相机参数）', '需要时修改日期 / 作者，或一键清除 GPS / 全部元数据', '下载处理后的照片'],
  faq: [
    ['支持哪些格式？', 'EXIF 读写支持 JPEG；PNG / WebP 请用「清除全部元数据」之外的工具查看基础信息。'],
    ['清除后画质会变吗？', '不会。只移除元数据段，图像数据原样保留。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/jpeg,.jpg,.jpeg' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const dateInput = inp({ type: 'text', class: 'input', placeholder: '2026:01:01 12:00:00' });
    const artistInput = inp({ type: 'text', class: 'input', placeholder: '作者 / 版权' });
    let dataUrl = '', name = 'photo', exif = null, lib = null;

    const TAGS = {
      271: '相机品牌', 272: '相机型号', 274: '方向', 306: '修改时间',
      33434: '曝光时间', 33437: '光圈', 34855: 'ISO', 36867: '拍摄时间',
      37386: '焦距', 40962: '像素宽', 40963: '像素高',
    };
    const show = () => {
      if (!exif) return;
      const lines = [];
      const walk = (obj, label) => {
        for (const [k, v] of Object.entries(obj || {})) {
          if (typeof v === 'object') continue;
          lines.push(`${label}${TAGS[k] || `标签${k}`}: ${String(v).slice(0, 80)}`);
        }
      };
      walk(exif['0th'], '');
      walk(exif.Exif, '');
      const gps = exif.GPS || {};
      if (Object.keys(gps).length) {
        const lat = gps[2], lon = gps[4];
        const fmt = arr => Array.isArray(arr) ? arr.map(x => Array.isArray(x) ? (x[0] / x[1]).toFixed(4) : x).join('°') : String(arr);
        lines.push(`GPS 纬度: ${gps[1] || ''} ${fmt(lat)}`);
        lines.push(`GPS 经度: ${gps[3] || ''} ${fmt(lon)}`);
        lines.push('⚠ 照片包含位置信息，分享前建议清除');
      } else lines.push('GPS: 无位置信息');
      if (exif['0th'] && exif['0th'][306]) dateInput.value = String(exif['0th'][306]);
      output.set(lines.length ? lines.join('\n') : '未找到 EXIF 元数据');
    };
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      try {
        lib = await piexif();
        dataUrl = await readDataURL(file);
        name = baseName(file.name);
        exif = lib.load(dataUrl);
        show();
        status.textContent = `已载入 ${file.name} · ${formatBytes(file.size)}`; status.className = 'status ok';
      } catch (error) {
        status.textContent = `读取失败：${error.message}`; status.className = 'status bad';
      }
    });
    const save = async (mutate, suffix) => {
      if (!dataUrl) { toast('请先选择照片', 'warn'); return; }
      try {
        const next = JSON.parse(JSON.stringify(exif));
        mutate(next);
        const inserted = lib.insert(lib.dump(next), dataUrl);
        downloadBlob(await dataUrlToBlob(inserted), `${name}-${suffix}.jpg`);
        exif = next; show();
        toast('已导出', 'ok');
      } catch (error) { toast(`处理失败：${error.message}`, 'warn'); }
    };
    root.append(
      panel('选择 JPG 照片', picker),
      actions(
        btn('修改日期 / 作者', () => save(next => {
          if (dateInput.value.trim()) {
            next['0th'][306] = dateInput.value.trim();
            next.Exif[36867] = dateInput.value.trim();
            next.Exif[36868] = dateInput.value.trim();
          }
          if (artistInput.value.trim()) next['0th'][315] = artistInput.value.trim();
        }, 'edited'), 'primary'),
        btn('只清除 GPS', () => save(next => { next.GPS = {}; }, 'no-gps')),
        btn('清除全部元数据', async () => {
          if (!dataUrl) { toast('请先选择照片', 'warn'); return; }
          downloadBlob(await dataUrlToBlob(lib.remove(dataUrl)), `${name}-clean.jpg`);
          exif = { '0th': {}, Exif: {}, GPS: {}, '1st': {} };
          output.set('已清除全部 EXIF 元数据');
          toast('已导出无元数据照片', 'ok');
        }),
      ),
      panel('修改项', el('div', { class: 'inline-fields' }, labeled('拍摄时间', dateInput), labeled('作者', artistInput))),
      status, output.node,
      hint('时间格式 YYYY:MM:DD HH:MM:SS；清除操作不重编码图像，画质无损。'),
    );
  },
};

/* ---------- DPI 检查 / 修改 ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = bytes => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const dpiTool = {
  id: 'dpi-tool', name: 'DPI 检查 / 修改', category: 'image',
  desc: '查看打印尺寸，把 JPG / PNG 改成 300DPI（不重编码）',
  keywords: ['DPI', '300', '分辨率', '打印', '印刷', 'pHYs', 'JFIF'],
  steps: ['选择 JPG 或 PNG', '查看当前 DPI 与 72/150/300 下的打印尺寸', '需要时选目标 DPI 并导出（只改元数据，画质不变）'],
  faq: [
    ['改 DPI 会让图变清晰吗？', '不会。DPI 只是打印密度标记，像素数不变；要放大像素请用缩放工具。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/jpeg,image/png,.jpg,.jpeg,.png' });
    const target = sel([{ value: '300', label: '300 DPI（印刷）' }, { value: '150', label: '150 DPI（普通打印）' }, { value: '72', label: '72 DPI（屏幕）' }, { value: 'custom', label: '自定义…' }], '300');
    const customDpi = inp({ type: 'number', min: '1', max: '2400', value: '300', class: 'input' });
    customDpi.style.display = 'none';
    target.addEventListener('change', () => { customDpi.style.display = target.value === 'custom' ? '' : 'none'; });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let bytes = null, kind = '', name = 'image', pixelW = 0, pixelH = 0;

    const readInfo = () => {
      const lines = [];
      let dpi = 0;
      if (kind === 'jpeg') {
        /* 找 JFIF APP0 */
        let p = 2;
        while (p < bytes.length - 4) {
          if (bytes[p] !== 0xff) break;
          const marker = bytes[p + 1];
          const len = (bytes[p + 2] << 8) | bytes[p + 3];
          if (marker === 0xe0 && String.fromCharCode(...bytes.slice(p + 4, p + 9)) === 'JFIF\0') {
            const units = bytes[p + 11];
            const x = (bytes[p + 12] << 8) | bytes[p + 13];
            dpi = units === 1 ? x : units === 2 ? Math.round(x * 2.54) : 0;
            lines.push(`JFIF 密度: ${x}（单位 ${units === 1 ? '英寸' : units === 2 ? '厘米' : '无'}）`);
            break;
          }
          if (marker === 0xda) break;
          p += 2 + len;
        }
        /* 像素尺寸：扫 SOF */
        let q = 2;
        while (q < bytes.length - 9) {
          if (bytes[q] !== 0xff) { q += 1; continue; }
          const m = bytes[q + 1];
          if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
            pixelH = (bytes[q + 5] << 8) | bytes[q + 6];
            pixelW = (bytes[q + 7] << 8) | bytes[q + 8];
            break;
          }
          q += 2 + ((bytes[q + 2] << 8) | bytes[q + 3]);
        }
      } else {
        pixelW = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        pixelH = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        let p = 8;
        while (p < bytes.length - 8) {
          const len = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
          const type = String.fromCharCode(...bytes.slice(p + 4, p + 8));
          if (type === 'pHYs') {
            const x = (bytes[p + 8] << 24) | (bytes[p + 9] << 16) | (bytes[p + 10] << 8) | bytes[p + 11];
            const unit = bytes[p + 16];
            dpi = unit === 1 ? Math.round(x * 0.0254) : 0;
            lines.push(`pHYs: ${x} 像素/米（${unit === 1 ? '公制' : '无单位'}）`);
            break;
          }
          p += 12 + len;
        }
      }
      lines.unshift(`像素尺寸: ${pixelW}×${pixelH}`);
      lines.push(`当前 DPI: ${dpi || '未声明（屏幕默认按 72/96 计）'}`);
      for (const d of [72, 150, 300]) {
        lines.push(`按 ${d}DPI 打印: ${(pixelW / d * 2.54).toFixed(1)}×${(pixelH / d * 2.54).toFixed(1)} cm`);
      }
      output.set(lines.join('\n'));
    };
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      bytes = new Uint8Array(await file.arrayBuffer());
      kind = bytes[0] === 0x89 ? 'png' : 'jpeg';
      name = baseName(file.name);
      readInfo();
      status.textContent = `已载入 ${file.name} · ${formatBytes(file.size)}`; status.className = 'status ok';
    });

    const run = () => {
      if (!bytes) { toast('请先选择图片', 'warn'); return; }
      const dpi = target.value === 'custom' ? num(customDpi.value, 300) : num(target.value, 300);
      if (kind === 'jpeg') {
        let p = 2, found = -1;
        while (p < bytes.length - 4) {
          if (bytes[p] !== 0xff) break;
          const marker = bytes[p + 1];
          const len = (bytes[p + 2] << 8) | bytes[p + 3];
          if (marker === 0xe0 && String.fromCharCode(...bytes.slice(p + 4, p + 9)) === 'JFIF\0') { found = p; break; }
          if (marker === 0xda) break;
          p += 2 + len;
        }
        let out;
        if (found >= 0) {
          out = bytes.slice();
          out[found + 11] = 1;
          out[found + 12] = (dpi >> 8) & 255; out[found + 13] = dpi & 255;
          out[found + 14] = (dpi >> 8) & 255; out[found + 15] = dpi & 255;
        } else {
          /* 无 JFIF：在 SOI 后插入标准 APP0 段 */
          const seg = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 1, (dpi >> 8) & 255, dpi & 255, (dpi >> 8) & 255, dpi & 255, 0, 0]);
          out = new Uint8Array(bytes.length + seg.length);
          out.set(bytes.slice(0, 2), 0); out.set(seg, 2); out.set(bytes.slice(2), 2 + seg.length);
        }
        downloadBlob(new Blob([out], { type: 'image/jpeg' }), `${name}-${dpi}dpi.jpg`);
      } else {
        const ppu = Math.round(dpi / 0.0254);
        const chunk = new Uint8Array(21);
        const dv = new DataView(chunk.buffer);
        dv.setUint32(0, 9);
        chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
        dv.setUint32(8, ppu); dv.setUint32(12, ppu); chunk[16] = 1;
        dv.setUint32(17, crc32(chunk.slice(4, 17)));
        let p = 8, insertAt = -1, removeLen = 0;
        while (p < bytes.length - 8) {
          const len = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
          const type = String.fromCharCode(...bytes.slice(p + 4, p + 8));
          if (type === 'pHYs') { insertAt = p; removeLen = 12 + len; break; }
          if (type === 'IDAT' && insertAt < 0) insertAt = p;
          p += 12 + len;
        }
        if (insertAt < 0) insertAt = 8;
        const out = new Uint8Array(bytes.length - removeLen + chunk.length);
        out.set(bytes.slice(0, insertAt), 0);
        out.set(chunk, insertAt);
        out.set(bytes.slice(insertAt + removeLen), insertAt + chunk.length);
        downloadBlob(new Blob([out], { type: 'image/png' }), `${name}-${dpi}dpi.png`);
      }
      status.textContent = `已导出 ${dpi}DPI（像素不变，仅改密度标记）`; status.className = 'status ok';
    };
    root.append(
      panel('选择 JPG / PNG', picker),
      panel('目标 DPI', el('div', { class: 'inline-fields' }, labeled('档位', target), labeled('自定义', customDpi))),
      actions(btn('修改 DPI 并导出', run, 'primary')),
      status, output.node,
      hint('直接补丁 JFIF / pHYs 元数据段，不重新压缩图像；打印店要求 300DPI 时用这个即可。'),
    );
  },
};

export const exifDpiTools = [exifTool, dpiTool];
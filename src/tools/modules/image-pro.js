/* 图片专业处理：目标体积压缩 / 证件照 / SVG 转 PNG / ICO / 调色 / 圆角 / 水印。
   全部本地 Canvas 实现，参考 BulkPicTools 的功能面，固定参数合并为内置预设。 */
import {
  el, inp, sel, btn, panel, actions, hint, toast, filePicker,
  readDataURL, readTextFile, loadImage, canvasToBlob, downloadBlob, formatBytes, resultBox, labeled,
} from '../../core/ui.js';
import { makeCanvas, canvasFromImageFile, num, clamp, zipBlobs } from './shared.js';

const baseName = name => (name || 'image').replace(/\.[^.]+$/, '') || 'image';

/* ---------- 压缩到指定大小 ---------- */
const compressToSize = {
  id: 'compress-to-size', name: '压缩到指定大小', category: 'image',
  desc: '把 JPG / PNG / WebP 压到 20KB~2MB 以内，自动降质与缩放',
  keywords: ['压缩', '100KB', '200KB', '500KB', '1MB', '2MB', '50KB', '20KB', '证件照', '报名', '上传'],
  steps: ['选择一张或多张图片', '选目标体积档位（或自定义 KB）', '点「开始压缩」，自动搜索质量与尺寸直到达标', '单张直接下载，多张打包 ZIP'],
  faq: [
    ['一定能压到目标以内吗？', '会先降质量再逐步缩小尺寸，绝大多数图片可达标；极端复杂的图可能略超，结果里会如实标注。'],
    ['透明背景怎么办？', 'PNG 带透明时保持 PNG 格式（只缩放不降质）；不透明时转 JPEG 以获得更高压缩率。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const preset = sel([
      { value: '20', label: '20KB（极小文件 / 签名）' },
      { value: '50', label: '50KB（老系统上传）' },
      { value: '100', label: '100KB（报名 / 头像）' },
      { value: '200', label: '200KB（签证 / 政务）' },
      { value: '500', label: '500KB（电商主图 / 邮件）' },
      { value: '1024', label: '1MB（微信原图）' },
      { value: '2048', label: '2MB（打印 / 作品集）' },
      { value: 'custom', label: '自定义…' },
    ], '100');
    const custom = inp({ type: 'number', min: '5', max: '20480', value: '150', class: 'input' });
    custom.style.display = 'none';
    preset.addEventListener('change', () => { custom.style.display = preset.value === 'custom' ? '' : 'none'; });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let results = [];

    const targetBytes = () => (preset.value === 'custom' ? num(custom.value, 150) : num(preset.value, 100)) * 1024;

    const compressOne = async (file, target) => {
      const image = await loadImage(await readDataURL(file));
      let canvas = makeCanvas(image.naturalWidth, image.naturalHeight);
      let ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const hasAlpha = (() => {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
        return false;
      })();
      const type = hasAlpha ? 'image/png' : 'image/jpeg';
      if (!hasAlpha) {
        const flat = makeCanvas(canvas.width, canvas.height);
        const fctx = flat.getContext('2d');
        fctx.fillStyle = '#ffffff'; fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(canvas, 0, 0);
        canvas = flat; ctx = fctx;
      }
      let blob = await canvasToBlob(canvas, type, 0.92);
      let quality = 0.92, scale = 1, rounds = 0;
      while (blob && blob.size > target && rounds < 40) {
        rounds += 1;
        if (!hasAlpha && quality > 0.1) {
          quality = Math.max(0.05, quality - 0.08);
        } else {
          scale *= 0.85;
          quality = 0.9;
          const w = Math.max(16, Math.round(image.naturalWidth * scale));
          const h = Math.max(16, Math.round(image.naturalHeight * scale));
          const next = makeCanvas(w, h);
          const nctx = next.getContext('2d');
          if (!hasAlpha) { nctx.fillStyle = '#ffffff'; nctx.fillRect(0, 0, w, h); }
          nctx.drawImage(image, 0, 0, w, h);
          canvas = next;
        }
        blob = await canvasToBlob(canvas, type, quality);
      }
      return { blob, width: canvas.width, height: canvas.height, type, ok: !!blob && blob.size <= target };
    };

    const run = async () => {
      const files = [...(picker.files || [])];
      if (!files.length) { toast('请先选择图片', 'warn'); return; }
      const target = targetBytes();
      results = [];
      status.textContent = '压缩中…'; status.className = 'status';
      const lines = [];
      for (const file of files) {
        try {
          const r = await compressOne(file, target);
          const ext = r.type === 'image/png' ? 'png' : 'jpg';
          results.push([`${baseName(file.name)}-compressed.${ext}`, r.blob]);
          lines.push(`${file.name}  ${formatBytes(file.size)} → ${formatBytes(r.blob.size)}  ${r.width}×${r.height}  ${r.ok ? '达标' : '略超目标（已尽力）'}`);
        } catch (error) {
          lines.push(`${file.name}  失败：${error.message}`);
        }
      }
      output.set(lines.join('\n'));
      status.textContent = `完成 ${results.length}/${files.length}`; status.className = 'status ok';
      if (results.length === 1) downloadBlob(results[0][1], results[0][0]);
      else if (results.length > 1) await zipBlobs(results, 'compressed.zip');
    };

    root.append(
      panel('选择图片（可多选）', picker),
      panel('目标体积', el('div', { class: 'inline-fields' }, labeled('档位', preset), labeled('自定义 KB', custom))),
      actions(btn('开始压缩', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, output.node,
      hint('先降低 JPEG 质量，仍超标再逐步缩小尺寸；带透明通道的 PNG 保持无损只缩放。全程本地处理。'),
    );
  },
};

/* ---------- 证件照裁剪 ---------- */
const PASSPORT_SPECS = [
  { value: '25x35', label: '一寸（25×35mm）', w: 25, h: 35 },
  { value: '35x49', label: '二寸（35×49mm）', w: 35, h: 49 },
  { value: '35x45', label: '小二寸 / 欧盟签证（35×45mm）', w: 35, h: 45 },
  { value: '33x48', label: '护照 / 港澳通行证（33×48mm）', w: 33, h: 48 },
  { value: '51x51', label: '美国签证 2x2（51×51mm）', w: 51, h: 51 },
  { value: '45x45', label: '日本签证（45×45mm）', w: 45, h: 45 },
  { value: 'custom', label: '自定义毫米…', w: 25, h: 35 },
];
const passportPhoto = {
  id: 'passport-photo', name: '证件照裁剪', category: 'image',
  desc: '一寸 / 二寸 / 护照 / 美签等标准规格，300DPI 居中裁剪',
  keywords: ['证件照', '一寸', '二寸', '护照', '签证', '美签', '2x2', '报名照'],
  steps: ['选择正面照片', '选规格（或自定义毫米）', '拖动「取景位置」让头部居中', '导出 300DPI 照片'],
  faq: [
    ['像素怎么算？', '按 300DPI 换算：毫米 ÷ 25.4 × 300，如一寸 = 295×413 像素。'],
    ['能换底色吗？', '本工具只做裁剪与尺寸；换底色可先用「移除背景」抠图再合成。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const spec = sel(PASSPORT_SPECS.map(s => ({ value: s.value, label: s.label })), '25x35');
    const mmW = inp({ type: 'number', min: '10', max: '200', value: '25', class: 'input' });
    const mmH = inp({ type: 'number', min: '10', max: '200', value: '35', class: 'input' });
    const customWrap = el('div', { class: 'inline-fields' }, labeled('宽 mm', mmW), labeled('高 mm', mmH));
    customWrap.style.display = 'none';
    spec.addEventListener('change', () => { customWrap.style.display = spec.value === 'custom' ? '' : 'none'; });
    const offset = inp({ type: 'range', min: '0', max: '100', value: '38' });
    const offsetLabel = el('span', { class: 'field-label', text: '取景位置 38%（偏上，适合头肩照）' });
    offset.addEventListener('input', () => { offsetLabel.textContent = `取景位置 ${offset.value}%`; draw(); });
    const preview = el('canvas', { class: 'preview-img' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'photo', resultBlob = null;

    const dims = () => {
      const s = PASSPORT_SPECS.find(x => x.value === spec.value) || PASSPORT_SPECS[0];
      const w = spec.value === 'custom' ? num(mmW.value, 25) : s.w;
      const h = spec.value === 'custom' ? num(mmH.value, 35) : s.h;
      return { pw: Math.round(w / 25.4 * 300), ph: Math.round(h / 25.4 * 300) };
    };
    const cropCanvas = () => {
      const { pw, ph } = dims();
      const ratio = pw / ph;
      const sw = source.naturalWidth, sh = source.naturalHeight;
      let cw = sw, ch = sw / ratio;
      if (ch > sh) { ch = sh; cw = sh * ratio; }
      const cx = (sw - cw) / 2;
      const cy = clamp((sh - ch) * num(offset.value, 38) / 100, 0, Math.max(0, sh - ch));
      const canvas = makeCanvas(pw, ph);
      canvas.getContext('2d').drawImage(source, cx, cy, cw, ch, 0, 0, pw, ph);
      return canvas;
    };
    const draw = () => {
      if (!source) return;
      const c = cropCanvas();
      preview.width = c.width; preview.height = c.height;
      preview.getContext('2d').drawImage(c, 0, 0);
      const { pw, ph } = dims();
      status.textContent = `输出 ${pw}×${ph} 像素 · 300DPI`; status.className = 'status ok';
    };
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      draw();
    });
    spec.addEventListener('change', draw);
    mmW.addEventListener('input', draw); mmH.addEventListener('input', draw);

    root.append(
      panel('选择照片', picker),
      panel('规格', spec, customWrap, el('div', { class: 'inline-fields' }, labeled('取景', offset), offsetLabel)),
      actions(
        btn('生成证件照', () => {
          if (!source) { toast('请先选择照片', 'warn'); return; }
          cropCanvas().toBlob(blob => {
            resultBlob = blob;
            downloadBlob(blob, `${name}-passport.jpg`);
            toast('已导出 300DPI 证件照', 'ok');
          }, 'image/jpeg', 0.95);
        }, 'primary'),
      ),
      status, panel('预览', preview),
      hint('居中裁剪，取景滑块控制纵向位置；输出 JPEG。需要白/蓝/红底时请先用抠图工具处理背景。'),
    );
  },
};

/* ---------- SVG 转 PNG ---------- */
const svgToPng = {
  id: 'svg-to-png', name: 'SVG 转 PNG', category: 'image',
  desc: '本地渲染 SVG，自定义尺寸 / 背景，一次导出 1x/2x/3x',
  keywords: ['SVG', 'PNG', '矢量', '图标', '转换', 'favicon'],
  render(root) {
    const picker = filePicker({ accept: '.svg,image/svg+xml' });
    const width = inp({ type: 'number', min: '1', max: '8192', value: '512', class: 'input' });
    const height = inp({ type: 'number', min: '1', max: '8192', value: '512', class: 'input' });
    const bg = inp({ type: 'color', value: '#ffffff', class: 'color-input' });
    const transparent = inp({ type: 'checkbox', checked: true });
    const scales = sel([{ value: '1', label: '仅 1x' }, { value: '123', label: '1x + 2x + 3x（ZIP）' }], '1');
    const preview = el('img', { class: 'preview-img', alt: 'PNG 预览' });
    const status = el('div', { class: 'status' });
    let svgText = '', name = 'svg', img = null;

    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      svgText = await readTextFile(file);
      name = baseName(file.name);
      const m = svgText.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
      if (m) { width.value = Math.round(num(m[1], 512)); height.value = Math.round(num(m[2], 512)); }
      img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`);
      preview.src = img.src;
      status.textContent = `已载入 ${file.name}`; status.className = 'status ok';
    });

    const renderAt = async scale => {
      const w = Math.max(1, Math.round(num(width.value, 512) * scale));
      const h = Math.max(1, Math.round(num(height.value, 512) * scale));
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!transparent.checked) { ctx.fillStyle = bg.value; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      return canvasToBlob(canvas, 'image/png');
    };

    root.append(
      panel('选择 SVG', picker),
      panel('输出设置',
        el('div', { class: 'inline-fields' }, labeled('宽 px', width), labeled('高 px', height), labeled('背景色', bg)),
        el('label', { class: 'check' }, transparent, el('span', { text: '透明背景（忽略背景色）' })),
        labeled('导出倍率', scales)),
      actions(btn('转换并下载', async () => {
        if (!img) { toast('请先选择 SVG', 'warn'); return; }
        try {
          if (scales.value === '1') downloadBlob(await renderAt(1), `${name}.png`);
          else {
            const entries = [];
            for (const s of [1, 2, 3]) entries.push([`${name}@${s}x.png`, await renderAt(s)]);
            await zipBlobs(entries, `${name}-png.zip`);
          }
          status.textContent = '已导出 PNG'; status.className = 'status ok';
        } catch (error) { toast(`渲染失败：${error.message}`, 'warn'); }
      }, 'primary')),
      status, panel('预览', preview),
      hint('SVG 以 <img> 方式本地渲染，其中的脚本不会执行；含外部引用的 SVG 可能显示不全。'),
    );
  },
};

/* ---------- 图片转 ICO ---------- */
const imageToIco = {
  id: 'image-to-ico', name: '图片转 ICO', category: 'image',
  desc: '生成多尺寸 Windows 图标 / favicon（16~256px）',
  keywords: ['ICO', 'favicon', '图标', 'icon', '网站图标'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const sizes = [16, 32, 48, 64, 128, 256];
    const checks = sizes.map(s => {
      const c = inp({ type: 'checkbox', checked: s !== 128 });
      return { s, c, node: el('label', { class: 'check' }, c, el('span', { text: `${s}×${s}` })) };
    });
    const preview = el('img', { class: 'preview-img', alt: '图标预览' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'icon';
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      preview.src = source.src;
      status.textContent = `已载入 ${file.name}`; status.className = 'status ok';
    });

    const run = async () => {
      if (!source) { toast('请先选择图片', 'warn'); return; }
      const chosen = checks.filter(x => x.c.checked).map(x => x.s);
      if (!chosen.length) { toast('至少勾选一个尺寸', 'warn'); return; }
      const pngs = [];
      for (const s of chosen) {
        const canvas = makeCanvas(s, s);
        const ctx = canvas.getContext('2d');
        const ratio = Math.max(s / source.naturalWidth, s / source.naturalHeight);
        const w = source.naturalWidth * ratio, h = source.naturalHeight * ratio;
        ctx.drawImage(source, (s - w) / 2, (s - h) / 2, w, h);
        pngs.push({ s, blob: await canvasToBlob(canvas, 'image/png') });
      }
      const header = 6 + pngs.length * 16;
      let offset = header, total = header;
      for (const p of pngs) total += p.blob.size;
      const buf = new ArrayBuffer(total);
      const view = new DataView(buf);
      const u8 = new Uint8Array(buf);
      view.setUint16(0, 0, true); view.setUint16(2, 1, true); view.setUint16(4, pngs.length, true);
      for (let i = 0; i < pngs.length; i += 1) {
        const p = pngs[i], o = 6 + i * 16;
        view.setUint8(o, p.s >= 256 ? 0 : p.s); view.setUint8(o + 1, p.s >= 256 ? 0 : p.s);
        view.setUint8(o + 2, 0); view.setUint8(o + 3, 0);
        view.setUint16(o + 4, 1, true); view.setUint16(o + 6, 32, true);
        view.setUint32(o + 8, p.blob.size, true); view.setUint32(o + 12, offset, true);
        u8.set(new Uint8Array(await p.blob.arrayBuffer()), offset);
        offset += p.blob.size;
      }
      downloadBlob(new Blob([buf], { type: 'image/x-icon' }), `${name}.ico`);
      status.textContent = `已生成 ICO（${chosen.join('/')}px）`; status.className = 'status ok';
    };

    root.append(
      panel('选择图片', picker),
      panel('包含尺寸', el('div', { class: 'check-grid' }, ...checks.map(x => x.node))),
      actions(btn('生成 ICO', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, panel('预览', preview),
      hint('ICO 内嵌 PNG 压缩图，现代浏览器与 Windows 均支持；方形居中裁剪。'),
    );
  },
};

/* ---------- 图片调色 ---------- */
const imageAdjust = {
  id: 'image-adjust', name: '图片调色', category: 'image',
  desc: '亮度 / 对比度 / 饱和度 / 灰度 / 反色 / 复古，实时预览可批量',
  keywords: ['亮度', '对比度', '饱和度', '灰度', '黑白', '反色', '调色', '滤镜'],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const mk = (label, min, max, val) => {
      const range = inp({ type: 'range', min: String(min), max: String(max), value: String(val) });
      const lab = el('span', { class: 'field-label', text: `${label} ${val}` });
      range.addEventListener('input', () => { lab.textContent = `${label} ${range.value}`; draw(); });
      return { range, lab, node: el('div', { class: 'inline-fields' }, labeled(label, range), lab) };
    };
    const brightness = mk('亮度', 0, 200, 100);
    const contrast = mk('对比度', 0, 200, 100);
    const saturate = mk('饱和度', 0, 200, 100);
    const grayscale = mk('灰度', 0, 100, 0);
    const sepia = mk('复古', 0, 100, 0);
    const invert = inp({ type: 'checkbox' });
    const presetSel = sel([
      { value: '', label: '自定义' }, { value: 'bw', label: '黑白照片' },
      { value: 'vivid', label: '鲜艳' }, { value: 'retro', label: '复古胶片' },
      { value: 'bright', label: '提亮暗部' }, { value: 'invert', label: '反色' },
    ], '');
    const preview = el('canvas', { class: 'preview-img' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'image';

    const applyTo = canvas => {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const b = num(brightness.range.value, 100) / 100;
      const c = num(contrast.range.value, 100) / 100;
      const s = num(saturate.range.value, 100) / 100;
      const g = num(grayscale.range.value, 0) / 100;
      const sp = num(sepia.range.value, 0) / 100;
      const inv = invert.checked;
      const cf = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * b, gg = d[i + 1] * b, bb = d[i + 2] * b;
        r = cf * (r - 128) + 128; gg = cf * (gg - 128) + 128; bb = cf * (bb - 128) + 128;
        const gray = 0.2126 * r + 0.7152 * gg + 0.0722 * bb;
        r = gray + (r - gray) * s; gg = gray + (gg - gray) * s; bb = gray + (bb - gray) * s;
        r = r + (gray - r) * g; gg = gg + (gray - gg) * g; bb = bb + (gray - bb) * g;
        if (sp > 0) {
          const sr = r * (1 - sp) + (r * 0.393 + gg * 0.769 + bb * 0.189) * sp;
          const sg = gg * (1 - sp) + (r * 0.349 + gg * 0.686 + bb * 0.168) * sp;
          const sb = bb * (1 - sp) + (r * 0.272 + gg * 0.534 + bb * 0.131) * sp;
          r = sr; gg = sg; bb = sb;
        }
        if (inv) { r = 255 - r; gg = 255 - gg; bb = 255 - bb; }
        d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(bb, 0, 255);
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    };
    const draw = () => {
      if (!source) return;
      const max = 900;
      const ratio = Math.min(1, max / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = makeCanvas(source.naturalWidth * ratio, source.naturalHeight * ratio);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      applyTo(canvas);
      preview.width = canvas.width; preview.height = canvas.height;
      preview.getContext('2d').drawImage(canvas, 0, 0);
    };
    presetSel.addEventListener('change', () => {
      const set = (b, c, s, g, sp, inv) => {
        brightness.range.value = b; contrast.range.value = c; saturate.range.value = s;
        grayscale.range.value = g; sepia.range.value = sp; invert.checked = inv;
        for (const m of [brightness, contrast, saturate, grayscale, sepia]) m.lab.textContent = `${m.lab.textContent.split(' ')[0]} ${m.range.value}`;
        draw();
      };
      const v = presetSel.value;
      if (v === 'bw') set(100, 105, 100, 100, 0, false);
      else if (v === 'vivid') set(103, 110, 140, 0, 0, false);
      else if (v === 'retro') set(105, 108, 85, 0, 55, false);
      else if (v === 'bright') set(125, 105, 105, 0, 0, false);
      else if (v === 'invert') set(100, 100, 100, 0, 0, true);
      else set(100, 100, 100, 0, 0, false);
    });
    invert.addEventListener('change', draw);
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      draw();
      status.textContent = `已载入 ${file.name}（批量导出会处理全部所选文件）`; status.className = 'status ok';
    });

    const run = async () => {
      const files = [...(picker.files || [])];
      if (!files.length) { toast('请先选择图片', 'warn'); return; }
      const entries = [];
      for (const file of files) {
        const canvas = await canvasFromImageFile(file);
        applyTo(canvas);
        entries.push([`${baseName(file.name)}-adjusted.png`, await canvasToBlob(canvas, 'image/png')]);
      }
      if (entries.length === 1) downloadBlob(entries[0][1], entries[0][0]);
      else await zipBlobs(entries, 'adjusted.zip');
      status.textContent = `已导出 ${entries.length} 张`; status.className = 'status ok';
    };

    root.append(
      panel('选择图片（可多选）', picker),
      panel('调整', presetSel, brightness.node, contrast.node, saturate.node, grayscale.node, sepia.node,
        el('label', { class: 'check' }, invert, el('span', { text: '反色（互补色）' }))),
      actions(btn('导出 PNG', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, panel('预览', preview),
      hint('逐像素计算，不依赖浏览器滤镜 API，各浏览器效果一致；导出保留透明通道。'),
    );
  },
};

/* ---------- 图片圆角 ---------- */
const roundCorners = {
  id: 'round-corners', name: '图片圆角', category: 'image',
  desc: '给图片加圆角，透明背景 PNG 输出，可批量',
  keywords: ['圆角', '头像', '卡片', 'rounded', 'PNG'],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const radius = inp({ type: 'range', min: '0', max: '50', value: '12' });
    const radiusLabel = el('span', { class: 'field-label', text: '圆角 12%' });
    const preview = el('canvas', { class: 'preview-img' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'image';
    const applyTo = canvas => {
      const r = Math.min(canvas.width, canvas.height) * num(radius.value, 12) / 100;
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
      ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
      ctx.arcTo(0, canvas.height, 0, 0, r);
      ctx.arcTo(0, 0, canvas.width, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      return canvas;
    };
    const draw = () => {
      if (!source) return;
      const max = 700;
      const ratio = Math.min(1, max / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = makeCanvas(source.naturalWidth * ratio, source.naturalHeight * ratio);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      applyTo(canvas);
      preview.width = canvas.width; preview.height = canvas.height;
      preview.getContext('2d').drawImage(canvas, 0, 0);
    };
    radius.addEventListener('input', () => { radiusLabel.textContent = `圆角 ${radius.value}%`; draw(); });
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      draw();
      status.textContent = `已载入 ${file.name}`; status.className = 'status ok';
    });
    const run = async () => {
      const files = [...(picker.files || [])];
      if (!files.length) { toast('请先选择图片', 'warn'); return; }
      const entries = [];
      for (const file of files) entries.push([`${baseName(file.name)}-rounded.png`, await canvasToBlob(applyTo(await canvasFromImageFile(file)), 'image/png')]);
      if (entries.length === 1) downloadBlob(entries[0][1], entries[0][0]);
      else await zipBlobs(entries, 'rounded.zip');
      status.textContent = `已导出 ${entries.length} 张透明 PNG`; status.className = 'status ok';
    };
    root.append(
      panel('选择图片（可多选）', picker),
      panel('圆角', el('div', { class: 'inline-fields' }, labeled('半径', radius), radiusLabel)),
      actions(btn('导出 PNG', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, panel('预览', preview),
      hint('圆角外区域变透明，适合头像与卡片配图；50% 即正圆（方形图时）。'),
    );
  },
};

/* ---------- 图片水印 ---------- */
const imageWatermark = {
  id: 'image-watermark', name: '图片加水印', category: 'image',
  desc: '文字 / Logo 水印，九宫格定位或平铺，透明度可调，批量处理',
  keywords: ['水印', '版权', 'logo', '防盗图', '批量'],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const mode = sel([{ value: 'text', label: '文字水印' }, { value: 'logo', label: 'Logo 水印' }], 'text');
    const text = inp({ type: 'text', value: '© xiaoyuTools', class: 'input', placeholder: '水印文字' });
    const logoPicker = filePicker({ accept: 'image/*' });
    logoPicker.style.display = 'none';
    mode.addEventListener('change', () => { logoPicker.style.display = mode.value === 'logo' ? '' : 'none'; draw(); });
    const size = inp({ type: 'range', min: '2', max: '30', value: '6' });
    const opacity = inp({ type: 'range', min: '5', max: '100', value: '35' });
    const color = inp({ type: 'color', value: '#ffffff', class: 'color-input' });
    const position = sel([
      { value: 'tl', label: '左上' }, { value: 'tc', label: '上中' }, { value: 'tr', label: '右上' },
      { value: 'ml', label: '左中' }, { value: 'mc', label: '居中' }, { value: 'mr', label: '右中' },
      { value: 'bl', label: '左下' }, { value: 'bc', label: '下中' }, { value: 'br', label: '右下' },
      { value: 'tile', label: '全图平铺' },
    ], 'br');
    const preview = el('canvas', { class: 'preview-img' });
    const status = el('div', { class: 'status' });
    let source = null, logo = null, name = 'image';

    const applyTo = canvas => {
      const ctx = canvas.getContext('2d');
      const alpha = num(opacity.value, 35) / 100;
      const rel = num(size.value, 6) / 100;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (mode.value === 'logo' && logo) {
        const lw = canvas.width * rel * 2;
        const lh = logo.naturalHeight / logo.naturalWidth * lw;
        const place = (x, y) => ctx.drawImage(logo, x, y, lw, lh);
        if (position.value === 'tile') {
          for (let y = 0; y < canvas.height + lh; y += lh * 2.2) {
            for (let x = 0; x < canvas.width + lw; x += lw * 1.6) place(x, y);
          }
        } else {
          const m = canvas.width * 0.02;
          const px = { l: m, c: (canvas.width - lw) / 2, r: canvas.width - lw - m };
          const py = { t: m, m: (canvas.height - lh) / 2, b: canvas.height - lh - m };
          place(px[position.value[1] === 'l' ? 'l' : position.value[1] === 'r' ? 'r' : 'c'], py[position.value[0] === 't' ? 't' : position.value[0] === 'b' ? 'b' : 'm']);
        }
      } else {
        const fs = Math.max(10, canvas.width * rel);
        ctx.font = `600 ${fs}px sans-serif`;
        ctx.fillStyle = color.value;
        ctx.textBaseline = 'top';
        const content = text.value || '© watermark';
        const tw = ctx.measureText(content).width;
        if (position.value === 'tile') {
          ctx.rotate(-Math.PI / 9);
          for (let y = -canvas.height; y < canvas.height * 2; y += fs * 4) {
            for (let x = -canvas.width; x < canvas.width * 2; x += tw + fs * 3) ctx.fillText(content, x, y);
          }
        } else {
          const m = canvas.width * 0.02;
          const px = { l: m, c: (canvas.width - tw) / 2, r: canvas.width - tw - m };
          const py = { t: m, m: (canvas.height - fs) / 2, b: canvas.height - fs - m };
          ctx.fillText(content, px[position.value[1] === 'l' ? 'l' : position.value[1] === 'r' ? 'r' : 'c'], py[position.value[0] === 't' ? 't' : position.value[0] === 'b' ? 'b' : 'm']);
        }
      }
      ctx.restore();
      return canvas;
    };
    const draw = () => {
      if (!source) return;
      const max = 800;
      const ratio = Math.min(1, max / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = makeCanvas(source.naturalWidth * ratio, source.naturalHeight * ratio);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      applyTo(canvas);
      preview.width = canvas.width; preview.height = canvas.height;
      preview.getContext('2d').drawImage(canvas, 0, 0);
    };
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      draw();
      status.textContent = `已载入 ${file.name}`; status.className = 'status ok';
    });
    logoPicker.addEventListener('change', async () => {
      const file = logoPicker.files[0];
      if (!file) return;
      logo = await loadImage(await readDataURL(file));
      draw();
    });
    for (const c of [size, opacity, position]) c.addEventListener('input', draw);
    text.addEventListener('input', draw); color.addEventListener('input', draw);

    const run = async () => {
      const files = [...(picker.files || [])];
      if (!files.length) { toast('请先选择图片', 'warn'); return; }
      if (mode.value === 'logo' && !logo) { toast('请先选择 Logo 图片', 'warn'); return; }
      const entries = [];
      for (const file of files) {
        const canvas = await canvasFromImageFile(file);
        applyTo(canvas);
        entries.push([`${baseName(file.name)}-watermarked.jpg`, await canvasToBlob(canvas, 'image/jpeg', 0.92)]);
      }
      if (entries.length === 1) downloadBlob(entries[0][1], entries[0][0]);
      else await zipBlobs(entries, 'watermarked.zip');
      status.textContent = `已导出 ${entries.length} 张`; status.className = 'status ok';
    };
    root.append(
      panel('选择图片（可多选）', picker),
      panel('水印设置', mode, text, logoPicker,
        el('div', { class: 'inline-fields' }, labeled('大小', size), labeled('透明度', opacity), labeled('颜色', color), labeled('位置', position))),
      actions(btn('导出带水印图片', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, panel('预览', preview),
      hint('文字水印用所选颜色；Logo 水印保持原色只调透明度。平铺模式适合防盗图。'),
    );
  },
};

export const imageProTools = [compressToSize, passportPhoto, svgToPng, imageToIco, imageAdjust, roundCorners, imageWatermark];
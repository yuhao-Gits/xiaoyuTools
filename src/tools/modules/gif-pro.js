/* GIF 系列：多图合成 / 压缩 / 拆帧 / 编辑 / 合并 / 雪碧图 / 转视频。
   解码与编码均为本项目自写实现（shared.js），调色板用中位切分。 */
import {
  el, inp, sel, btn, panel, actions, hint, toast, filePicker,
  readDataURL, loadImage, canvasToBlob, downloadBlob, formatBytes, resultBox, labeled,
} from '../../core/ui.js';
import {
  makeCanvas, num, clamp, zipBlobs, encodeGif, decodeGif, quantizePalette, gifFrameCanvases,
} from './shared.js';

const baseName = name => (name || 'anim').replace(/\.[^.]+$/, '') || 'anim';
const previewImg = () => el('img', { class: 'preview-img', alt: 'GIF 预览', style: 'max-width:100%' });

function framesFromCanvases(canvases) {
  return canvases.map(c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
}
function encodeSmart(canvases, delays) {
  const w = canvases[0].width, h = canvases[0].height;
  const frames = framesFromCanvases(canvases);
  const palette = quantizePalette(frames, w, h);
  return encodeGif(frames, w, h, 10, { palette, delays });
}
const showGif = (img, blob, status, extra = '') => {
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  status.textContent = `已生成 ${formatBytes(blob.size)}${extra}`;
  status.className = 'status ok';
};

/* ---------- 多图合成 GIF ---------- */
const imagesToGif = {
  id: 'images-to-gif', name: '多图合成 GIF', category: 'image',
  desc: '把多张图片按顺序合成动图，可调速度 / 尺寸 / 循环',
  keywords: ['GIF', '动图', '合成', '表情包', '定格', '多图'],
  render(root) {
    const picker = filePicker({ accept: 'image/*', multiple: true });
    const fps = inp({ type: 'number', min: '1', max: '30', value: '4', class: 'input' });
    const maxW = inp({ type: 'number', min: '64', max: '1280', value: '480', class: 'input' });
    const loop = inp({ type: 'checkbox', checked: true });
    const preview = previewImg();
    const status = el('div', { class: 'status' });
    let blob = null, name = 'animation';
    const run = async () => {
      const files = [...(picker.files || [])];
      if (files.length < 2) { toast('至少选择两张图片', 'warn'); return; }
      status.textContent = '合成中…'; status.className = 'status';
      const images = [];
      for (const f of files) images.push(await loadImage(await readDataURL(f)));
      const w = Math.min(num(maxW.value, 480), Math.max(...images.map(i => i.naturalWidth)));
      const h = Math.round(w * Math.max(...images.map(i => i.naturalHeight / i.naturalWidth)));
      const canvases = images.map(img => {
        const c = makeCanvas(w, h);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * ratio, dh = img.naturalHeight * ratio;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return c;
      });
      const delay = Math.max(2, Math.round(100 / num(fps.value, 4)));
      blob = encodeSmart(canvases, canvases.map(() => delay));
      name = baseName(files[0].name);
      showGif(preview, blob, status, ` · ${canvases.length} 帧 · ${w}×${h}`);
    };
    root.append(
      panel('选择图片（按选择顺序播放）', picker),
      panel('参数', el('div', { class: 'inline-fields' }, labeled('帧率 fps', fps), labeled('最大宽度 px', maxW)),
        el('label', { class: 'check' }, loop, el('span', { text: '无限循环' }))),
      actions(
        btn('合成 GIF', () => run().catch(e => toast(e.message, 'warn')), 'primary'),
        btn('下载', () => { if (blob) downloadBlob(blob, `${name}.gif`); else toast('请先合成', 'warn'); }),
      ),
      status, panel('预览', preview),
      hint('图片等比缩放居中补白底；256 色中位切分调色板，色彩丰富度略低于原图。'),
    );
  },
};

/* ---------- GIF 压缩 ---------- */
const GIF_TARGETS = [
  { value: '256', label: '256KB（Discord 表情）' },
  { value: '512', label: '512KB（Discord 贴纸）' },
  { value: '1024', label: '1MB（微信表情 / 邮件）' },
  { value: '5120', label: '5MB（微信 / Slack）' },
  { value: '10240', label: '10MB（高质量分享）' },
  { value: 'custom', label: '自定义 KB…' },
];
const gifCompressor = {
  id: 'gif-compressor', name: 'GIF 压缩', category: 'image',
  desc: '缩尺寸 / 抽帧 / 调色板优化，压到微信 1MB / 5MB 等平台限制',
  keywords: ['GIF', '压缩', '微信', '表情包', '1MB', '5MB', 'Discord'],
  render(root) {
    const picker = filePicker({ accept: 'image/gif,.gif' });
    const target = sel(GIF_TARGETS, '1024');
    const custom = inp({ type: 'number', min: '10', max: '51200', value: '800', class: 'input' });
    custom.style.display = 'none';
    target.addEventListener('change', () => { custom.style.display = target.value === 'custom' ? '' : 'none'; });
    const maxW = inp({ type: 'number', min: '64', max: '1280', value: '480', class: 'input' });
    const output = resultBox();
    const preview = previewImg();
    const status = el('div', { class: 'status' });
    let decoded = null, blob = null, name = 'anim', origSize = 0;

    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      try {
        decoded = decodeGif(await file.arrayBuffer());
        name = baseName(file.name); origSize = file.size;
        status.textContent = `已载入 ${file.name} · ${decoded.frames.length} 帧 · ${decoded.width}×${decoded.height} · ${formatBytes(file.size)}`;
        status.className = 'status ok';
      } catch (error) { status.textContent = error.message; status.className = 'status bad'; }
    });

    const build = (width, skip) => {
      const ratio = width / decoded.width;
      const h = Math.max(1, Math.round(decoded.height * ratio));
      const canvases = [], delays = [];
      decoded.frames.forEach((f, i) => {
        if (i % skip !== 0) return;
        const src = makeCanvas(decoded.width, decoded.height);
        src.getContext('2d').putImageData(new ImageData(f.data, decoded.width, decoded.height), 0, 0);
        const c = makeCanvas(width, h);
        c.getContext('2d').drawImage(src, 0, 0, width, h);
        canvases.push(c);
        delays.push(Math.max(2, f.delayCs * skip));
      });
      return encodeSmart(canvases, delays);
    };
    const run = async () => {
      if (!decoded) { toast('请先选择 GIF', 'warn'); return; }
      const goal = (target.value === 'custom' ? num(custom.value, 800) : num(target.value, 1024)) * 1024;
      status.textContent = '压缩中…'; status.className = 'status';
      let width = Math.min(num(maxW.value, 480), decoded.width);
      let skip = 1, best = null;
      for (let round = 0; round < 14; round += 1) {
        best = build(Math.max(48, Math.round(width)), skip);
        if (best.size <= goal) break;
        if (skip < 4 && decoded.frames.length / skip > 4) skip += 1;
        else width *= 0.8;
        if (width < 48 && skip >= 4) break;
      }
      blob = best;
      showGif(preview, blob, status);
      output.set([
        `原始  ${formatBytes(origSize)}  ${decoded.width}×${decoded.height}  ${decoded.frames.length} 帧`,
        `压缩后  ${formatBytes(blob.size)}  ${blob.size <= goal ? '达标' : '略超目标（已尽力）'}`,
        `策略  宽度上限 ${Math.round(width)}px · 每 ${skip} 帧取 1 帧 · 中位切分调色板`,
      ].join('\n'));
    };
    root.append(
      panel('选择 GIF', picker),
      panel('目标', el('div', { class: 'inline-fields' }, labeled('体积档位', target), labeled('自定义 KB', custom), labeled('宽度上限 px', maxW))),
      actions(
        btn('开始压缩', () => run().catch(e => toast(e.message, 'warn')), 'primary'),
        btn('下载', () => { if (blob) downloadBlob(blob, `${name}-compressed.gif`); else toast('请先压缩', 'warn'); }),
      ),
      status, output.node, panel('预览', preview),
      hint('先抽帧再缩尺寸，循环播放；GIF 为 256 色格式，压缩以牺牲少量色彩与帧数换体积。'),
    );
  },
};

/* ---------- GIF 拆帧 ---------- */
const gifFrameExtractor = {
  id: 'gif-frame-extractor', name: 'GIF 拆帧', category: 'image',
  desc: '把动图拆成逐帧 PNG，全部 / 首帧 / 按步长抽帧，ZIP 打包',
  keywords: ['GIF', '拆帧', '提取', '帧', 'PNG', '分解'],
  render(root) {
    const picker = filePicker({ accept: 'image/gif,.gif' });
    const mode = sel([{ value: 'all', label: '全部帧' }, { value: 'first', label: '仅首帧' }, { value: 'step', label: '按步长抽帧' }], 'all');
    const step = inp({ type: 'number', min: '2', max: '30', value: '3', class: 'input' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let decoded = null, name = 'anim';
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      try {
        decoded = decodeGif(await file.arrayBuffer());
        name = baseName(file.name);
        status.textContent = `已载入 · ${decoded.frames.length} 帧 · ${decoded.width}×${decoded.height}`;
        status.className = 'status ok';
      } catch (error) { status.textContent = error.message; status.className = 'status bad'; }
    });
    const run = async () => {
      if (!decoded) { toast('请先选择 GIF', 'warn'); return; }
      const canvases = gifFrameCanvases(decoded);
      const chosen = mode.value === 'first' ? [0]
        : mode.value === 'step' ? canvases.map((_, i) => i).filter(i => i % num(step.value, 3) === 0)
        : canvases.map((_, i) => i);
      const entries = [];
      for (const i of chosen) entries.push([`frame-${String(i + 1).padStart(3, '0')}.png`, await canvasToBlob(canvases[i], 'image/png')]);
      if (entries.length === 1) downloadBlob(entries[0][1], `${name}-frame1.png`);
      else await zipBlobs(entries, `${name}-frames.zip`);
      output.set(`已导出 ${entries.length} 帧（共 ${canvases.length} 帧）`);
      status.textContent = '导出完成'; status.className = 'status ok';
    };
    root.append(
      panel('选择 GIF', picker),
      panel('导出范围', el('div', { class: 'inline-fields' }, labeled('模式', mode), labeled('步长', step))),
      actions(btn('导出 PNG', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, output.node,
      hint('帧已按 GIF disposal 规则合成为完整画面，直接可用。'),
    );
  },
};

/* ---------- GIF 编辑 ---------- */
const gifEditor = {
  id: 'gif-editor', name: 'GIF 编辑', category: 'image',
  desc: '倒放 / 变速 / 截取 / 旋转 / 裁剪 / 加文字，一件搞定',
  keywords: ['GIF', '编辑', '倒放', '变速', '裁剪', '旋转', '加文字', '截取'],
  render(root) {
    const picker = filePicker({ accept: 'image/gif,.gif' });
    const speed = sel([{ value: '0.5', label: '0.5×（放慢）' }, { value: '1', label: '1×（原速）' }, { value: '1.5', label: '1.5×' }, { value: '2', label: '2×（加快）' }, { value: '3', label: '3×' }], '1');
    const reverse = inp({ type: 'checkbox' });
    const rotate = sel([{ value: '0', label: '不旋转' }, { value: '90', label: '顺时针 90°' }, { value: '180', label: '180°' }, { value: '270', label: '逆时针 90°' }], '0');
    const trimStart = inp({ type: 'number', min: '1', value: '1', class: 'input' });
    const trimEnd = inp({ type: 'number', min: '1', value: '1', class: 'input' });
    const crop = inp({ type: 'text', class: 'input', placeholder: '裁剪 左,上,右,下（%）如 10,10,90,90' });
    const text = inp({ type: 'text', class: 'input', placeholder: '加文字（留空不加）' });
    const textPos = sel([{ value: 'bottom', label: '底部' }, { value: 'top', label: '顶部' }], 'bottom');
    const preview = previewImg();
    const status = el('div', { class: 'status' });
    let decoded = null, blob = null, name = 'anim';
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      try {
        decoded = decodeGif(await file.arrayBuffer());
        name = baseName(file.name);
        trimEnd.value = decoded.frames.length;
        status.textContent = `已载入 · ${decoded.frames.length} 帧`; status.className = 'status ok';
      } catch (error) { status.textContent = error.message; status.className = 'status bad'; }
    });
    const run = async () => {
      if (!decoded) { toast('请先选择 GIF', 'warn'); return; }
      let canvases = gifFrameCanvases(decoded);
      let delays = decoded.frames.map(f => f.delayCs);
      const s = clamp(num(trimStart.value, 1), 1, canvases.length);
      const e = clamp(num(trimEnd.value, canvases.length), s, canvases.length);
      canvases = canvases.slice(s - 1, e); delays = delays.slice(s - 1, e);
      if (reverse.checked) { canvases.reverse(); delays.reverse(); }
      delays = delays.map(d => Math.max(2, Math.round(d / num(speed.value, 1))));
      const deg = num(rotate.value, 0);
      if (deg) {
        canvases = canvases.map(c => {
          const swap = deg % 180 !== 0;
          const out = makeCanvas(swap ? c.height : c.width, swap ? c.width : c.height);
          const ctx = out.getContext('2d');
          ctx.translate(out.width / 2, out.height / 2);
          ctx.rotate(deg * Math.PI / 180);
          ctx.drawImage(c, -c.width / 2, -c.height / 2);
          return out;
        });
      }
      const m = (crop.value || '').match(/([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (m) {
        const [l, t, r, b] = m.slice(1, 5).map(Number);
        canvases = canvases.map(c => {
          const x = Math.round(c.width * clamp(l, 0, 99) / 100);
          const y = Math.round(c.height * clamp(t, 0, 99) / 100);
          const w = Math.max(2, Math.round(c.width * clamp(r, l + 1, 100) / 100) - x);
          const h = Math.max(2, Math.round(c.height * clamp(b, t + 1, 100) / 100) - y);
          const out = makeCanvas(w, h);
          out.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
          return out;
        });
      }
      if (text.value.trim()) {
        canvases = canvases.map(c => {
          const ctx = c.getContext('2d');
          const fs = Math.max(12, Math.round(c.height * 0.1));
          ctx.font = `700 ${fs}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = Math.max(2, fs / 8);
          ctx.strokeStyle = '#000000'; ctx.fillStyle = '#ffffff';
          const y = textPos.value === 'top' ? fs * 1.2 : c.height - fs * 0.4;
          ctx.strokeText(text.value.trim(), c.width / 2, y);
          ctx.fillText(text.value.trim(), c.width / 2, y);
          return c;
        });
      }
      blob = encodeSmart(canvases, delays);
      showGif(preview, blob, status, ` · ${canvases.length} 帧`);
    };
    root.append(
      panel('选择 GIF', picker),
      panel('编辑操作',
        el('div', { class: 'inline-fields' }, labeled('速度', speed), labeled('旋转', rotate), labeled('起始帧', trimStart), labeled('结束帧', trimEnd)),
        el('label', { class: 'check' }, reverse, el('span', { text: '倒放' })),
        el('div', { class: 'inline-fields' }, labeled('裁剪 %', crop), labeled('文字', text), labeled('文字位置', textPos))),
      actions(
        btn('应用并预览', () => run().catch(e => toast(e.message, 'warn')), 'primary'),
        btn('下载', () => { if (blob) downloadBlob(blob, `${name}-edited.gif`); else toast('请先应用', 'warn'); }),
      ),
      status, panel('预览', preview),
      hint('操作按 截取→倒放→变速→旋转→裁剪→文字 顺序叠加；帧数与尺寸变化后重新量化调色板。'),
    );
  },
};

/* ---------- GIF 合并 ---------- */
const gifMerger = {
  id: 'gif-merger', name: 'GIF 合并', category: 'image',
  desc: '多个动图按顺序接成一段，自动统一尺寸',
  keywords: ['GIF', '合并', '拼接', '连接'],
  render(root) {
    const picker = filePicker({ accept: 'image/gif,.gif', multiple: true });
    const preview = previewImg();
    const status = el('div', { class: 'status' });
    let blob = null;
    const run = async () => {
      const files = [...(picker.files || [])];
      if (files.length < 2) { toast('至少选择两个 GIF', 'warn'); return; }
      status.textContent = '合并中…'; status.className = 'status';
      const parts = [];
      for (const f of files) parts.push(decodeGif(await f.arrayBuffer()));
      const w = Math.max(...parts.map(p => p.width));
      const h = Math.max(...parts.map(p => p.height));
      const canvases = [], delays = [];
      for (const part of parts) {
        part.frames.forEach(f => {
          const src = makeCanvas(part.width, part.height);
          src.getContext('2d').putImageData(new ImageData(f.data, part.width, part.height), 0, 0);
          const c = makeCanvas(w, h);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(src, (w - part.width) / 2, (h - part.height) / 2);
          canvases.push(c); delays.push(Math.max(2, f.delayCs));
        });
      }
      blob = encodeSmart(canvases, delays);
      showGif(preview, blob, status, ` · ${canvases.length} 帧 · ${w}×${h}`);
    };
    root.append(
      panel('选择多个 GIF（按选择顺序）', picker),
      actions(
        btn('合并', () => run().catch(e => toast(e.message, 'warn')), 'primary'),
        btn('下载', () => { if (blob) downloadBlob(blob, 'merged.gif'); else toast('请先合并', 'warn'); }),
      ),
      status, panel('预览', preview),
      hint('尺寸不一致时居中补黑边；各段保留原帧延迟。'),
    );
  },
};

/* ---------- GIF 雪碧图 ---------- */
const gifSprite = {
  id: 'gif-sprite', name: 'GIF 雪碧图', category: 'image',
  desc: 'GIF ↔ 雪碧图互转：导出网格大图，或从网格重建动图',
  keywords: ['GIF', '雪碧图', 'sprite', 'CSS', '游戏', '网格'],
  render(root) {
    const mode = sel([{ value: 'toSprite', label: 'GIF → 雪碧图' }, { value: 'toGif', label: '雪碧图 → GIF' }], 'toSprite');
    const gifPicker = filePicker({ accept: 'image/gif,.gif' });
    const imgPicker = filePicker({ accept: 'image/*' });
    imgPicker.style.display = 'none';
    const cols = inp({ type: 'number', min: '1', max: '32', value: '8', class: 'input' });
    const rows = inp({ type: 'number', min: '1', max: '32', value: '4', class: 'input' });
    const fps = inp({ type: 'number', min: '1', max: '30', value: '8', class: 'input' });
    const toGifFields = el('div', { class: 'inline-fields' }, labeled('列数', cols), labeled('行数', rows), labeled('帧率', fps));
    toGifFields.style.display = 'none';
    mode.addEventListener('change', () => {
      gifPicker.style.display = mode.value === 'toSprite' ? '' : 'none';
      imgPicker.style.display = mode.value === 'toGif' ? '' : 'none';
      toGifFields.style.display = mode.value === 'toGif' ? '' : 'none';
    });
    const preview = previewImg();
    const status = el('div', { class: 'status' });
    let blob = null;
    const run = async () => {
      if (mode.value === 'toSprite') {
        const file = gifPicker.files[0];
        if (!file) { toast('请先选择 GIF', 'warn'); return; }
        const decoded = decodeGif(await file.arrayBuffer());
        const canvases = gifFrameCanvases(decoded);
        const n = num(cols.value, 8);
        const r = Math.ceil(canvases.length / n);
        const sheet = makeCanvas(decoded.width * n, decoded.height * r);
        const ctx = sheet.getContext('2d');
        canvases.forEach((c, i) => ctx.drawImage(c, (i % n) * decoded.width, Math.floor(i / n) * decoded.height));
        blob = await canvasToBlob(sheet, 'image/png');
        downloadBlob(blob, 'sprite-sheet.png');
        preview.src = URL.createObjectURL(blob);
        status.textContent = `雪碧图 ${sheet.width}×${sheet.height} · ${canvases.length} 帧 · ${n} 列 ${r} 行`;
        status.className = 'status ok';
      } else {
        const file = imgPicker.files[0];
        if (!file) { toast('请先选择雪碧图', 'warn'); return; }
        const img = await loadImage(await readDataURL(file));
        const n = num(cols.value, 8), r = num(rows.value, 4);
        const fw = Math.floor(img.naturalWidth / n), fh = Math.floor(img.naturalHeight / r);
        const canvases = [];
        for (let i = 0; i < n * r; i += 1) {
          const c = makeCanvas(fw, fh);
          c.getContext('2d').drawImage(img, (i % n) * fw, Math.floor(i / n) * fh, fw, fh, 0, 0, fw, fh);
          canvases.push(c);
        }
        const delay = Math.max(2, Math.round(100 / num(fps.value, 8)));
        blob = encodeSmart(canvases, canvases.map(() => delay));
        showGif(preview, blob, status, ` · ${canvases.length} 帧`);
        downloadBlob(blob, 'from-sprite.gif');
      }
    };
    root.append(
      panel('方向', mode),
      panel('输入', gifPicker, imgPicker),
      panel('网格参数', el('div', { class: 'inline-fields' }, labeled('列数', cols)), toGifFields),
      actions(btn('转换', () => run().catch(e => toast(e.message, 'warn')), 'primary')),
      status, panel('预览', preview),
      hint('GIF→雪碧图按列数排布；雪碧图→GIF 按行列均分切帧，适合 CSS 动画与游戏素材。'),
    );
  },
};

/* ---------- GIF 转视频 ---------- */
const gifToVideo = {
  id: 'gif-to-video', name: 'GIF 转视频', category: 'image',
  desc: '动图转 WebM / MP4 视频，体积更小播放更流畅',
  keywords: ['GIF', '视频', 'MP4', 'WebM', '转换'],
  render(root) {
    const picker = filePicker({ accept: 'image/gif,.gif' });
    const loops = inp({ type: 'number', min: '1', max: '10', value: '2', class: 'input' });
    const preview = el('video', { class: 'preview-img', controls: true, style: 'max-width:100%' });
    const status = el('div', { class: 'status' });
    let blob = null, ext = 'webm';
    const run = async () => {
      const file = picker.files[0];
      if (!file) { toast('请先选择 GIF', 'warn'); return; }
      const decoded = decodeGif(await file.arrayBuffer());
      const canvases = gifFrameCanvases(decoded);
      const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=avc1'].filter(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      if (!candidates.length) { toast('当前浏览器不支持视频录制', 'warn'); return; }
      const canvas = makeCanvas(decoded.width, decoded.height);
      canvas.style.cssText = 'position:absolute;left:-9999px;top:0;';
      root.append(canvas);
      const ctx = canvas.getContext('2d');
      const n = num(loops.value, 2);
      const record = async mime => {
        const stream = canvas.captureStream(0);
        const track = stream.getVideoTracks()[0];
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        const done = new Promise(res => { rec.onstop = res; });
        rec.start(250);
        for (let l = 0; l < n; l += 1) {
          for (let i = 0; i < canvases.length; i += 1) {
            ctx.drawImage(canvases[i], 0, 0);
            if (track.requestFrame) track.requestFrame();
            await new Promise(r => setTimeout(r, Math.max(30, decoded.frames[i].delayCs * 10)));
          }
        }
        await new Promise(r => setTimeout(r, 300));
        rec.stop();
        await done;
        stream.getTracks().forEach(t => t.stop());
        return new Blob(chunks, { type: mime.split(';')[0] });
      };
      status.textContent = '录制中（实时播放一遍）…'; status.className = 'status';
      let mime = candidates[0];
      blob = null;
      for (const candidate of candidates) {
        mime = candidate;
        blob = await record(candidate);
        if (blob.size) break;
      }
      canvas.remove();
      ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      if (!blob || !blob.size) { status.textContent = '录制失败：浏览器未产出视频数据'; status.className = 'status bad'; return; }
      preview.src = URL.createObjectURL(blob);
      status.textContent = `已生成 ${ext.toUpperCase()} · ${formatBytes(blob.size)}（原 GIF ${formatBytes(file.size)}）`;
      status.className = 'status ok';
    };
    root.append(
      panel('选择 GIF', picker),
      panel('参数', labeled('循环次数', loops)),
      actions(
        btn('转换', () => run().catch(e => toast(e.message, 'warn')), 'primary'),
        btn('下载', () => { if (blob) downloadBlob(blob, `animation.${ext}`); else toast('请先转换', 'warn'); }),
      ),
      status, panel('预览', preview),
      hint('用浏览器原生录制：支持 MP4 的浏览器出 MP4，否则出 WebM；转换按帧延迟实时播放，请耐心等待。'),
    );
  },
};

export const gifProTools = [imagesToGif, gifCompressor, gifFrameExtractor, gifEditor, gifMerger, gifSprite, gifToVideo];
/* 图片类补充工具：全部使用 Canvas / FileReader / MediaRecorder 等浏览器原生 API。 */
import {
  panel, filePicker, inp, sel, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadBlob, formatBytes,
} from '../../core/ui.js';
import {
  canvasFromImageFile, makeCanvas, num, clamp, zipBlobs,
} from './shared.js';

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const mimeExt = type => MIME_EXT[type] || 'png';
const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

function paintOn(canvas, source, background) {
  const ctx = canvas.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function sourceCanvas(file) {
  return canvasFromImageFile(file, { max: 4096 });
}

/* 格式互转 / 压缩共用一个实现，参数不同。 */
function transformTool({ id, name, desc, type, keywords, scale = 100 }) {
  return {
    id, name, category: 'image', desc, keywords,
    render(root) {
      const picker = filePicker({ accept: 'image/*' });
      const quality = inp({ type: 'range', min: '0.3', max: '1', step: '0.05', value: '0.85' });
      const scaleInput = inp({ type: 'range', min: '20', max: '100', step: '5', value: String(scale) });
      const bgColor = inp({ type: 'color', value: '#ffffff', class: 'input color-input' });
      const needsFill = type === 'image/jpeg' || type === 'auto';
      const preview = el('img', { class: 'preview-img', alt: '处理结果预览' });
      const output = resultBox();
      const status = el('div', { class: 'status' });
      let result = null;

      const run = async () => {
        const file = picker.files && picker.files[0];
        if (!file) { output.set('请先选择一张图片'); return; }
        status.textContent = '正在本机处理…';
        try {
          const source = await sourceCanvas(file);
          const ratio = clamp(num(scaleInput.value, 100), 20, 100) / 100;
          const outType = type === 'auto' ? (file.type === 'image/png' ? 'image/png' : 'image/jpeg') : type;
          const canvas = makeCanvas(
            Math.max(1, Math.round(source.width * ratio)),
            Math.max(1, Math.round(source.height * ratio)),
          );
          paintOn(canvas, source, outType === 'image/jpeg' ? bgColor.value : null);
          const blob = await toBlob(canvas, outType, num(quality.value, 0.85));
          if (!blob) throw new Error('浏览器未能导出该格式');
          const actual = blob.type || outType;
          result = { blob, ext: mimeExt(actual), base: file.name.replace(/\.[^.]+$/, '') };
          preview.src = URL.createObjectURL(blob);
          const saved = file.size - blob.size;
          output.set([
            `源文件   ${file.name}  ${source.width}×${source.height}  ${formatBytes(file.size)}`,
            `输出     ${actual}  ${canvas.width}×${canvas.height}  ${formatBytes(blob.size)}`,
            `体积变化 ${saved >= 0 ? '减少' : '增加'} ${formatBytes(Math.abs(saved))}（${Math.abs(saved / file.size * 100).toFixed(1)}%）`,
            actual !== outType ? `注意：浏览器不支持 ${outType}，已自动回退为 ${actual}` : '',
          ].filter(Boolean).join('\n'));
          status.textContent = '处理完成，可下载';
        } catch (error) {
          status.textContent = '';
          output.set(`处理失败：${error.message}`);
        }
      };

      root.append(panel('图片处理', picker,
        el('div', { class: 'inline-fields' }, labeled('输出质量', quality), labeled('缩放 %', scaleInput),
          ...(needsFill ? [labeled('透明区底色', bgColor)] : [])),
        actions(btn('开始处理', run, 'primary'),
          btn('下载结果', () => result
            ? downloadBlob(result.blob, `${result.base}.${result.ext}`)
            : toast('请先处理图片', 'warn'))),
        preview, output.node, status,
        hint('图片只在本机 Canvas 里重绘，不上传；JPEG 会补白底，WebP 支持取决于浏览器。')));
    },
  };
}

const converters = [
  transformTool({ id: 'png-to-jpg', name: 'PNG 转 JPG', desc: '透明区域补底色（默认白）后转 JPEG', type: 'image/jpeg', keywords: ['png', 'jpg', 'jpeg', '格式转换', '底色'] }),
  transformTool({ id: 'jpg-to-webp', name: 'JPG 转 WebP', desc: '转 WebP 以减小体积', type: 'image/webp', keywords: ['jpg', 'webp', '格式转换'] }),
  transformTool({ id: 'png-to-webp', name: 'PNG 转 WebP', desc: '带透明通道转 WebP', type: 'image/webp', keywords: ['png', 'webp', '格式转换'] }),
  transformTool({ id: 'webp-to-jpg', name: 'WebP 转 JPG', desc: 'WebP 解码后转 JPEG', type: 'image/jpeg', keywords: ['webp', 'jpg', '格式转换'] }),
  transformTool({ id: 'webp-to-png', name: 'WebP 转 PNG', desc: 'WebP 解码后转 PNG', type: 'image/png', keywords: ['webp', 'png', '格式转换'] }),
  transformTool({ id: 'compress-image', name: '压缩图片', desc: '按原格式降质量 / 缩放，实时对比体积', type: 'auto', scale: 80, keywords: ['压缩', '瘦身', 'compress', '图片'] }),
];

/* ---------- 调整尺寸 ---------- */
const imageResizer = {
  id: 'image-resizer', name: '调整图片大小', category: 'image',
  desc: '按宽高 / 百分比缩放，内置 YouTube / Instagram / 淘宝等平台预设',
  keywords: ['尺寸', '缩放', 'resize', '宽高', 'YouTube', 'Instagram', '封面', '头像', '主图', '预设'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const preset = sel([
      { value: '', label: '自定义尺寸' },
      { value: '1280x720', label: 'YouTube 封面 1280×720' },
      { value: '1080x1080', label: 'Instagram 方图 1080×1080' },
      { value: '1080x1350', label: 'Instagram 竖图 1080×1350' },
      { value: '1500x500', label: 'Twitter/X 头图 1500×500' },
      { value: '1600x900', label: 'Twitter/X 推文 1600×900' },
      { value: '820x312', label: 'Facebook 封面 820×312' },
      { value: '900x383', label: '公众号封面 900×383' },
      { value: '1242x1660', label: '小红书 3:4 1242×1660' },
      { value: '800x800', label: '淘宝主图 800×800' },
      { value: '240x240', label: '微信头像 240×240' },
      { value: '512x512', label: '应用图标 512×512' },
      { value: '256x256', label: '图标 256×256' },
      { value: '100x100', label: '论坛头像 100×100' },
    ], '');
    const width = inp({ type: 'number', min: '1', value: '800' });
    const height = inp({ type: 'number', min: '1', value: '600' });
    const keep = el('input', { type: 'checkbox', checked: true });
    const fit = sel([
      { value: 'stretch', label: '拉伸到目标尺寸' },
      { value: 'cover', label: '裁剪填满（不变形）' },
      { value: 'contain', label: '等比留白（不变形）' },
    ], 'cover');
    const percent = inp({ type: 'number', min: '5', max: '400', value: '100' });
    preset.addEventListener('change', () => {
      if (!preset.value) return;
      const [w, h] = preset.value.split('x').map(Number);
      width.value = w; height.value = h;
      keep.checked = false;
    });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let origin = null, result = null;

    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      try {
        const c = await sourceCanvas(file);
        origin = { w: c.width, h: c.height, name: file.name };
        width.value = c.width; height.value = c.height;
        output.set(`原图 ${c.width}×${c.height}  ${formatBytes(file.size)}`);
      } catch { output.set('图片读取失败'); }
    });
    width.addEventListener('input', () => {
      if (keep.checked && origin) height.value = Math.max(1, Math.round(num(width.value) * origin.h / origin.w));
    });
    height.addEventListener('input', () => {
      if (keep.checked && origin) width.value = Math.max(1, Math.round(num(height.value) * origin.w / origin.h));
    });

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      try {
        const source = await sourceCanvas(file);
        const p = clamp(num(percent.value, 100), 5, 400) / 100;
        const w = Math.max(1, Math.round(num(width.value, source.width) * p));
        const h = Math.max(1, Math.round(num(height.value, source.height) * p));
        const canvas = makeCanvas(w, h);
        const ctx = canvas.getContext('2d');
        if (fit.value === 'contain') {
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
          const scale = Math.min(w / source.width, h / source.height);
          const dw = source.width * scale, dh = source.height * scale;
          ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
        } else if (fit.value === 'cover') {
          const scale = Math.max(w / source.width, h / source.height);
          const dw = source.width * scale, dh = source.height * scale;
          ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
        } else {
          ctx.drawImage(source, 0, 0, w, h);
        }
        const blob = await toBlob(canvas, 'image/png');
        result = { blob, name: file.name.replace(/\.[^.]+$/, '') };
        output.set(`原图 ${source.width}×${source.height}\n输出 ${w}×${h}（${formatBytes(blob.size)}）`);
        status.textContent = '已生成，可下载 PNG';
      } catch (error) { output.set(`失败：${error.message}`); }
    };

    root.append(panel('尺寸', picker,
      labeled('平台预设', preset),
      el('div', { class: 'inline-fields' },
        labeled('宽 px', width), labeled('高 px', height),
        labeled('锁定比例', keep), labeled('填充方式', fit), labeled('额外缩放 %', percent)),
      actions(btn('生成', run, 'primary'),
        btn('下载 PNG', () => result ? downloadBlob(result.blob, `${result.name}-resized.png`) : toast('请先生成', 'warn'))),
      output.node, status,
      hint('选预设自动填入尺寸；裁剪填满适合封面，等比留白适合商品图；锁定比例时改动任一维度自动换算另一维度。')));
  },
};

/* ---------- 翻转 / 旋转 ---------- */
const flipImage = {
  id: 'flip-image', name: '翻转和旋转图片', category: 'image',
  desc: '水平 / 垂直翻转与 90° 旋转，实时预览', keywords: ['翻转', '旋转', '镜像', 'rotate'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const preview = el('img', { class: 'preview-img', alt: '翻转预览' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let source = null, base = 'image', state = { h: false, v: false, r: 0 }, current = null;

    const draw = () => {
      if (!source) return;
      const quarter = state.r % 2 !== 0;
      const w = quarter ? source.height : source.width;
      const h = quarter ? source.width : source.height;
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate(state.r * Math.PI / 180);
      ctx.scale(state.h ? -1 : 1, state.v ? -1 : 1);
      ctx.drawImage(source, -source.width / 2, -source.height / 2);
      canvas.toBlob(blob => {
        if (!blob) return;
        current = blob;
        preview.src = URL.createObjectURL(blob);
        output.set(`输出 ${w}×${h}  水平${state.h ? '翻转' : '不变'}  垂直${state.v ? '翻转' : '不变'}  旋转 ${state.r}°`);
      }, 'image/png');
    };

    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      try {
        source = await sourceCanvas(file); base = file.name.replace(/\.[^.]+$/, '');
        state = { h: false, v: false, r: 0 }; draw();
        status.textContent = '已载入，点击按钮调整';
      } catch { output.set('图片读取失败'); }
    });

    root.append(panel('变换', picker,
      actions(
        btn('水平翻转', () => { state.h = !state.h; draw(); }),
        btn('垂直翻转', () => { state.v = !state.v; draw(); }),
        btn('左转 90°', () => { state.r = (state.r + 270) % 360; draw(); }),
        btn('右转 90°', () => { state.r = (state.r + 90) % 360; draw(); }),
        btn('复位', () => { state = { h: false, v: false, r: 0 }; draw(); }),
        btn('下载 PNG', () => current ? downloadBlob(current, `${base}-flipped.png`) : toast('请先选择图片', 'warn'), 'primary')),
      preview, output.node, status));
  },
};

/* ---------- 圆形裁剪 ---------- */
const circleCrop = {
  id: 'circle-crop', name: '圆形裁剪', category: 'image',
  desc: '裁成正圆形头像，外部透明', keywords: ['圆形', '头像', '裁剪', 'circle'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const size = inp({ type: 'number', min: '32', max: '2048', value: '512' });
    const bg = inp({ type: 'color', value: '#ffffff', class: 'input color-input' });
    const transparent = el('input', { type: 'checkbox', checked: true });
    const preview = el('img', { class: 'preview-img', alt: '圆形裁剪预览' });
    const status = el('div', { class: 'status' });
    let source = null, current = null;

    const draw = () => {
      if (!source) return;
      const s = clamp(num(size.value, 512), 32, 2048);
      const canvas = makeCanvas(s, s);
      const ctx = canvas.getContext('2d');
      if (!transparent.checked) { ctx.fillStyle = bg.value; ctx.fillRect(0, 0, s, s); }
      ctx.save();
      ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.clip();
      const side = Math.min(source.width, source.height);
      ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, s, s);
      ctx.restore();
      canvas.toBlob(blob => {
        if (!blob) return;
        current = blob; preview.src = URL.createObjectURL(blob);
        status.textContent = `已生成 ${s}×${s} 圆形 PNG`;
      }, 'image/png');
    };
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (file) { source = await sourceCanvas(file); draw(); }
    });
    [size, bg, transparent].forEach(n => n.addEventListener(n.type === 'checkbox' ? 'change' : 'input', draw));

    root.append(panel('圆形裁剪', picker,
      el('div', { class: 'inline-fields' },
        labeled('边长 px', size), labeled('透明背景', transparent), labeled('底色', bg)),
      actions(btn('重新生成', draw), btn('下载 PNG', () => current ? downloadBlob(current, 'circle.png') : toast('请先选择图片', 'warn'), 'primary')),
      preview, status,
      hint('取原图中心正方形区域裁成圆形；勾选透明背景时外部为透明像素。')));
  },
};

/* ---------- 九宫格切割 ---------- */
const imageGridSplit = {
  id: 'image-grid-split', name: '图片九宫格切割', category: 'image',
  desc: '按 2/3/4 等分切成小图并打包下载', keywords: ['九宫格', '切割', '切图', 'grid'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const gridSize = sel([{ value: '2', label: '2 × 2' }, { value: '3', label: '3 × 3（九宫格）' }, { value: '4', label: '4 × 4' }], '3', null);
    const preview = el('div', { class: 'palette-grid' });
    const output = resultBox();
    const status = el('div', { class: 'status' });

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      try {
        const source = await sourceCanvas(file);
        const n = clamp(num(gridSize.value, 3), 2, 6);
        const cw = Math.floor(source.width / n), ch = Math.floor(source.height / n);
        const entries = [];
        preview.replaceChildren();
        for (let r = 0; r < n; r += 1) {
          for (let c = 0; c < n; c += 1) {
            const canvas = makeCanvas(cw, ch);
            canvas.getContext('2d').drawImage(source, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
            const blob = await toBlob(canvas, 'image/png');
            entries.push([`tile-${r + 1}-${c + 1}.png`, blob]);
            const img = el('img', { class: 'palette-chip', src: URL.createObjectURL(blob), title: `第 ${r + 1} 行 ${c + 1} 列` });
            preview.append(img);
          }
        }
        await zipBlobs(entries, `grid-${n}x${n}.zip`);
        output.set(`原图 ${source.width}×${source.height}\n切成 ${n}×${n} = ${entries.length} 张，每块 ${cw}×${ch}\n已打包为 grid-${n}x${n}.zip`);
        status.textContent = '切割完成';
      } catch (error) { output.set(`失败：${error.message}`); }
    };

    root.append(panel('网格切割', picker,
      el('div', { class: 'inline-fields' }, labeled('等分数', gridSize)),
      actions(btn('切割并打包', run, 'primary')),
      preview, output.node, status,
      hint('按整数等分，右侧与底部不足一格的部分会被忽略；结果用本地 JSZip 打包。')));
  },
};

/* ---------- 无缝切图（长图轮播切分） ---------- */
const carouselSplitter = {
  id: 'carousel-splitter', name: '无缝切图', category: 'image',
  desc: '把长图按份数等分，用于轮播拼接', keywords: ['切图', '轮播', '长图', '分割'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const pieces = inp({ type: 'number', min: '2', max: '20', value: '3' });
    const direction = sel([{ value: 'vertical', label: '纵向（长图）' }, { value: 'horizontal', label: '横向（宽图）' }], 'vertical', null);
    const overlap = inp({ type: 'number', min: '0', max: '100', value: '0' });
    const preview = el('div', { class: 'palette-grid' });
    const output = resultBox();
    const status = el('div', { class: 'status' });

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      try {
        const source = await sourceCanvas(file);
        const n = clamp(Math.round(num(pieces.value, 3)), 2, 20);
        const ov = clamp(num(overlap.value, 0), 0, 100);
        const vertical = direction.value === 'vertical';
        const full = vertical ? source.height : source.width;
        const step = Math.floor(full / n);
        const extra = Math.round(step * ov / 100);
        const entries = [];
        preview.replaceChildren();
        for (let i = 0; i < n; i += 1) {
          const start = i * step;
          const length = Math.min(full - start, step + extra);
          const w = vertical ? source.width : length;
          const h = vertical ? length : source.height;
          const canvas = makeCanvas(w, h);
          canvas.getContext('2d').drawImage(source,
            vertical ? 0 : start, vertical ? start : 0, w, h, 0, 0, w, h);
          const blob = await toBlob(canvas, 'image/png');
          entries.push([`slice-${String(i + 1).padStart(2, '0')}.png`, blob]);
          preview.append(el('img', { class: 'palette-chip', src: URL.createObjectURL(blob), title: `第 ${i + 1} 段` }));
        }
        await zipBlobs(entries, 'slices.zip');
        output.set(`原图 ${source.width}×${source.height}\n${vertical ? '纵向' : '横向'}切为 ${n} 段，每段基准 ${step}px，重叠 ${extra}px\n已打包为 slices.zip`);
        status.textContent = '切分完成';
      } catch (error) { output.set(`失败：${error.message}`); }
    };

    root.append(panel('长图切分', picker,
      el('div', { class: 'inline-fields' },
        labeled('份数', pieces), labeled('方向', direction), labeled('重叠 %', overlap)),
      actions(btn('切分并打包', run, 'primary')),
      preview, output.node, status,
      hint('重叠百分比会在每段末尾多带一段，便于拼接时对齐；全部在本机完成。')));
  },
};

/* ---------- 丝网印刷滤镜 ---------- */
const silkScreen = {
  id: 'silk-screen', name: '丝网印刷滤镜', category: 'image',
  desc: '色调分离 + 双色套印，模拟丝网印刷', keywords: ['滤镜', '丝网', '套印', 'posterize', '海报'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const levels = inp({ type: 'range', min: '2', max: '12', value: '4' });
    const colorA = inp({ type: 'color', value: '#101820', class: 'input color-input' });
    const colorB = inp({ type: 'color', value: '#f2c14e', class: 'input color-input' });
    const duotone = el('input', { type: 'checkbox', checked: true });
    const preview = el('img', { class: 'preview-img', alt: '滤镜预览' });
    const status = el('div', { class: 'status' });
    let source = null, current = null;
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) || 0);

    const draw = () => {
      if (!source) return;
      const w = Math.min(source.width, 1400), h = Math.round(source.height * w / source.width);
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const n = clamp(num(levels.value, 4), 2, 12);
      const [ar, ag, ab] = rgb(colorA.value), [br, bg, bb] = rgb(colorB.value);
      for (let i = 0; i < data.data.length; i += 4) {
        const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const step = Math.min(n - 1, Math.floor(lum * n)) / (n - 1);
        if (duotone.checked) {
          data.data[i] = ar + (br - ar) * step;
          data.data[i + 1] = ag + (bg - ag) * step;
          data.data[i + 2] = ab + (bb - ab) * step;
        } else {
          const q = value => Math.round(Math.round(value / 255 * (n - 1)) / (n - 1) * 255);
          data.data[i] = q(r); data.data[i + 1] = q(g); data.data[i + 2] = q(b);
        }
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        current = blob; preview.src = URL.createObjectURL(blob);
        status.textContent = `已应用 ${n} 阶色调分离${duotone.checked ? ' + 双色套印' : ''}`;
      }, 'image/png');
    };
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (file) { source = await sourceCanvas(file); draw(); }
    });
    [levels, colorA, colorB, duotone].forEach(node => node.addEventListener(node.type === 'checkbox' ? 'change' : 'input', draw));

    root.append(panel('套印参数', picker,
      el('div', { class: 'inline-fields' },
        labeled('色阶', levels), labeled('暗色', colorA), labeled('亮色', colorB), labeled('双色套印', duotone)),
      actions(btn('重新生成', draw), btn('下载 PNG', () => current ? downloadBlob(current, 'silkscreen.png') : toast('请先选择图片', 'warn'), 'primary')),
      preview, status,
      hint('按亮度量化色阶，再映射到两种颜色；大图会先缩到 1400px 宽以控制内存。')));
  },
};

/* ---------- 图片镜头动画 ---------- */
const photoMotionMaker = {
  id: 'photo-motion-maker', name: '图片镜头动画', category: 'image',
  desc: '缓慢推拉 / 平移，导出 WebM 动效片段', keywords: ['镜头', '动画', 'Ken Burns', '视频', '动图'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const motion = sel([
      { value: 'zoom-in', label: '推近' }, { value: 'zoom-out', label: '拉远' },
      { value: 'pan-right', label: '右移' }, { value: 'pan-left', label: '左移' },
    ], 'zoom-in', null);
    const seconds = inp({ type: 'number', min: '1', max: '20', value: '5' });
    const fps = sel([{ value: '24', label: '24 fps' }, { value: '30', label: '30 fps' }], '30', null);
    const canvas = makeCanvas(960, 540);
    canvas.className = 'board-canvas';
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let recording = false;

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      if (recording) { output.set('正在录制中，请稍候'); return; }
      const Rec = typeof window !== 'undefined' ? window.MediaRecorder : null;
      if (!Rec || !canvas.captureStream) {
        output.set('当前浏览器不支持 MediaRecorder / captureStream，无法导出视频。\n可改用「视频转 GIF」或「视频截图」工具。');
        return;
      }
      try {
        const image = await canvasFromImageFile(file, { max: 2000 });
        const stream = canvas.captureStream(num(fps.value, 30));
        const mime = Rec.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new Rec(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          recording = false;
          const blob = new Blob(chunks, { type: 'video/webm' });
          if (!blob.size) {
            output.set('浏览器编码器没有产出任何画面（多见于首次调用编码器时）。\n请再点一次「开始录制并下载」。');
            status.textContent = '录制无输出';
            return;
          }
          downloadBlob(blob, 'motion.webm');
          output.set(`已导出 ${mime}\n时长 ${num(seconds.value, 5)} 秒 / ${num(fps.value, 30)} fps\n大小 ${formatBytes(blob.size)}`);
          status.textContent = '录制完成';
        };
        const duration = clamp(num(seconds.value, 5), 1, 20) * 1000;
        const start = performance.now();
        recording = true;
        /* 带 timeslice 才会周期性落盘；不带时限在本机 Chromium 里会得到空容器 */
        recorder.start(250);
        status.textContent = '录制中…';
        const ctx = canvas.getContext('2d');
        const frame = () => {
          const t = Math.min(1, (performance.now() - start) / duration);
          const eased = t * t * (3 - 2 * t);
          let scale = 1, dx = 0;
          if (motion.value === 'zoom-in') scale = 1 + 0.25 * eased;
          else if (motion.value === 'zoom-out') scale = 1.25 - 0.25 * eased;
          else { scale = 1.18; dx = (motion.value === 'pan-right' ? -1 : 1) * 0.09 * eased; }
          const dw = canvas.width * scale, dh = canvas.height * scale;
          const ratio = Math.max(dw / image.width, dh / image.height);
          const sw = dw / ratio, sh = dh / ratio;
          ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image,
            (image.width - sw) / 2 + dx * image.width, (image.height - sh) / 2, sw, sh,
            (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
          if (t < 1) requestAnimationFrame(frame);
          else setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120);
        };
        requestAnimationFrame(frame);
      } catch (error) {
        recording = false;
        output.set(`录制失败：${error.message}`);
      }
    };

    root.append(panel('镜头动效', picker,
      el('div', { class: 'inline-fields' },
        labeled('运镜', motion), labeled('时长（秒）', seconds), labeled('帧率', fps)),
      actions(btn('开始录制并下载', run, 'primary')),
      canvas, output.node, status,
      hint('用 Canvas 逐帧绘制并由浏览器原生编码器录成 WebM；录制需按实时时长等待，不上传素材。')));
  },
};

/* ---------- AI 图片元数据查看器 ---------- */
const aiImageMetadataViewer = {
  id: 'ai-image-metadata-viewer', name: 'AI 图片元数据查看器', category: 'image',
  desc: '读取 PNG 文本块 / JPEG 注释里的生成参数', keywords: ['元数据', 'prompt', 'EXIF', 'PNG', 'AI'],
  render(root) {
    const picker = filePicker();
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let full = '';

    const printable = bytes => {
      let s = '';
      for (const b of bytes) s += (b >= 32 && b < 127) || b === 10 || b === 9 ? String.fromCharCode(b) : '\n';
      return s.split('\n').map(x => x.trim()).filter(x => x.length > 3);
    };
    const parsePng = bytes => {
      const found = [];
      let off = 8;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let size = null;
      while (off + 8 <= bytes.length) {
        const len = dv.getUint32(off);
        const type = String.fromCharCode(...bytes.slice(off + 4, off + 8));
        const data = bytes.slice(off + 8, off + 8 + len);
        if (type === 'IHDR' && len >= 8) size = `${dv.getUint32(off + 8)}×${dv.getUint32(off + 12)}`;
        if (['tEXt', 'iTXt', 'zTXt'].includes(type)) {
          const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
          const parts = text.split('\0');
          found.push(`${type} · ${parts[0] || '(无名)'}：${parts.slice(parts.length > 2 ? 2 : 1).join(' ').slice(0, 4000)}`);
        }
        off += 12 + len;
        if (type === 'IEND') break;
      }
      return { size, found };
    };
    const parseJpeg = bytes => {
      const found = [];
      let off = 2;
      while (off + 4 <= bytes.length) {
        if (bytes[off] !== 0xff) { off += 1; continue; }
        const marker = bytes[off + 1];
        if (marker === 0xd8 || marker === 0xd9) { off += 2; continue; }
        const len = (bytes[off + 2] << 8) + bytes[off + 3];
        if (len < 2) break;
        if (marker === 0xfe || marker === 0xe1 || marker === 0xe2) {
          for (const line of printable(bytes.slice(off + 4, off + 2 + len))) {
            if (/prompt|parameters|model|seed|steps|sampler|negative|software|comment/i.test(line)) found.push(line.slice(0, 2000));
          }
        }
        if (marker === 0xda) break;
        off += 2 + len;
      }
      return { size: null, found: found.slice(0, 40) };
    };

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
        const parsed = isPng ? parsePng(bytes) : isJpeg ? parseJpeg(bytes) : { size: null, found: [] };
        const lines = [
          `文件     ${file.name}`,
          `格式     ${file.type || (isPng ? 'PNG' : isJpeg ? 'JPEG' : '未知')}`,
          `大小     ${formatBytes(file.size)}`,
          parsed.size ? `尺寸     ${parsed.size}` : '',
          '',
          parsed.found.length ? `发现 ${parsed.found.length} 条文本信息：` : '未发现可读的文本元数据（该图片可能不含生成参数，或格式不受支持）。',
          ...parsed.found,
        ].filter(Boolean);
        full = lines.join('\n');
        output.set(full);
        status.textContent = '解析完成，全部在本机读取';
      } catch (error) { output.set(`解析失败：${error.message}`); }
    };

    root.append(panel('读取元数据', picker,
      actions(btn('解析', run, 'primary'), btn('复制结果', () => copyText(full))),
      output.node, status,
      hint('读取 PNG 的 tEXt / iTXt / zTXt 块与 JPEG 的 COM / APP 段文本，常见于本地生成的图片；压缩过的 zTXt 与 CID 编码文本可能不可读，不做 OCR。')));
  },
};

export const imageExtraTools = [
  ...converters, imageResizer, flipImage, circleCrop,
  imageGridSplit, carouselSplitter, silkScreen, photoMotionMaker, aiImageMetadataViewer,
];

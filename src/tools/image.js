import {
  el, inp, sel, btn, panel, actions, hint, toast, filePicker,
  readDataURL, loadImage, canvasToBlob, downloadBlob, formatBytes, copyText, resultBox,
} from '../core/ui.js';

const FORMATS = [
  { value: 'image/png', label: 'PNG（无损）', ext: 'png' },
  { value: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'image/webp', label: 'WebP', ext: 'webp' },
  { value: 'image/avif', label: 'AVIF（更小，需新浏览器）', ext: 'avif' },
  { value: 'image/bmp', label: 'BMP（无损位图）', ext: 'bmp' },
];

/* 24 位 BMP 编码（浏览器 canvas 不原生支持 BMP 导出） */
function canvasToBmp(canvas) {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const rowSize = Math.ceil(w * 3 / 4) * 4;
  const size = 54 + rowSize * h;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  u8[0] = 0x42; u8[1] = 0x4d;
  v.setUint32(2, size, true); v.setUint32(10, 54, true);
  v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true);
  v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, rowSize * h, true);
  v.setUint32(38, 2835, true); v.setUint32(42, 2835, true);
  for (let y = 0; y < h; y += 1) {
    const srcY = h - 1 - y;
    for (let x = 0; x < w; x += 1) {
      const o = (srcY * w + x) * 4;
      const p = 54 + y * rowSize + x * 3;
      u8[p] = data[o + 2]; u8[p + 1] = data[o + 1]; u8[p + 2] = data[o];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

function makeCanvas(width, height) {
  const canvas = el('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function extensionOf(type) {
  return (FORMATS.find(item => item.value === type) || FORMATS[0]).ext;
}

export const imageTools = [
  {
    id: 'image-convert',
    name: '图片压缩 / 格式转换',
    category: 'image',
    desc: 'PNG、JPEG、WebP、AVIF、BMP 互转并可调质量',
    keywords: ['图片', '压缩', '格式', 'png', 'jpeg', 'webp', 'avif', 'bmp', '转换'],
    render(root) {
      const picker = filePicker({ accept: 'image/*' });
      const format = sel(FORMATS.map(item => ({ value: item.value, label: item.label })), 'image/png');
      const quality = inp({ type: 'range', min: '0.1', max: '1', step: '0.05', value: '0.9' });
      const qualityLabel = el('span', { class: 'field-label', text: '质量 90%' });
      quality.addEventListener('input', () => {
        qualityLabel.textContent = `质量 ${Math.round(Number(quality.value) * 100)}%`;
      });
      const preview = el('img', { class: 'preview-img', alt: '输出预览' });
      const status = el('div', { class: 'status' });
      let source = null;
      let baseName = 'image';
      let resultBlob = null;

      picker.addEventListener('change', async () => {
        const file = picker.files[0];
        if (!file) return;
        try {
          const url = await readDataURL(file);
          source = await loadImage(url);
          baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
          preview.src = url;
          status.textContent = `已载入 ${file.name} · ${source.naturalWidth}×${source.naturalHeight} · ${formatBytes(file.size)}`;
          status.className = 'status ok';
        } catch (error) {
          status.textContent = `读取失败：${error.message}`;
          status.className = 'status bad';
        }
      });

      const run = async () => {
        if (!source) {
          toast('请先选择一张图片', 'warn');
          return;
        }
        const type = format.value;
        const canvas = makeCanvas(source.naturalWidth, source.naturalHeight);
        const ctx = canvas.getContext('2d');
        if (type === 'image/jpeg' || type === 'image/bmp') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(source, 0, 0);
        const blob = type === 'image/bmp' ? canvasToBmp(canvas) : await canvasToBlob(canvas, type, Number(quality.value));
        if (!blob) {
          toast('当前浏览器不支持导出该格式', 'warn');
          return;
        }
        resultBlob = blob;
        preview.src = URL.createObjectURL(blob);
        status.textContent = `已生成 ${formatBytes(blob.size)}`;
        status.className = 'status ok';
      };

      root.append(
        panel('选择图片', picker),
        panel('输出设置',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '格式' }), format),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '有损质量' }), quality),
            qualityLabel)),
        actions(
          btn('生成', () => run().catch(error => toast(error.message, 'warn')), 'primary'),
          btn('下载结果', () => {
            if (!resultBlob) { toast('请先点击生成', 'warn'); return; }
            downloadBlob(resultBlob, `${baseName}-xiaoyu.${extensionOf(format.value)}`);
          }),
        ),
        status,
        hint('JPEG / BMP 会用白底填充透明区域；质量滑块只对 JPEG / WebP / AVIF 生效。AVIF 导出需浏览器支持（Chrome / Edge 新版），输入支持浏览器可解码的 AVIF / GIF / BMP 等。'),
        panel('预览', preview),
      );
    },
  },
  {
    id: 'image-crop',
    name: '图片裁剪 / 缩放',
    category: 'image',
    desc: '指定尺寸，按居中裁剪、等比留白或拉伸输出',
    keywords: ['图片', '裁剪', '缩放', '尺寸', 'crop'],
    render(root) {
      const picker = filePicker({ accept: 'image/*' });
      const widthInput = inp({ type: 'number', min: '1', value: '800' });
      const heightInput = inp({ type: 'number', min: '1', value: '800' });
      const mode = sel([
        { value: 'cover', label: '居中裁剪（填满）' },
        { value: 'contain', label: '等比缩放（留白）' },
        { value: 'stretch', label: '直接拉伸' },
      ], 'cover');
      const background = inp({ type: 'color', value: '#ffffff', class: 'input color-input' });
      const preview = el('img', { class: 'preview-img', alt: '裁剪预览' });
      const status = el('div', { class: 'status' });
      let source = null;
      let resultBlob = null;

      picker.addEventListener('change', async () => {
        const file = picker.files[0];
        if (!file) return;
        const url = await readDataURL(file);
        source = await loadImage(url);
        preview.src = url;
        widthInput.value = String(source.naturalWidth);
        heightInput.value = String(source.naturalHeight);
        status.textContent = `已载入 ${file.name} · 原图 ${source.naturalWidth}×${source.naturalHeight}`;
        status.className = 'status ok';
      });

      const run = async () => {
        if (!source) { toast('请先选择一张图片', 'warn'); return; }
        const targetW = Math.max(1, Number(widthInput.value) || 1);
        const targetH = Math.max(1, Number(heightInput.value) || 1);
        const canvas = makeCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        const w = source.naturalWidth;
        const h = source.naturalHeight;

        if (mode.value === 'cover') {
          const scale = Math.max(targetW / w, targetH / h);
          const sw = targetW / scale;
          const sh = targetH / scale;
          ctx.drawImage(source, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, targetW, targetH);
        } else if (mode.value === 'contain') {
          ctx.fillStyle = background.value;
          ctx.fillRect(0, 0, targetW, targetH);
          const scale = Math.min(targetW / w, targetH / h);
          const dw = w * scale;
          const dh = h * scale;
          ctx.drawImage(source, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
        } else {
          ctx.drawImage(source, 0, 0, targetW, targetH);
        }

        const blob = await canvasToBlob(canvas, 'image/png');
        if (!blob) { toast('导出失败', 'warn'); return; }
        resultBlob = blob;
        preview.src = URL.createObjectURL(blob);
        status.textContent = `已生成 ${targetW}×${targetH} · ${formatBytes(blob.size)}`;
        status.className = 'status ok';
      };

      root.append(
        panel('选择图片', picker),
        panel('目标尺寸与方式',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '宽 (px)' }), widthInput),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '高 (px)' }), heightInput),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '方式' }), mode),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '留白底色' }), background))),
        actions(
          btn('生成', () => run().catch(error => toast(error.message, 'warn')), 'primary'),
          btn('下载 PNG', () => {
            if (!resultBlob) { toast('请先点击生成', 'warn'); return; }
            downloadBlob(resultBlob, 'xiaoyuTools-crop.png');
          }),
        ),
        status,
        panel('预览', preview),
      );
    },
  },
  {
    id: 'palette',
    name: '图片配色提取',
    category: 'image',
    desc: '从图片中找出主色，输出可复制的色板',
    keywords: ['图片', '配色', '取色', '色板', 'palette'],
    render(root) {
      const picker = filePicker({ accept: 'image/*' });
      const countSelect = sel([
        { value: '6', label: '6 色' }, { value: '8', label: '8 色' }, { value: '12', label: '12 色' },
      ], '8');
      const status = el('div', { class: 'status' });
      const swatches = el('div', { class: 'palette-grid' });
      const result = resultBox();
      let source = null;

      const analyze = () => {
        if (!source) { toast('请先选择一张图片', 'warn'); return; }
        const maxSide = 400;
        const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = makeCanvas(source.naturalWidth * scale, source.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
          const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          entry.count += 1;
          entry.r += r;
          entry.g += g;
          entry.b += b;
          buckets.set(key, entry);
        }
        const hex = (r, g, b) => '#' + [r, g, b]
          .map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
        const top = Array.from(buckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, Number(countSelect.value))
          .map(entry => hex(entry.r / entry.count, entry.g / entry.count, entry.b / entry.count));
        const total = Array.from(buckets.values()).reduce((sum, entry) => sum + entry.count, 0);
        swatches.replaceChildren(...top.map(color => el('button', {
          class: 'palette-item',
          type: 'button',
          onclick: () => copyText(color),
        },
          el('span', { class: 'palette-chip', style: { background: color } }),
          el('span', { class: 'palette-hex', text: color }))));
        result.set(top.join('\n'));
        status.textContent = `分析完成 · ${canvas.width}×${canvas.height} 采样 · ${total.toLocaleString('zh-CN')} 个像素 · 点击色块复制`;
        status.className = 'status ok';
      };

      picker.addEventListener('change', async () => {
        const file = picker.files[0];
        if (!file) return;
        try {
          source = await loadImage(await readDataURL(file));
          status.textContent = `已载入 ${file.name} · ${source.naturalWidth}×${source.naturalHeight}`;
          status.className = 'status ok';
          analyze();
        } catch (error) {
          status.textContent = `读取失败：${error.message}`;
          status.className = 'status bad';
        }
      });

      root.append(
        panel('选择图片', picker),
        panel('色板数量',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '提取' }), countSelect),
            btn('重新分析', analyze, 'primary')),
          hint('按 4bit 分桶统计像素并取桶内平均色，颜色越靠前占比越高。')),
        status,
        panel('主色（点击复制）', swatches),
        panel('色值列表', result.node),
      );
    },
  },
  {
    id: 'image-stitch',
    name: '图片拼接合并',
    category: 'image',
    desc: '纵向长图 / 横向并排 / 网格排列，多张合一',
    keywords: ['图片', '拼接', '长图', '合并', '横向', '网格', '九宫格'],
    render(root) {
      const picker = filePicker({ accept: 'image/*', multiple: true });
      const direction = sel([
        { value: 'vertical', label: '纵向长图' },
        { value: 'horizontal', label: '横向并排' },
        { value: 'grid', label: '网格排列' },
      ], 'vertical');
      const colsInput = inp({ type: 'number', min: '2', max: '12', value: '3' });
      const colsWrap = el('label', { class: 'field' }, el('span', { class: 'field-label', text: '网格列数' }), colsInput);
      colsWrap.style.display = 'none';
      direction.addEventListener('change', () => { colsWrap.style.display = direction.value === 'grid' ? '' : 'none'; });
      const widthInput = inp({ type: 'number', min: '1', value: '800' });
      const gapInput = inp({ type: 'number', min: '0', value: '0' });
      const background = inp({ type: 'color', value: '#ffffff', class: 'input color-input' });
      const status = el('div', { class: 'status' });
      const preview = el('img', { class: 'preview-img', alt: '拼接预览' });
      let sources = [];
      let resultBlob = null;

      picker.addEventListener('change', async () => {
        const files = Array.from(picker.files || []);
        if (!files.length) return;
        try {
          sources = await Promise.all(files.map(async file => ({
            name: file.name,
            image: await loadImage(await readDataURL(file)),
          })));
          widthInput.value = String(sources[0].image.naturalWidth);
          status.textContent = `已载入 ${sources.length} 张图片，按选择顺序拼接`;
          status.className = 'status ok';
        } catch (error) {
          status.textContent = `读取失败：${error.message}`;
          status.className = 'status bad';
        }
      });

      const run = async () => {
        if (!sources.length) { toast('请先选择至少一张图片', 'warn'); return; }
        const targetWidth = Math.max(1, Number(widthInput.value) || 1);
        const gap = Math.max(0, Number(gapInput.value) || 0);
        const mode = direction.value;
        let canvas;
        if (mode === 'horizontal') {
          const scaled = sources.map(item => ({
            image: item.image,
            width: Math.round(item.image.naturalWidth * (targetWidth / item.image.naturalHeight)),
          }));
          const totalWidth = scaled.reduce((sum, item) => sum + item.width, 0) + gap * (scaled.length - 1);
          canvas = makeCanvas(totalWidth, targetWidth);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = background.value; ctx.fillRect(0, 0, totalWidth, targetWidth);
          let x = 0;
          for (const item of scaled) { ctx.drawImage(item.image, x, 0, item.width, targetWidth); x += item.width + gap; }
        } else if (mode === 'grid') {
          const cols = Math.max(2, Math.min(12, Number(colsInput.value) || 3));
          const cellW = Math.floor((targetWidth - gap * (cols - 1)) / cols);
          const rows = Math.ceil(sources.length / cols);
          const rowHeights = [];
          for (let r = 0; r < rows; r += 1) {
            let h = 0;
            for (let c = 0; c < cols; c += 1) {
              const item = sources[r * cols + c];
              if (item) h = Math.max(h, Math.round(item.image.naturalHeight * cellW / item.image.naturalWidth));
            }
            rowHeights.push(h);
          }
          const totalHeight = rowHeights.reduce((a, b) => a + b, 0) + gap * (rows - 1);
          canvas = makeCanvas(targetWidth, totalHeight);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = background.value; ctx.fillRect(0, 0, targetWidth, totalHeight);
          let y = 0;
          for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
              const item = sources[r * cols + c];
              if (!item) continue;
              const h = Math.round(item.image.naturalHeight * cellW / item.image.naturalWidth);
              ctx.drawImage(item.image, c * (cellW + gap), y + Math.round((rowHeights[r] - h) / 2), cellW, h);
            }
            y += rowHeights[r] + gap;
          }
        } else {
          const scaled = sources.map(item => ({
            image: item.image,
            height: Math.round(item.image.naturalHeight * (targetWidth / item.image.naturalWidth)),
          }));
          const totalHeight = scaled.reduce((sum, item) => sum + item.height, 0) + gap * (scaled.length - 1);
          canvas = makeCanvas(targetWidth, totalHeight);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = background.value;
          ctx.fillRect(0, 0, targetWidth, totalHeight);
          let y = 0;
          for (const item of scaled) {
            ctx.drawImage(item.image, 0, y, targetWidth, item.height);
            y += item.height + gap;
          }
        }
        const blob = await canvasToBlob(canvas, 'image/png');
        if (!blob) { toast('导出失败', 'warn'); return; }
        resultBlob = blob;
        preview.src = URL.createObjectURL(blob);
        status.textContent = `已生成 ${canvas.width}×${canvas.height} · ${formatBytes(blob.size)}`;
        status.className = 'status ok';
      };

      root.append(
        panel('选择多张图片', picker, hint('按住 Ctrl / Shift 可多选，按选择顺序排列。')),
        panel('拼接设置',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '排列方式' }), direction),
            colsWrap,
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '输出宽度 / 高度 (px)' }), widthInput),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '间距 (px)' }), gapInput),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '背景' }), background))),
        actions(
          btn('拼接', () => run().catch(error => toast(error.message, 'warn')), 'primary'),
          btn('下载 PNG', () => {
            if (!resultBlob) { toast('请先点击拼接', 'warn'); return; }
            downloadBlob(resultBlob, 'xiaoyuTools-stitch.png');
          }),
        ),
        status,
        panel('预览', preview),
      );
    },
  },
];

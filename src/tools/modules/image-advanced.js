/* 图片高级能力：AI 抠图（本地 imgly 模型，AGPL-3.0，见 vendor/imgly/LICENSE.md）
   与色键抠图（自研）、HEIC 解码（本地 MIT 库）、AI 文件预览流提取。 */
import {
  panel, inp, sel, filePicker, btn, actions, resultBox, hint, el,
  labeled, toast, downloadBlob, formatBytes,
} from '../../core/ui.js';
import {
  num, clamp, canvasFromImageFile, makeCanvas, extractPdfBytes, pdfjs, renderPdfPage, loadScript,
} from './shared.js';

const backgroundRemover = {
  id: 'background-remover', name: 'AI 抠图 · 移除背景', category: 'image',
  desc: '本地 AI 分割去背景，可换白 / 蓝 / 红底；另有色键快速模式',
  keywords: ['抠图', '去背景', '透明', 'AI', '证件照', '换底色', '色键', '背景'],
  steps: ['选择照片（人像 / 商品均可）', '选「AI 智能抠图」或「色键快速」', '首次使用 AI 会加载本地模型（约 55MB，只加载一次）', '选透明或替换底色，下载 PNG / JPG'],
  faq: [
    ['AI 模型从哪来？', '模型与推理引擎全部随站点本地分发（vendor/imgly-data），运行时不访问任何外部服务器。'],
    ['AI 模式慢吗？', '首次加载模型约 55MB；之后每张在本机 CPU 推理，几秒到十几秒不等，取决于设备。'],
    ['色键模式什么时候用？', '纯色背景（白底商品图、绿幕）用色键更快；复杂背景、发丝边缘用 AI。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const engine = sel([{ value: 'ai', label: 'AI 智能抠图（本地模型）' }, { value: 'key', label: '色键快速（纯色背景）' }], 'ai');
    const keyParams = el('div', { class: 'inline-fields' });
    const mode = sel([{ value: 'auto', label: '自动取四角背景色' }, { value: 'manual', label: '手动指定颜色' }], 'auto', null);
    const manual = inp({ type: 'color', value: '#ffffff', class: 'input color-input' });
    const tolerance = inp({ type: 'range', min: '5', max: '150', value: '45' });
    const feather = inp({ type: 'range', min: '0', max: '80', value: '20' });
    keyParams.append(labeled('取色方式', mode), labeled('背景色', manual), labeled('容差', tolerance), labeled('羽化', feather));
    keyParams.style.display = 'none';
    engine.addEventListener('change', () => { keyParams.style.display = engine.value === 'key' ? '' : 'none'; });
    const bgFill = sel([
      { value: 'transparent', label: '透明背景（PNG）' },
      { value: '#ffffff', label: '白底（证件照）' },
      { value: '#438edb', label: '蓝底（证件照）' },
      { value: '#d9001b', label: '红底（证件照）' },
      { value: 'custom', label: '自定义颜色…' },
    ], 'transparent');
    const customColor = inp({ type: 'color', value: '#22c55e', class: 'input color-input' });
    customColor.style.display = 'none';
    bgFill.addEventListener('change', () => { customColor.style.display = bgFill.value === 'custom' ? '' : 'none'; });
    const preview = el('img', { class: 'preview-img', alt: '抠图预览' });
    const status = el('div', { class: 'status' });
    const output = resultBox();
    let source = null, current = null, autoColor = [255, 255, 255], aiBlob = null, lastFile = null;

    const composite = async cutBlob => {
      const fill = bgFill.value === 'custom' ? customColor.value : bgFill.value;
      if (fill === 'transparent') return cutBlob;
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej;
        i.src = URL.createObjectURL(cutBlob);
      });
      const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = fill; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      return new Promise(res => canvas.toBlob(res, 'image/png'));
    };
    const finish = async (cutBlob, note) => {
      current = await composite(cutBlob);
      if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
      preview.src = URL.createObjectURL(current);
      output.set(note);
      status.textContent = '已生成，可下载'; status.className = 'status ok';
    };

    const drawKey = () => {
      if (!source) return;
      const canvas = makeCanvas(source.width, source.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hex = manual.value.slice(1);
      const bg = mode.value === 'manual'
        ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
        : autoColor;
      const tol = clamp(num(tolerance.value, 45), 5, 150);
      const soft = clamp(num(feather.value, 20), 0, 80);
      let removed = 0;
      for (let i = 0; i < data.data.length; i += 4) {
        const d = Math.sqrt(
          (data.data[i] - bg[0]) ** 2 + (data.data[i + 1] - bg[1]) ** 2 + (data.data[i + 2] - bg[2]) ** 2,
        );
        if (d <= tol) { data.data[i + 3] = 0; removed += 1; }
        else if (d < tol + soft) data.data[i + 3] = Math.round(255 * (d - tol) / soft);
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const total = canvas.width * canvas.height;
        finish(blob, `色键抠图\n背景色   rgb(${bg.join(', ')})\n容差     ${tol}  羽化 ${soft}\n透明像素 ${removed} / ${total}（${(removed / total * 100).toFixed(1)}%）`);
      }, 'image/png');
    };

    const runAi = async () => {
      if (!lastFile) { toast('请先选择图片', 'warn'); return; }
      try {
        status.textContent = '加载本地推理引擎…'; status.className = 'status';
        await loadScript('./vendor/onnxruntime/ort.wasm.min.js');
        const { removeBackground } = await import('../../../vendor/imgly/index.js');
        const publicPath = new URL('vendor/imgly-data/', document.baseURI).href;
        const blob = await removeBackground(lastFile, {
          publicPath,
          model: 'small',
          output: { format: 'image/png' },
          progress: (key, cur, total) => {
            if (key.startsWith('fetch:')) {
              status.textContent = `加载本地模型 ${(cur / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB（仅首次）…`;
            } else if (key.startsWith('compute:')) {
              status.textContent = '本机 AI 推理中…';
            }
          },
        });
        aiBlob = blob;
        await finish(blob, `AI 分割（ISNet 本地模型）\n输出 ${formatBytes(blob.size)} 透明 PNG\n模型与推理全程在本机完成，0 次外部请求`);
      } catch (error) {
        status.textContent = `AI 抠图失败：${error.message}`; status.className = 'status bad';
        output.set('可切换到「色键快速」模式处理纯色背景图片。');
      }
    };

    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      lastFile = file; aiBlob = null;
      try {
        const c = await canvasFromImageFile(file, { max: 1600 });
        source = c;
        const ctx = c.getContext('2d');
        const samples = [];
        const size = Math.min(12, Math.floor(c.width / 4), Math.floor(c.height / 4));
        for (const [x, y] of [[0, 0], [c.width - size, 0], [0, c.height - size], [c.width - size, c.height - size]]) {
          const d = ctx.getImageData(x, y, size, size).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
          samples.push([r / n, g / n, b / n]);
        }
        autoColor = [0, 1, 2].map(k => Math.round(samples.reduce((a, s) => a + s[k], 0) / samples.length));
        manual.value = `#${autoColor.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`;
        if (engine.value === 'key') drawKey();
        else { status.textContent = '已载入，点「开始抠图」运行 AI'; status.className = 'status ok'; }
      } catch { output.set('图片读取失败'); }
    });
    [mode, manual, tolerance, feather].forEach(node => {
      node.addEventListener(node.tagName === 'SELECT' || node.type === 'checkbox' ? 'change' : 'input', () => { if (engine.value === 'key') drawKey(); });
    });
    bgFill.addEventListener('change', async () => {
      const cut = engine.value === 'ai' ? aiBlob : null;
      if (cut) await finish(cut, '已更换底色');
      else if (engine.value === 'key' && source) drawKey();
    });
    customColor.addEventListener('input', async () => {
      if (aiBlob) await finish(aiBlob, '已更换底色');
    });

    root.append(panel('抠图', picker,
      el('div', { class: 'inline-fields' }, labeled('引擎', engine), labeled('输出底色', bgFill), customColor),
      keyParams,
      actions(
        btn('开始抠图', () => { if (engine.value === 'ai') runAi(); else drawKey(); }, 'primary'),
        btn('下载结果', () => current ? downloadBlob(current, bgFill.value === 'transparent' ? 'no-background.png' : 'id-photo.png') : toast('请先抠图', 'warn')),
      ),
      preview, output.node, status,
      hint('AI 引擎：imgly ISNet 模型（AGPL-3.0），随站点本地分发，首次加载约 55MB 后离线可用；色键引擎为自研颜色距离算法，只对纯色背景有效。')));
  },
};

const heicToJpg = {
  id: 'heic-to-jpg', name: 'HEIC 转 JPG', category: 'image',
  desc: '用本地解码库把 HEIC / HEIF 转成常用格式', keywords: ['HEIC', 'HEIF', 'JPG', 'iPhone', '格式转换'],
  render(root) {
    const picker = filePicker({ accept: '.heic,.heif,image/heic,image/heif', multiple: true });
    const format = sel([{ value: 'image/jpeg', label: 'JPEG' }, { value: 'image/png', label: 'PNG' }], 'image/jpeg', null);
    const quality = inp({ type: 'range', min: '0.4', max: '1', step: '0.05', value: '0.9' });
    const output = resultBox();
    const status = el('div', { class: 'status' });

    const run = async () => {
      const convert = typeof window !== 'undefined' ? window.heic2any : null;
      if (!convert) { output.set('本地 HEIC 解码库未加载，请检查 vendor/heic2any'); return; }
      const files = [...(picker.files || [])];
      if (!files.length) { output.set('请先选择 HEIC / HEIF 文件'); return; }
      status.textContent = '正在本机解码…';
      const lines = [];
      for (const file of files) {
        try {
          const result = await convert({ blob: file, toType: format.value, quality: num(quality.value, 0.9) });
          const blobs = Array.isArray(result) ? result : [result];
          blobs.forEach((blob, i) => {
            const ext = format.value === 'image/png' ? 'png' : 'jpg';
            const suffix = blobs.length > 1 ? `-${i + 1}` : '';
            downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}${suffix}.${ext}`);
            lines.push(`${file.name}  ${formatBytes(file.size)} → ${formatBytes(blob.size)}`);
          });
        } catch (error) {
          lines.push(`${file.name}  解码失败：${error.message}`);
        }
      }
      output.set([`共处理 ${files.length} 个文件`, ...lines].join('\n'));
      status.textContent = '处理完成';
    };
    root.append(panel('HEIC 转换', picker,
      el('div', { class: 'inline-fields' }, labeled('输出格式', format), labeled('质量', quality)),
      actions(btn('转换并下载', run, 'primary')),
      output.node, status,
      hint('解码由本地 heic2any（MIT，自带内联 worker）完成，不上传照片；个别特殊编码的 HEIC 可能无法解码。')));
  },
};

const aiToPng = {
  id: 'ai-to-png', name: 'AI 转 PNG', category: 'image',
  desc: '提取 .ai 文件内的 PDF 兼容预览流并渲染', keywords: ['AI', 'Illustrator', 'PNG', '预览', '转换'],
  render(root) {
    const picker = filePicker({ accept: '.ai,application/illustrator' });
    const scale = sel([{ value: '1', label: '1.0×' }, { value: '1.5', label: '1.5×' }, { value: '2', label: '2.0×' }], '1.5', null);
    const preview = el('img', { class: 'preview-img', alt: '渲染预览' });
    const output = resultBox();
    const status = el('div', { class: 'status' });

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 .ai 文件'); return; }
      const lib = pdfjs();
      if (!lib) { output.set('本地 PDF 渲染库不可用'); return; }
      try {
        const bytes = extractPdfBytes(await file.arrayBuffer());
        if (!bytes) {
          output.set([
            '未在该文件中找到 PDF 兼容预览流（%PDF- 头）。',
            '',
            '部分 .ai 文件保存时未勾选「创建 PDF 兼容文件」，此时文件里没有可直接渲染的预览数据。',
            '可在 Illustrator 中重新保存并启用该选项后再试；本项目不解析 Illustrator 私有格式。',
          ].join('\n'));
          status.textContent = '';
          return;
        }
        status.textContent = '正在本机渲染预览…';
        const pdf = await lib.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const canvas = await renderPdfPage(page, num(scale.value, 1.5));
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG 编码失败');
        downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.png`);
        preview.src = URL.createObjectURL(blob);
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `预览流  ${formatBytes(bytes.length)}（PDF 页数 ${pdf.numPages}）`,
          `输出    ${canvas.width}×${canvas.height} PNG  ${formatBytes(blob.size)}`,
          '',
          '仅渲染第一页的 PDF 兼容预览，不解析 Illustrator 图层、矢量对象与专色。',
        ].join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`渲染失败：${error.message}`);
        status.textContent = '';
      }
    };
    root.append(panel('AI 文件预览', picker,
      el('div', { class: 'inline-fields' }, labeled('渲染倍率', scale)),
      actions(btn('提取并导出 PNG', run, 'primary')),
      preview, output.node, status,
      hint('利用 .ai 常见内嵌的 PDF 兼容流做预览渲染；不依赖 Illustrator、不联网、不上传。')));
  },
};

export const imageAdvancedTools = [backgroundRemover, heicToJpg, aiToPng];

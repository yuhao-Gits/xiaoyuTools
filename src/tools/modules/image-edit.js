/* 图片编辑交互类：区域模糊打码 / 故障艺术 / 图片叠加。
   指针事件同时支持鼠标与触屏；全部本地 Canvas 处理。 */
import {
  el, inp, sel, btn, panel, actions, hint, toast, filePicker,
  readDataURL, loadImage, canvasToBlob, downloadBlob, formatBytes, resultBox, labeled,
} from '../../core/ui.js';
import { makeCanvas, num, clamp } from './shared.js';

const baseName = name => (name || 'image').replace(/\.[^.]+$/, '') || 'image';

/* ---------- 区域模糊 / 马赛克 ---------- */
const regionBlur = {
  id: 'region-blur', name: '区域模糊打码', category: 'image',
  desc: '拖框遮挡截图里的姓名、账号、密码等隐私，模糊 / 马赛克 / 纯色',
  keywords: ['打码', '马赛克', '模糊', '截图', '隐私', '遮挡', 'blur'],
  steps: ['上传或粘贴截图', '在图上拖出要遮挡的矩形（可多个）', '为每个区域选模糊 / 马赛克 / 纯色', '导出处理后的图片'],
  faq: [
    ['模糊能被还原吗？', '马赛克与纯色不可还原；轻度模糊理论上可被增强，敏感信息建议用马赛克或纯色。'],
  ],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const mode = sel([{ value: 'mosaic', label: '马赛克' }, { value: 'blur', label: '高斯模糊' }, { value: 'solid', label: '纯色遮盖' }], 'mosaic');
    const strength = inp({ type: 'range', min: '4', max: '40', value: '14' });
    const solidColor = inp({ type: 'color', value: '#111111', class: 'color-input' });
    const stage = el('canvas', { class: 'preview-img', style: 'touch-action:none;cursor:crosshair;max-width:100%' });
    const regionList = el('div', { class: 'check-grid' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'screenshot';
    let regions = []; // {x,y,w,h,mode,strength,color} 图像坐标
    let viewScale = 1, dragging = null;

    const renderRegion = (ctx, r) => {
      const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
      if (w < 2 || h < 2) return;
      if (r.mode === 'solid') {
        ctx.fillStyle = r.color; ctx.fillRect(x, y, w, h);
      } else if (r.mode === 'mosaic') {
        const block = Math.max(2, Math.round(r.strength));
        const tw = Math.max(1, Math.ceil(w / block)), th = Math.max(1, Math.ceil(h / block));
        const tmp = makeCanvas(tw, th);
        tmp.getContext('2d').drawImage(stageSource(), x, y, w, h, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
        ctx.imageSmoothingEnabled = true;
      } else {
        const tmp = makeCanvas(w, h);
        const tctx = tmp.getContext('2d');
        tctx.filter = `blur(${Math.round(r.strength / 2)}px)`;
        tctx.drawImage(stageSource(), x, y, w, h, 0, 0, w, h);
        ctx.drawImage(tmp, x, y);
      }
    };
    let cleanCanvas = null;
    const stageSource = () => cleanCanvas;
    const draw = () => {
      if (!source) return;
      const maxW = Math.min(860, root.clientWidth || 860);
      viewScale = Math.min(1, maxW / source.naturalWidth);
      const w = Math.round(source.naturalWidth * viewScale), h = Math.round(source.naturalHeight * viewScale);
      stage.width = w; stage.height = h;
      cleanCanvas = makeCanvas(source.naturalWidth, source.naturalHeight);
      cleanCanvas.getContext('2d').drawImage(source, 0, 0);
      const ctx = stage.getContext('2d');
      ctx.drawImage(cleanCanvas, 0, 0, w, h);
      /* 在全尺寸副本上应用区域，再缩回显示 */
      const full = makeCanvas(source.naturalWidth, source.naturalHeight);
      full.getContext('2d').drawImage(cleanCanvas, 0, 0);
      const fctx = full.getContext('2d');
      for (const r of regions) renderRegion(fctx, r);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(full, 0, 0, w, h);
      if (dragging) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.strokeRect(dragging.x * viewScale, dragging.y * viewScale, dragging.w * viewScale, dragging.h * viewScale);
        ctx.setLineDash([]);
      }
    };
    const refreshList = () => {
      regionList.replaceChildren(...regions.map((r, i) => el('div', { class: 'check' },
        el('span', { text: `区域 ${i + 1} · ${r.mode === 'mosaic' ? '马赛克' : r.mode === 'blur' ? '模糊' : '纯色'} · ${Math.round(r.w)}×${Math.round(r.h)}` }),
        btn('删除', () => { regions.splice(i, 1); refreshList(); draw(); }))));
    };
    const pos = e => {
      const rect = stage.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / viewScale, y: (e.clientY - rect.top) / viewScale };
    };
    stage.addEventListener('pointerdown', e => {
      if (!source) return;
      stage.setPointerCapture(e.pointerId);
      const p = pos(e);
      dragging = { x: p.x, y: p.y, w: 0, h: 0, sx: p.x, sy: p.y };
    });
    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = pos(e);
      dragging.x = Math.min(dragging.sx, p.x); dragging.y = Math.min(dragging.sy, p.y);
      dragging.w = Math.abs(p.x - dragging.sx); dragging.h = Math.abs(p.y - dragging.sy);
      draw();
    });
    stage.addEventListener('pointerup', () => {
      if (!dragging) return;
      if (dragging.w > 4 && dragging.h > 4) {
        regions.push({ x: dragging.x, y: dragging.y, w: dragging.w, h: dragging.h, mode: mode.value, strength: num(strength.value, 14), color: solidColor.value });
        refreshList();
      }
      dragging = null;
      draw();
    });
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      source = await loadImage(await readDataURL(file));
      name = baseName(file.name);
      regions = []; refreshList(); draw();
      status.textContent = `已载入 ${file.name} · 在图上拖框添加遮挡`; status.className = 'status ok';
    });
    const exportFull = async () => {
      const full = makeCanvas(source.naturalWidth, source.naturalHeight);
      const ctx = full.getContext('2d');
      ctx.drawImage(source, 0, 0);
      for (const r of regions) renderRegion(ctx, r);
      return full;
    };
    root.append(
      panel('选择截图 / 照片', picker),
      panel('新区域设置', el('div', { class: 'inline-fields' }, labeled('效果', mode), labeled('强度', strength), labeled('纯色', solidColor))),
      panel('遮挡区域', regionList),
      actions(
        btn('导出 PNG', async () => {
          if (!source) { toast('请先选择图片', 'warn'); return; }
          downloadBlob(await canvasToBlob(await exportFull(), 'image/png'), `${name}-redacted.png`);
        }, 'primary'),
        btn('清空区域', () => { regions = []; refreshList(); draw(); }),
      ),
      status, panel('画布（拖框添加遮挡）', stage),
      hint('区域按添加时的效果与强度固定；导出为原分辨率。敏感信息建议马赛克或纯色。'),
    );
  },
};

/* ---------- 故障艺术 ---------- */
const glitchEffect = {
  id: 'glitch-effect', name: '故障艺术效果', category: 'image',
  desc: 'RGB 分离 / 切片错位 / 扫描线，一键赛博故障风',
  keywords: ['故障', 'glitch', '赛博', 'RGB', '错位', '艺术'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const shift = inp({ type: 'range', min: '0', max: '40', value: '12' });
    const slices = inp({ type: 'range', min: '0', max: '30', value: '10' });
    const scan = inp({ type: 'range', min: '0', max: '60', value: '20' });
    const preview = el('canvas', { class: 'preview-img' });
    const status = el('div', { class: 'status' });
    let source = null, name = 'image', seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const applyTo = canvas => {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const base = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      const s = num(shift.value, 12);
      const d = base.data, o = out.data;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          const rx = clamp(x + s, 0, w - 1), bx = clamp(x - s, 0, w - 1);
          o[i] = d[(y * w + rx) * 4];
          o[i + 1] = d[i + 1];
          o[i + 2] = d[(y * w + bx) * 4 + 2];
          o[i + 3] = d[i + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
      const n = num(slices.value, 10);
      seed = 42;
      for (let i = 0; i < n; i += 1) {
        const sy = Math.floor(rand() * h);
        const sh = Math.max(2, Math.floor(rand() * h * 0.06));
        const dx = Math.floor((rand() - 0.5) * w * 0.2);
        const strip = ctx.getImageData(0, sy, w, Math.min(sh, h - sy));
        ctx.putImageData(strip, dx, sy);
      }
      const sc = num(scan.value, 20) / 100;
      if (sc > 0) {
        ctx.fillStyle = `rgba(0,0,0,${sc})`;
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
      }
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
    for (const c of [shift, slices, scan]) c.addEventListener('input', draw);
    root.append(
      panel('选择图片', picker),
      panel('效果强度',
        el('div', { class: 'inline-fields' }, labeled('RGB 分离', shift), labeled('切片错位', slices), labeled('扫描线', scan))),
      actions(btn('导出 PNG', async () => {
        if (!source) { toast('请先选择图片', 'warn'); return; }
        const canvas = makeCanvas(source.naturalWidth, source.naturalHeight);
        canvas.getContext('2d').drawImage(source, 0, 0);
        applyTo(canvas);
        downloadBlob(await canvasToBlob(canvas, 'image/png'), `${name}-glitch.png`);
      }, 'primary')),
      status, panel('预览', preview),
      hint('切片错位使用固定随机种子，预览与导出一致；导出为原分辨率。'),
    );
  },
};

/* ---------- 图片叠加 ---------- */
const imageOverlay = {
  id: 'image-overlay', name: '图片叠加', category: 'image',
  desc: '把多张图叠到背景上，拖拽 / 缩放 / 旋转 / 透明度',
  keywords: ['叠加', '合成', '图层', '贴图', 'overlay'],
  render(root) {
    const bgPicker = filePicker({ accept: 'image/*' });
    const layerPicker = filePicker({ accept: 'image/*', multiple: true });
    const stage = el('canvas', { class: 'preview-img', style: 'touch-action:none;cursor:move;max-width:100%' });
    const layerList = el('div', { class: 'check-grid' });
    const scale = inp({ type: 'range', min: '5', max: '200', value: '40' });
    const rotate = inp({ type: 'range', min: '-180', max: '180', value: '0' });
    const opacity = inp({ type: 'range', min: '5', max: '100', value: '100' });
    const status = el('div', { class: 'status' });
    let bg = null, layers = [], selected = -1, viewScale = 1, drag = null;

    const draw = () => {
      if (!bg) return;
      const maxW = Math.min(860, root.clientWidth || 860);
      viewScale = Math.min(1, maxW / bg.naturalWidth);
      stage.width = Math.round(bg.naturalWidth * viewScale);
      stage.height = Math.round(bg.naturalHeight * viewScale);
      const ctx = stage.getContext('2d');
      ctx.drawImage(bg, 0, 0, stage.width, stage.height);
      layers.forEach((l, i) => {
        const w = bg.naturalWidth * l.scale / 100 * viewScale;
        const h = l.img.naturalHeight / l.img.naturalWidth * w;
        ctx.save();
        ctx.globalAlpha = l.opacity / 100;
        ctx.translate(l.x * viewScale, l.y * viewScale);
        ctx.rotate(l.rotate * Math.PI / 180);
        ctx.drawImage(l.img, -w / 2, -h / 2, w, h);
        ctx.restore();
        if (i === selected) {
          ctx.strokeStyle = '#ffffff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
          ctx.strokeRect(l.x * viewScale - w / 2, l.y * viewScale - h / 2, w, h);
          ctx.setLineDash([]);
        }
      });
    };
    const refreshList = () => {
      layerList.replaceChildren(...layers.map((l, i) => el('div', { class: 'check' },
        btn(i === selected ? `● 图层 ${i + 1}` : `图层 ${i + 1}`, () => { selected = i; syncControls(); refreshList(); draw(); }),
        btn('上移', () => { if (i < layers.length - 1) { [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]; selected = i + 1; refreshList(); draw(); } }),
        btn('删除', () => { layers.splice(i, 1); selected = Math.min(selected, layers.length - 1); syncControls(); refreshList(); draw(); }))));
    };
    const syncControls = () => {
      const l = layers[selected];
      if (!l) return;
      scale.value = l.scale; rotate.value = l.rotate; opacity.value = l.opacity;
    };
    bgPicker.addEventListener('change', async () => {
      const file = bgPicker.files[0];
      if (!file) return;
      bg = await loadImage(await readDataURL(file));
      draw();
      status.textContent = '背景已载入，继续添加图层'; status.className = 'status ok';
    });
    layerPicker.addEventListener('change', async () => {
      for (const file of [...(layerPicker.files || [])]) {
        const img = await loadImage(await readDataURL(file));
        layers.push({ img, x: bg ? bg.naturalWidth / 2 : 200, y: bg ? bg.naturalHeight / 2 : 200, scale: 40, rotate: 0, opacity: 100 });
      }
      selected = layers.length - 1;
      syncControls(); refreshList(); draw();
    });
    for (const [c, key] of [[scale, 'scale'], [rotate, 'rotate'], [opacity, 'opacity']]) {
      c.addEventListener('input', () => {
        const l = layers[selected];
        if (!l) return;
        l[key] = num(c.value, l[key]);
        draw();
      });
    }
    const pos = e => {
      const rect = stage.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / viewScale, y: (e.clientY - rect.top) / viewScale };
    };
    stage.addEventListener('pointerdown', e => {
      if (!bg) return;
      stage.setPointerCapture(e.pointerId);
      const p = pos(e);
      /* 从上往下命中图层 */
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const l = layers[i];
        const w = bg.naturalWidth * l.scale / 100;
        const h = l.img.naturalHeight / l.img.naturalWidth * w;
        if (Math.abs(p.x - l.x) <= w / 2 && Math.abs(p.y - l.y) <= h / 2) {
          selected = i; drag = { dx: p.x - l.x, dy: p.y - l.y };
          syncControls(); refreshList(); draw();
          return;
        }
      }
    });
    stage.addEventListener('pointermove', e => {
      if (drag === null || selected < 0) return;
      const p = pos(e);
      layers[selected].x = p.x - drag.dx;
      layers[selected].y = p.y - drag.dy;
      draw();
    });
    stage.addEventListener('pointerup', () => { drag = null; });
    const exportFull = () => {
      const canvas = makeCanvas(bg.naturalWidth, bg.naturalHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bg, 0, 0);
      for (const l of layers) {
        const w = bg.naturalWidth * l.scale / 100;
        const h = l.img.naturalHeight / l.img.naturalWidth * w;
        ctx.save();
        ctx.globalAlpha = l.opacity / 100;
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rotate * Math.PI / 180);
        ctx.drawImage(l.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      return canvas;
    };
    root.append(
      panel('背景图', bgPicker),
      panel('叠加图层（可多选）', layerPicker),
      panel('选中图层调整', el('div', { class: 'inline-fields' }, labeled('大小 %', scale), labeled('旋转 °', rotate), labeled('透明度 %', opacity))),
      panel('图层列表', layerList),
      actions(btn('导出合成 PNG', async () => {
        if (!bg) { toast('请先选择背景图', 'warn'); return; }
        downloadBlob(await canvasToBlob(exportFull(), 'image/png'), 'overlay.png');
      }, 'primary')),
      status, panel('画布（拖动图层）', stage),
      hint('点击图层选中后可拖拽位置；大小为相对背景宽度的百分比。'),
    );
  },
};

export const imageEditTools = [regionBlur, glitchEffect, imageOverlay];
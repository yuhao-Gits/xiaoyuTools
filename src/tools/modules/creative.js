import {
  panel, inp, sel, btn, actions, resultBox, hint, el, toast,
  copyText, downloadText, downloadBlob, labeled,
} from '../../core/ui.js';

const whiteboard = {
  id: 'whiteboard',
  name: '画板',
  category: 'creative',
  desc: '自由涂鸦、标注，导出 PNG',
  keywords: ['白板', '画板', '涂鸦', 'draw', 'canvas'],
  render(root) {
    const canvas = el('canvas', { width: 900, height: 480, class: 'board-canvas' });
    const color = inp({ type: 'color', value: '#f2f2f4', class: 'input color-input' });
    const size = inp({ type: 'range', min: '1', max: '30', value: '4' });
    const bg = inp({ type: 'color', value: '#141415', class: 'input color-input' });
    const status = el('div', { class: 'status' });
    const ctx = canvas.getContext('2d');
    let drawing = false, eraser = false, last = null;

    const reset = () => {
      ctx.fillStyle = bg.value;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      status.textContent = '画布已清空';
    };
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / (rect.width || canvas.width)),
        y: (event.clientY - rect.top) * (canvas.height / (rect.height || canvas.height)),
      };
    };
    const stroke = (from, to) => {
      ctx.strokeStyle = eraser ? bg.value : color.value;
      ctx.lineWidth = eraser ? Number(size.value) * 3 : Number(size.value);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    canvas.addEventListener('pointerdown', event => {
      drawing = true; last = point(event);
      stroke(last, { x: last.x + 0.01, y: last.y + 0.01 });
    });
    canvas.addEventListener('pointermove', event => {
      if (!drawing) return;
      const next = point(event);
      stroke(last, next);
      last = next;
    });
    const end = () => { drawing = false; last = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    bg.addEventListener('input', reset);
    reset();

    root.append(panel('画布', canvas,
      el('div', { class: 'inline-fields' },
        labeled('画笔颜色', color), labeled('粗细', size),
        labeled('背景色', bg)),
      actions(
        btn('橡皮', () => { eraser = !eraser; status.textContent = eraser ? '橡皮已开启' : '画笔模式'; }),
        btn('清空', reset),
        btn('导出 PNG', () => canvas.toBlob(blob => {
          if (blob) downloadBlob(blob, 'whiteboard.png');
        }, 'image/png'), 'primary')),
      status,
      hint('画板完全由 Canvas 在本机绘制，切换背景色会清空当前内容。')));
  },
};

const gradientGenerator = {
  id: 'gradient-generator',
  name: '渐变生成器',
  category: 'creative',
  desc: '线性 / 径向渐变，实时预览并复制 CSS',
  keywords: ['渐变', 'CSS', 'gradient', '配色'],
  render(root) {
    const from = inp({ type: 'color', value: '#4f46e5', class: 'input color-input' });
    const middle = inp({ type: 'color', value: '#8b5cf6', class: 'input color-input' });
    const to = inp({ type: 'color', value: '#22d3ee', class: 'input color-input' });
    const angle = inp({ type: 'range', min: '0', max: '360', value: '135' });
    const kind = sel([{ value: 'linear', label: '线性' }, { value: 'radial', label: '径向' }], 'linear', null);
    const preview = el('div', { class: 'gradient-preview' });
    const output = resultBox();

    const css = () => kind.value === 'radial'
      ? `radial-gradient(circle at 50% 50%, ${from.value} 0%, ${middle.value} 50%, ${to.value} 100%)`
      : `linear-gradient(${angle.value}deg, ${from.value} 0%, ${middle.value} 50%, ${to.value} 100%)`;
    const paint = () => {
      const value = css();
      preview.style.background = value;
      output.set(`background: ${value};`);
    };
    [from, middle, to, angle].forEach(node => node.addEventListener('input', paint));
    kind.addEventListener('change', paint);
    paint();

    root.append(panel('渐变',
      el('div', { class: 'inline-fields' },
        labeled('起点', from), labeled('中间', middle), labeled('终点', to),
        labeled('角度', angle), labeled('类型', kind)),
      preview,
      actions(btn('复制 CSS', () => copyText(css()), 'primary'),
        btn('导出 CSS 文件', () => downloadText(`.my-gradient {\n  ${output.node.textContent}\n}\n`, 'gradient.css', 'text/css;charset=utf-8'))),
      output.node));
  },
};

const qrCodeGenerator = {
  id: 'qr-code-generator',
  name: '二维码生成器',
  category: 'creative',
  desc: '文本、网址、Wi-Fi 与邮件二维码（本地 MIT 库）',
  keywords: ['二维码', 'QR', 'qrcode', '条码'],
  render(root) {
    const mode = sel([
      { value: 'text', label: '文本 / 网址' },
      { value: 'wifi', label: 'Wi-Fi 配置' },
      { value: 'mail', label: '邮件' },
    ], 'text', null);
    const text = inp({ type: 'text', value: 'xiaoyuTools · 本地工具箱', placeholder: '输入文本或网址…' });
    const ssid = inp({ type: 'text', placeholder: 'Wi-Fi 名称 SSID' });
    const pass = inp({ type: 'text', placeholder: 'Wi-Fi 密码' });
    const level = sel([
      { value: 'L', label: '纠错 L（7%）' }, { value: 'M', label: '纠错 M（15%）' },
      { value: 'Q', label: '纠错 Q（25%）' }, { value: 'H', label: '纠错 H（30%）' },
    ], 'M', null);
    const scale = inp({ type: 'range', min: '3', max: '14', value: '7' });
    const preview = el('div', { class: 'qr-preview' });
    const status = el('div', { class: 'status' });
    let current = null, currentSvg = '';

    const payload = () => {
      if (mode.value === 'wifi') {
        return `WIFI:T:WPA;S:${ssid.value};P:${pass.value};;`;
      }
      if (mode.value === 'mail') return `mailto:${text.value}`;
      return text.value;
    };
    const syncFields = () => {
      const wifi = mode.value === 'wifi';
      ssid.style.display = wifi ? '' : 'none';
      pass.style.display = wifi ? '' : 'none';
      text.placeholder = wifi ? '' : mode.value === 'mail' ? '收件人邮箱…' : '输入内容…';
    };

    const draw = (qr, cell) => {
      const n = qr.getModuleCount();
      const margin = 3;
      const size = (n + margin * 2) * cell;
      const canvas = el('canvas', { width: size, height: size });
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#0a0a0b';
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
          if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
      return canvas;
    };

    const make = () => {
      const lib = typeof window !== 'undefined' ? window.qrcode : null;
      if (!lib) { status.textContent = '本地二维码库未加载，请检查 vendor/qrcode-generator'; return; }
      const data = payload().trim();
      if (!data) { status.textContent = '请输入内容'; return; }
      try {
        const qr = lib(0, level.value);
        qr.addData(data);
        qr.make();
        current = qr;
        currentSvg = qr.createSvgTag({ cellSize: Number(scale.value), margin: 3 });
        const canvas = draw(qr, Number(scale.value));
        preview.replaceChildren(canvas);
        status.textContent = `已生成：${qr.getModuleCount()} × ${qr.getModuleCount()} 模块，${data.length} 字符`;
      } catch (error) {
        status.textContent = `生成失败：${error.message}`;
      }
    };

    [mode, text, ssid, pass, level, scale].forEach(node => {
      node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', make);
    });
    mode.addEventListener('change', syncFields);
    syncFields();

    root.append(panel('二维码',
      el('div', { class: 'inline-fields' }, labeled('类型', mode), labeled('内容', text), ssid, pass,
        labeled('纠错级别', level), labeled('像素块大小', scale)),
      actions(btn('生成', make, 'primary'),
        btn('下载 SVG', () => currentSvg
          ? downloadText(currentSvg, 'qrcode.svg', 'image/svg+xml;charset=utf-8')
          : toast('请先生成二维码', 'warn')),
        btn('下载 PNG', () => {
          if (!current) { toast('请先生成二维码', 'warn'); return; }
          draw(current, Math.max(8, Number(scale.value))).toBlob(blob => {
            if (blob) downloadBlob(blob, 'qrcode.png');
          }, 'image/png');
        })),
      preview, status,
      hint('编码由 vendor/qrcode-generator（MIT，含 UTF-8 中文补丁）在本机完成，不调用任何在线生成服务。')));
  },
};

export const creativeTools = [whiteboard, gradientGenerator, qrCodeGenerator];

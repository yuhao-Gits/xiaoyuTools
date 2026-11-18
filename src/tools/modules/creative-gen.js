/* 创意生成类（一）：动画、Emoji、像素画、日程、签名、闪卡、图表。
   所有内置数据集与文案均为本项目自写。 */
import {
  panel, inp, txt, sel, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadText, downloadBlob, filePicker,
} from '../../core/ui.js';
import { loadState, saveState } from '../../core/store.js';
import { canvasFromImageFile, makeCanvas, num, clamp, pad, parseCsv } from './shared.js';

const textAnimationMaker = {
  id: 'text-animation-maker', name: '文字动画制作器', category: 'creative',
  desc: '打字机 / 渐显 / 弹跳 / 呼吸，预览并导出 CSS', keywords: ['动画', '文字', 'CSS', 'animation'],
  render(root) {
    const content = inp({ type: 'text', value: '你好，xiaoyuTools' });
    const kind = sel([
      { value: 'typewriter', label: '打字机' }, { value: 'fade', label: '渐显' },
      { value: 'bounce', label: '弹跳' }, { value: 'pulse', label: '呼吸' },
    ], 'typewriter', null);
    const speed = inp({ type: 'range', min: '400', max: '5000', step: '100', value: '1800' });
    const size = inp({ type: 'range', min: '16', max: '72', value: '40' });
    const preview = el('div', { class: 'anim-preview', text: '你好，xiaoyuTools' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let animation = null;

    const css = () => {
      const duration = num(speed.value, 1800);
      const frames = {
        typewriter: '@keyframes xyType { from { width: 0 } to { width: 100% } }',
        fade: '@keyframes xyFade { 0% { opacity: 0; transform: translateY(12px) } 100% { opacity: 1; transform: none } }',
        bounce: '@keyframes xyBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }',
        pulse: '@keyframes xyPulse { 0%,100% { opacity: .45; transform: scale(.98) } 50% { opacity: 1; transform: scale(1.04) } }',
      }[kind.value];
      const rule = {
        typewriter: `animation: xyType ${duration}ms steps(${Math.max(2, content.value.length)}) infinite; overflow: hidden; white-space: nowrap; border-right: 2px solid currentColor;`,
        fade: `animation: xyFade ${duration}ms ease-in-out infinite alternate;`,
        bounce: `animation: xyBounce ${duration}ms ease-in-out infinite;`,
        pulse: `animation: xyPulse ${duration}ms ease-in-out infinite;`,
      }[kind.value];
      return `${frames}\n\n.xy-animated {\n  font-size: ${num(size.value, 40)}px;\n  ${rule}\n}`;
    };
    const play = () => {
      preview.textContent = content.value || '（输入文字）';
      preview.style.fontSize = `${num(size.value, 40)}px`;
      if (animation) animation.cancel();
      const duration = num(speed.value, 1800);
      const frames = {
        typewriter: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
        fade: [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
        bounce: [{ transform: 'translateY(0)' }, { transform: 'translateY(-18px)' }, { transform: 'translateY(0)' }],
        pulse: [{ opacity: 0.45, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1.04)' }, { opacity: 0.45, transform: 'scale(.98)' }],
      }[kind.value];
      if (preview.animate) animation = preview.animate(frames, { duration, iterations: Infinity, easing: 'ease-in-out' });
      output.set(css());
      status.textContent = '预览中';
    };
    [content, speed, size].forEach(n => n.addEventListener('input', play));
    kind.addEventListener('change', play);
    play();

    root.append(panel('动画设置',
      el('div', { class: 'inline-fields' },
        labeled('文字', content), labeled('效果', kind), labeled('周期 ms', speed), labeled('字号', size)),
      actions(btn('重新播放', play, 'primary'), btn('复制 CSS', () => copyText(css())),
        btn('导出 HTML', () => downloadText(
          `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#0a0a0b;color:#f2f2f4;display:grid;place-items:center;height:100vh;margin:0}div{white-space:pre-wrap}${css()}</style></head><body><div class="xy-animated">${content.value.replace(/</g, '&lt;')}</div></body></html>`,
          'animation.html', 'text/html;charset=utf-8'))),
      preview, output.node, status,
      hint('预览用 Web Animations API，导出的 CSS 可独立使用；打字机效果按字符数设置 steps。')));
  },
};

/* 自建的小型 Emoji 关键词索引，仅为常用表情与中文描述。 */
const EMOJI_DATA = [
  ['😀', '笑脸 开心 笑 grin'], ['😂', '笑哭 大笑 joy'], ['🙂', '微笑 略笑'], ['😍', '喜欢 爱心眼'],
  ['😎', '酷 墨镜'], ['🤔', '思考 疑问'], ['😴', '睡觉 困'], ['😭', '哭 难过'],
  ['😡', '生气 愤怒'], ['🥳', '庆祝 派对'], ['🤝', '握手 合作'], ['👍', '点赞 好 棒'],
  ['👎', '差评 不好'], ['👏', '鼓掌 掌声'], ['🙏', '感谢 拜托'], ['💪', '加油 肌肉 强'],
  ['👀', '眼睛 看'], ['🧠', '大脑 思考 脑'], ['❤️', '爱心 红心 喜欢'], ['💔', '心碎 分手'],
  ['✨', '闪光 星星 亮'], ['🔥', '火 热门 燃'], '⭐', '🌟', '🎉', '🎊',
  ['💰', '钱 Money 收入'], ['💳', '银行卡 支付'], ['📈', '上涨 增长 图表'], ['📉', '下跌 下降'],
  ['📊', '柱状图 统计'], ['📅', '日历 日程'], ['⏰', '闹钟 时间'], ['⏱️', '秒表 计时'],
  ['📝', '笔记 记录 写'], ['📄', '文档 文件'], ['📁', '文件夹 目录'], ['📎', '回形针 附件'],
  ['🔍', '搜索 放大镜'], ['🔒', '锁 安全 加密'], ['🔑', '钥匙 密码'], ['💡', '灯泡 想法 提示'],
  ['🛠️', '工具 修理'], ['⚙️', '设置 齿轮'], ['🧰', '工具箱'], ['🖥️', '电脑 显示器'],
  ['⌨️', '键盘 打字'], ['🖱️', '鼠标'], ['💾', '保存 磁盘'], ['🔋', '电池 电量'],
  ['📷', '相机 拍照'], ['🎬', '视频 电影'], ['🎵', '音乐 音符'], ['🎧', '耳机 听歌'],
  ['🎨', '画画 调色板 艺术'], ['🖌️', '画笔 涂鸦'], ['🖼️', '图片 相框'], ['📐', '尺子 测量'],
  ['🍚', '米饭 吃饭'], ['🍜', '面条 拉面'], ['🍕', '披萨'], ['🍔', '汉堡'],
  ['🍎', '苹果 水果'], ['☕', '咖啡 提神'], ['🍵', '茶'], ['🍰', '蛋糕 甜点'],
  ['🌞', '太阳 晴天'], ['🌧️', '下雨 雨天'], ['❄️', '雪 冷'], ['🌈', '彩虹'],
  ['🌍', '地球 世界'], ['🚀', '火箭 上线 发布'], ['✈️', '飞机 旅行'], ['🚗', '汽车 开车'],
  ['🏠', '家 房子'], ['🏃', '跑步 运动'], ['🧘', '放松 冥想 呼吸'], ['🎯', '目标 命中 靶'],
  ['✅', '完成 打勾 对'], ['❌', '错误 叉 否'], ['⚠️', '警告 注意'], ['❓', '问号 疑问'],
  ['🔄', '刷新 循环 重试'], ['🗑️', '删除 垃圾桶'], ['📌', '置顶 图钉'], ['🏷️', '标签 分类'],
].map(entry => Array.isArray(entry) ? entry : [entry, '']);

const emojiFinder = {
  id: 'emoji-finder', name: 'Emoji 搜索', category: 'creative',
  desc: '按中文 / 英文关键词查常用表情，点击复制', keywords: ['emoji', '表情', '符号', '搜索'],
  render(root) {
    const query = inp({ type: 'text', placeholder: '例如：笑 / 钱 / 工具 / fire' });
    const grid = el('div', { class: 'emoji-grid' });
    const status = el('div', { class: 'status' });
    const paint = () => {
      const q = query.value.trim().toLowerCase();
      const list = q ? EMOJI_DATA.filter(([, keywords]) => keywords.toLowerCase().includes(q)) : EMOJI_DATA;
      grid.replaceChildren();
      for (const [emoji, keywords] of list.slice(0, 120)) {
        grid.append(el('button', {
          class: 'emoji-item', type: 'button', title: keywords || emoji,
          text: emoji, onclick: () => { copyText(emoji); status.textContent = `已复制 ${emoji}  ${keywords}`; },
        }));
      }
      status.textContent = q ? `匹配 ${list.length} 个（显示前 ${Math.min(120, list.length)}）` : `共 ${EMOJI_DATA.length} 个常用表情`;
    };
    query.addEventListener('input', paint);
    paint();
    root.append(panel('Emoji 查找', query, grid, status,
      hint('内置一份小型常用表情索引，点击即复制；不加载外部 Emoji 数据集或字体。')));
  },
};

const pixelArtConverter = {
  id: 'pixel-art-converter', name: '像素画转换器', category: 'creative',
  desc: '把图片降采样成像素风格，可调块大小', keywords: ['像素', '马赛克', 'pixel', '图片'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const block = inp({ type: 'range', min: '2', max: '40', value: '12' });
    const levels = inp({ type: 'range', min: '2', max: '16', value: '8' });
    const preview = el('img', { class: 'preview-img', alt: '像素画预览' });
    const status = el('div', { class: 'status' });
    let source = null, current = null;
    const draw = async () => {
      if (!source) return;
      const b = clamp(num(block.value, 12), 2, 40);
      const smallW = Math.max(1, Math.floor(source.width / b)), smallH = Math.max(1, Math.floor(source.height / b));
      const small = makeCanvas(smallW, smallH);
      small.getContext('2d').drawImage(source, 0, 0, smallW, smallH);
      const img = small.getContext('2d').getImageData(0, 0, smallW, smallH);
      const n = clamp(num(levels.value, 8), 2, 16);
      const q = v => Math.round(Math.round(v / 255 * (n - 1)) / (n - 1) * 255);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = q(img.data[i]); img.data[i + 1] = q(img.data[i + 1]); img.data[i + 2] = q(img.data[i + 2]);
      }
      small.getContext('2d').putImageData(img, 0, 0);
      const out = makeCanvas(smallW * b, smallH * b);
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, out.width, out.height);
      out.toBlob(blob => {
        if (!blob) return;
        current = blob; preview.src = URL.createObjectURL(blob);
        status.textContent = `已生成 ${out.width}×${out.height}，块 ${b}px，${n} 阶色`;
      }, 'image/png');
    };
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (file) { source = await canvasFromImageFile(file, { max: 1600 }); draw(); }
    });
    [block, levels].forEach(n => n.addEventListener('input', draw));
    root.append(panel('像素化', picker,
      el('div', { class: 'inline-fields' }, labeled('块大小 px', block), labeled('色阶', levels)),
      actions(btn('重新生成', draw), btn('下载 PNG', () => current ? downloadBlob(current, 'pixel-art.png') : toast('请先选择图片', 'warn'), 'primary')),
      preview, status,
      hint('先按块大小缩小取样，再关闭平滑放大；色阶越低越有复古味。')));
  },
};

const dailyPlanner = {
  id: 'daily-planner', name: '日程规划', category: 'creative',
  desc: '本地保存的时间段待办，可导出文本', keywords: ['日程', '待办', '计划', 'todo'],
  render(root) {
    const date = inp({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    const time = inp({ type: 'time', value: '09:00' });
    const title = inp({ type: 'text', placeholder: '要做什么…' });
    const list = el('div', { class: 'check-grid' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let items = loadState('planner', []);
    if (!Array.isArray(items)) items = [];

    const paint = () => {
      const day = date.value;
      const rows = items.filter(x => x.date === day).sort((a, b) => a.time.localeCompare(b.time));
      list.replaceChildren();
      if (!rows.length) list.append(el('div', { class: 'hint', text: '这一天还没有安排' }));
      for (const item of rows) {
        const box = el('input', { type: 'checkbox', checked: !!item.done });
        box.addEventListener('change', () => { item.done = box.checked; saveState('planner', items); paint(); });
        const label = el('span', { text: `${item.time}  ${item.title}`, class: item.done ? 'dim' : '' });
        const del = el('button', { class: 'button', type: 'button', text: '删除', onclick: () => { items = items.filter(x => x !== item); saveState('planner', items); paint(); } });
        list.append(el('div', { class: 'check' }, box, label, del));
      }
      const all = items.length;
      output.set(`共保存 ${all} 条日程，其中 ${day} 有 ${rows.length} 条，完成 ${rows.filter(x => x.done).length} 条。`);
    };
    const add = () => {
      if (!title.value.trim()) { toast('请填写内容', 'warn'); return; }
      items.push({ date: date.value, time: time.value || '00:00', title: title.value.trim(), done: false });
      saveState('planner', items);
      title.value = ''; status.textContent = '已添加'; paint();
    };
    date.addEventListener('change', paint);
    paint();
    root.append(panel('安排',
      el('div', { class: 'inline-fields' }, labeled('日期', date), labeled('时间', time), labeled('内容', title)),
      actions(btn('添加', add, 'primary'),
        btn('导出当天 TXT', () => {
          const rows = items.filter(x => x.date === date.value).sort((a, b) => a.time.localeCompare(b.time));
          downloadText(`${date.value} 日程\n\n${rows.map(x => `${x.done ? '[x]' : '[ ]'} ${x.time}  ${x.title}`).join('\n')}\n`, `plan-${date.value}.txt`);
        }),
        btn('清空当天', () => { items = items.filter(x => x.date !== date.value); saveState('planner', items); paint(); })),
      list, output.node, status,
      hint('数据只写在本机 localStorage，不同日期各自独立；可导出为纯文本备份。')));
  },
};

const signatureMaker = {
  id: 'signature-maker', name: '签名生成器', category: 'creative',
  desc: '手写板或字体排版，导出透明 PNG', keywords: ['签名', '手写', 'signature', '名字'],
  render(root) {
    const mode = sel([{ value: 'draw', label: '手写板' }, { value: 'font', label: '字体排版' }], 'draw', null);
    const name = inp({ type: 'text', value: '小鱼', placeholder: '输入姓名' });
    const font = sel([
      { value: 'cursive', label: '手写体' }, { value: 'serif', label: '衬线' },
      { value: 'monospace', label: '等宽' }, { value: 'sans-serif', label: '无衬线' },
    ], 'cursive', null);
    const color = inp({ type: 'color', value: '#f2f2f4', class: 'input color-input' });
    const size = inp({ type: 'range', min: '24', max: '120', value: '72' });
    const canvas = makeCanvas(700, 220);
    canvas.className = 'board-canvas';
    const status = el('div', { class: 'status' });
    let drawing = false, last = null, hasInk = false;
    const ctx = canvas.getContext('2d');

    const clear = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; };
    const renderFont = () => {
      clear();
      ctx.fillStyle = color.value;
      ctx.font = `italic ${num(size.value, 72)}px ${font.value}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name.value || '你的名字', canvas.width / 2, canvas.height / 2);
      hasInk = true;
      status.textContent = '已生成字体签名';
    };
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / (rect.width || canvas.width), y: (event.clientY - rect.top) * canvas.height / (rect.height || canvas.height) };
    };
    canvas.addEventListener('pointerdown', e => { drawing = true; last = point(e); ctx.fillStyle = color.value; ctx.beginPath(); ctx.arc(last.x, last.y, 2, 0, Math.PI * 2); ctx.fill(); hasInk = true; });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = point(e);
      ctx.strokeStyle = color.value; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    ['pointerup', 'pointerleave'].forEach(t => canvas.addEventListener(t, () => { drawing = false; last = null; }));
    [name, color, size].forEach(n => n.addEventListener('input', () => { if (mode.value === 'font') renderFont(); }));
    font.addEventListener('change', () => { if (mode.value === 'font') renderFont(); });
    mode.addEventListener('change', () => {
      if (mode.value === 'font') renderFont();
      else { clear(); status.textContent = '请在画布上书写'; }
    });

    root.append(panel('签名',
      el('div', { class: 'inline-fields' }, labeled('模式', mode), labeled('姓名', name),
        labeled('字体', font), labeled('颜色', color), labeled('字号', size)),
      actions(btn('清空', clear),
        btn('生成字体签名', renderFont),
        btn('下载 PNG', () => hasInk
          ? canvas.toBlob(blob => { if (blob) downloadBlob(blob, 'signature.png'); }, 'image/png')
          : toast('请先书写或生成签名', 'warn'), 'primary')),
      canvas, status,
      hint('手写板用指针事件绘制，导出为透明背景 PNG；字体模式依赖系统已安装的字体，换设备可能显示不同。')));
  },
};

const flashcardMaker = {
  id: 'flashcard-maker', name: '闪卡生成器', category: 'creative',
  desc: '本地问答卡片，翻面复习与 JSON 导入导出', keywords: ['闪卡', '记忆', '复习', 'flashcard'],
  render(root) {
    const front = txt({ rows: 2, placeholder: '正面问题…' });
    const back = txt({ rows: 2, placeholder: '背面答案…' });
    const face = el('div', { class: 'flash-card', text: '暂无卡片' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let cards = loadState('flashcards', []);
    if (!Array.isArray(cards)) cards = [];
    let index = 0, flipped = false;

    const paint = () => {
      const card = cards[index];
      face.textContent = card ? (flipped ? card.back : card.front) : '暂无卡片，先添加一张';
      output.set(`共 ${cards.length} 张  当前第 ${cards.length ? index + 1 : 0} 张  ${flipped ? '显示答案' : '显示问题'}`);
    };
    const move = delta => {
      if (!cards.length) return;
      index = (index + delta + cards.length) % cards.length;
      flipped = false; paint();
    };
    face.addEventListener('click', () => { if (cards.length) { flipped = !flipped; paint(); } });
    const add = () => {
      if (!front.value.trim() || !back.value.trim()) { toast('正面和背面都要填写', 'warn'); return; }
      cards.push({ front: front.value.trim(), back: back.value.trim() });
      saveState('flashcards', cards);
      front.value = ''; back.value = ''; index = cards.length - 1; flipped = false;
      status.textContent = '已添加'; paint();
    };
    paint();
    root.append(panel('卡片',
      el('div', { class: 'inline-fields' }, labeled('正面', front), labeled('背面', back)),
      actions(btn('添加卡片', add, 'primary'), btn('翻面', () => { flipped = !flipped; paint(); }),
        btn('上一张', () => move(-1)), btn('下一张', () => move(1)),
        btn('删除当前', () => { if (!cards.length) return; cards.splice(index, 1); index = Math.max(0, index - 1); saveState('flashcards', cards); paint(); }),
        btn('导出 JSON', () => downloadText(JSON.stringify(cards, null, 2), 'flashcards.json', 'application/json;charset=utf-8')),
        btn('复制全部', () => copyText(cards.map((c, i) => `${pad(i + 1)}. ${c.front}\n   ${c.back}`).join('\n')))),
      face, output.node, status,
      hint('点击卡片翻面；数据保存在本机 localStorage，导出 JSON 可自行备份。')));
  },
};

const chartMaker = {
  id: 'chart-maker', name: 'CSV 图表生成器', category: 'creative',
  desc: '粘贴两列数据，画柱状 / 折线 / 饼图并导出 PNG', keywords: ['图表', 'CSV', '柱状图', '饼图', 'chart'],
  render(root) {
    const data = txt({ rows: 7, value: '一月,120\n二月,168\n三月,95\n四月,210\n五月,176' });
    const kind = sel([{ value: 'bar', label: '柱状图' }, { value: 'line', label: '折线图' }, { value: 'pie', label: '饼图' }], 'bar', null);
    const title = inp({ type: 'text', value: '示例数据' });
    const canvas = makeCanvas(760, 420);
    canvas.className = 'board-canvas';
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const COLORS = ['#8b8b96', '#a9a9b4', '#6f6f7c', '#c4c4cc', '#565663', '#d8d8de', '#7d7d8a', '#b0b0bb'];

    const draw = () => {
      /* 首行常是表头（例如「月份,销量」）：数值列不是数字的行直接跳过，免得画出 0 值柱子 */
      const rows = parseCsv(data.value)
        .map(r => ({ label: String(r[0] || '').trim(), raw: String(r[1] ?? '').replace(/[,¥$\s]/g, '') }))
        .filter(r => r.label && r.raw !== '' && Number.isFinite(Number(r.raw)))
        .map(r => ({ label: r.label, value: Number(r.raw) }));
      if (!rows.length) { output.set('没有可绘制的数据，请按「标签,数值」每行一条填写'); return; }
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#17171a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(title.value || '图表', 28, 36);
      const max = Math.max(...rows.map(r => Math.abs(r.value)), 1);
      const left = 66, right = w - 28, top = 70, bottom = h - 56;
      ctx.strokeStyle = '#d8d8de'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const y = top + (bottom - top) * i / 4;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        ctx.fillStyle = '#6f6f7c'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(String(Math.round(max * (1 - i / 4))), left - 8, y + 4);
      }
      if (kind.value === 'pie') {
        const total = rows.reduce((a, b) => a + Math.abs(b.value), 0) || 1;
        const cx = w / 2, cy = (top + bottom) / 2, r = Math.min(w, h) / 3;
        let start = -Math.PI / 2;
        rows.forEach((row, i) => {
          const angle = Math.abs(row.value) / total * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + angle); ctx.closePath();
          ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
          start += angle;
        });
        let ly = top + 12;
        rows.slice(0, 8).forEach((row, i) => {
          ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fillRect(right - 130, ly - 9, 12, 12);
          ctx.fillStyle = '#17171a'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
          ctx.fillText(`${row.label} ${row.value}`, right - 112, ly + 1); ly += 20;
        });
      } else {
        const band = (right - left) / rows.length;
        const bw = Math.min(band * 0.6, 64);
        const yOf = v => bottom - (Math.abs(v) / max) * (bottom - top);
        if (kind.value === 'line' && rows.length > 1) {
          ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.beginPath();
          rows.forEach((row, i) => {
            const x = left + band * (i + 0.5), y = yOf(row.value);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke();
        }
        rows.forEach((row, i) => {
          const x = left + band * (i + 0.5);
          if (kind.value === 'bar') {
            ctx.fillStyle = COLORS[i % COLORS.length];
            ctx.fillRect(x - bw / 2, yOf(row.value), bw, bottom - yOf(row.value));
          } else {
            ctx.fillStyle = '#4f46e5'; ctx.beginPath(); ctx.arc(x, yOf(row.value), 4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#17171a'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(row.label.slice(0, 8), x, bottom + 20);
          ctx.fillText(String(row.value), x, yOf(row.value) - 8);
        });
      }
      output.set(`已绘制 ${rows.length} 组数据\n${rows.map(r => `${r.label}: ${r.value}`).join('\n')}`);
      status.textContent = '绘制完成';
    };
    [data, title].forEach(n => n.addEventListener('input', draw));
    kind.addEventListener('change', draw);
    draw();
    root.append(panel('图表',
      el('div', { class: 'inline-fields' }, labeled('标题', title), labeled('类型', kind)),
      data,
      actions(btn('重新绘制', draw, 'primary'),
        btn('下载 PNG', () => canvas.toBlob(blob => { if (blob) downloadBlob(blob, 'chart.png'); }, 'image/png')),
        btn('复制数据', () => copyText(data.value))),
      canvas, output.node, status,
      hint('第一列为标签、第二列为数值，支持带引号的 CSV；用 Canvas 手绘，不引入图表库。')));
  },
};

export const creativeGenTools = [
  textAnimationMaker, emojiFinder, pixelArtConverter, dailyPlanner,
  signatureMaker, flashcardMaker, chartMaker,
];

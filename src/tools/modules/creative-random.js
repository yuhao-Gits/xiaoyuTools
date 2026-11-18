/* 随机决策类：候选数据、文案与图形均为本项目独立编写。 */
import {
  panel, inp, txt, sel, btn, actions, resultBox, hint, el, labeled, toast, copyText,
} from '../../core/ui.js';
import { pick, pad, makeCanvas } from './shared.js';

const DISHES = [
  '番茄炒蛋盖饭', '红烧牛肉面', '酸辣粉', '黄焖鸡米饭', '麻辣香锅', '扬州炒饭',
  '水煮牛肉', '麻婆豆腐', '宫保鸡丁', '鱼香肉丝', '回锅肉', '糖醋排骨',
  '葱油拌面', '牛肉饺子', '三鲜馄饨', '兰州拉面', '煲仔饭', '石锅拌饭',
  '寿喜锅', '咖喱猪排饭', '意式肉酱面', '奶油蘑菇意面', '芝士焗饭', '烤鸡沙拉',
  '麻辣烫', '冒菜', '烤肉拌饭', '海鲜粥', '皮蛋瘦肉粥', '小笼包',
  '生煎包', '肉夹馍', '凉皮', '炸酱面', '羊肉泡馍', '螺蛳粉',
  '日式豚骨拉面', '照烧鸡腿饭', '韩式泡菜炒饭', '越南河粉',
];

const FATE_ANSWERS = [
  '可以，但先把手上那件小事做完。', '再等等，现在不是最好的时机。',
  '值得试试，最坏的结果也能收拾。', '换个角度想，答案会完全不一样。',
  '先睡一觉，明天再决定。', '别一个人扛，找人聊聊。',
  '这件事没你想的那么重要。', '做吧，你会感谢现在的自己。',
  '先收集信息，别凭感觉。', '把范围缩小一点，就好选了。',
  '这次倾向保守一点。', '机会在别处，别死磕。',
];

const DARES = [
  '给最近没联系的朋友发一句问候', '把桌面收拾干净', '站起来伸展三分钟',
  '喝一杯水', '写下今天最想完成的一件事', '朗读一段喜欢的文字',
  '关掉手机静坐两分钟', '整理一个文件夹', '学一个新单词并用它造句',
  '给家人发张今天的照片', '做十个深蹲', '列出三件让你开心的小事',
];

const whatToEat = {
  id: 'what-to-eat', name: '今天吃什么？', category: 'creative',
  desc: '从自定义候选里随机抽一顿，支持排除', keywords: ['吃什么', '随机', '选择困难', '抽签'],
  render(root) {
    const editor = txt({ value: DISHES.join('\n'), rows: 8 });
    const exclude = inp({ type: 'text', placeholder: '不想吃的关键词，用逗号分隔' });
    const big = el('strong', { text: '还没抽' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let history = [];
    const draw = () => {
      const bans = exclude.value.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
      const pool = editor.value.split('\n').map(s => s.trim()).filter(Boolean)
        .filter(s => !bans.some(b => s.includes(b)));
      if (!pool.length) { toast('没有可用候选', 'warn'); return; }
      const choice = pick(pool);
      history.unshift(choice); history = history.slice(0, 8);
      big.textContent = choice;
      output.set(`候选 ${pool.length} 项${bans.length ? `，已排除含「${bans.join('、')}」的选项` : ''}\n\n最近抽到：\n${history.map((h, i) => `${pad(i + 1)}. ${h}`).join('\n')}`);
      status.textContent = `第 ${history.length} 次抽取（本机随机）`;
    };
    root.append(panel('候选清单', editor,
      el('div', { class: 'inline-fields' }, labeled('排除关键词', exclude)),
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '就吃这个' }), big)),
      actions(btn('帮我选', draw, 'primary'), btn('复制候选', () => copyText(editor.value))),
      output.node, status,
      hint('候选清单可自由编辑；随机由 Math.random 在本机产生，不记录、不联网。')));
  },
};

const askFate = {
  id: 'ask-fate', name: '问命运', category: 'creative',
  desc: '心里想一个问题，抽一条本地提示', keywords: ['占卜', '命运', '随机', '决策'],
  render(root) {
    const question = inp({ type: 'text', placeholder: '在心里或这里写下你的问题…' });
    const big = el('strong', { text: '？' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let count = 0;
    const draw = () => {
      count += 1;
      big.textContent = pick(FATE_ANSWERS);
      output.set(`第 ${count} 次\n问题：${question.value.trim() || '（未填写）'}\n\n提示只是随机文案，不构成任何建议。`);
      status.textContent = '已抽取';
    };
    root.append(panel('问一问', question,
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '抽到的提示' }), big)),
      actions(btn('抽一条', draw, 'primary')), output.node, status,
      hint('纯本地随机文案，不占卜、不预测、不联网，请勿据此做重要决定。')));
  },
};

const coinFlip = {
  id: 'coin-flip', name: '抛硬币', category: 'creative',
  desc: '正反随机，自动统计次数与比例', keywords: ['硬币', '正反', '随机', 'flip'],
  render(root) {
    const face = el('strong', { text: '—' });
    const heads = el('strong', { text: '0' }), tails = el('strong', { text: '0' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let h = 0, t = 0, log = [];
    const flip = () => {
      const isHead = Math.random() < 0.5;
      isHead ? (h += 1) : (t += 1);
      face.textContent = isHead ? '正面' : '反面';
      heads.textContent = h; tails.textContent = t;
      log.unshift(`${pad(log.length + 1)}  ${isHead ? '正面' : '反面'}`);
      output.set(`共 ${h + t} 次  正面 ${h}（${((h / (h + t)) * 100).toFixed(1)}%）  反面 ${t}\n\n${log.slice(0, 20).join('\n')}`);
      status.textContent = '已抛';
    };
    root.append(panel('抛硬币',
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '结果' }), face)),
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '正面' }), heads),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '反面' }), tails)),
      actions(btn('抛一次', flip, 'primary'), btn('连抛 10 次', () => { for (let i = 0; i < 10; i += 1) flip(); }),
        btn('清空统计', () => { h = 0; t = 0; log = []; heads.textContent = '0'; tails.textContent = '0'; output.clear(); })),
      output.node, status));
  },
};

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const diceRoller = {
  id: 'dice-roller', name: '掷骰子', category: 'creative',
  desc: '多颗骰子、可设面数，显示点数和', keywords: ['骰子', 'dice', '随机', '点数'],
  render(root) {
    const count = inp({ type: 'number', min: '1', max: '20', value: '2' });
    const sides = sel([{ value: '4', label: '4 面' }, { value: '6', label: '6 面' }, { value: '8', label: '8 面' }, { value: '10', label: '10 面' }, { value: '12', label: '12 面' }, { value: '20', label: '20 面' }], '6', null);
    const face = el('strong', { text: '—' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let log = [];
    const roll = () => {
      const n = Math.min(20, Math.max(1, Math.round(Number(count.value) || 1)));
      const s = Number(sides.value) || 6;
      const values = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
      face.textContent = s === 6 && n <= 8 ? values.map(v => DICE_FACES[v]).join(' ') : values.join('  ');
      const sum = values.reduce((a, b) => a + b, 0);
      log.unshift(`[${values.join(', ')}]  合计 ${sum}`);
      output.set(`本次 ${n} 颗 ${s} 面骰  合计 ${sum}  平均 ${(sum / n).toFixed(1)}\n\n最近记录：\n${log.slice(0, 12).join('\n')}`);
      status.textContent = '已投掷';
    };
    root.append(panel('骰子',
      el('div', { class: 'inline-fields' }, labeled('颗数', count), labeled('面数', sides)),
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '点数' }), face)),
      actions(btn('掷！', roll, 'primary'), btn('清空记录', () => { log = []; output.clear(); })),
      output.node, status,
      hint('6 面骰用 Unicode 骰面字符显示，其它面数显示数字；完全本机随机。')));
  },
};

/* 转盘工厂：Canvas 绘制扇形 + 缓动旋转，结果取顶部指针位置。 */
function spinnerTool({ id, name, desc, keywords, options, title }) {
  return {
    id, name, category: 'creative', desc, keywords,
    render(root) {
      const editor = txt({ value: options.join('\n'), rows: 6 });
      const canvas = makeCanvas(420, 420);
      canvas.className = 'board-canvas spinner-canvas';
      const big = el('strong', { text: '等待旋转' });
      const output = resultBox();
      const status = el('div', { class: 'status' });
      let angle = 0, spinning = false, history = [];
      const PALETTE = ['#3a3a42', '#52525e', '#6b6b78', '#838390', '#2c2c33', '#454552', '#5d5d6a', '#747482'];

      const items = () => editor.value.split('\n').map(s => s.trim()).filter(Boolean);
      const paint = () => {
        const list = items();
        const ctx = canvas.getContext('2d');
        const cx = 210, cy = 210, r = 195;
        ctx.clearRect(0, 0, 420, 420);
        if (!list.length) { ctx.fillStyle = '#f2f2f4'; ctx.fillText('请先填写选项', 140, 210); return; }
        const step = (Math.PI * 2) / list.length;
        for (let i = 0; i < list.length; i += 1) {
          const a0 = angle + i * step, a1 = a0 + step;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
          ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fill();
          ctx.strokeStyle = '#0a0a0b'; ctx.lineWidth = 2; ctx.stroke();
          ctx.save();
          ctx.translate(cx + Math.cos((a0 + a1) / 2) * r * 0.62, cy + Math.sin((a0 + a1) / 2) * r * 0.62);
          ctx.rotate((a0 + a1) / 2);
          ctx.fillStyle = '#f5f5f7'; ctx.font = '14px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(list[i].slice(0, 10), 0, 0);
          ctx.restore();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy - r - 12); ctx.lineTo(cx - 12, cy - r - 30); ctx.lineTo(cx + 12, cy - r - 30); ctx.closePath();
        ctx.fillStyle = '#f2f2f4'; ctx.fill();
      };
      const spin = () => {
        const list = items();
        if (!list.length) { toast('请先填写选项', 'warn'); return; }
        if (spinning) return;
        spinning = true;
        const turns = 4 + Math.random() * 3;
        const target = Math.random() * Math.PI * 2;
        const from = angle, to = angle + turns * Math.PI * 2 + target;
        const duration = 3200, start = performance.now();
        const step = () => {
          const t = Math.min(1, (performance.now() - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          angle = from + (to - from) * eased;
          paint();
          if (t < 1) requestAnimationFrame(step);
          else {
            spinning = false;
            const normalized = ((Math.PI / 2 - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const index = Math.floor(normalized / (Math.PI * 2 / list.length)) % list.length;
            const choice = list[index];
            big.textContent = choice;
            history.unshift(choice);
            output.set(`${title}：${choice}\n\n最近结果：\n${history.slice(0, 8).map((x, i) => `${pad(i + 1)}. ${x}`).join('\n')}`);
            status.textContent = '旋转结束';
          }
        };
        status.textContent = '旋转中…';
        requestAnimationFrame(step);
      };
      paint();
      root.append(panel(title, editor,
        actions(btn('开始旋转', spin, 'primary'), btn('重绘', paint)),
        canvas,
        el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '结果' }), big)),
        output.node, status,
        hint('选项每行一条；指针固定在正上方，旋转缓动结束后由角度算出结果。全部在本机绘制。')));
    },
  };
}

export const creativeRandomTools = [
  whatToEat, askFate, coinFlip, diceRoller,
  spinnerTool({
    id: 'random-spinner', name: '随机转盘', desc: '自定义选项的转盘抽签',
    keywords: ['转盘', '抽签', '随机', 'spinner'], title: '自定义转盘',
    options: ['方案 A', '方案 B', '方案 C', '方案 D', '再想一个', '交给明天'],
  }),
  spinnerTool({
    id: 'spin-the-dare', name: '大冒险轮盘', desc: '抽一条轻松的小任务',
    keywords: ['大冒险', '轮盘', '抽签', '任务'], title: '大冒险轮盘',
    options: DARES,
  }),
];

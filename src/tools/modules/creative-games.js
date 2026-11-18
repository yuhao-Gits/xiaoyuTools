/* 反应 / 手速小游戏：全部本机计时与绘制，不联网、不记录成绩。 */
import {
  panel, inp, sel, btn, actions, resultBox, hint, el, toast,
} from '../../core/ui.js';
import { pad } from './shared.js';

const reactionTimeTest = {
  id: 'reaction-time-test', name: '反应速度测试', category: 'creative',
  desc: '看到变色就点击，统计平均反应时间', keywords: ['反应', '手速', '测试', 'reaction'],
  render(root) {
    const area = el('div', { class: 'game-area game-ready', text: '点击「开始」后等待变色' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const statAvg = el('strong', { text: '—' }), statBest = el('strong', { text: '—' }), statCount = el('strong', { text: '0' });
    let phase = 'idle', at = 0, timer = null, results = [];

    const reset = () => {
      clearTimeout(timer); timer = null; phase = 'idle';
      area.className = 'game-area game-ready';
      area.textContent = '点击「开始」后等待变色';
    };
    const start = () => {
      reset();
      phase = 'wait';
      area.className = 'game-area game-wait';
      area.textContent = '等待信号…（不要提前点）';
      status.textContent = '等待中';
      timer = setTimeout(() => {
        if (phase !== 'wait') return;
        phase = 'go'; at = performance.now();
        area.className = 'game-area game-go';
        area.textContent = '现在点！';
      }, 1200 + Math.random() * 2800);
    };
    area.addEventListener('click', () => {
      if (phase === 'idle') return;
      if (phase === 'wait') {
        clearTimeout(timer); reset();
        status.textContent = '抢跑了，重新开始吧';
        toast('太早了，请等变色', 'warn');
        return;
      }
      if (phase === 'go') {
        const ms = Math.round(performance.now() - at);
        results.push(ms);
        const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
        statAvg.textContent = `${avg} ms`;
        statBest.textContent = `${Math.min(...results)} ms`;
        statCount.textContent = results.length;
        output.set(results.map((v, i) => `${pad(i + 1)}. ${v} ms  ${v < 200 ? '很快' : v < 300 ? '正常' : '偏慢'}`).join('\n'));
        status.textContent = `本次 ${ms} ms`;
        reset();
      }
    });

    root.append(panel('反应测试', area,
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '平均' }), statAvg),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '最好' }), statBest),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '次数' }), statCount)),
      actions(btn('开始', start, 'primary'), btn('清空成绩', () => {
        results = []; statAvg.textContent = '—'; statBest.textContent = '—'; statCount.textContent = '0'; output.clear(); reset();
      })),
      output.node, status,
      hint('随机延时 1.2–4 秒后变色；成绩只存在当前页面，刷新即清空。')));
  },
};

const cpsTest = {
  id: 'cps-test', name: 'CPS 测试', category: 'creative',
  desc: '测一测每秒点击次数，可选时长', keywords: ['CPS', '点击', '手速', '连点'],
  render(root) {
    const seconds = sel([{ value: '5', label: '5 秒' }, { value: '10', label: '10 秒' }, { value: '3', label: '3 秒' }], '5', null);
    const area = el('div', { class: 'game-area game-ready', text: '点这里开始' });
    const big = el('strong', { text: '0.00' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let clicks = 0, running = false, deadline = 0, timer = null;

    const finish = () => {
      clearInterval(timer); timer = null; running = false;
      const total = Number(seconds.value) || 5;
      const cps = clicks / total;
      big.textContent = cps.toFixed(2);
      area.className = 'game-area game-ready';
      area.textContent = `结束！共 ${clicks} 次，再来一次？`;
      output.set(`时长 ${total} 秒\n点击 ${clicks} 次\nCPS  ${cps.toFixed(2)} 次/秒`);
      status.textContent = '本轮结束';
    };
    area.addEventListener('click', () => {
      if (!running) {
        clicks = 1; running = true;
        const total = Number(seconds.value) || 5;
        deadline = Date.now() + total * 1000;
        area.className = 'game-area game-go';
        area.textContent = '快点！';
        status.textContent = '计时中…';
        timer = setInterval(() => {
          const left = Math.max(0, deadline - Date.now());
          big.textContent = (clicks / total).toFixed(2);
          if (!area.isConnected || left <= 0) { finish(); return; }
          area.textContent = `快点！剩余 ${(left / 1000).toFixed(1)} 秒`;
        }, 50);
      } else { clicks += 1; }
    });

    root.append(panel('点击测试',
      el('div', { class: 'inline-fields' }, el('label', { class: 'field' }, el('span', { class: 'field-label', text: '测试时长' }), seconds)),
      area,
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: 'CPS' }), big)),
      actions(btn('重置', () => {
        clearInterval(timer); timer = null; running = false; clicks = 0;
        big.textContent = '0.00'; area.className = 'game-area game-ready';
        area.textContent = '点这里开始'; output.clear();
      })),
      output.node, status,
      hint('第一次点击开始计时，在这段时间内尽量多点；结果仅本机显示。')));
  },
};

const aimTrainer = {
  id: 'aim-trainer', name: '瞄准训练', category: 'creative',
  desc: '限时点击随机目标，统计命中率', keywords: ['瞄准', '训练', '反应', 'aim'],
  render(root) {
    const seconds = sel([{ value: '20', label: '20 秒' }, { value: '30', label: '30 秒' }, { value: '10', label: '10 秒' }], '30', null);
    const size = sel([{ value: '36', label: '大目标' }, { value: '26', label: '中目标' }, { value: '18', label: '小目标' }], '26', null);
    const area = el('div', { class: 'aim-area' });
    const statHit = el('strong', { text: '0' }), statMiss = el('strong', { text: '0' }), statLeft = el('strong', { text: '—' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let running = false, hit = 0, miss = 0, deadline = 0, timer = null, target = null;

    const place = () => {
      if (target) target.remove();
      const s = Number(size.value) || 26;
      const w = Math.max(120, area.clientWidth || 600), h = Math.max(120, area.clientHeight || 300);
      target = el('div', {
        class: 'aim-target',
        style: { width: `${s}px`, height: `${s}px`, left: `${Math.random() * (w - s)}px`, top: `${Math.random() * (h - s)}px` },
      });
      target.addEventListener('click', event => {
        event.stopPropagation();
        if (!running) return;
        hit += 1; statHit.textContent = hit; place();
      });
      area.append(target);
    };
    area.addEventListener('click', () => { if (running) { miss += 1; statMiss.textContent = miss; } });
    const finish = () => {
      clearInterval(timer); timer = null; running = false;
      if (target) { target.remove(); target = null; }
      const total = hit + miss;
      output.set(`命中 ${hit}  失手 ${miss}\n命中率 ${total ? (hit / total * 100).toFixed(1) : '0.0'}%\n目标尺寸 ${size.value}px`);
      status.textContent = '本轮结束';
    };
    const start = () => {
      if (running) return;
      hit = 0; miss = 0; running = true;
      statHit.textContent = '0'; statMiss.textContent = '0';
      deadline = Date.now() + (Number(seconds.value) || 30) * 1000;
      place();
      status.textContent = '进行中…';
      timer = setInterval(() => {
        const left = Math.max(0, deadline - Date.now());
        statLeft.textContent = `${(left / 1000).toFixed(1)} s`;
        if (!area.isConnected || left <= 0) { statLeft.textContent = '0.0 s'; finish(); }
      }, 50);
    };

    root.append(panel('瞄准训练',
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '时长' }), seconds),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '目标大小' }), size)),
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '命中' }), statHit),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '失手' }), statMiss),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '剩余' }), statLeft)),
      actions(btn('开始', start, 'primary'), btn('结束', finish)),
      area, output.node, status,
      hint('点击方块计命中，点空白计失手；目标位置由本机随机生成。')));
  },
};

const KEY_ROWS = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Back'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Alt', 'Space', 'Alt', 'Ctrl'],
];
const keyboardTester = {
  id: 'keyboard-tester', name: '键盘测试', category: 'creative',
  desc: '按下任意键高亮键位，检查是否失灵', keywords: ['键盘', '按键', '测试', 'keyboard'],
  render(root) {
    const keys = new Map();
    const board = el('div', { class: 'kbd-board' });
    for (const row of KEY_ROWS) {
      const line = el('div', { class: 'kbd-row' });
      for (const label of row) {
        const node = el('div', { class: 'kbd', text: label });
        const key = label.toLowerCase();
        if (!keys.has(key)) keys.set(key, []);
        keys.get(key).push(node);
        line.append(node);
      }
      board.append(line);
    }
    const readout = el('strong', { text: '—' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const pressed = new Set();
    const nameOf = event => {
      const k = event.key;
      if (k === ' ') return 'space';
      if (k === 'Control') return 'ctrl';
      if (k === 'Escape') return 'esc';
      if (k === 'Backspace') return 'back';
      if (k === 'ArrowUp') return '↑';
      return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
    };
    const highlight = (name, on) => {
      for (const node of keys.get(name) || []) node.classList.toggle('is-on', on);
    };
    const onDown = event => {
      const name = nameOf(event);
      if (pressed.has(name)) return;
      pressed.add(name); highlight(name, true);
      readout.textContent = `${event.key}  ·  code=${event.code}  ·  keyCode=${event.keyCode}`;
      output.set(`已按过的键（${pressed.size}）：\n${[...pressed].join('  ')}`);
      status.textContent = `${event.repeat ? '长按' : '按下'} ${name}`;
      if (['tab', 'space'].includes(name)) event.preventDefault();
    };
    const onUp = event => {
      const name = nameOf(event);
      pressed.delete(name); highlight(name, false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    const cleanup = setInterval(() => {
      if (!board.isConnected) { clearInterval(cleanup); window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); }
    }, 500);

    root.append(panel('键位状态', board,
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '最近按键' }), readout)),
      actions(btn('清空记录', () => { pressed.clear(); output.clear(); for (const nodes of keys.values()) for (const n of nodes) n.classList.remove('is-on'); })),
      output.node, status,
      hint('打开本页后直接按键盘即可；同时按住多键可检查冲突。监听在离开页面时自动移除。')));
  },
};

export const creativeGameTools = [reactionTimeTest, cpsTest, aimTrainer, keyboardTester];

/* 时间类补充：番茄钟与打字速度测试。 */
import {
  panel, inp, sel, btn, actions, resultBox, hint, el, labeled, toast,
} from '../../core/ui.js';
import { num, clamp, pad, clockText } from './shared.js';

const pomodoroTimer = {
  id: 'pomodoro-timer', name: '番茄钟', category: 'time',
  desc: '专注 / 短休 / 长休自动循环，本机计时', keywords: ['番茄钟', '专注', 'pomodoro', '计时'],
  render(root) {
    const workMin = inp({ type: 'number', value: '25', min: '1', max: '180', step: '1' });
    const shortMin = inp({ type: 'number', value: '5', min: '1', max: '60', step: '1' });
    const longMin = inp({ type: 'number', value: '15', min: '1', max: '120', step: '1' });
    const every = inp({ type: 'number', value: '4', min: '1', max: '10', step: '1' });
    const display = el('strong', { text: '25:00' });
    const phase = el('strong', { text: '未开始' });
    const rounds = el('strong', { text: '0' });
    const status = el('div', { class: 'status' });
    const output = resultBox();
    let timer = null, running = false, deadline = 0, remain = 0, stage = 'work', done = 0;

    const duration = () => (stage === 'work' ? num(workMin.value, 25) : stage === 'short' ? num(shortMin.value, 5) : num(longMin.value, 15)) * 60000;
    const beep = () => {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      try {
        const ctx = new Ctor(), osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = 660; gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination); osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.52);
        setTimeout(() => ctx.close().catch(() => {}), 700);
      } catch { /* 音频不可用时忽略 */ }
    };
    const paint = () => { display.textContent = clockText(remain); };
    const advance = () => {
      beep();
      if (stage === 'work') {
        done += 1; rounds.textContent = done;
        stage = done % clamp(Math.round(num(every.value, 4)), 1, 10) === 0 ? 'long' : 'short';
        toast('专注结束，休息一下', 'ok');
      } else {
        stage = 'work';
        toast('休息结束，开始下一轮', 'ok');
      }
      remain = duration();
      deadline = Date.now() + remain;
      phase.textContent = stage === 'work' ? '专注中' : stage === 'long' ? '长休息' : '短休息';
      output.set(`已完成 ${done} 个专注轮次\n当前阶段：${phase.textContent}`);
      paint();
    };
    const tick = () => {
      if (!display.isConnected) { clearInterval(timer); timer = null; running = false; return; }
      remain = Math.max(0, deadline - Date.now());
      if (remain <= 0) advance();
      else paint();
    };
    const start = () => {
      if (running) return;
      running = true;
      if (!deadline || remain <= 0) { remain = duration(); deadline = Date.now() + remain; }
      else deadline = Date.now() + remain;
      phase.textContent = stage === 'work' ? '专注中' : stage === 'long' ? '长休息' : '短休息';
      status.textContent = '进行中';
      timer = setInterval(tick, 200);
    };
    const pause = () => {
      if (!running) return;
      remain = Math.max(0, deadline - Date.now());
      clearInterval(timer); timer = null; running = false;
      status.textContent = '已暂停'; paint();
    };
    const reset = () => {
      clearInterval(timer); timer = null; running = false;
      stage = 'work'; done = 0; remain = duration(); deadline = 0;
      rounds.textContent = '0'; phase.textContent = '未开始';
      status.textContent = '已重置'; output.clear(); paint();
    };
    remain = duration(); paint();

    root.append(panel('节奏设置',
      el('div', { class: 'inline-fields' }, labeled('专注 min', workMin), labeled('短休 min', shortMin),
        labeled('长休 min', longMin), labeled('每几轮长休', every)),
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '剩余' }), display)),
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '阶段' }), phase),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '完成轮次' }), rounds)),
      actions(btn('开始', start, 'primary'), btn('暂停', pause), btn('跳过本阶段', advance), btn('重置', reset)),
      output.node, status,
      hint('阶段结束会用本机合成音提示并自动切换；页面需保持打开，不依赖系统通知权限。')));
  },
};

const SAMPLES = [
  '把常用的小操作收进一个页面，打开就能用，不需要安装，也不需要等待网络。',
  'The quick brown fox jumps over the lazy dog. Practice makes steady progress every day.',
  '本地工具的意义在于可控：数据留在这台机器上，处理过程看得见，结果随时可以导出。',
];
const typingTest = {
  id: 'typing-test', name: '打字速度测试', category: 'time',
  desc: '计时输入，统计速度、准确率与错字', keywords: ['打字', '速度', 'WPM', '准确率', '练习'],
  render(root) {
    const sample = sel(SAMPLES.map((s, i) => ({ value: String(i), label: `范文 ${i + 1}（${s.slice(0, 14)}…）` })), '0', null);
    const custom = el('div', { class: 'mono typing-sample', text: SAMPLES[0] });
    const input = inp({ type: 'text', placeholder: '点这里开始输入，计时自动启动…' });
    const speed = el('strong', { text: '0' }), accuracy = el('strong', { text: '—' }), elapsed = el('strong', { text: '0.0' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let startAt = 0, timer = null;
    const target = () => custom.textContent;

    sample.addEventListener('change', () => {
      clearInterval(timer); timer = null; startAt = 0;
      input.value = ''; custom.textContent = SAMPLES[Number(sample.value)] || SAMPLES[0];
      speed.textContent = '0'; accuracy.textContent = '—'; elapsed.textContent = '0.0';
      output.clear(); status.textContent = '已切换范文';
    });
    const paint = () => {
      const text = input.value, goal = target();
      let correct = 0;
      for (let i = 0; i < text.length; i += 1) if (text[i] === goal[i]) correct += 1;
      const seconds = startAt ? Math.max(0.1, (performance.now() - startAt) / 1000) : 0;
      elapsed.textContent = seconds.toFixed(1);
      speed.textContent = seconds ? Math.round(correct / seconds * 60) : '0';
      accuracy.textContent = text.length ? `${(correct / text.length * 100).toFixed(1)}%` : '—';
      const marks = [...goal].map((c, i) => {
        if (i >= text.length) return `<span class="dim">${c}</span>`;
        return text[i] === c ? `<span class="ok">${c}</span>` : `<span class="bad">${c}</span>`;
      }).join('');
      custom.innerHTML = marks;
      if (text.length >= goal.length) {
        clearInterval(timer); timer = null;
        output.set(`完成！用时 ${seconds.toFixed(1)} 秒\n速度 ${speed.textContent} 字符/分钟\n准确率 ${accuracy.textContent}`);
        status.textContent = '本轮完成';
        toast('打字测试完成', 'ok');
      }
    };
    input.addEventListener('input', () => {
      if (!startAt) {
        startAt = performance.now();
        status.textContent = '计时中…';
        timer = setInterval(() => {
          if (!input.isConnected) { clearInterval(timer); timer = null; return; }
          elapsed.textContent = ((performance.now() - startAt) / 1000).toFixed(1);
        }, 100);
      }
      paint();
    });
    const reset = () => {
      clearInterval(timer); timer = null; startAt = 0; input.value = '';
      custom.textContent = target();
      speed.textContent = '0'; accuracy.textContent = '—'; elapsed.textContent = '0.0';
      output.clear(); status.textContent = '已重置'; input.focus();
    };

    root.append(panel('打字测试',
      el('div', { class: 'inline-fields' }, labeled('范文', sample)),
      custom,
      input,
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '字符/分钟' }), speed),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '准确率' }), accuracy),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '用时 s' }), elapsed)),
      actions(btn('重新开始', reset, 'primary')), output.node, status,
      hint('按字符计速（中文一字算一字符），与英文 WPM 口径不同；范文与统计都在本机。')));
  },
};

export const timeExtraTools = [pomodoroTimer, typingTest];

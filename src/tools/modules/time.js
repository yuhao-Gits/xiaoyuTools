import { panel, inp, btn, actions, resultBox, hint, toast, el } from '../../core/ui.js';

const pad = (n, size = 2) => String(n).padStart(size, '0');
const clock = ms => `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;

const stopwatch = {
  id: 'stopwatch',
  name: '秒表',
  category: 'time',
  desc: '毫秒计时与圈速记录',
  keywords: ['秒表', '计时', 'stopwatch', '圈速'],
  render(root) {
    const display = el('strong', { text: '00:00:00.00' });
    const laps = resultBox();
    laps.clear();
    const status = el('div', { class: 'status' });
    let running = false, startAt = 0, elapsed = 0, timer = null, marks = [];

    const current = () => elapsed + (running ? performance.now() - startAt : 0);
    const paint = () => { display.textContent = clock(current()); };
    const tick = () => {
      if (!display.isConnected) { clearInterval(timer); timer = null; return; }
      paint();
    };
    const ensureTimer = () => { if (timer === null) timer = setInterval(tick, 33); };

    root.append(panel('计时',
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' },
        el('span', { text: '经过时间' }), display)),
      actions(
        btn('开始 / 暂停', () => {
          if (running) { elapsed = current(); running = false; }
          else { startAt = performance.now(); running = true; ensureTimer(); }
          status.textContent = running ? '计时中' : '已暂停';
          paint();
        }, 'primary'),
        btn('记圈', () => {
          marks.push(clock(current()));
          laps.set(marks.map((t, i) => `第 ${pad(i + 1)} 圈  ${t}`).join('\n'));
        }),
        btn('重置', () => {
          running = false; elapsed = 0; marks = [];
          laps.clear(); status.textContent = '已重置'; paint();
        })),
      status, laps.node,
      hint('计时基于 performance.now()，全部在本机进行，不依赖网络时间。')));
  },
};

const countdownTimer = {
  id: 'countdown-timer',
  name: '倒计时',
  category: 'time',
  desc: '设定时长，到点本机提醒',
  keywords: ['倒计时', '计时器', 'timer', '提醒'],
  render(root) {
    const h = inp({ type: 'number', value: '0', min: '0', max: '99', step: '1' });
    const m = inp({ type: 'number', value: '5', min: '0', max: '59', step: '1' });
    const s = inp({ type: 'number', value: '0', min: '0', max: '59', step: '1' });
    const display = el('strong', { text: '00:05:00' });
    const status = el('div', { class: 'status' });
    let deadline = 0, remain = 300000, timer = null, running = false;

    const total = () => ((Number(h.value) || 0) * 3600 + (Number(m.value) || 0) * 60 + (Number(s.value) || 0)) * 1000;
    const paint = () => { display.textContent = clock(Math.max(0, remain)); };
    const tick = () => {
      if (!display.isConnected) { clearInterval(timer); timer = null; return; }
      remain = deadline - Date.now();
      if (remain <= 0) {
        clearInterval(timer); timer = null; running = false; remain = 0;
        status.textContent = '时间到！';
        toast('倒计时结束', 'ok');
        paint();
        return;
      }
      paint();
    };

    const start = () => {
      if (running) return;
      if (remain <= 0) remain = total();
      deadline = Date.now() + remain;
      running = true;
      status.textContent = '倒计时进行中';
      timer = setInterval(tick, 200);
    };

    remain = total(); paint();
    root.append(panel('倒计时',
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '小时' }), h),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '分钟' }), m),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '秒' }), s)),
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '剩余时间' }), display)),
      actions(
        btn('开始', start, 'primary'),
        btn('暂停', () => {
          if (!running) return;
          remain = Math.max(0, deadline - Date.now());
          clearInterval(timer); timer = null; running = false;
          status.textContent = '已暂停'; paint();
        }),
        btn('重置', () => {
          clearInterval(timer); timer = null; running = false;
          remain = total(); status.textContent = '已重置'; paint();
        })),
      status,
      hint('到点后通过页面提示提醒；浏览器未授权通知权限时不会弹系统通知。')));
  },
};

const CITIES = [
  { name: '北京', tz: 'Asia/Shanghai' }, { name: '东京', tz: 'Asia/Tokyo' },
  { name: '首尔', tz: 'Asia/Seoul' }, { name: '新加坡', tz: 'Asia/Singapore' },
  { name: '迪拜', tz: 'Asia/Dubai' }, { name: '伦敦', tz: 'Europe/London' },
  { name: '巴黎', tz: 'Europe/Paris' }, { name: '柏林', tz: 'Europe/Berlin' },
  { name: '纽约', tz: 'America/New_York' }, { name: '洛杉矶', tz: 'America/Los_Angeles' },
  { name: '悉尼', tz: 'Australia/Sydney' }, { name: '协调世界时', tz: 'UTC' },
];

const worldClock = {
  id: 'world-clock',
  name: '世界时钟',
  category: 'time',
  desc: '用本机系统时间换算 12 个时区',
  keywords: ['世界时钟', '时区', 'timezone', '时间'],
  render(root) {
    const grid = el('div', { class: 'stat-grid' });
    const cells = CITIES.map(city => {
      const value = el('strong', { text: '--:--:--' });
      const cell = el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: city.name }), value);
      grid.append(cell);
      return { city, value };
    });
    const paint = () => {
      const now = new Date();
      for (const { city, value } of cells) {
        try {
          value.textContent = new Intl.DateTimeFormat('zh-CN', {
            timeZone: city.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          }).format(now);
        } catch {
          value.textContent = '不支持';
        }
      }
    };
    paint();
    const timer = setInterval(() => {
      if (!grid.isConnected) { clearInterval(timer); return; }
      paint();
    }, 1000);

    root.append(panel('各地时间', grid,
      actions(btn('立即刷新', paint, 'primary')),
      hint('基于 Intl.DateTimeFormat 与本机系统时钟计算，不请求任何网络时间服务。')));
  },
};

export const timeTools = [stopwatch, countdownTimer, worldClock];

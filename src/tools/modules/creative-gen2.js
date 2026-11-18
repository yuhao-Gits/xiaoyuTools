/* 创意生成类（二）：节日、物品定位、ASCII、MIDI 键盘、呼吸放松、设备测试。
   字库、节日与说明文字均为本项目自写。 */
import {
  panel, inp, txt, sel, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadText, downloadBlob, filePicker,
} from '../../core/ui.js';
import { loadState, saveState } from '../../core/store.js';
import { canvasFromImageFile, makeCanvas, num, clamp, pad, audioContext } from './shared.js';

/* 自写的固定 / 可计算公历纪念日清单，不引用任何第三方节日数据。 */
const HOLIDAYS = [
  { m: 1, d: 1, name: '元旦', note: '公历新年第一天' },
  { m: 2, d: 14, name: '情人节', note: '常见的互赠礼物日' },
  { m: 3, d: 8, name: '国际妇女节', note: '纪念女性权益与成就' },
  { m: 3, d: 12, name: '植树节', note: '中国的植树纪念日' },
  { m: 3, d: 14, name: '圆周率日', note: '3.14，数学爱好者的小节日' },
  { m: 4, d: 1, name: '愚人节', note: '以玩笑与恶作剧闻名' },
  { m: 4, d: 22, name: '世界地球日', note: '关注环境保护' },
  { m: 4, d: 23, name: '世界读书日', note: '推广阅读与版权意识' },
  { m: 5, d: 1, name: '国际劳动节', note: '劳动者的节日' },
  { m: 5, d: 4, name: '青年节', note: '纪念五四运动' },
  { m: 6, d: 1, name: '国际儿童节', note: '关注儿童权益' },
  { m: 6, d: 5, name: '世界环境日', note: '联合国环境主题日' },
  { m: 9, d: 10, name: '教师节', note: '中国的教师节' },
  { m: 10, d: 1, name: '国庆节', note: '中华人民共和国国庆日' },
  { m: 10, d: 31, name: '万圣节前夜', note: '流行文化中的装扮日' },
  { m: 11, d: 11, name: '双十一', note: '电商促销日' },
  { m: 12, d: 24, name: '平安夜', note: '圣诞前夜' },
  { m: 12, d: 25, name: '圣诞节', note: '西方传统节日' },
  { m: 12, d: 31, name: '跨年夜', note: '一年的最后一天' },
];
const nthWeekday = (year, month, weekday, nth) => {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
};

const holidays = {
  id: 'holidays', name: '世界节日', category: 'creative',
  desc: '按日期查看常见纪念日与倒计时', keywords: ['节日', '纪念日', '倒计时', '日历'],
  render(root) {
    const year = inp({ type: 'number', value: String(new Date().getFullYear()), min: '1970', max: '9999' });
    const month = sel([{ value: '0', label: '全年' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 月` }))], '0', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    const paint = () => {
      const y = clamp(Math.round(num(year.value, new Date().getFullYear())), 1970, 9999);
      const list = [
        ...HOLIDAYS.map(h => ({ ...h, date: new Date(y, h.m - 1, h.d) })),
        { name: '母亲节', note: '5 月第二个星期日', date: nthWeekday(y, 5, 0, 2), m: 5 },
        { name: '父亲节', note: '6 月第三个星期日', date: nthWeekday(y, 6, 0, 3), m: 6 },
        { name: '感恩节', note: '11 月第四个星期四', date: nthWeekday(y, 11, 4, 4), m: 11 },
      ].filter(h => month.value === '0' || h.m === Number(month.value))
        .sort((a, b) => a.date - b.date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const lines = list.map(h => {
        const days = Math.round((h.date - today) / 86400000);
        const when = days === 0 ? '就是今天' : days > 0 ? `还有 ${days} 天` : `已过去 ${-days} 天`;
        return `${pad(h.date.getMonth() + 1)}-${pad(h.date.getDate())}  周${WEEK[h.date.getDay()]}  ${h.name.padEnd(8, '　')} ${when.padEnd(10)} ${h.note}`;
      });
      output.set(`${y} 年 · 共 ${list.length} 条\n\n${lines.join('\n')}`);
      status.textContent = '按本机系统日期计算';
    };
    year.addEventListener('input', paint);
    month.addEventListener('change', paint);
    paint();
    root.append(panel('节日一览',
      el('div', { class: 'inline-fields' }, labeled('年份', year), labeled('月份', month)),
      actions(btn('刷新', paint, 'primary'), btn('复制列表', () => copyText(output.node.textContent))),
      output.node, status,
      hint('仅收录固定公历日期与可按规则推算的节日；农历与地区性假日未列入，也不联网校时。')));
  },
};

const itemLocator = {
  id: 'item-locator', name: '物品定位器', category: 'creative',
  desc: '记录东西放在哪，随时本机搜索', keywords: ['收纳', '物品', '位置', '查找', '记录'],
  render(root) {
    const name = inp({ type: 'text', placeholder: '物品名称' });
    const place = inp({ type: 'text', placeholder: '放在哪里' });
    const note = inp({ type: 'text', placeholder: '备注（可选）' });
    const query = inp({ type: 'text', placeholder: '搜索名称、位置或备注' });
    const list = el('div', { class: 'check-grid' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let items = loadState('items', []);
    if (!Array.isArray(items)) items = [];

    const paint = () => {
      const q = query.value.trim().toLowerCase();
      const rows = items.filter(x => !q || [x.name, x.place, x.note].join(' ').toLowerCase().includes(q));
      list.replaceChildren();
      if (!rows.length) list.append(el('div', { class: 'hint', text: q ? '没有匹配的记录' : '还没有记录，先添加一条' }));
      for (const item of rows) {
        list.append(el('div', { class: 'check' },
          el('span', { text: `${item.name}  →  ${item.place}${item.note ? `  ·  ${item.note}` : ''}` }),
          el('button', { class: 'button', type: 'button', text: '删除', onclick: () => {
            items = items.filter(x => x !== item); saveState('items', items); paint();
          } })));
      }
      output.set(`共 ${items.length} 条记录，当前显示 ${rows.length} 条。`);
    };
    const add = () => {
      if (!name.value.trim() || !place.value.trim()) { toast('请填写名称与位置', 'warn'); return; }
      items.push({ name: name.value.trim(), place: place.value.trim(), note: note.value.trim() });
      saveState('items', items);
      name.value = ''; place.value = ''; note.value = '';
      status.textContent = '已保存'; paint();
    };
    query.addEventListener('input', paint);
    paint();
    root.append(panel('物品记录',
      el('div', { class: 'inline-fields' }, labeled('名称', name), labeled('位置', place), labeled('备注', note)),
      actions(btn('添加', add, 'primary'),
        btn('搜索', paint),
        btn('导出 TXT', () => downloadText(items.map(x => `${x.name}\t${x.place}\t${x.note}`).join('\n') + '\n', 'items.txt')),
        btn('清空全部', () => { items = []; saveState('items', items); paint(); })),
      query, list, output.node, status,
      hint('记录只写在本机 localStorage；纯本地用途，不上传、不共享。')));
  },
};

const ASCII_SETS = {
  detailed: '@%#*+=-:. ',
  simple: '@#*+-. ',
  blocks: '█▓▒░ ',
  binary: '01',
};
const asciiArt = {
  id: 'ascii-art', name: 'ASCII 艺术', category: 'creative',
  desc: '把图片按灰度映射成字符画', keywords: ['ASCII', '字符画', '图片', '艺术'],
  render(root) {
    const picker = filePicker({ accept: 'image/*' });
    const columns = inp({ type: 'range', min: '20', max: '180', value: '80' });
    const charset = sel([
      { value: 'detailed', label: '细腻 10 级' }, { value: 'simple', label: '简洁 7 级' },
      { value: 'blocks', label: '方块' }, { value: 'binary', label: '0 / 1' },
    ], 'detailed', null);
    const invert = el('input', { type: 'checkbox' });
    const contrast = inp({ type: 'range', min: '50', max: '200', value: '100' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let text = '';
    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择图片'); return; }
      try {
        const image = await canvasFromImageFile(file, { max: 2000 });
        const cols = clamp(num(columns.value, 80), 20, 180);
        const rows = Math.max(1, Math.round(cols * image.height / image.width * 0.5));
        const canvas = makeCanvas(cols, rows);
        canvas.getContext('2d').drawImage(image, 0, 0, cols, rows);
        const data = canvas.getContext('2d').getImageData(0, 0, cols, rows).data;
        const chars = ASCII_SETS[charset.value] || ASCII_SETS.detailed;
        const k = clamp(num(contrast.value, 100), 50, 200) / 100;
        const lines = [];
        for (let y = 0; y < rows; y += 1) {
          let line = '';
          for (let x = 0; x < cols; x += 1) {
            const i = (y * cols + x) * 4;
            let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
            lum = clamp((lum - 0.5) * k + 0.5, 0, 1);
            if (invert.checked) lum = 1 - lum;
            line += chars[Math.min(chars.length - 1, Math.floor(lum * chars.length))];
          }
          lines.push(line.replace(/\s+$/, ''));
        }
        text = lines.join('\n');
        output.set(text);
        status.textContent = `已生成 ${cols}×${rows} 字符`;
      } catch (error) { output.set(`失败：${error.message}`); }
    };
    root.append(panel('字符画', picker,
      el('div', { class: 'inline-fields' },
        labeled('宽度（字符）', columns), labeled('字符集', charset),
        labeled('反相', invert), labeled('对比 %', contrast)),
      actions(btn('生成', run, 'primary'), btn('复制', () => copyText(text)),
        btn('下载 TXT', () => downloadText(text + '\n', 'ascii-art.txt'))),
      output.node, status,
      hint('按字符宽高比 1:2 取样；深色主题下建议勾选「反相」以获得更自然的观感。')));
  },
};

/* 5×7 点阵：每行 5 bit，bit4 对应最左列。字库为本项目自行编排。 */
const FONT5X7 = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e], D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], 1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f], 3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], 5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], 7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e], 9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0], '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04], '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 0x04], '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
};
const asciiBanner = {
  id: 'ascii-banner', name: 'ASCII 横幅', category: 'creative',
  desc: '用 5×7 点阵把文字排成大字横幅', keywords: ['ASCII', '横幅', '大字', 'banner', '点阵'],
  render(root) {
    const text = inp({ type: 'text', value: 'XIAOYU', placeholder: '支持 A-Z 0-9 与空格' });
    const char = inp({ type: 'text', value: '#', maxlength: 3 });
    const gap = inp({ type: 'range', min: '0', max: '4', value: '1' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const paint = () => {
      const chars = (text.value || '').toUpperCase().split('');
      const glyphs = chars.map(c => FONT5X7[c] || FONT5X7['?']);
      const fill = (char.value || '#')[0];
      const space = ' '.repeat(clamp(num(gap.value, 1), 0, 4) + 1);
      const lines = [];
      for (let row = 0; row < 7; row += 1) {
        lines.push(glyphs.map(g => {
          let s = '';
          for (let bit = 4; bit >= 0; bit -= 1) s += (g[row] >> bit) & 1 ? fill : ' ';
          return s;
        }).join(space).replace(/\s+$/, ''));
      }
      output.set(lines.join('\n'));
      status.textContent = `${chars.length} 个字符 · 7 行`;
    };
    [text, char, gap].forEach(n => n.addEventListener('input', paint));
    paint();
    root.append(panel('横幅文字',
      el('div', { class: 'inline-fields' }, labeled('内容', text), labeled('填充字符', char), labeled('字间距', gap)),
      actions(btn('重新生成', paint, 'primary'), btn('复制', () => copyText(output.node.textContent)),
        btn('下载 TXT', () => downloadText(output.node.textContent + '\n', 'banner.txt'))),
      output.node, status,
      hint('只支持大写字母、数字与少量符号；中文会自动按问号占位，需中文大字请用画板或签名工具。')));
  },
};

const NOTE_KEYS = [
  { key: 'a', label: 'C', semi: 0 }, { key: 'w', label: 'C♯', semi: 1, black: true },
  { key: 's', label: 'D', semi: 2 }, { key: 'e', label: 'D♯', semi: 3, black: true },
  { key: 'd', label: 'E', semi: 4 }, { key: 'f', label: 'F', semi: 5 },
  { key: 't', label: 'F♯', semi: 6, black: true }, { key: 'g', label: 'G', semi: 7 },
  { key: 'y', label: 'G♯', semi: 8, black: true }, { key: 'h', label: 'A', semi: 9 },
  { key: 'u', label: 'A♯', semi: 10, black: true }, { key: 'j', label: 'B', semi: 11 },
  { key: 'k', label: 'C', semi: 12 },
];
const midiKeyboard = {
  id: 'midi-keyboard', name: 'MIDI 键盘', category: 'creative',
  desc: 'Web Audio 合成琴键，可选接入 MIDI 设备', keywords: ['MIDI', '钢琴', '键盘', '合成', '音阶'],
  render(root) {
    const wave = sel([
      { value: 'sine', label: '正弦' }, { value: 'triangle', label: '三角' },
      { value: 'square', label: '方波' }, { value: 'sawtooth', label: '锯齿' },
    ], 'triangle', null);
    const octave = sel([{ value: '3', label: 'C3' }, { value: '4', label: 'C4' }, { value: '5', label: 'C5' }], '4', null);
    const volume = inp({ type: 'range', min: '1', max: '100', value: '35' });
    const board = el('div', { class: 'piano' });
    const readout = el('strong', { text: '—' });
    const status = el('div', { class: 'status' });
    const output = resultBox();
    let ctx = null, active = new Map(), log = [];

    const ensure = () => { if (!ctx) ctx = audioContext(); return ctx; };
    const note = (semi, source) => {
      const c = ensure(); if (!c) return;
      const base = (Number(octave.value) + 1) * 12;
      const freq = 440 * 2 ** ((base + semi - 69) / 12);
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = wave.value; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(clamp(num(volume.value, 35), 1, 100) / 400, c.currentTime + 0.02);
      osc.connect(gain).connect(c.destination); osc.start();
      const name = `${NOTE_KEYS.find(n => n.semi === semi)?.label || ''}${octave.value}`;
      active.set(source, { osc, gain });
      readout.textContent = `${name}  ${freq.toFixed(2)} Hz`;
      log.unshift(`${name.padEnd(4)} ${freq.toFixed(2)} Hz  ${wave.value}`);
      output.set(log.slice(0, 14).join('\n'));
      return name;
    };
    const release = source => {
      const item = active.get(source); if (!item || !ctx) return;
      try {
        item.gain.gain.cancelScheduledValues(ctx.currentTime);
        item.gain.gain.setValueAtTime(item.gain.gain.value, ctx.currentTime);
        item.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        item.osc.stop(ctx.currentTime + 0.2);
      } catch { /* 已停止 */ }
      active.delete(source);
    };
    for (const item of NOTE_KEYS) {
      const key = el('div', { class: `piano-key${item.black ? ' piano-black' : ''}`, text: `${item.label}\n${item.key.toUpperCase()}` });
      key.addEventListener('pointerdown', () => { note(item.semi, item.key); key.classList.add('is-on'); });
      ['pointerup', 'pointerleave'].forEach(t => key.addEventListener(t, () => { release(item.key); key.classList.remove('is-on'); }));
      board.append(key);
    }
    const onDown = event => {
      if (event.repeat) return;
      const item = NOTE_KEYS.find(n => n.key === event.key.toLowerCase());
      if (item) { note(item.semi, item.key); }
    };
    const onUp = event => release(event.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    const cleanup = setInterval(() => {
      if (!board.isConnected) {
        clearInterval(cleanup);
        window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp);
        for (const key of [...active.keys()]) release(key);
        if (ctx) ctx.close().catch(() => {});
      }
    }, 500);

    root.append(panel('合成键盘',
      el('div', { class: 'inline-fields' }, labeled('波形', wave), labeled('八度', octave), labeled('音量', volume)),
      actions(btn('接入 MIDI 设备', async () => {
        if (!navigator.requestMIDIAccess) { status.textContent = '当前浏览器不支持 Web MIDI'; return; }
        try {
          const access = await navigator.requestMIDIAccess();
          const bind = () => {
            for (const input of access.inputs.values()) {
              input.onmidimessage = event => {
                const [cmd, pitch, velocity] = event.data;
                const semi = ((pitch - (Number(octave.value) + 1) * 12) % 13 + 13) % 13;
                if (cmd === 0x90 && velocity > 0) note(semi, `midi-${pitch}`);
                else release(`midi-${pitch}`);
              };
            }
            status.textContent = `已接入 ${access.inputs.size} 个 MIDI 输入`;
          };
          bind(); access.onstatechange = bind;
        } catch (error) { status.textContent = `MIDI 授权失败：${error.message}`; }
      })),
      board,
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: '当前音符' }), readout)),
      output.node, status,
      hint('用鼠标或键盘 A W S E D F T G Y H U J K 弹奏；Web MIDI 需浏览器授权，不联网。')));
  },
};

const BREATH_MODES = {
  '478': { name: '4-7-8 放松', steps: [['吸气', 4], ['屏息', 7], ['呼气', 8]] },
  box: { name: '方形呼吸 4-4-4-4', steps: [['吸气', 4], ['屏息', 4], ['呼气', 4], ['屏息', 4]] },
  calm: { name: '平缓呼吸 4-4', steps: [['吸气', 4], ['呼气', 4]] },
};
const breathingRelaxation = {
  id: 'breathing-relaxation', name: '呼吸放松指南', category: 'creative',
  desc: '按节奏放大 / 缩小圆，跟着提示呼吸', keywords: ['呼吸', '放松', '冥想', '减压', '478'],
  render(root) {
    const mode = sel(Object.entries(BREATH_MODES).map(([k, v]) => ({ value: k, label: v.name })), '478', null);
    const circle = el('div', { class: 'breath-circle' });
    const phase = el('strong', { text: '准备' });
    const countdown = el('strong', { text: '—' });
    const status = el('div', { class: 'status' });
    const output = resultBox();
    let timer = null, running = false, cycles = 0;

    const stop = () => {
      clearInterval(timer); timer = null; running = false;
      phase.textContent = '已停止'; countdown.textContent = '—';
      circle.style.transform = 'scale(1)';
    };
    const start = () => {
      if (running) return;
      running = true; cycles = 0;
      const steps = BREATH_MODES[mode.value].steps;
      const total = steps.reduce((a, [, s]) => a + s, 0);
      const began = performance.now();
      status.textContent = '跟随提示呼吸…';
      timer = setInterval(() => {
        if (!circle.isConnected) { stop(); return; }
        const elapsed = (performance.now() - began) / 1000;
        const cycleIndex = Math.floor(elapsed / total);
        let local = elapsed % total, acc = 0, current = steps[0];
        for (const step of steps) { if (local < acc + step[1]) { current = step; break; } acc += step[1]; }
        const remain = Math.max(0, acc + current[1] - local);
        phase.textContent = current[0];
        countdown.textContent = `${remain.toFixed(1)} s`;
        const t = 1 - remain / current[1];
        const scale = current[0] === '吸气' ? 0.7 + 0.5 * t : current[0] === '呼气' ? 1.2 - 0.5 * t : 1.2;
        circle.style.transform = `scale(${scale.toFixed(3)})`;
        if (cycleIndex > cycles) { cycles = cycleIndex; output.set(`已完成 ${cycles} 个完整循环`); }
      }, 60);
    };
    root.append(panel('呼吸节奏',
      el('div', { class: 'inline-fields' }, labeled('模式', mode)),
      el('div', { class: 'breath-stage' }, circle),
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '阶段' }), phase),
        el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: '剩余' }), countdown)),
      actions(btn('开始', start, 'primary'), btn('停止', stop)),
      output.node, status,
      hint('仅为节奏提示，不构成医疗建议；感到不适请立即停止。动画与计时都在本机进行。')));
  },
};

const micCameraTest = {
  id: 'mic-camera-test', name: '麦克风与摄像头测试', category: 'creative',
  desc: '预览画面与实时音量，检查设备是否正常', keywords: ['麦克风', '摄像头', '设备', '音量', '测试'],
  render(root) {
    const video = el('video', { class: 'preview-video', autoplay: true, muted: true, playsinline: true });
    const bar = el('div', { class: 'level-fill' });
    const level = el('div', { class: 'level-bar' }, bar);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let stream = null, ctx = null, analyser = null, raf = null, source = null, timer = null;

    const stop = () => {
      cancelAnimationFrame(raf); raf = null;
      clearInterval(timer); timer = null;
      if (source) { try { source.disconnect(); } catch { /* noop */ } source = null; }
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      video.srcObject = null; bar.style.width = '0%';
      status.textContent = '已停止，设备已释放';
    };
    const start = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = '当前浏览器不支持 getUserMedia'; return;
      }
      stop();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;
        const tracks = stream.getTracks().map(t => `${t.kind}: ${t.label || '(无名称)'} · ${t.readyState}`);
        output.set(`已获取 ${stream.getTracks().length} 条轨道\n${tracks.join('\n')}`);
        status.textContent = '设备已开启';
        ctx = audioContext();
        if (ctx && stream.getAudioTracks().length) {
          analyser = ctx.createAnalyser(); analyser.fftSize = 512;
          source = ctx.createMediaStreamSource(stream); source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
            bar.style.width = `${Math.min(100, peak * 180).toFixed(1)}%`;
            raf = requestAnimationFrame(tick);
          };
          tick();
        }
        timer = setInterval(() => { if (!video.isConnected) stop(); }, 500);
      } catch (error) {
        stop();
        status.textContent = `无法开启设备：${error.message}`;
        output.set('请检查浏览器权限、是否使用 https 或 localhost，以及设备是否被占用。');
      }
    };
    root.append(panel('设备预览',
      actions(btn('开启设备', start, 'primary'), btn('停止', stop)),
      video, level, output.node, status,
      hint('仅在点击后请求权限，画面与声音都在本机预览，不录制、不上传、不保存。离开工具页会自动释放设备。')));
  },
};

export const creativeGen2Tools = [
  holidays, itemLocator, asciiArt, asciiBanner, midiKeyboard, breathingRelaxation, micCameraTest,
];

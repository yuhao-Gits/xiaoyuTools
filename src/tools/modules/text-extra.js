import { panel, txt, inp, btn, actions, resultBox, hint, copyText, downloadText, el } from '../../core/ui.js';

function diffLines(left, right) {
  const a = left.replace(/\r\n/g, '\n').split('\n');
  const b = right.replace(/\r\n/g, '\n').split('\n');
  if (a.length > 600 || b.length > 600) return '文本行数超过 600，请先分段比较。';
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(`  ${a[i]}`); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(`- ${a[i]}`); i += 1; removed += 1; }
    else { out.push(`+ ${b[j]}`); j += 1; added += 1; }
  }
  while (i < n) { out.push(`- ${a[i++]}`); removed += 1; }
  while (j < m) { out.push(`+ ${b[j++]}`); added += 1; }
  out.unshift(`新增 ${added} 行 / 删除 ${removed} 行`, '');
  return out.join('\n');
}

const textDiff = {
  id: 'text-diff',
  name: '文本对比',
  category: 'text',
  desc: '按行比较两段文本，标出新增与删除',
  keywords: ['对比', 'diff', '差异', '比较'],
  render(root) {
    const left = txt({ placeholder: '原文…' });
    const right = txt({ placeholder: '新文本…' });
    const output = resultBox();
    const run = () => output.set(diffLines(left.value, right.value));
    root.append(panel('按行对比',
      el('div', { class: 'split' }, left, right),
      actions(btn('比较', run, 'primary'), btn('清空', () => { left.value = ''; right.value = ''; output.clear(); })),
      output.node,
      hint('基于最长公共子序列（LCS）在本机计算，「-」为删除，「+」为新增。')));
  },
};

const WORDS = ('lumen terra vitae aqua ignis aer vox lux umbra silva campus rivus mons nubes stella '
  + 'sol luna ventus pluvia flos herba lapis arena portus via domus liber pagina verbum numerus '
  + 'tempus memoria spatium forma color motus ordo ratio finis initium').split(' ');

function sentence(rng) {
  const count = 7 + Math.floor(rng() * 9);
  const parts = Array.from({ length: count }, () => WORDS[Math.floor(rng() * WORDS.length)]);
  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

const loremIpsum = {
  id: 'lorem-ipsum-generator',
  name: '占位文本生成器',
  category: 'text',
  desc: '生成排版用的拉丁风格占位段落',
  keywords: ['lorem', '占位', '假文', '排版'],
  render(root) {
    const count = inp({ type: 'number', value: '3', min: '1', max: '30', step: '1' });
    const perParagraph = inp({ type: 'number', value: '4', min: '1', max: '12', step: '1' });
    const output = resultBox();
    const make = () => {
      const p = Math.max(1, Math.min(30, Number(count.value) || 3));
      const s = Math.max(1, Math.min(12, Number(perParagraph.value) || 4));
      output.set(Array.from({ length: p }, () => Array.from({ length: s }, () => sentence(Math.random)).join(' ')).join('\n\n'));
    };
    make();
    root.append(panel('占位文本',
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '段落数' }), count),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '每段句数' }), perParagraph)),
      actions(btn('重新生成', make, 'primary'), btn('复制', () => copyText(output.node.textContent), '')),
      output.node,
      hint('词库与句式由本项目自写，仅用于排版占位，不复制任何第三方文本。')));
  },
};

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-',
  R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....',
  7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
  '!': '-.-.--', '/': '-..-.', '-': '-....-', ':': '---...', "'": '.----.', '=': '-...-',
};
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const morse = {
  id: 'morse-code-translator',
  name: '摩斯电码',
  category: 'text',
  desc: '文本与摩斯互转，可本机蜂鸣播放',
  keywords: ['摩斯', 'morse', '电码', '电报'],
  render(root) {
    const input = txt({ placeholder: '输入文本，或输入用空格分隔的 . 与 -' });
    const output = resultBox();
    const status = el('div', { class: 'status' });

    const encode = () => input.value.toUpperCase().split(/\s+/).filter(Boolean)
      .map(word => [...word].map(ch => MORSE[ch] || '').filter(Boolean).join(' ')).join(' / ');

    /* 编码并把「没进摩斯表」的字符报出来，避免中文被无声吞掉 */
    const encodeWithReport = () => {
      const skipped = [];
      const words = input.value.toUpperCase().split(/\s+/).filter(Boolean)
        .map(word => [...word].map(ch => {
          if (MORSE[ch]) return MORSE[ch];
          if (!skipped.includes(ch)) skipped.push(ch);
          return '';
        }).filter(Boolean).join(' '))
        .filter(Boolean);
      const code = words.join(' / ');
      if (skipped.length) {
        status.textContent = `已跳过 ${skipped.length} 个摩斯表里没有的字符：${skipped.slice(0, 8).join(' ')}`;
      } else {
        status.textContent = code ? '' : '没有可编码的字符';
      }
      return code || '（没有可编码的字符）';
    };
    const decode = () => input.value.trim().split(/\s*\/\s*/).map(word =>
      word.split(/\s+/).filter(Boolean).map(code => REVERSE[code] || '?').join('')).join(' ');

    const play = () => {
      const code = encode();
      if (!code) { status.textContent = '没有可播放的内容'; return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { status.textContent = '当前浏览器不支持 Web Audio'; return; }
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 620;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      const unit = 0.09;
      let at = ctx.currentTime + 0.05;
      for (const ch of code) {
        if (ch === '.' || ch === '-') {
          const len = ch === '.' ? unit : unit * 3;
          gain.gain.setValueAtTime(0.18, at);
          gain.gain.setValueAtTime(0, at + len);
          at += len + unit;
        } else if (ch === ' ') at += unit * 2;
        else if (ch === '/') at += unit * 4;
      }
      osc.stop(at + unit);
      status.textContent = '正在播放…';
      osc.onended = () => { ctx.close(); status.textContent = '播放结束'; };
    };

    root.append(panel('互转',
      input,
      actions(
        btn('编码 →', () => output.set(encodeWithReport()), 'primary'),
        btn('← 解码', () => output.set(decode())),
        btn('蜂鸣播放', play),
        btn('导出文本', () => downloadText(output.node.textContent, 'morse.txt'))),
      output.node, status,
      hint('单词之间用 / 分隔；解码时每个码用空格隔开。播放由 Web Audio 在本机合成。')));
  },
};

export const textExtraTools = [textDiff, loremIpsum, morse];

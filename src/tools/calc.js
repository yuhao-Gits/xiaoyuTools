import {
  el, txt, inp, sel, btn, panel, actions, resultBox, copyText, hint, toast,
} from '../core/ui.js';

function hexToRgb(hex) {
  let value = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(value)) value = value.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function randomChar(chars) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return chars[buffer[0] % chars.length];
}

export const calcTools = [
  {
    id: 'timestamp',
    name: '时间戳转换',
    category: 'calc',
    desc: 'Unix 时间戳与本地时间双向换算',
    keywords: ['时间戳', 'unix', '日期', '时间'],
    render(root) {
      const nowBox = el('div', { class: 'now-box' });
      const refresh = () => {
        const now = Date.now();
        const rows = [
          ['当前 Unix 秒', String(Math.floor(now / 1000))],
          ['当前毫秒', String(now)],
          ['本地时间', new Date(now).toLocaleString('zh-CN')],
        ];
        nowBox.replaceChildren(...rows.map(([label, value]) => el('div', { class: 'now-item' },
          el('span', { text: label }), el('strong', { text: value }))));
      };

      const tsInput = inp({ type: 'text', placeholder: '例如 1730000000 或 1730000000000' });
      const dateInput = inp({ type: 'datetime-local' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const fromTimestamp = () => {
        const raw = tsInput.value.trim();
        if (!/^\d+$/.test(raw)) {
          status.textContent = '请输入纯数字时间戳';
          status.className = 'status bad';
          return;
        }
        const numeric = Number(raw);
        const millis = raw.length > 12 ? numeric : numeric * 1000;
        const date = new Date(millis);
        if (Number.isNaN(date.getTime())) {
          status.textContent = '时间戳超出可表示范围';
          status.className = 'status bad';
          return;
        }
        output.set([
          `判定单位     ${raw.length > 12 ? '毫秒' : '秒'}`,
          `本地时间     ${date.toLocaleString('zh-CN')}`,
          `UTC 时间     ${date.toISOString()}`,
          `ISO 8601     ${date.toISOString()}`,
          `换算为秒     ${Math.floor(millis / 1000)}`,
          `换算为毫秒   ${millis}`,
        ].join('\n'));
        status.textContent = '转换完成';
        status.className = 'status ok';
      };

      const fromDate = () => {
        if (!dateInput.value) {
          status.textContent = '请先选择日期时间';
          status.className = 'status bad';
          return;
        }
        const date = new Date(dateInput.value);
        const millis = date.getTime();
        output.set([
          `本地时间     ${date.toLocaleString('zh-CN')}`,
          `UTC 时间     ${date.toISOString()}`,
          `Unix 秒      ${Math.floor(millis / 1000)}`,
          `Unix 毫秒    ${millis}`,
        ].join('\n'));
        status.textContent = '转换完成（按本机时区解析）';
        status.className = 'status ok';
      };

      root.append(
        panel('此刻', nowBox, actions(btn('刷新', refresh), btn('复制秒级时间戳', () => copyText(String(Math.floor(Date.now() / 1000))), 'primary'))),
        panel('时间戳 → 时间', el('div', { class: 'inline-fields' }, tsInput, btn('转换', fromTimestamp, 'primary'))),
        panel('时间 → 时间戳', el('div', { class: 'inline-fields' }, dateInput, btn('转换', fromDate, 'primary'))),
        status,
        panel('结果', output.node),
        hint('自动按位数判断秒或毫秒；日期时间按本机时区解析。'),
      );
      refresh();
    },
  },
  {
    id: 'password',
    name: '密码生成器',
    category: 'calc',
    desc: '按自选字符集生成高强度随机密码',
    keywords: ['密码', 'password', '随机', '强度'],
    render(root) {
      const lengthInput = inp({ type: 'number', min: '4', max: '128', value: '20' });
      const quantity = sel([
        { value: '1', label: '1 个' }, { value: '5', label: '5 个' }, { value: '10', label: '10 个' },
      ], '5');
      const sets = [
        { label: '小写字母', chars: 'abcdefghijklmnopqrstuvwxyz', on: true },
        { label: '大写字母', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', on: true },
        { label: '数字', chars: '0123456789', on: true },
        { label: '符号', chars: '!@#$%^&*()-_=+[]{};:,.?', on: true },
      ];
      const boxes = sets.map(set => {
        const checkbox = el('input', { type: 'checkbox', checked: set.on });
        return { set, checkbox, node: el('label', { class: 'check' }, checkbox, el('span', { text: set.label })) };
      });
      const confusing = el('input', { type: 'checkbox' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const generate = () => {
        let alphabet = '';
        for (const { set, checkbox } of boxes) {
          if (checkbox.checked) alphabet += set.chars;
        }
        if (confusing.checked) alphabet = alphabet.replace(/[0O1lI|]/g, '');
        const length = Math.max(4, Math.min(128, Number(lengthInput.value) || 20));
        if (!alphabet) {
          status.textContent = '至少勾选一种字符类型';
          status.className = 'status bad';
          return;
        }
        const count = Number(quantity.value);
        const lines = Array.from({ length: count }, () =>
          Array.from({ length }, () => randomChar(alphabet)).join(''));
        output.set(lines.join('\n'));
        const entropy = (length * Math.log2(alphabet.length)).toFixed(1);
        status.textContent = `已生成 ${count} 个 · 字符集 ${alphabet.length} 种 · 理论熵约 ${entropy} bit`;
        status.className = 'status ok';
      };

      root.append(
        panel('参数',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '长度(4-128)' }), lengthInput),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '数量' }), quantity)),
          el('div', { class: 'check-grid' }, ...boxes.map(item => item.node)),
          el('label', { class: 'check' }, confusing, el('span', { text: '排除易混淆字符 0 O 1 l I' }))),
        actions(
          btn('生成', generate, 'primary'),
          btn('复制全部', () => copyText(output.node.textContent)),
        ),
        status,
        hint('使用 crypto.getRandomValues 取随机数，不上传、不保存生成的密码，请自行妥善保管。'),
        panel('结果', output.node),
      );
      generate();
    },
  },
  {
    id: 'mortgage',
    name: '房贷 / 贷款计算',
    category: 'calc',
    desc: '等额本息与等额本金的月供、总利息对比',
    keywords: ['房贷', '贷款', '月供', '利息', '等额本息'],
    render(root) {
      const principal = inp({ type: 'number', min: '0', step: '1', value: '1000000', placeholder: '元' });
      const rate = inp({ type: 'number', min: '0', max: '30', step: '0.01', value: '3.5', placeholder: '%' });
      const years = inp({ type: 'number', min: '1', max: '40', step: '1', value: '30' });
      const mode = sel([
        { value: 'equal', label: '等额本息' },
        { value: 'principal', label: '等额本金' },
      ], 'equal');
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const run = () => {
        const p = Number(principal.value);
        const annual = Number(rate.value);
        const n = Math.round(Number(years.value) * 12);
        if (!(p > 0) || !(annual >= 0) || !(n > 0)) {
          status.textContent = '请填写有效的本金、年利率和年限';
          status.className = 'status bad';
          return;
        }
        const r = annual / 100 / 12;
        const lines = [];
        const detail = [];
        let totalInterest = 0;
        let firstPayment = 0;
        let lastPayment = 0;

        if (mode.value === 'equal') {
          const payment = r === 0 ? p / n : p * r * (1 + r) ** n / ((1 + r) ** n - 1);
          totalInterest = payment * n - p;
          firstPayment = payment;
          lastPayment = payment;
          lines.push('还款方式     等额本息');
          lines.push(`每月月供     ${payment.toFixed(2)} 元（固定）`);
        } else {
          lines.push('还款方式     等额本金');
          lines.push('月供逐月递减，首期最高');
          const base = p / n;
          for (let i = 1; i <= n; i += 1) {
            const interest = (p - base * (i - 1)) * r;
            totalInterest += interest;
            const payment = base + interest;
            if (i === 1) firstPayment = payment;
            if (i === n) lastPayment = payment;
            if (i <= 12) detail.push(`第 ${String(i).padStart(2, ' ')} 期  本金 ${base.toFixed(2)}  利息 ${interest.toFixed(2)}  月供 ${payment.toFixed(2)}`);
          }
        }

        lines.push('');
        lines.push(`贷款本金     ${p.toFixed(2)} 元`);
        lines.push(`年利率       ${annual}%  ·  月利率 ${(r * 100).toFixed(4)}%`);
        lines.push(`期限         ${n} 期（${years.value} 年）`);
        lines.push(`首期月供     ${firstPayment.toFixed(2)} 元`);
        lines.push(`末期月供     ${lastPayment.toFixed(2)} 元`);
        lines.push(`总利息       ${totalInterest.toFixed(2)} 元`);
        lines.push(`本息合计     ${(p + totalInterest).toFixed(2)} 元`);
        if (detail.length) {
          lines.push('');
          lines.push('前 12 期明细');
          lines.push(...detail);
        }
        output.set(lines.join('\n'));
        status.textContent = '计算完成 · 结果为理论值，不含税费、保险费与提前还款';
        status.className = 'status ok';
      };

      root.append(
        panel('贷款信息',
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '本金（元）' }), principal),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '年利率（%）' }), rate),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '年限' }), years),
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '方式' }), mode))),
        actions(
          btn('计算', run, 'primary'),
          btn('复制结果', () => copyText(output.node.textContent)),
        ),
        status,
        hint('仅按标准公式估算，实际还款以贷款机构合同为准。'),
        panel('结果', output.node),
      );
      run();
    },
  },
  {
    id: 'color',
    name: '颜色转换',
    category: 'calc',
    desc: 'HEX / RGB / HSL 互转，附取色与预览',
    keywords: ['颜色', 'hex', 'rgb', 'hsl', '取色'],
    render(root) {
      const picker = inp({ type: 'color', value: '#4f46e5', class: 'input color-input' });
      const hexInput = inp({ type: 'text', value: '#4F46E5', placeholder: '#RRGGBB' });
      const swatch = el('div', { class: 'swatch' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const show = hex => {
        const rgb = hexToRgb(hex);
        if (!rgb) {
          status.textContent = '颜色格式不合法，请输入 #RGB 或 #RRGGBB';
          status.className = 'status bad';
          return false;
        }
        const normalized = rgbToHex(rgb.r, rgb.g, rgb.b);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        picker.value = normalized.toLowerCase();
        hexInput.value = normalized;
        swatch.style.background = normalized;
        output.set([
          `HEX    ${normalized}`,
          `RGB    rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          `HSL    hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
          `CSS     --xiaoyu-color: ${normalized};`,
        ].join('\n'));
        status.textContent = '转换完成';
        status.className = 'status ok';
        return true;
      };

      picker.addEventListener('input', () => show(picker.value));
      hexInput.addEventListener('input', () => {
        if (/^#?[0-9a-f]{3}$/i.test(hexInput.value.trim()) || /^#?[0-9a-f]{6}$/i.test(hexInput.value.trim())) show(hexInput.value);
      });
      show(picker.value);

      root.append(
        panel('选色',
          el('div', { class: 'inline-fields' }, picker,
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'HEX 值' }), hexInput)),
          swatch),
        actions(
          btn('随机颜色', () => {
            const bytes = new Uint8Array(3);
            crypto.getRandomValues(bytes);
            show(rgbToHex(bytes[0], bytes[1], bytes[2]));
          }, 'primary'),
          btn('复制 HEX', () => copyText(hexInput.value)),
          btn('复制结果', () => copyText(output.node.textContent)),
        ),
        status,
        hint('输入 HEX 会自动换算；取色器直接使用系统颜色选择器。'),
        panel('输出', output.node),
      );
    },
  },
];

/* 文本类补充：Unicode 花式文字与本地收据生成。 */
import {
  panel, inp, btn, actions, resultBox, hint, el, labeled, copyText, downloadText, escapeHtml,
} from '../../core/ui.js';
import { num, clamp, pad, money } from './shared.js';

/* Unicode 风格映射表为本项目自行编排，仅使用公开码位。 */
const cp = (code, startUpper, startLower, startDigit, exceptions = {}) => {
  if (code >= 65 && code <= 90) return String.fromCodePoint(exceptions[code - 65] ?? startUpper + code - 65);
  if (code >= 97 && code <= 122) return String.fromCodePoint(exceptions[26 + code - 97] ?? startLower + code - 97);
  if (code >= 48 && code <= 57 && startDigit) return String.fromCodePoint(startDigit + code - 48);
  return null;
};
const STYLES = [
  { name: '数学粗体', fn: ch => cp(ch.codePointAt(0), 0x1d400, 0x1d41a, 0x1d7ce) },
  { name: '数学斜体', fn: ch => cp(ch.codePointAt(0), 0x1d434, 0x1d44e, null, { 33: 0x210e }) },
  { name: '粗斜体', fn: ch => cp(ch.codePointAt(0), 0x1d468, 0x1d482, null) },
  { name: '花体', fn: ch => cp(ch.codePointAt(0), 0x1d49c, 0x1d4b6, null, {
    1: 0x212c, 4: 0x2130, 5: 0x2131, 7: 0x210b, 8: 0x2110, 9: 0x2112, 10: 0x2133, 12: 0x211b,
    /* 小写里 e g l o p 没有连续的数学花体码位，要落到字母式符号区（索引 = 26 + 字母序号） */
    30: 0x212f, 32: 0x210a, 37: 0x2113, 40: 0x2134, 41: 0x2118,
  }) },
  { name: '双线体', fn: ch => cp(ch.codePointAt(0), 0x1d538, 0x1d552, 0x1d7d8, {
    2: 0x2102, 7: 0x210d, 13: 0x2115, 15: 0x2119, 16: 0x211a, 17: 0x211d, 24: 0x2124,
  }) },
  { name: '等宽', fn: ch => cp(ch.codePointAt(0), 0x1d670, 0x1d68a, 0x1d7f6) },
  { name: '圆圈', fn: ch => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97);
    if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49);
    if (c === 48) return '⓪';
    return null;
  } },
  { name: '全角', fn: ch => {
    const c = ch.codePointAt(0);
    return c >= 33 && c <= 126 ? String.fromCodePoint(0xff01 + c - 33) : null;
  } },
  { name: '删除线', fn: ch => `${ch}\u0336` },
  { name: '下划线', fn: ch => `${ch}\u0332` },
  { name: '小大写', fn: ch => {
    const c = ch.codePointAt(0);
    if (c < 97 || c > 122) return null;
    const small = ['ᴀ', 'ʙ', 'ᴄ', 'ᴅ', 'ᴇ', 'ꜰ', 'ɢ', 'ʜ', 'ɪ', 'ᴊ', 'ᴋ', 'ʟ', 'ᴍ', 'ɴ', 'ᴏ', 'ᴘ', 'ǫ', 'ʀ', 's', 'ᴛ', 'ᴜ', 'ᴠ', 'ᴡ', 'x', 'ʏ', 'ᴢ'];
    return small[c - 97];
  } },
];

const fancyTextGenerator = {
  id: 'fancy-text-generator', name: '花式文字生成器', category: 'text',
  desc: '把文字转成多种 Unicode 样式，点击即复制', keywords: ['花式文字', 'Unicode', '粗体', '花体', '特殊字符'],
  render(root) {
    const input = inp({ type: 'text', value: 'xiaoyuTools', placeholder: '输入要转换的文字' });
    const list = el('div', { class: 'check-grid' });
    const status = el('div', { class: 'status' });
    const paint = () => {
      const text = input.value || '';
      list.replaceChildren();
      for (const style of STYLES) {
        const converted = [...text].map(ch => style.fn(ch) || ch).join('');
        list.append(el('div', { class: 'check' },
          el('span', { class: 'field-label', text: style.name }),
          el('span', { class: 'mono', text: converted }),
          el('button', { class: 'button', type: 'button', text: '复制', onclick: () => { copyText(converted); status.textContent = `已复制「${style.name}」`; } })));
      }
      status.textContent = `${STYLES.length} 种样式 · ${text.length} 个字符`;
    };
    input.addEventListener('input', paint);
    paint();
    root.append(panel('花式文字', input,
      actions(btn('重新生成', paint, 'primary'),
        btn('复制全部', () => copyText(STYLES.map(s => `${s.name}: ${[...input.value].map(ch => s.fn(ch) || ch).join('')}`).join('\n')))),
      list, status,
      hint('部分 Unicode 字形依赖系统字体，可能显示为方框或空白；中文没有对应码位时保持原样。')));
  },
};

const invoiceGenerator = {
  id: 'invoice-generator', name: '发票生成器', category: 'text',
  desc: '生成个人记账用的简易收据，可导出 HTML', keywords: ['收据', '发票', '账单', '明细', '记账'],
  render(root) {
    const buyer = inp({ type: 'text', value: '个人', placeholder: '抬头 / 客户' });
    const number = inp({ type: 'text', value: `XY-${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}${pad(new Date().getDate())}-01` });
    const taxRate = inp({ type: 'number', value: '0', min: '0', max: '100', step: '0.1' });
    const rows = el('div', { class: 'check-grid' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let items = [{ name: '服务项目', qty: 1, price: 100 }];

    const rowNode = (item) => {
      const name = inp({ type: 'text', value: item.name, placeholder: '项目' });
      const qty = inp({ type: 'number', value: String(item.qty), min: '0', step: '1' });
      const price = inp({ type: 'number', value: String(item.price), min: '0', step: '0.01' });
      const sync = () => { item.name = name.value; item.qty = num(qty.value, 0); item.price = num(price.value, 0); build(); };
      [name, qty, price].forEach(n => n.addEventListener('input', sync));
      return el('div', { class: 'check' }, name, qty, price,
        el('button', { class: 'button', type: 'button', text: '删除', onclick: () => { items = items.filter(x => x !== item); renderRows(); } }));
    };
    const renderRows = () => { rows.replaceChildren(...items.map(rowNode)); build(); };
    const totals = () => {
      const subtotal = items.reduce((a, b) => a + b.qty * b.price, 0);
      const tax = subtotal * clamp(num(taxRate.value, 0), 0, 100) / 100;
      return { subtotal, tax, total: subtotal + tax };
    };
    const html = () => {
      const { subtotal, tax, total } = totals();
      const date = new Date().toISOString().slice(0, 10);
      const trs = items.map((x, i) => `<tr><td>${pad(i + 1)}</td><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>${x.price.toFixed(2)}</td><td>${(x.qty * x.price).toFixed(2)}</td></tr>`).join('');
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>收据 ${escapeHtml(number.value)}</title><style>body{font:14px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;color:#17171a}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th:last-child,td:last-child{text-align:right}.muted{color:#777}@media print{body{margin:0}}</style></head><body><h1>收据 / 记账凭证</h1><p class="muted">编号 ${escapeHtml(number.value)}　日期 ${date}　抬头 ${escapeHtml(buyer.value)}</p><table><thead><tr><th>#</th><th>项目</th><th>数量</th><th>单价</th><th>金额</th></tr></thead><tbody>${trs}</tbody></table><p>小计 ${subtotal.toFixed(2)}　税费(${taxRate.value}%) ${tax.toFixed(2)}　<b>合计 ${total.toFixed(2)}</b></p><p class="muted">本文件由本地工具生成，仅用于个人记录，不是税务发票，不具备报销或法律效力。</p></body></html>`;
    };
    const build = () => {
      const { subtotal, tax, total } = totals();
      output.set([
        `编号  ${number.value}`,
        `抬头  ${buyer.value}`,
        `明细  ${items.length} 行`,
        ...items.map((x, i) => `  ${pad(i + 1)}. ${x.name}  ×${x.qty}  @${x.price.toFixed(2)}  = ${(x.qty * x.price).toFixed(2)}`),
        `小计  ${money(subtotal)}`,
        `税费  ${money(tax)}（${taxRate.value}%）`,
        `合计  ${money(total)}`,
      ].join('\n'));
      status.textContent = '可在下方下载 HTML 后打印';
    };
    [buyer, number, taxRate].forEach(n => n.addEventListener('input', build));
    renderRows();

    root.append(panel('收据信息',
      el('div', { class: 'inline-fields' }, labeled('抬头', buyer), labeled('编号', number), labeled('税率 %', taxRate)),
      rows,
      actions(btn('添加明细', () => { items.push({ name: '新项目', qty: 1, price: 0 }); renderRows(); }, 'primary'),
        btn('下载 HTML', () => downloadText(html(), `receipt-${number.value}.html`, 'text/html;charset=utf-8')),
        btn('复制纯文本', () => copyText(output.node.textContent))),
      output.node, status,
      hint('仅用于个人记账 / 存档，不是税务发票，不能用于报销；不联网、不校验企业信息。')));
  },
};

export const textExtra2Tools = [fancyTextGenerator, invoiceGenerator];

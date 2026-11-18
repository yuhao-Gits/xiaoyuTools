/* 财务速算（归入「计算」门类）：本机数值计算，结果均为估算，不含税费与服务费率，不构成投资建议。 */
import {
  el, panel, inp, sel, btn, actions, resultBox, hint, labeled,
} from '../../core/ui.js';
import { num, clamp, money } from './shared.js';

/* 复利 / 定投：按月计息的等效月利率，避免简单除 12 带来的高估。 */
const compoundInterest = {
  id: 'compound-interest',
  name: '复利 / 定投计算',
  category: 'calc',
  desc: '本金 + 每月追加，按年化收益率推算终值与收益构成',
  keywords: ['复利', '定投', '理财', '终值', 'compound', '年化'],
  render(root) {
    const principal = inp({ type: 'number', value: '50000', min: '0', step: '1000', inputmode: 'decimal' });
    const monthly = inp({ type: 'number', value: '2000', min: '0', step: '100', inputmode: 'decimal' });
    const rate = inp({ type: 'number', value: '5', min: '-20', max: '50', step: '0.1', inputmode: 'decimal' });
    const years = inp({ type: 'number', value: '10', min: '1', max: '60', step: '1', inputmode: 'numeric' });
    const timing = sel([
      { value: 'end', label: '月末追加' },
      { value: 'begin', label: '月初追加' },
    ], 'end');
    const output = resultBox();
    const stats = el('div', { class: 'stat-grid' });

    const calc = () => {
      const p = clamp(num(principal.value, 50000), 0, 1e9);
      const m = clamp(num(monthly.value, 2000), 0, 1e8);
      const annual = clamp(num(rate.value, 5), -20, 50) / 100;
      const n = Math.round(clamp(num(years.value, 10), 1, 60));
      const monthlyRate = Math.pow(1 + annual, 1 / 12) - 1;
      const rows = [];
      let balance = p;
      let invested = p;
      for (let year = 1; year <= n; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          if (timing.value === 'begin') {
            balance += m;
            invested += m;
            balance *= 1 + monthlyRate;
          } else {
            balance *= 1 + monthlyRate;
            balance += m;
            invested += m;
          }
        }
        rows.push({ year, balance, invested });
      }
      const gain = balance - invested;
      const ratio = invested > 0 ? (gain / invested) * 100 : 0;

      stats.replaceChildren(...[
        ['期末总额', money(balance)],
        ['累计投入', money(invested)],
        ['投资损益', money(gain)],
        ['收益 / 本金', `${ratio >= 0 ? '+' : ''}${ratio.toFixed(1)}%`],
      ].map(([label, value]) => el('div', { class: 'stat' },
        el('span', { class: 'stat-label', text: label }),
        el('strong', { text: value }))));

      const lines = [
        `投入 ${n} 年 · 年化 ${(annual * 100).toFixed(1)}% · ${timing.value === 'begin' ? '月初' : '月末'}追加`,
        `等效月利率  ${(monthlyRate * 100).toFixed(3)}%`,
        '',
        '年末余额（元）',
        ...rows.map(r => `第 ${String(r.year).padStart(2, ' ')} 年  ${money(r.balance).padStart(14, ' ')}  已投 ${money(r.invested)}`),
        '',
        gain >= 0 ? '收益来自复利滚动，实际收益随市场波动，不保证为正。' : '负收益示例：年化为负时本金会逐年缩水，仅供参考。',
      ];
      output.set(lines.join('\n'));
    };

    [principal, monthly, rate, years].forEach(node => {
      node.addEventListener('input', calc);
      node.addEventListener('change', calc);
    });
    timing.addEventListener('change', calc);
    calc();

    root.append(
      panel('参数',
        el('div', { class: 'inline-fields' },
          labeled('初始本金（元）', principal),
          labeled('每月追加（元）', monthly),
          labeled('年化收益率（%）', rate),
          labeled('投资年限', years),
          labeled('追加时点', timing)),
        hint('按月复利，年化收益率换算为等效月利率；不考虑申购费、管理费与税费。'),
        actions(btn('重新计算', calc, 'primary'))),
      panel('结果', stats, output.node),
    );
  },
};

/* 收支结余：把「收入 - 固定 - 弹性」摊平成一张体检表，并对照目标储蓄率。 */
const budgetRatio = {
  id: 'budget-ratio',
  name: '收支结余测算',
  category: 'calc',
  desc: '按收入与两类支出算结余率，对照目标储蓄率给出缺口',
  keywords: ['预算', '结余', '储蓄率', '记账', '收支', 'budget'],
  render(root) {
    const income = inp({ type: 'number', value: '12000', min: '0', step: '500', inputmode: 'decimal' });
    const fixed = inp({ type: 'number', value: '5500', min: '0', step: '100', inputmode: 'decimal' });
    const flexible = inp({ type: 'number', value: '3000', min: '0', step: '100', inputmode: 'decimal' });
    const goal = inp({ type: 'number', value: '30', min: '0', max: '100', step: '1', inputmode: 'numeric' });
    const output = resultBox();
    const stats = el('div', { class: 'stat-grid' });
    const meter = el('div', { class: 'fin-meter-bar' }, el('div', { class: 'fin-meter-fill' }));
    const meterText = el('div', { class: 'fin-meter-row' },
      el('span', { text: '结余率' }),
      el('strong', { text: '—' }));

    const calc = () => {
      const inc = clamp(num(income.value, 0), 0, 1e9);
      const fx = clamp(num(fixed.value, 0), 0, 1e9);
      const fl = clamp(num(flexible.value, 0), 0, 1e9);
      const g = clamp(num(goal.value, 30), 0, 100) / 100;
      const left = inc - fx - fl;
      const ratio = inc > 0 ? left / inc : 0;
      const gap = left - inc * g;
      const fixedShare = inc > 0 ? (fx / inc) * 100 : 0;

      const tone = ratio >= g ? '达标' : ratio >= g * 0.6 ? '接近' : '缺口明显';
      const fill = Math.max(0, Math.min(1, ratio / Math.max(g, 0.01))) * 100;

      meterText.querySelector('strong').textContent = `${(ratio * 100).toFixed(1)}%`;
      meter.querySelector('.fin-meter-fill').style.width = `${fill}%`;

      stats.replaceChildren(...[
        ['月结余', money(left)],
        ['年结余', money(left * 12)],
        ['固定支出占比', `${fixedShare.toFixed(1)}%`],
        [`目标 ${(g * 100).toFixed(0)}% 差额`, money(gap)],
      ].map(([label, value]) => el('div', { class: 'stat' },
        el('span', { class: 'stat-label', text: label }),
        el('strong', { text: value }))));

      const suggestions = [];
      if (inc <= 0) suggestions.push('先把月收入填成大于 0 的数。');
      else if (gap >= 0) suggestions.push(`按目标储蓄率还可多存 ${money(gap)}，可考虑放进定投或应急金。`);
      else suggestions.push(`距离目标还差 ${money(-gap)}，先压缩弹性支出比压缩固定支出更容易。`);
      if (fixedShare > 55) suggestions.push('固定支出已超过收入的一半，抗风险空间偏小。');
      if (fl > inc * 0.3) suggestions.push('弹性支出超过收入三成，可给单项设上限。');

      output.set([
        `月收入    ${money(inc)}`,
        `固定支出  ${money(fx)}（占 ${fixedShare.toFixed(1)}%）`,
        `弹性支出  ${money(fl)}（占 ${(inc > 0 ? (fl / inc) * 100 : 0).toFixed(1)}%）`,
        `月结余    ${money(left)} · 结余率 ${(ratio * 100).toFixed(1)}%`,
        `目标评估  ${tone}（目标 ${(g * 100).toFixed(0)}%）`,
        '',
        ...suggestions.map(s => `· ${s}`),
        '',
        '口径说明：只做收支结构测算，不含个税、社保与年终奖等一次性收入。',
      ].join('\n'));
    };

    [income, fixed, flexible, goal].forEach(node => {
      node.addEventListener('input', calc);
      node.addEventListener('change', calc);
    });
    calc();

    root.append(
      panel('每月收支',
        el('div', { class: 'inline-fields' },
          labeled('月收入（税后）', income),
          labeled('固定支出（房租 / 房贷等）', fixed),
          labeled('弹性支出（餐饮 / 购物等）', flexible),
          labeled('目标储蓄率（%）', goal)),
        el('div', { class: 'fin-meter' }, meterText, meter),
        actions(btn('重新计算', calc, 'primary'))),
      panel('测算结果', stats, output.node),
    );
  },
};

export const financeTools = [compoundInterest, budgetRatio];

import { panel, inp, sel, btn, actions, resultBox, labeled, hint, el } from '../../core/ui.js';

const UNITS = {
  长度: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  重量: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125 },
  面积: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, ha: 10000, 'ft²': 0.09290304, acre: 4046.8564224 },
  体积: { L: 1, mL: 0.001, 'm³': 1000, 'cm³': 0.001, gal: 3.785411784, qt: 0.946352946 },
  时间: { s: 1, ms: 0.001, min: 60, h: 3600, d: 86400, wk: 604800 },
  数据: { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 },
  温度: { '°C': null, '°F': null, K: null },
};

function fillSelect(node, keys, selected) {
  node.replaceChildren(...keys.map(key => el('option', { value: key, text: key, selected: key === selected })));
}

function toCelsius(value, unit) {
  if (unit === '°C') return value;
  if (unit === '°F') return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(value, unit) {
  if (unit === '°C') return value;
  if (unit === '°F') return value * 9 / 5 + 32;
  return value + 273.15;
}

const unitConverter = {
  id: 'unit-converter',
  name: '单位换算',
  category: 'calc',
  desc: '长度、重量、面积、体积、时间、数据与温度',
  keywords: ['单位', '换算', 'unit', '长度', '温度'],
  render(root) {
    const valueInput = inp({ type: 'number', value: '1', step: 'any' });
    const from = sel([], '', null);
    const to = sel([], '', null);
    const output = resultBox();
    const group = sel(Object.keys(UNITS).map(k => ({ value: k, label: k })), '长度', null);

    const compute = () => {
      const kind = UNITS[group.value] ? group.value : '长度';
      const table = UNITS[kind];
      const names = Object.keys(table);
      const raw = Number(valueInput.value);
      if (!Number.isFinite(raw)) { output.set('请输入有效数字'); return; }
      const a = from.value || names[0];
      const b = to.value || names[names.length - 1];
      let result;
      if (kind === '温度') result = fromCelsius(toCelsius(raw, a), b);
      else result = raw * table[a] / table[b];
      const fmt = n => Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)
        ? n.toExponential(6) : Number(n.toFixed(8)).toString();
      output.set(`${raw} ${a}  =  ${fmt(result)} ${b}`);
    };

    const syncUnits = () => {
      const names = Object.keys(UNITS[group.value] || UNITS['长度']);
      fillSelect(from, names, names[0]);
      fillSelect(to, names, names[Math.min(1, names.length - 1)]);
      compute();
    };

    group.addEventListener('change', syncUnits);
    from.addEventListener('change', compute);
    to.addEventListener('change', compute);
    valueInput.addEventListener('input', compute);
    syncUnits();

    root.append(panel('换算',
      el('div', { class: 'inline-fields' },
        labeled('类别', group), labeled('数值', valueInput),
        labeled('从', from), labeled('到', to)),
      actions(btn('换算', compute, 'primary')),
      output.node,
      hint('全部按固定换算因子在本机计算；温度为精确公式，数据单位按 1024 进制。')));
  },
};

const percentageCalculator = {
  id: 'percentage-calculator',
  name: '百分比计算器',
  category: 'calc',
  desc: '占比、变化率、增减与反推原值',
  keywords: ['百分比', '比例', 'percent', '增长率'],
  render(root) {
    const mode = sel([
      { value: 'of', label: 'X% 的 Y 是多少' },
      { value: 'ratio', label: 'X 是 Y 的百分之几' },
      { value: 'change', label: '从 A 到 B 的变化率' },
      { value: 'increase', label: 'Y 增加 X% 后是多少' },
      { value: 'reverse', label: 'Y 是某数的 X%，求原数' },
    ], 'of', null);
    const a = inp({ type: 'number', value: '25', step: 'any' });
    const b = inp({ type: 'number', value: '200', step: 'any' });
    const output = resultBox();

    const compute = () => {
      const x = Number(a.value), y = Number(b.value);
      if (![x, y].every(Number.isFinite)) { output.set('请输入有效数字'); return; }
      const round = n => Number(n.toFixed(6)).toString();
      const lines = {
        of: `${x}% × ${y} = ${round(y * x / 100)}`,
        ratio: `${x} ÷ ${y} = ${round(y === 0 ? 0 : x / y * 100)}%`,
        change: `从 ${x} 到 ${y}：${round(x === 0 ? 0 : (y - x) / x * 100)}%（${y >= x ? '增加' : '减少'} ${round(Math.abs(y - x))}）`,
        increase: `${y} × (1 + ${x}%) = ${round(y * (1 + x / 100))}`,
        reverse: `${y} ÷ ${x}% = ${round(x === 0 ? 0 : y / (x / 100))}`,
      };
      output.set(lines[mode.value] || lines.of);
    };

    [a, b].forEach(node => node.addEventListener('input', compute));
    mode.addEventListener('change', compute);
    compute();

    root.append(panel('计算',
      el('div', { class: 'inline-fields' },
        labeled('计算类型', mode), labeled('第一个数 X / A', a), labeled('第二个数 Y / B', b)),
      actions(btn('计算', compute, 'primary')),
      output.node));
  },
};

export const calcExtraTools = [unitConverter, percentageCalculator];

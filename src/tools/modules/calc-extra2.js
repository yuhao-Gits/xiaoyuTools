/* 生活计算类：全部本机数值计算，结果为估算，不构成专业建议。 */
import { panel, inp, btn, actions, resultBox, hint, el, labeled } from '../../core/ui.js';
import { num, clamp, pad, money } from './shared.js';

const ageCalculator = {
  id: 'age-calculator', name: '年龄计算器', category: 'calc',
  desc: '精确到年月日、天数与下次生日', keywords: ['年龄', '生日', '周岁', 'age'],
  render(root) {
    const birth = inp({ type: 'date', value: '1995-01-01' });
    const at = inp({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    const output = resultBox();
    const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const SIGNS = [
      [1, 20, '水瓶座'], [2, 19, '双鱼座'], [3, 21, '白羊座'], [4, 20, '金牛座'],
      [5, 21, '双子座'], [6, 22, '巨蟹座'], [7, 23, '狮子座'], [8, 23, '处女座'],
      [9, 23, '天秤座'], [10, 24, '天蝎座'], [11, 23, '射手座'], [12, 22, '摩羯座'],
    ];
    const signOf = (m, d) => {
      for (let i = SIGNS.length - 1; i >= 0; i -= 1) if (m > SIGNS[i][0] || (m === SIGNS[i][0] && d >= SIGNS[i][1])) return SIGNS[i][2];
      return '摩羯座';
    };
    const calc = () => {
      const b = new Date(`${birth.value}T00:00:00`), t = new Date(`${at.value}T00:00:00`);
      if (Number.isNaN(b.getTime()) || Number.isNaN(t.getTime())) { output.set('请选择有效日期'); return; }
      if (b > t) { output.set('出生日期不能晚于计算日期'); return; }
      let years = t.getFullYear() - b.getFullYear();
      let months = t.getMonth() - b.getMonth();
      let days = t.getDate() - b.getDate();
      if (days < 0) {
        months -= 1;
        days += new Date(t.getFullYear(), t.getMonth(), 0).getDate();
      }
      if (months < 0) { years -= 1; months += 12; }
      const totalDays = Math.floor((t - b) / 86400000);
      const next = new Date(t.getFullYear(), b.getMonth(), b.getDate());
      if (next <= t) next.setFullYear(next.getFullYear() + 1);
      const daysToNext = Math.round((next - t) / 86400000);
      const year = b.getFullYear();
      output.set([
        `周岁      ${years} 岁 ${months} 个月 ${days} 天`,
        `累计天数  ${totalDays} 天（约 ${(totalDays / 365.2425).toFixed(2)} 年）`,
        `累计周数  ${Math.floor(totalDays / 7)} 周`,
        `下次生日  ${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}（还有 ${daysToNext} 天）`,
        `生肖      ${ZODIAC[(year - 4) % 12]}（按农历年近似，年初可能不准）`,
        `星座      ${signOf(b.getMonth() + 1, b.getDate())}`,
        '',
        '按公历日期计算，不考虑闰秒与农历；生肖仅作参考。',
      ].join('\n'));
    };
    birth.addEventListener('change', calc); at.addEventListener('change', calc); calc();
    root.append(panel('日期',
      el('div', { class: 'inline-fields' }, labeled('出生日期', birth), labeled('计算到', at)),
      actions(btn('重新计算', calc, 'primary')), output.node));
  },
};

const bmiCalculator = {
  id: 'bmi-calculator', name: 'BMI 计算器', category: 'calc',
  desc: '按中国成人标准分级，给出参考体重区间', keywords: ['BMI', '体重', '身高', '健康'],
  render(root) {
    const height = inp({ type: 'number', value: '170', min: '50', max: '250', step: '0.1' });
    const weight = inp({ type: 'number', value: '65', min: '10', max: '400', step: '0.1' });
    const output = resultBox();
    const calc = () => {
      const h = clamp(num(height.value, 170), 50, 250) / 100;
      const w = clamp(num(weight.value, 65), 10, 400);
      const bmi = w / (h * h);
      const band = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖';
      const low = (18.5 * h * h).toFixed(1), high = (23.9 * h * h).toFixed(1);
      const bars = [
        ['偏瘦', '< 18.5'], ['正常', '18.5 – 23.9'], ['超重', '24.0 – 27.9'], ['肥胖', '≥ 28.0'],
      ];
      output.set([
        `BMI      ${bmi.toFixed(2)}  kg/m²`,
        `分级      ${band}（中国成人参考标准）`,
        `身高      ${(h * 100).toFixed(1)} cm    体重 ${w.toFixed(1)} kg`,
        `正常体重区间（BMI 18.5–23.9）  ${low} – ${high} kg`,
        `与区间相差  ${w < Number(low) ? `偏轻 ${(Number(low) - w).toFixed(1)} kg` : w > Number(high) ? `偏重 ${(w - Number(high)).toFixed(1)} kg` : '在区间内'}`,
        '',
        ...bars.map(([label, range]) => `${label.padEnd(4, '　')} ${range}`),
        '',
        '仅作参考，孕妇、儿童、运动员等不适用；不构成医学建议。',
      ].join('\n'));
    };
    [height, weight].forEach(n => n.addEventListener('input', calc)); calc();
    root.append(panel('身体数据',
      el('div', { class: 'inline-fields' }, labeled('身高 cm', height), labeled('体重 kg', weight)),
      actions(btn('重新计算', calc, 'primary')), output.node,
      hint('分级采用中国成人 BMI 标准，与 WHO 国际标准不同。')));
  },
};

const tipCalculator = {
  id: 'tip-calculator', name: '小费计算器', category: 'calc',
  desc: '按账单、费率与人数拆分每人应付', keywords: ['小费', '账单', '分账', 'tip'],
  render(root) {
    const amount = inp({ type: 'number', value: '280', min: '0', step: '0.01' });
    const rate = inp({ type: 'range', min: '0', max: '30', step: '1', value: '10' });
    const people = inp({ type: 'number', value: '2', min: '1', max: '100', step: '1' });
    const roundUp = el('input', { type: 'checkbox' });
    const output = resultBox();
    const calc = () => {
      const bill = Math.max(0, num(amount.value, 0));
      const pct = clamp(num(rate.value, 10), 0, 30);
      const n = clamp(Math.round(num(people.value, 1)), 1, 100);
      const tip = bill * pct / 100;
      const total = roundUp.checked ? Math.ceil(bill + tip) : bill + tip;
      const per = total / n;
      output.set([
        `账单金额      ${money(bill)}`,
        `小费比例      ${pct}%`,
        `小费金额      ${money(tip)}`,
        `合计          ${money(total)}${roundUp.checked ? '（已向上取整）' : ''}`,
        `分摊人数      ${n} 人`,
        `每人应付      ${money(per)}`,
        '',
        Array.from({ length: Math.min(n, 10) }, (_, i) => `第 ${pad(i + 1)} 人   ${money(per)}`).join('\n'),
        n > 10 ? `… 其余 ${n - 10} 人同上` : '',
      ].filter(Boolean).join('\n'));
    };
    [amount, rate, people, roundUp].forEach(node => node.addEventListener(node.type === 'checkbox' ? 'change' : 'input', calc));
    calc();
    root.append(panel('账单',
      el('div', { class: 'inline-fields' }, labeled('金额', amount), labeled('小费 %', rate),
        labeled('人数', people), labeled('合计取整', roundUp)),
      actions(btn('重新计算', calc, 'primary')), output.node,
      hint('纯数值计算，不接任何支付或汇率服务；货币符号固定为 ¥。')));
  },
};

const meetingCostCalculator = {
  id: 'meeting-cost-calculator', name: '会议成本计算器', category: 'calc',
  desc: '估算一场会议与全年例会的人力成本', keywords: ['会议', '成本', '时薪', '效率'],
  render(root) {
    const people = inp({ type: 'number', value: '8', min: '1', max: '1000', step: '1' });
    const salary = inp({ type: 'number', value: '80', min: '0', step: '1' });
    const minutes = inp({ type: 'number', value: '60', min: '1', max: '1440', step: '5' });
    const perWeek = inp({ type: 'number', value: '2', min: '0', max: '50', step: '1' });
    const output = resultBox();
    const calc = () => {
      const n = clamp(Math.round(num(people.value, 8)), 1, 1000);
      const hour = Math.max(0, num(salary.value, 80));
      const mins = clamp(num(minutes.value, 60), 1, 1440);
      const times = clamp(num(perWeek.value, 2), 0, 50);
      const single = n * hour * mins / 60;
      const weekly = single * times;
      const yearly = weekly * 52;
      const hours = n * mins / 60 * times * 52;
      output.set([
        `参会人数      ${n} 人`,
        `平均时薪      ${money(hour)} / 小时`,
        `单场时长      ${mins} 分钟`,
        `单场成本      ${money(single)}（占用 ${(n * mins / 60).toFixed(1)} 人时）`,
        `每周 ${times} 场  ${money(weekly)}`,
        `全年 52 周    ${money(yearly)}`,
        `全年人力工时  ${hours.toFixed(0)} 小时 ≈ ${(hours / 8).toFixed(0)} 个工作日`,
        '',
        '按「人数 × 时薪 × 时长」估算，未计场地、设备与机会成本，仅供内部参考。',
      ].join('\n'));
    };
    [people, salary, minutes, perWeek].forEach(n => n.addEventListener('input', calc)); calc();
    root.append(panel('会议参数',
      el('div', { class: 'inline-fields' }, labeled('人数', people), labeled('平均时薪 ¥', salary),
        labeled('时长（分钟）', minutes), labeled('每周次数', perWeek)),
      actions(btn('重新计算', calc, 'primary')), output.node));
  },
};

export const calcExtra2Tools = [ageCalculator, bmiCalculator, tipCalculator, meetingCostCalculator];

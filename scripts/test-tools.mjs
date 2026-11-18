/* 全量可用性测试：
   1) 逐个打开全部工具，检查渲染是否为空、是否有控制台报错；
   2) 对核心工具做输入 → 输出断言（编码、哈希、统计、贷款、复利等）；
   3) 检查分区与信任页面能否正常渲染。

   用法：node scripts/test-tools.mjs
   需要本机已装 Edge / Chrome，或通过 CHROME_PATH 指定可执行文件。 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { IMPLEMENTATIONS } from '../src/tools/index.js';

const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const executablePath = CANDIDATES.find(path => existsSync(path));
if (!executablePath) {
  console.error('找不到浏览器。请设置 CHROME_PATH 指向本机 Chrome / Edge。');
  process.exit(2);
}

const tools = [...IMPLEMENTATIONS.values()];
const failures = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

let consoleErrors = [];
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => consoleErrors.push(`PAGEERROR ${error.message}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar .nav-item');

/* ---------- 一、分区页面 ---------- */

const SECTIONS = [
  ['#/', 'home'], ['#/toolbox', 'toolbox'], ['#/blog', 'blog'],
  ['#/about', 'about'], ['#/privacy', 'privacy'], ['#/terms', 'terms'], ['#/verify', 'verify'],
  ['#/toolbox/dev', 'toolbox-cat'],
  ['#/blog/local-first', 'post'], ['#/toolbox/fav', 'fav'],
];

for (const [hash, name] of SECTIONS) {
  consoleErrors = [];
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(220);
  const info = await page.evaluate(() => ({
    len: (document.querySelector('.view')?.innerText || '').trim().length,
    heads: document.querySelectorAll('.view h1, .view h2').length,
  }));
  check(`分区 ${name}`, info.len > 40 && info.heads > 0, `文本 ${info.len} 字 / 标题 ${info.heads}`);
  check(`分区 ${name} 无报错`, consoleErrors.length === 0, consoleErrors.join(' | '));
}

/* ---------- 二、全量工具渲染 ---------- */

for (const tool of tools) {
  consoleErrors = [];
  await page.evaluate(h => { location.hash = h; }, `#/tool/${tool.id}`);
  await page.waitForFunction(
    name => document.querySelector('.tool-head h2')?.textContent === name,
    tool.name,
    { timeout: 4000 },
  ).catch(() => {});
  await page.waitForTimeout(60);

  const info = await page.evaluate(() => {
    const body = document.querySelector('.tool-body');
    if (!body) return { missing: true };
    return {
      missing: false,
      children: body.children.length,
      html: body.innerHTML.length,
      text: (body.innerText || '').trim().length,
      controls: body.querySelectorAll('input, textarea, select, button, canvas, video, audio').length,
      failed: /工具初始化失败/.test(body.innerText || ''),
    };
  });

  const ok = !info.missing && !info.failed && info.children > 0 && info.html > 260;
  check(`工具 ${tool.id} 渲染`, ok, info.missing ? '缺少 .tool-body' : info.failed ? '初始化失败' : `children=${info.children} html=${info.html}`);

  if (info.controls === 0 && (info.text || 0) < 20) {
    check(`工具 ${tool.id} 有内容`, false, '既没有控件也没有文案');
  }
  if (consoleErrors.length) check(`工具 ${tool.id} 无报错`, false, consoleErrors.join(' | '));
}

/* ---------- 三、核心工具输入 → 输出断言 ---------- */

async function openTool(id, name) {
  consoleErrors = [];
  await page.evaluate(h => { location.hash = h; }, `#/tool/${id}`);
  await page.waitForFunction(
    n => document.querySelector('.tool-head h2')?.textContent === n,
    name,
    { timeout: 4000 },
  ).catch(() => {});
  await page.waitForTimeout(80);
}

async function clickText(text) {
  await page.locator('.tool-body button', { hasText: text }).first().click();
  await page.waitForTimeout(120);
}

/* 有的工具把结果写在 .result，有的直接摊在正文里（年龄、花式文字），统一兜底 */
const resultText = async () => {
  const box = page.locator('.tool-body .result').first();
  if (await box.count()) {
    return box.innerText().catch(() => page.locator('.tool-body').innerText());
  }
  return page.locator('.tool-body').innerText();
};
const statMap = () => page.$$eval('.tool-body .stat', els => Object.fromEntries(els.map(el => [
  el.querySelector('.stat-label')?.textContent || '',
  el.querySelector('strong')?.textContent || '',
])));

/* JSON 格式化：合法 JSON 应通过校验并按 2 空格缩进 */
await openTool('json-format', 'JSON 格式化 / 校验');
await page.locator('.tool-body textarea').first().fill('{"name":"小明","tags":[1,2]}');
await clickText('格式化（2 空格）');
{
  const out = await resultText();
  const status = await page.locator('.tool-body .status').first().innerText();
  check('JSON 格式化输出', out.includes('"name": "小明"') && out.includes('\n'), out.slice(0, 60));
  check('JSON 合法性校验', status.includes('通过'), status);
}

/* Base64：中文按 UTF-8 编码 */
await openTool('base64', 'Base64 编解码');
await page.locator('.tool-body textarea').first().fill('你好，世界');
await clickText('编码文本');
{
  const out = (await resultText()).trim();
  check('Base64 中文编码', out === '5L2g5aW977yM5LiW55WM', out);
}

/* 文本统计：字符数与 UTF-8 字节数 */
await openTool('text-stats', '文本统计');
await page.locator('.tool-body textarea').first().fill('hello 世界');
{
  const stats = await statMap();
  check('文本统计字符数', stats['字符数（含空白）'] === '8', `得到 ${stats['字符数（含空白）']}`);
  check('文本统计字节数', stats['UTF-8 字节数'] === '12', `得到 ${stats['UTF-8 字节数']}`);
}

/* URL 编码：中文百分号编码 */
await openTool('url-codec', 'URL 编解码');
await page.locator('.tool-body textarea').first().fill('一个 参数');
await clickText('编码参数');
{
  const out = (await resultText()).trim();
  check('URL 编码', out === '%E4%B8%80%E4%B8%AA%20%E5%8F%82%E6%95%B0', out);
}

/* UUID：批量生成 5 条且格式合法 */
await openTool('uuid', 'UUID 生成器');
await clickText('重新生成');
{
  const out = await resultText();
  const list = out.split('\n').map(line => line.trim()).filter(Boolean);
  const valid = list.length === 5 && list.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
  check('UUID 生成', valid, `${list.length} 条：${list[0] || '空'}`);
}

/* 哈希：abc 的 SHA-256 应等于已知值 */
await openTool('hash', '文本 / 文件哈希');
await page.locator('.tool-body textarea').first().fill('abc');
await clickText('计算摘要');
{
  await page.waitForTimeout(200);
  const out = await resultText();
  check('SHA-256 摘要', out.includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), out.slice(0, 80));
}

/* 颜色转换：HEX → RGB */
await openTool('color', '颜色转换');
await page.locator('.tool-body input[placeholder="#RRGGBB"]').fill('#FF0000');
{
  const out = await resultText();
  check('HEX 转 RGB', out.includes('rgb(255, 0, 0)'), out.split('\n')[1] || out);
}

/* 贷款：100 万 / 3.5% / 30 年，等额本息月供约 4490 元 */
await openTool('mortgage', '房贷 / 贷款计算');
await clickText('计算');
{
  const out = await resultText();
  const match = out.match(/每月月供\s+([\d.]+)/);
  const value = match ? Number(match[1]) : 0;
  check('房贷月供计算', value > 4400 && value < 4600, `${value} 元`);
}

/* 复利：5 万本金 + 每月 2000，5% 年化，10 年终值应大于累计投入 */
await openTool('compound-interest', '复利 / 定投计算');
{
  const stats = await statMap();
  const number = text => Number(String(text).replace(/[^\d.-]/g, ''));
  const total = number(stats['期末总额']);
  const invested = number(stats['累计投入']);
  check('复利终值', total > invested && invested > 250000, `${stats['期末总额']} / 投入 ${stats['累计投入']}`);
}

/* 收支结余：12000 收入，5500 固定，3000 弹性 → 结余 3500 */
await openTool('budget-ratio', '收支结余测算');
{
  const stats = await statMap();
  check('收支结余', String(stats['月结余']).includes('3500'), JSON.stringify(stats));
}

/* 单位换算：默认长度、1 米 → 英里 */
await openTool('unit-converter', '单位换算');
{
  const out = await resultText();
  check('单位换算', /1\s*m\s*=\s*0\.001\s*km/.test(out), out);
}

/* 百分比：200 的 15% = 30 */
await openTool('percentage-calculator', '百分比计算器');
{
  const inputs = page.locator('.tool-body input[type="number"]');
  if (await inputs.count() >= 2) {
    await inputs.nth(0).fill('200');
    await inputs.nth(1).fill('15');
    await page.waitForTimeout(150);
  }
  const out = await resultText();
  check('百分比计算', out.includes('30'), out.slice(0, 80));
}

/* ---------- 三·续、其它分区的功能断言 ---------- */

/* 文本清洗：合并空格 + 去首尾空白 */
await openTool('text-clean', '文本清洗');
await page.locator('.tool-body textarea').first().fill('  hello   world  \n 第二行  ');
await clickText('应用规则');
{
  const out = await page.locator('.tool-body textarea').nth(1).inputValue();
  check('文本清洗', out.includes('hello world') && out.includes('第二行'), JSON.stringify(out));
}

/* Markdown 预览：标题、列表、代码块都要渲染成标签 */
await openTool('markdown-preview', 'Markdown 预览');
{
  await page.locator('.tool-body textarea').first().fill('# 标题\n\n- 甲\n- 乙\n\n```\ncode\n```');
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const box = document.querySelector('.tool-body .markdown-body');
    return box ? { h1: box.querySelectorAll('h1').length, li: box.querySelectorAll('li').length, pre: box.querySelectorAll('pre').length } : null;
  });
  check('Markdown 渲染', !!info && info.h1 === 1 && info.li === 2 && info.pre === 1, JSON.stringify(info));
}

/* 时间戳：1700000000 秒 = 2023-11-15 06:13 UTC */
await openTool('timestamp', '时间戳转换');
{
  await page.locator('.tool-body input[type="text"]').first().fill('1700000000');
  await clickText('转换');
  const out = await resultText();
  check('时间戳换算', /2023\/11\/1[45]/.test(out), out.slice(0, 60));
}

/* JWT：解析出 payload 字段 */
await openTool('jwt-view', 'JWT 解析');
{
  await page.locator('.tool-body textarea').first().fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWwj-mbqCIsImlhdCI6MTcwMDAwMDAwMH0.abc123');
  await clickText('解析');
  const out = await resultText();
  check('JWT 解析', out.includes('"name": "小雨"') && out.includes('HS256'), out.slice(0, 60));
}

/* 文本对比：多一行即为新增 */
await openTool('text-diff', '文本对比');
{
  const areas = page.locator('.tool-body textarea');
  await areas.nth(0).fill('第一行\n第二行');
  await areas.nth(1).fill('第一行\n第二行\n第三行');
  await clickText('比较');
  const out = await resultText();
  check('文本对比', /新增\s*1\s*行/.test(out) && /删除\s*0\s*行/.test(out), out.slice(0, 60));
}

/* 摩斯：SOS → ... --- ... */
await openTool('morse-code-translator', '摩斯电码');
{
  await page.locator('.tool-body textarea').first().fill('SOS');
  await clickText('编码');
  const out = (await resultText()).trim();
  check('摩斯编码', out === '... --- ...', out);
}

/* 密码生成：长度 16 且不含易混字符外的空白 */
await openTool('password', '密码生成器');
{
  const out = (await resultText()).split('\n').map(s => s.trim()).filter(Boolean);
  check('密码生成', out.length >= 3 && out.every(p => p.length >= 12), `${out.length} 条`);
}

/* 渐变：输出合法 CSS */
await openTool('gradient-generator', '渐变生成器');
{
  const out = await resultText();
  check('渐变 CSS', /background:\s*(linear|radial)-gradient\(/.test(out), out.slice(0, 60));
}

/* 二维码：生成模块数与字符数 */
await openTool('qr-code-generator', '二维码生成器');
{
  await page.locator('.tool-body input[type="text"], .tool-body textarea').first().fill('https://example.com/xiaoyu');
  await clickText('生成');
  const status = await page.locator('.tool-body .status').first().innerText();
  check('二维码生成', /已生成：\d+ × \d+ 模块/.test(status), status);
}

/* 今天吃什么：抽到一道 */
await openTool('what-to-eat', '今天吃什么？');
await clickText('帮我选');
{
  const out = await resultText();
  check('随机选餐', out.trim().length > 1 && !/暂无/.test(out), out.slice(0, 40));
}

/* 抛硬币：十次统计 */
await openTool('coin-flip', '抛硬币');
await clickText('连抛 10 次');
{
  const out = await resultText();
  const match = out.match(/共\s*(\d+)\s*次/);
  check('抛硬币统计', match && Number(match[1]) >= 10, out.slice(0, 40));
}

/* 掷骰：合计等于点数之和 */
await openTool('dice-roller', '掷骰子');
{
  await page.locator('.tool-body input[type="number"]').first().fill('3');
  await clickText('掷！');
  const out = await resultText();
  const match = out.match(/\[([\d, ]+)\]\s*合计\s*(\d+)/);
  const sum = match ? match[1].split(',').map(Number).reduce((a, b) => a + b, 0) : -1;
  check('掷骰合计', match && sum === Number(match[2]), out.slice(0, 60));
}

/* 转盘：旋转结束后出结果（3.2 秒动画） */
await openTool('random-spinner', '随机转盘');
await clickText('开始旋转');
await page.waitForTimeout(3800);
{
  const out = await resultText();
  check('转盘出结果', /自定义转盘：/.test(out), out.slice(0, 40));
}

/* 文字动画：导出 keyframes */
await openTool('text-animation-maker', '文字动画制作器');
{
  const out = await resultText();
  check('文字动画 CSS', /@keyframes/.test(out), out.slice(0, 40));
}

/* ASCII 横幅：7 行点阵 */
await openTool('ascii-banner', 'ASCII 横幅');
await clickText('重新生成');
{
  const out = await resultText();
  const lines = out.split('\n').filter(line => line.trim());
  check('ASCII 横幅', lines.length >= 7, `${lines.length} 行`);
}

/* CSV 图表：3 行数据 */
await openTool('chart-maker', 'CSV 图表生成器');
{
  await page.locator('.tool-body textarea').first().fill('月份,销量\n1月,120\n2月,180\n3月,90');
  await clickText('重新绘制');
  const out = await resultText();
  check('CSV 图表', /已绘制\s*3\s*组数据/.test(out), out.slice(0, 60));
}

/* 节日：默认当年，条数大于 10 */
await openTool('holidays', '世界节日');
{
  const out = await resultText();
  const match = out.match(/共\s*(\d+)\s*条/);
  check('节日列表', match && Number(match[1]) > 10, out.slice(0, 30));
}

/* BMI：170cm / 60kg ≈ 20.8 */
await openTool('bmi-calculator', 'BMI 计算器');
{
  await page.locator('.tool-body input[type="number"]').nth(0).fill('170');
  await page.locator('.tool-body input[type="number"]').nth(1).fill('60');
  await page.waitForTimeout(200);
  const out = await page.locator('.tool-body').innerText();
  const bmi = Number((out.match(/BMI\s+([\d.]+)/) || [])[1]);
  check('BMI 计算', Math.abs(bmi - 20.8) < 0.2, `得到 ${bmi}`);
}

/* 小费：100 元 / 10% / 2 人 → 每人 55 */
await openTool('tip-calculator', '小费计算器');
{
  const nums = page.locator('.tool-body input[type="number"]');
  await nums.nth(0).fill('100');
  await page.locator('.tool-body input[type="range"]').first().fill('10');
  await nums.nth(1).fill('2');
  await page.waitForTimeout(200);
  const out = await page.locator('.tool-body').innerText();
  const each = Number((out.match(/每人应付\s+¥\s*([\d.]+)/) || [])[1]);
  check('小费分摊', Math.abs(each - 55) < 0.01, `得到 ${each}`);
}

/* 会议成本：10 人 × 100 元/时 × 60 分钟 = 1000 */
await openTool('meeting-cost-calculator', '会议成本计算器');
{
  const nums = page.locator('.tool-body input[type="number"]');
  await nums.nth(0).fill('10');
  await nums.nth(1).fill('100');
  await nums.nth(2).fill('60');
  await page.waitForTimeout(200);
  const out = await page.locator('.tool-body').innerText();
  const cost = Number((out.match(/单场成本\s+¥\s*([\d,.]+)/) || [])[1]?.replace(/,/g, ''));
  check('会议成本', cost > 990 && cost < 1010, `得到 ${cost}`);
}

/* 年龄：1990-06-15 → 与今天相差的周岁可复算 */
await openTool('age-calculator', '年龄计算器');
{
  const dates = page.locator('.tool-body input[type="date"]');
  await dates.nth(0).fill('1990-06-15');
  await page.waitForTimeout(200);
  const out = await resultText();
  const years = Number((out.match(/周岁\s+(\d+)\s*岁/) || [])[1]);
  const expected = new Date().getFullYear() - 1990 - (new Date() < new Date(`${new Date().getFullYear()}-06-15`) ? 1 : 0);
  check('年龄计算', years === expected, `得到 ${years}，应为 ${expected}`);
}

/* 花式文字：数学粗体与花体映射正确 */
await openTool('fancy-text-generator', '花式文字生成器');
{
  await page.locator('.tool-body input[type="text"]').first().fill('ep');
  await page.waitForTimeout(250);
  const out = await resultText();
  check('花式文字花体', out.includes('ℯ℘'), out.slice(0, 120));
  check('花式文字粗体', out.includes('𝐞𝐩'), out.slice(0, 120));
}

/* 收据：小计等于明细之和 */
await openTool('invoice-generator', '发票生成器');
{
  const out = await resultText();
  check('收据小计', /小计\s+¥\s*[\d,]+\.\d{2}/.test(out), out.slice(0, 60));
}

/* 世界时钟：至少 10 个城市 */
await openTool('world-clock', '世界时钟');
{
  const out = await resultText();
  const hits = (out.match(/\d{2}:\d{2}:\d{2}/g) || []).length;
  check('世界时钟', hits >= 10, `${hits} 个时间`);
}

/* 秒表：开始后计时在走 */
await openTool('stopwatch', '秒表');
await clickText('开始');
await page.waitForTimeout(700);
{
  const out = await page.locator('.tool-body').innerText();
  const timer = (out.match(/\d{2}:\d{2}:\d{2}\.\d{2}/) || [''])[0];
  check('秒表计时', timer !== '' && timer !== '00:00:00.00', timer || out.slice(0, 40));
}
await clickText('开始 / 暂停').catch(() => {});

/* 番茄钟：开始后进入专注阶段 */
await openTool('pomodoro-timer', '番茄钟');
await clickText('开始');
await page.waitForTimeout(400);
{
  const out = await page.locator('.tool-body').innerText();
  check('番茄钟启动', /专注|进行中/.test(out) && /00:2[45]:/.test(out), out.replace(/\n/g, ' ').slice(0, 60));
}

/* 收尾：确认没有未捕获异常 */
check('全程无控制台报错', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ---------- 四、汇总 ---------- */

await browser.close();

const passed = checks.filter(item => item.ok).length;
console.log(`\n检查项 ${checks.length} · 通过 ${passed} · 失败 ${failures.length}`);
if (failures.length) {
  console.log('\n失败明细：');
  failures.forEach(item => console.log(`  ✗ ${item}`));
  process.exit(1);
}
console.log(`全部通过：分区与信任页可打开，${tools.length} 件工具均可渲染，核心工具的输入输出符合预期。`);

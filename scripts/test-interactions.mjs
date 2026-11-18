/* 交互冒烟：对每件工具填入样例输入、点击安全的主操作按钮，捕获运行时异常。
   与其它脚本的分工：
   - test-tools.mjs        页面能否渲染
   - 本脚本                 点下去会不会炸，且操作前后是否真的产出了东西
   - test-files.mjs        真实文件输入（图片 / PDF / 音频 / docx）
   - test-downloads.mjs    点下载后文件是否真的有效
   判定口径：快照包含 innerText、整体 HTML、所有输入框的值、画布像素指纹、状态文案。
   结果写进 textarea 的工具（文本清洗、字幕修复等）与画进 canvas 的工具（画板、图表）
   都能被正确识别，不再误报「无变化」。
   用法：node scripts/test-interactions.mjs */
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
].filter(Boolean);
const executablePath = CANDIDATES.find(path => existsSync(path));
if (!executablePath) {
  console.error('找不到浏览器。请设置 CHROME_PATH。');
  process.exit(2);
}

const tools = [...IMPLEMENTATIONS.values()];

/* 安全操作白名单：只做本地计算 / 生成，不触发下载、复制、删除、录音录像 */
const SAFE = /计算|生成|转换|格式化|编码|解码|解析|运行|开始|应用|预览|渲染|检测|分析|识别|比较|统计|压缩|合并|拆分|切割|提取|随机|重算|刷新|执行|绘制|试听|模拟|查询|换算|校验|排版|拼接|裁剪|抛|掷|抽|选|洗牌|添加|查看|切分|标记/;
const UNSAFE = /下载|复制|清空|删除|移除|停止|结束|保存|分享|打印|摄像头|麦克风|录音|录像|上传|重置|恢复|撤销|退出|关闭|打开文件|选择文件|开启设备/;

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar .nav-item');

const snapshot = () => page.evaluate(() => {
  const body = document.querySelector('.tool-body');
  if (!body) return { text: '', html: 0, values: '', canvas: '', status: '', file: false };
  const values = [...body.querySelectorAll('textarea, input, select')]
    .map(node => `${node.type || node.tagName}:${node.value}`).join('|');
  const canvas = [...body.querySelectorAll('canvas')].map(node => {
    try {
      const ctx = node.getContext('2d');
      const { width, height } = node;
      if (!width || !height) return 'empty';
      const data = ctx.getImageData(0, 0, width, height).data;
      let sum = 0, nonBlank = 0;
      for (let i = 0; i < data.length; i += 4 * 97) {
        sum = (sum * 31 + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3] * 11) % 1000000007;
        if (data[i + 3] > 8) nonBlank += 1;
      }
      return `${sum}:${nonBlank}`;
    } catch {
      return 'tainted';
    }
  }).join(',');
  return {
    text: body.innerText || '',
    html: body.innerHTML.length,
    values,
    canvas,
    status: [...body.querySelectorAll('.status')].map(n => n.textContent.trim()).filter(Boolean).join(' / '),
    file: !!body.querySelector('input[type="file"]'),
  };
});

const results = [];

for (const tool of tools) {
  pageErrors.length = 0;
  await page.evaluate(hash => { location.hash = hash; }, `#/tool/${tool.id}`);
  await page.waitForFunction(
    name => document.querySelector('.tool-head h2')?.textContent === name,
    tool.name,
    { timeout: 4000 },
  ).catch(() => {});
  await page.waitForTimeout(100);

  const before = await snapshot();

  /* 1) 填样例输入 */
  const filled = await page.evaluate(() => {
    const body = document.querySelector('.tool-body');
    if (!body) return 0;
    let count = 0;
    for (const node of body.querySelectorAll('textarea, input')) {
      const type = (node.getAttribute('type') || 'text').toLowerCase();
      if (['file', 'color', 'checkbox', 'radio', 'range', 'date', 'time', 'datetime-local', 'month', 'week'].includes(type)) continue;
      if (node.value && node.value !== '0' && type !== 'number') continue;
      let sample = '测试 xiaoyuTools 123\n第二行 hello world';
      if (type === 'number') sample = '100';
      else if (type === 'url' || /url/i.test(node.placeholder || '')) sample = 'https://example.com/a?b=1';
      else if (/json/i.test(node.placeholder || '')) sample = '{"name":"xiaoyu","n":3}';
      else if (/base64/i.test(node.placeholder || '')) sample = 'aGVsbG8=';
      else if (/jwt|token/i.test(node.placeholder || '')) sample = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
      else if (/srt|字幕|webvtt/i.test(node.placeholder || '')) sample = '1\n00:00:01,000 --> 00:00:03,000\n第一句\n\n2\n00:00:04,000 --> 00:00:06,000\n第二句';
      else if (/csv|逗号/i.test(node.placeholder || '')) sample = '月份,销量\n1月,120\n2月,180\n3月,90';
      node.value = sample;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      count += 1;
    }
    for (const node of body.querySelectorAll('select')) {
      const options = [...node.options].filter(option => option.value && !option.disabled);
      if (options.length > 1 && node.selectedIndex === 0) {
        node.selectedIndex = 1;
        node.dispatchEvent(new Event('change', { bubbles: true }));
        count += 1;
      }
    }
    return count;
  });
  await page.waitForTimeout(130);

  /* 2) 点击安全按钮，最多 3 个 */
  const clicked = [];
  const buttons = page.locator('.tool-body button');
  const total = await buttons.count();
  for (let index = 0; index < total && clicked.length < 3; index += 1) {
    const button = buttons.nth(index);
    const label = (await button.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!label || !SAFE.test(label) || UNSAFE.test(label)) continue;
    if (/开始.*(录音|录制|摄像)/.test(label)) continue;
    if (await button.isDisabled().catch(() => true)) continue;
    try {
      await button.click({ timeout: 1500 });
      clicked.push(label);
      await page.waitForTimeout(180);
    } catch {
      /* 被遮挡或不可点，跳过 */
    }
  }

  const after = await snapshot();
  results.push({
    id: tool.id,
    name: tool.name,
    filled,
    clicked,
    needsFile: before.file,
    changed: after.text !== before.text
      || after.html !== before.html
      || after.values !== before.values
      || after.canvas !== before.canvas,
    status: after.status,
    errors: [...new Set(pageErrors)],
  });
}

await browser.close();

const withErrors = results.filter(item => item.errors.length);
const interactive = results.filter(item => !item.needsFile);
const unchanged = interactive.filter(item => !item.changed);

console.log(`\n工具 ${results.length} 件 · 有运行时异常 ${withErrors.length} 件 · 无需文件的 ${interactive.length} 件里操作无变化 ${unchanged.length} 件`);

if (withErrors.length) {
  console.log('\n运行时异常：');
  for (const item of withErrors) console.log(`  ✗ ${item.id} ${item.name}\n    ${item.errors.join('\n    ')}`);
}
if (unchanged.length) {
  console.log('\n无需文件、点完仍无变化（需人工判断）：');
  for (const item of unchanged) {
    console.log(`  - ${item.id} ${item.name} | 填入 ${item.filled} | 点击 [${item.clicked.join(' / ') || '无'}]\n      ${item.status || '(无状态文案)'}`);
  }
}

process.exit(withErrors.length ? 1 : 0);

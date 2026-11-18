/* 手势与设备类工具专项：这些工具不靠按钮出结果，需要真实指针拖拽、按键或点击区域。
   覆盖：画板、签名、键盘测试、文字冒险、反应速度、CPS、瞄准训练、打字测试、
         MIDI 键盘、番茄钟、呼吸放松、麦克风与摄像头（无设备时应给出可读提示）。
   用法：node scripts/test-gestures.mjs */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

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

const checks = [];
const failures = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};

/* 音频类工具需要 AudioContext 能在无用户手势时启动，否则只会停在「准备中」 */
const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });

const open = async (id) => {
  pageErrors.length = 0;
  await page.goto(`${BASE}#/tool/${id}`, { waitUntil: 'load' });
  await page.waitForSelector('.tool-body');
  await page.waitForTimeout(250);
};
const bodyText = () => page.locator('.tool-body').innerText();
const canvasSignature = () => page.evaluate(() => {
  const canvas = document.querySelector('.tool-body canvas');
  if (!canvas) return 'no-canvas';
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4 * 53) sum = (sum * 31 + data[i] + data[i + 1] * 3 + data[i + 3] * 7) % 1000000007;
  return String(sum);
});
const drag = async (locator, steps = 18) => {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(box.x + 30 + i * 7, box.y + 30 + i * 4);
  }
  await page.mouse.up();
  await page.waitForTimeout(180);
};

/* 画板：拖一道线，画布像素应变化 */
await open('whiteboard');
{
  const before = await canvasSignature();
  await drag(page.locator('.tool-body canvas').first());
  const after = await canvasSignature();
  check('画板可绘制', before !== after && after !== 'no-canvas', `${before} → ${after}`);
  check('画板无报错', pageErrors.length === 0, pageErrors.join(' | '));
}

/* 签名：手写模式拖动 */
await open('signature-maker');
{
  const before = await canvasSignature();
  await drag(page.locator('.tool-body canvas').first());
  const after = await canvasSignature();
  check('签名手写可绘制', before !== after, `${before} → ${after}`);
}

/* 键盘测试：按下高亮，抬起熄灭 */
await open('keyboard-tester');
{
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(120);
  const on = await page.$$eval('.tool-body .kbd.is-on', nodes => nodes.map(n => n.textContent.trim()));
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(120);
  const off = await page.$$eval('.tool-body .kbd.is-on', nodes => nodes.length);
  check('键盘按下高亮', on.some(text => text.toLowerCase() === 'a'), JSON.stringify(on));
  check('键盘抬起熄灭', off === 0, `${off} 个仍高亮`);
  check('键盘记录已按键', (await bodyText()).includes('已按过的键'), '');
}

/* 文字冒险：点选项进入第 2 步 */
await open('ai-text-adventure');
{
  const before = await bodyText();
  await page.locator('.tool-body button').first().click();
  await page.waitForTimeout(200);
  const after = await bodyText();
  check('文字冒险推进', /第\s*1\s*步/.test(before) && /第\s*2\s*步/.test(after), after.split('\n')[2] || '');
}

/* 反应速度：等到变色后点击，应记录一次成绩 */
await open('reaction-time-test');
{
  await page.locator('.tool-body button', { hasText: '开始' }).first().click();
  await page.waitForFunction(() => /现在点/.test(document.querySelector('.tool-body .game-area')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  await page.locator('.tool-body .game-area').click();
  await page.waitForTimeout(250);
  const out = await bodyText();
  check('反应测试记成绩', /次数\s*\n?\s*1/.test(out.replace(/\n+/g, ' ')) || /本次\s*\d+\s*ms/.test(out), out.replace(/\n+/g, ' ').slice(0, 80));
}

/* CPS：连点后每秒点击数应大于 0 */
await open('cps-test');
{
  const area = page.locator('.tool-body .game-area');
  for (let i = 0; i < 14; i += 1) { await area.click(); await page.waitForTimeout(45); }
  await page.waitForTimeout(200);
  const out = await bodyText();
  const cps = Number((out.match(/CPS\s+([\d.]+)/) || [])[1]);
  check('CPS 统计', cps > 0, `CPS=${cps}`);
}

/* 瞄准训练：点中目标计入命中 */
await open('aim-trainer');
{
  await page.locator('.tool-body button', { hasText: '开始' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.tool-body .aim-target').first().click();
  await page.waitForTimeout(200);
  const out = await bodyText();
  check('瞄准命中计数', /命中\s*\n?\s*1/.test(out.replace(/\n+/g, ' ')), out.replace(/\n+/g, ' ').slice(0, 60));
}

/* 打字测试：输入后速度与准确率应有值 */
await open('typing-test');
{
  await page.locator('.tool-body input').first().type('把常用的小操作收进一个页面，打开就能用。', { delay: 8 });
  await page.waitForTimeout(300);
  const out = await bodyText();
  const cpm = Number((out.match(/字符\/分钟\s*\n?\s*([\d]+)/) || (out.replace(/\n+/g, ' ').match(/字符\/分钟\s+([\d]+)/) || []))[1]);
  check('打字测速', cpm > 0, `字符/分钟=${cpm}`);
}

/* MIDI 键盘：点琴键应显示当前音符 */
await open('midi-keyboard');
{
  const key = page.locator('.tool-body .piano-key').first();
  await key.click();
  await page.waitForTimeout(200);
  const out = await bodyText();
  check('MIDI 琴键发声', /当前音符/.test(out) && /Hz/.test(out), out.replace(/\n+/g, ' ').slice(-60));
}

/* 番茄钟：开始后进入专注计时 */
await open('pomodoro-timer');
{
  await page.locator('.tool-body button', { hasText: '开始' }).first().click();
  await page.waitForTimeout(500);
  const out = await bodyText();
  check('番茄钟计时', /专注/.test(out) && /00:2[45]:/.test(out), out.replace(/\n+/g, ' ').slice(0, 60));
}

/* 呼吸放松：开始后阶段与剩余时间变化 */
await open('breathing-relaxation');
{
  const before = await bodyText();
  await page.locator('.tool-body button', { hasText: '开始' }).first().click();
  await page.waitForTimeout(1200);
  const after = await bodyText();
  check('呼吸节奏启动', before !== after && !/剩余\s+—/.test(after), after.replace(/\n+/g, ' ').slice(0, 60));
}

/* 麦克风与摄像头：无设备时应给出可读提示而不是崩溃 */
await open('mic-camera-test');
{
  await page.locator('.tool-body button', { hasText: '开启设备' }).first().click();
  await page.waitForTimeout(1200);
  const out = await bodyText();
  check('设备拒绝时提示', /无法开启设备|请检查浏览器权限|不支持/.test(out), out.replace(/\n+/g, ' ').slice(-80));
  check('设备工具无崩溃', pageErrors.length === 0, pageErrors.join(' | '));
}

/* 环境噪音：播放后状态应显示正在播放 */
await open('noise-generator');
{
  await page.locator('.tool-body button', { hasText: '播放' }).first().click();
  await page.waitForTimeout(600);
  const out = await bodyText();
  check('环境噪音播放', /播放中/.test(out), out.replace(/\n+/g, ' ').slice(-40));
}

/* 文本朗读：填入文本后进入朗读状态 */
await open('text-to-speech');
{
  await page.locator('.tool-body textarea').first().fill('你好，这是一段朗读测试。');
  await page.locator('.tool-body button', { hasText: '朗读' }).first().click();
  await page.waitForTimeout(700);
  const out = await bodyText();
  check('文本朗读启动', /朗读中/.test(out), out.replace(/\n+/g, ' ').slice(0, 40));
}

/* 节拍器：开始后拍号应递增 */
await open('metronome');
{
  await page.locator('.tool-body button', { hasText: '开始' }).first().click();
  await page.waitForTimeout(900);
  const out = await bodyText();
  check('节拍器走拍', /第\s*\d+\s*拍/.test(out), out.replace(/\n+/g, ' ').slice(0, 60));
}

/* BPM 检测：连点四下 Tap，应给出 BPM */
await open('bpm-detector');
{
  for (let i = 0; i < 5; i += 1) {
    await page.locator('.tool-body button', { hasText: 'Tap' }).first().click();
    await page.waitForTimeout(500);
  }
  const out = await bodyText();
  const bpm = Number((out.match(/BPM\s*\n?\s*(\d+)/) || [])[1]);
  check('BPM Tap 测速', bpm > 60 && bpm < 200, `BPM=${bpm}`);
}

await browser.close();

const passed = checks.filter(item => item.ok).length;
console.log(`\n手势类检查 ${checks.length} · 通过 ${passed} · 失败 ${failures.length}`);
if (failures.length) {
  console.log('\n失败明细：');
  failures.forEach(item => console.log(`  ✗ ${item}`));
  process.exit(1);
}

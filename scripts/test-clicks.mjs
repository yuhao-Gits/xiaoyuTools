/* 卡片点击回归：确认「打开」是真实可点的整卡热区，且星标不被覆盖层吃掉。
   这个脚本存在的原因：.card-open 曾被一条 display:none 隐藏，整卡失去点击能力而页面毫无报错。 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const exe = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find(p => existsSync(p));
if (!exe) { console.error('找不到浏览器，设置 CHROME_PATH'); process.exit(2); }

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const failures = [];

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const toToolbox = () => page.goto(`${BASE}#/toolbox`, { waitUntil: 'networkidle' });
const hash = () => page.evaluate(() => location.hash);
const clickAt = async (box, dx = 0.5, dy = 0.5) => {
  await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy);
  await page.waitForTimeout(280);
};

await toToolbox();
const total = await page.locator('.tool-card').count();
check('工具箱渲染出卡片', total > 0, `共 ${total} 张`);

const hit = await page.evaluate(() => {
  const r = document.querySelector('.tool-card').getBoundingClientRect();
  const n = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { tag: n.tagName, href: n.getAttribute?.('href') || '' };
});
check('卡片中心命中跳转层', hit.tag === 'A' && hit.href.startsWith('#/tool/'), `${hit.tag} ${hit.href}`);

/* 三个真实落点：打开文案、标题、右下留白 */
const targets = [
  ['打开文案', '.tool-card .card-action', 0.5, 0.5],
  ['卡片标题', '.tool-card .card-name', 0.15, 0.5],
  ['右下留白', '.tool-card', 0.94, 0.92],
];
for (const [label, selector, dx, dy] of targets) {
  await toToolbox();
  await clickAt(await page.locator(selector).first().boundingBox(), dx, dy);
  const h = await hash();
  const title = await page.locator('.tool-page h2').first().innerText().catch(() => '');
  check(`点${label}能进详情页`, h.startsWith('#/tool/') && title.length > 0, `${h} ${title}`);
}

/* 星标独立响应，且不触发跳转 */
await toToolbox();
await page.locator('.tool-card').first().hover();
await clickAt(await page.locator('.tool-card .card-fav').first().boundingBox());
check('星标可点且不跳转',
  (await hash()) === '#/toolbox' && (await page.locator('.tool-card .card-fav').first().getAttribute('aria-pressed')) === 'true');

/* 键盘可达：Tab 到卡片链接后回车 */
await toToolbox();
await page.locator('.tool-card .card-open').first().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(280);
check('键盘回车可打开', (await hash()).startsWith('#/tool/'), await hash());

/* 首页最近使用 / 收藏列表复用同一组件，抽查首页集群卡片 */
await page.goto(`${BASE}#/`, { waitUntil: 'networkidle' });
const wsCard = page.locator('.workspace-card').first();
await wsCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await clickAt(await wsCard.boundingBox(), 0.5, 0.35);
check('首页集群卡片可进分区', (await hash()).length > 3, await hash());

await browser.close();

for (const { name, ok, detail } of checks) console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
console.log(`\n通过 ${checks.filter(c => c.ok).length}/${checks.length}`);
if (failures.length) { console.error('\n失败：\n' + failures.join('\n')); process.exit(1); }

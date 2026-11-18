import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { IMPLEMENTATIONS } from '../src/tools/index.js';
const exe = ['C://Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar');
const rows = [];
for (const tool of IMPLEMENTATIONS.values()) {
  await page.evaluate(h => { location.hash = h; }, `#/tool/${tool.id}`);
  await page.waitForTimeout(45);
  const info = await page.evaluate(() => [...document.querySelectorAll('.tool-body input[type="file"]')].map(n => n.getAttribute('accept') || '*/*'));
  if (info.length) rows.push([tool.id, tool.name, info.join(' ; ')]);
}
console.log(rows.map(r => r.join(' | ')).join('\n'));
console.log('TOTAL', rows.length);
await browser.close();

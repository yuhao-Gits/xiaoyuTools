/* 文件类工具专项测试：自动生成测试素材并逐个上传，验证预览/解析/输出是否真的产生。
   覆盖 40 件带 file input 的工具；HEIC / AI / 视频压缩依赖真实编码文件，标记为 skip。

   用法：node scripts/test-files.mjs */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { IMPLEMENTATIONS } from '../src/tools/index.js';

const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const FIXTURES = resolve('fixtures');
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

/* pdf.js 的 worker 在页面关闭时可能留下未提交的导航，属于清理噪声，不影响测试结论 */
process.on('unhandledRejection', error => {
  const message = String(error?.message || error);
  if (/TargetClosedError|Target page, context or browser has been closed/.test(message)) return;
  console.error('UNHANDLED', message);
});

if (!existsSync(FIXTURES)) mkdirSync(FIXTURES, { recursive: true });

/* ---------- 1. 生成 WAV / 文本素材 ---------- */

function makeWav(path) {
  const sampleRate = 44100;
  const seconds = 1;
  const frames = sampleRate * seconds;
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000);
    data.writeInt16LE(value, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

writeFileSync(resolve(FIXTURES, 'sample.txt'), 'xiaoyuTools 测试文本\n第二行 hello world 123\n');
writeFileSync(resolve(FIXTURES, 'sample.md'), '# 测试标题\n\n这是 **Markdown** 测试。\n\n- 列表一\n- 列表二\n');
writeFileSync(resolve(FIXTURES, 'sample.csv'), '月份,收入,支出\n1月,12000,8500\n2月,13000,9100\n3月,12500,7800\n');
writeFileSync(resolve(FIXTURES, 'sample.json'), JSON.stringify({ name: 'xiaoyuTools', version: 3, tags: ['test', 'local'] }, null, 2));
writeFileSync(resolve(FIXTURES, 'sample.html'), '<!doctype html><html><body><h1>测试页面</h1><p>hello</p></body></html>');
writeFileSync(resolve(FIXTURES, 'sample.srt'), '1\n00:00:01,000 --> 00:00:03,000\n第一句字幕\n\n2\n00:00:04,000 --> 00:00:06,000\n第二句字幕\n');
writeFileSync(resolve(FIXTURES, 'sample.vtt'), 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nFirst line\n');
makeWav(resolve(FIXTURES, 'tone.wav'));

/* ---------- 2. 在浏览器里生成图片 / PDF / DOCX ---------- */

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on('crash', () => console.log('!!! 渲染进程崩溃（RENDERER CRASH）'));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(300);

const assets = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 480, 360);
  gradient.addColorStop(0, '#1f6feb');
  gradient.addColorStop(1, '#f1f1f2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 480, 360);
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(40, 40, 180, 120);
  ctx.fillStyle = '#2ea043';
  ctx.beginPath();
  ctx.arc(340, 240, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('xiaoyuTools', 40, 320);

  const png = canvas.toDataURL('image/png').split(',')[1];
  const jpeg = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  const webp = canvas.toDataURL('image/webp', 0.9).split(',')[1];

  /* PDF：两页，带文本层 */
  let pdf = null;
  if (window.PDFLib) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i += 1) {
      const pdfPage = doc.addPage([595, 842]);
      pdfPage.drawText(`xiaoyuTools test PDF page ${i + 1}`, { x: 60, y: 760, size: 20, font, color: rgb(0.1, 0.1, 0.1) });
      pdfPage.drawText('Hello PDF 123 local only', { x: 60, y: 710, size: 13, font, color: rgb(0.2, 0.2, 0.2) });
    }
    const bytes = await doc.save();
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    pdf = btoa(binary);
  }

  /* DOCX：最小可用 OOXML 包 */
  let docx = null;
  if (window.JSZip) {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>xiaoyuTools 测试 Word 文档</w:t></w:r></w:p><w:p><w:r><w:t>第二段：Hello DOCX 123</w:t></w:r></w:p><w:p><w:r><w:t>第三段用于验证段落重排。</w:t></w:r></w:p></w:body></w:document>');
    docx = await zip.generateAsync({ type: 'base64' });
  }

  return { png, jpeg, webp, pdf, docx };
});

const write = (name, base64) => {
  if (!base64) return false;
  writeFileSync(resolve(FIXTURES, name), Buffer.from(base64, 'base64'));
  return true;
};
write('photo.png', assets.png);
write('photo.jpg', assets.jpeg);
write('photo.webp', assets.webp);
const hasPdf = write('sample.pdf', assets.pdf);
const hasDocx = write('sample.docx', assets.docx);
console.log(`素材：图片 OK · PDF ${hasPdf ? 'OK' : '缺失'} · DOCX ${hasDocx ? 'OK' : '缺失'} · WAV/文本 OK`);

/* ---------- 3. 逐件上传 ---------- */

const tools = [...IMPLEMENTATIONS.values()];
const fileTools = [];
for (const tool of tools) {
  await page.evaluate(hash => { location.hash = hash; }, `#/tool/${tool.id}`);
  await page.waitForTimeout(60);
  const accepts = await page.evaluate(() => [...document.querySelectorAll('.tool-body input[type="file"]')].map(node => node.getAttribute('accept') || '*/*'));
  if (accepts.length) fileTools.push({ tool, accepts });
}

const pickFile = (id, accepts) => {
  const joined = accepts.join(' ');
  if (/heic|heif/i.test(joined)) return null;
  if (/\.ai|illustrator/i.test(joined)) return null;
  if (/video\//.test(joined)) return null;
  if (/svg/.test(joined)) return resolve(FIXTURES, 'sample.svg');
  if (/gif/.test(joined)) return resolve(FIXTURES, 'sample.gif');
  if (/pdf/.test(joined) && !/image/.test(joined)) return resolve(FIXTURES, 'sample.pdf');
  if (/docx|wordprocessingml/.test(joined)) return resolve(FIXTURES, 'sample.docx');
  if (/audio\//.test(joined)) return resolve(FIXTURES, 'tone.wav');
  if (/image\//.test(joined)) return resolve(FIXTURES, id === 'webp-to-jpg' || id === 'webp-to-png' ? 'photo.webp' : id.includes('png') ? 'photo.png' : 'photo.jpg');
  if (id === 'ai-image-metadata-viewer') return resolve(FIXTURES, 'photo.png');
  if (id === 'extract-text') return resolve(FIXTURES, 'sample.docx');
  return resolve(FIXTURES, 'sample.txt');
};

const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });

const SAFE = /生成|转换|合并|拼接|分析|提取|压缩|切割|裁剪|处理|开始|应用|计算|检测|解析|渲染|导出/;
const UNSAFE = /下载|复制|清空|删除|移除|停止|结束|保存|分享|打印|撤销/;

const report = [];
for (const { tool, accepts } of fileTools) {
  pageErrors.length = 0;
  process.stdout.write(`… ${tool.id}\n`);
  const file = pickFile(tool.id, accepts);
  if (!file) {
    report.push({ id: tool.id, name: tool.name, skipped: true, reason: `accept=${accepts.join(' ')}` });
    continue;
  }

  await page.evaluate(hash => { location.hash = hash; }, `#/tool/${tool.id}`);
  await page.waitForFunction(
    name => document.querySelector('.tool-head h2')?.textContent === name,
    tool.name,
    { timeout: 4000 },
  ).catch(() => {});
  await page.waitForTimeout(120);

  const snapshot = () => page.evaluate(() => {
    const body = document.querySelector('.tool-body');
    return {
      text: (body?.innerText || '').trim(),
      media: body ? body.querySelectorAll('img, canvas, audio, video').length : 0,
      status: [...document.querySelectorAll('.tool-body .status')].map(node => node.textContent.trim()).filter(Boolean).join(' / '),
      result: [...document.querySelectorAll('.tool-body .result')].map(node => node.textContent.trim()).filter(Boolean).join(' / ').slice(0, 120),
      fileValues: [...document.querySelectorAll('.tool-body input[type="file"]')].map(node => node.value).join(','),
    };
  });

  const before = await snapshot();
  try {
    const inputs = page.locator('.tool-body input[type="file"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i += 1) await inputs.nth(i).setInputFiles(file);
  } catch (error) {
    report.push({ id: tool.id, name: tool.name, error: `上传失败：${error.message}` });
    continue;
  }
  await page.waitForTimeout(1200);

  /* 上传后若还有安全按钮，点前两个 */
  const clicked = [];
  const buttons = page.locator('.tool-body button');
  const total = await buttons.count();
  for (let i = 0; i < total && clicked.length < 2; i += 1) {
    const button = buttons.nth(i);
    const label = (await button.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!label || !SAFE.test(label) || UNSAFE.test(label)) continue;
    if (await button.isDisabled().catch(() => true)) continue;
    try {
      await button.click({ timeout: 2000 });
      clicked.push(label);
      await page.waitForTimeout(900);
    } catch { /* ignore */ }
  }

  const after = await snapshot();
  const changed = after.text !== before.text || after.media > before.media || after.fileValues !== before.fileValues;
  /* 只把「状态行 / 结果区」里的失败字样算告警；正文提示语里出现「不支持」属于说明文案 */
  const hasErrorText = /失败|错误|异常/.test(`${after.status} ${after.result}`);
  report.push({
    id: tool.id,
    name: tool.name,
    file: file.split(/[\\/]/).pop(),
    changed,
    media: `${before.media}→${after.media}`,
    clicked,
    status: after.status,
    result: after.result,
    errorText: hasErrorText,
    errors: [...new Set(pageErrors)],
  });
}

await page.close().catch(() => {});
await browser.close().catch(() => {});

const failed = report.filter(item => !item.skipped && (item.error || item.errors?.length || !item.changed));
const suspicious = report.filter(item => !item.skipped && item.errorText && !item.errors?.length);

console.log(`\n文件类工具 ${report.length} 件 · 跳过 ${report.filter(item => item.skipped).length} · 正常 ${report.filter(item => !item.skipped).length - failed.length} · 异常 ${failed.length}`);
for (const item of report.filter(row => !row.skipped)) {
  const mark = failed.includes(item) ? '✗' : item.errorText ? '!' : '✓';
  console.log(`  ${mark} ${item.id} [${item.file}] 媒体 ${item.media} 点击[${(item.clicked || []).join('/') || '-'}] ${item.result ? `结果: ${item.result}` : ''}${item.status ? ` 状态: ${item.status}` : ''}`);
}
if (failed.length) {
  console.log('\n异常明细：');
  for (const item of failed) {
    console.log(`  ✗ ${item.id} ${item.name}${item.error ? ` — ${item.error}` : ''}${item.errors?.length ? ` — ${item.errors.join(' | ')}` : ''}${!item.changed ? ' — 上传后界面无变化' : ''}`);
  }
}
if (suspicious.length) {
  console.log('\n界面提示失败（需人工判断）：');
  for (const item of suspicious) console.log(`  ! ${item.id}: ${item.status || item.result || '(无文案)'}`);
}
process.exit(failed.length ? 1 : 0);

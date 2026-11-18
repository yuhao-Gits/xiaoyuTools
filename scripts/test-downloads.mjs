/* 下载类工具专项：点击「转换并下载」，接收浏览器下载，校验文件头与内容是否真的有效。
   覆盖：图片打包、PDF 合并/压缩、Word→PDF、PDF→Word、音频转换、镜头动画、视频截帧/GIF/音频/压缩。
   用法：node scripts/test-downloads.mjs */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const FIXTURES = resolve('fixtures');
const OUT = resolve('fixtures/out');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

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

/* pdf.js / MediaRecorder 在页面关闭时可能留下未提交的导航，属于清理噪声 */
process.on('unhandledRejection', error => {
  const message = String(error?.message || error);
  if (/TargetClosedError|Target page, context or browser has been closed/.test(message)) return;
  console.error('UNHANDLED', message);
});

const browser = await chromium.launch({ executablePath, headless: true });

/* 无头 Chromium 有个已知怪癖：进程里第一个页面的 canvas captureStream 采样不到画面，
   后面新开的页面就正常。先烧一个页面做预热，避免把环境问题误判成工具问题。 */
{
  const warm = await browser.newPage();
  await warm.goto(`${BASE}`, { waitUntil: 'load' });
  await warm.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(done => { recorder.onstop = done; });
    recorder.start(200);
    for (let i = 0; i < 20; i += 1) {
      ctx.fillStyle = `hsl(${i * 12},70%,50%)`;
      ctx.fillRect(0, 0, 320, 180);
      await new Promise(done => requestAnimationFrame(done));
    }
    recorder.stop();
    await stopped;
  }).catch(() => {});
  await warm.close();
}

const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });

/* 造一段带音轨的短视频，供视频类工具做输入；顺便验证一次「画布 + 音频 → WebM」链路 */
const CLIP = resolve(FIXTURES, 'clip.webm');
if (!existsSync(CLIP)) {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const dest = audio.createMediaStreamDestination();
    osc.frequency.value = 440; gain.gain.value = 0.15;
    osc.connect(gain).connect(dest); osc.start();
    const stream = canvas.captureStream(30);
    dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(done => { recorder.onstop = done; });
    recorder.start(200);
    const start = performance.now();
    await new Promise(done => {
      const frame = () => {
        const t = (performance.now() - start) / 1400;
        ctx.fillStyle = `hsl(${t * 240},65%,45%)`;
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
        ctx.fillText(`frame ${Math.round(t * 100)}`, 20, 100);
        if (t < 1) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
    osc.stop();
    recorder.stop();
    await stopped;
    await audio.close();
    const buffer = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  });
  writeFileSync(CLIP, Buffer.from(base64, 'base64'));
}

const f = name => resolve(FIXTURES, name);
const CASES = [
  { id: 'carousel-splitter', name: '长图切图', files: [f('photo.jpg')], before: async () => {
    await page.locator('.tool-body input[type="number"]').first().fill('3');
  }, expect: ['.zip'], magic: { '.zip': '504b0304' } },
  { id: 'photo-motion-maker', name: '镜头动画', files: [f('photo.jpg')], before: async () => {
    const nums = page.locator('.tool-body input[type="number"]');
    if (await nums.count()) await nums.first().fill('1');
  }, expect: ['.webm'], magic: { '.webm': '1a45dfa3' }, timeout: 60000 },
  { id: 'video-screenshot', name: '视频截帧', files: [f('clip.webm')], button: /截取/, expect: ['.png'], magic: { '.png': '89504e47' }, timeout: 60000 },
  { id: 'video-to-gif', name: '视频转 GIF', files: [f('clip.webm')], before: async () => {
    const nums = page.locator('.tool-body input[type="number"]');
    if (await nums.count() >= 2) { await nums.nth(0).fill('1'); await nums.nth(1).fill('6'); }
  }, expect: ['.gif'], magic: { '.gif': '47494638' }, timeout: 90000 },
  { id: 'video-to-audio', name: '视频转音频', files: [f('clip.webm')], expect: ['.wav', '.webm'], magic: { '.wav': '52494646', '.webm': '1a45dfa3' }, timeout: 90000 },
  { id: 'compress-video', name: '压缩视频', files: [f('clip.webm')], button: /开始压缩/, expect: ['.webm'], magic: { '.webm': '1a45dfa3' }, timeout: 90000 },
  { id: 'mp3-to-wav', name: '音频转 WAV', files: [f('tone.wav')], expect: ['.wav'], magic: { '.wav': '52494646' } },
  { id: 'wav-to-mp3', name: '有损音频导出', files: [f('tone.wav')], expect: ['.webm', '.m4a', '.mp4'], magic: { '.webm': '1a45dfa3' }, timeout: 60000 },
  { id: 'compress-pdf', name: '压缩 PDF', files: [f('sample.pdf')], expect: ['.pdf'], magic: { '.pdf': '25504446' }, timeout: 60000 },
  { id: 'merge-pdf', name: '合并 PDF', files: [f('sample.pdf'), f('sample.pdf')], expect: ['.pdf'], magic: { '.pdf': '25504446' } },
  { id: 'word-to-pdf', name: 'Word 转 PDF', files: [f('sample.docx')], expect: ['.pdf'], magic: { '.pdf': '25504446' } },
  { id: 'pdf-to-word', name: 'PDF 转 Word', files: [f('sample.pdf')], expect: ['.docx'], magic: { '.docx': '504b0304' }, timeout: 60000 },
];

const results = [];
for (const testCase of CASES) {
  pageErrors.length = 0;
  await page.goto(`${BASE}#/tool/${testCase.id}`, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const inputs = page.locator('.tool-body input[type="file"]');
  const count = await inputs.count();
  if (!count) {
    results.push({ ...testCase, ok: false, reason: '没有 file input' });
    continue;
  }
  const multiple = await inputs.first().evaluate(node => node.multiple);
  try {
    await inputs.first().setInputFiles(multiple ? testCase.files : testCase.files[0]);
  } catch (error) {
    results.push({ ...testCase, ok: false, reason: `上传失败：${error.message}` });
    continue;
  }
  await page.waitForTimeout(Math.min(1200, 400 + testCase.files.length * 200));

  if (testCase.before) {
    try { await testCase.before(); } catch { /* 参数可选 */ }
  }

  const button = page.locator('.tool-body button').filter({ hasText: testCase.button || /下载|打包|录制|合并|导出/ }).first();
  if (!(await button.count())) {
    results.push({ ...testCase, ok: false, reason: '找不到下载按钮' });
    continue;
  }

  const started = Date.now();
  let download = null;
  try {
    const [event] = await Promise.all([
      page.waitForEvent('download', { timeout: testCase.timeout || 30000 }),
      button.click(),
    ]);
    download = event;
  } catch (error) {
    results.push({ ...testCase, ok: false, reason: `未产生下载：${error.message.split('\n')[0]}`, elapsed: Date.now() - started });
    continue;
  }

  const filename = download.suggestedFilename();
  const path = resolve(OUT, filename);
  await download.saveAs(path).catch(() => {});
  let bytes = Buffer.alloc(0);
  try { bytes = readFileSync(path); } catch { /* ignore */ }
  const head = bytes.subarray(0, 4).toString('hex');
  const ext = '.' + filename.split('.').pop().toLowerCase();
  const magicOk = !testCase.magic[ext] || head === testCase.magic[ext];
  const extOk = testCase.expect.includes(ext);
  const sizeOk = bytes.length > 200;

  results.push({
    ...testCase, ok: magicOk && extOk && sizeOk, filename, size: bytes.length, head,
    elapsed: Date.now() - started,
    reason: !extOk ? `扩展名 ${ext} 不在预期` : !magicOk ? `文件头 ${head} 不符` : !sizeOk ? '文件过小' : '',
    errors: [...new Set(pageErrors)],
  });
  await page.waitForTimeout(300);
}

await page.close().catch(() => {});
await browser.close().catch(() => {});

let failed = 0;
console.log('\n下载类工具：');
for (const item of results) {
  if (!item.ok) failed += 1;
  console.log(`  ${item.ok ? '✓' : '✗'} ${item.id} ${item.ok ? `${item.filename} ${(item.size / 1024).toFixed(1)} KB 头=${item.head} ${item.elapsed}ms` : item.reason}`);
  if (item.errors?.length) console.log(`     控制台：${item.errors.join(' | ')}`);
}
console.log(`\n通过 ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

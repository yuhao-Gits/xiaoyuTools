/* 音频类补充：解码、BPM 估计、歌词波形与有损压缩导出。
   MP3 编码器为 LGPL，本项目不引入；压缩导出改用浏览器原生 MediaRecorder。 */
import {
  panel, inp, sel, txt, filePicker, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadBlob, downloadText, formatBytes,
} from '../../core/ui.js';
import {
  num, clamp, pad, decodeAudioFile, audioBufferToWav, audioContext, makeCanvas,
} from './shared.js';

function audioPicker(accept = 'audio/*') {
  return filePicker({ accept });
}

const mp3ToWav = {
  id: 'mp3-to-wav', name: 'MP3 转 WAV', category: 'audio',
  desc: '浏览器解码音频后导出 16 位 PCM WAV', keywords: ['mp3', 'wav', '转换', '解码', '音频'],
  render(root) {
    const picker = audioPicker('audio/*,.mp3,.m4a,.ogg,.flac,.wav');
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择音频文件'); return; }
      status.textContent = '正在本机解码…';
      try {
        const buffer = await decodeAudioFile(file);
        if (!buffer) { output.set('Web Audio 不可用'); return; }
        const blob = audioBufferToWav(buffer);
        downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.wav`);
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `采样率  ${buffer.sampleRate} Hz`,
          `声道    ${buffer.numberOfChannels}`,
          `时长    ${(buffer.duration).toFixed(2)} 秒`,
          `输出    16 位 PCM WAV  ${formatBytes(blob.size)}`,
          '',
          'WAV 为未压缩格式，体积通常明显大于源文件。',
        ].join('\n'));
        status.textContent = '已导出';
      } catch (error) {
        output.set(`解码失败：${error.message}\n该容器 / 编码可能不被当前浏览器支持，可尝试先转成 WAV 或 OGG。`);
        status.textContent = '';
      }
    };
    root.append(panel('选择音频', picker,
      actions(btn('转换并下载 WAV', run, 'primary')),
      output.node, status,
      hint('使用浏览器自带解码器（decodeAudioData），能读哪些格式取决于浏览器；不捆绑编解码器。')));
  },
};

const bpmDetector = {
  id: 'bpm-detector', name: 'BPM 检测器', category: 'audio',
  desc: '能量包络自相关估计节拍，另有手动 Tap', keywords: ['BPM', '节拍', '速度', '音频', 'tap'],
  render(root) {
    const picker = audioPicker();
    const big = el('strong', { text: '—' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let taps = [];

    const estimate = buffer => {
      const data = buffer.getChannelData(0);
      const hop = 1024;
      const energy = [];
      for (let i = 0; i + hop <= data.length; i += hop) {
        let sum = 0;
        for (let j = 0; j < hop; j += 1) sum += data[i + j] * data[i + j];
        energy.push(Math.sqrt(sum / hop));
      }
      const mean = energy.reduce((a, b) => a + b, 0) / (energy.length || 1);
      const onset = energy.map((v, i) => i ? Math.max(0, v - energy[i - 1]) : 0);
      const fps = buffer.sampleRate / hop;
      const minLag = Math.floor(fps * 60 / 200), maxLag = Math.ceil(fps * 60 / 60);
      let best = 0, bestLag = 0;
      for (let lag = minLag; lag <= maxLag && lag < onset.length; lag += 1) {
        let score = 0;
        for (let i = lag; i < onset.length; i += 1) score += onset[i] * onset[i - lag];
        if (score > best) { best = score; bestLag = lag; }
      }
      const bpm = bestLag ? 60 * fps / bestLag : 0;
      const normalized = bpm < 60 ? bpm * 2 : bpm > 200 ? bpm / 2 : bpm;
      const diff = onset.reduce((a, v, i) => a + (i ? Math.abs(v - onset[i - 1]) : 0), 0) / (onset.length || 1);
      return { bpm: normalized, raw: bpm, mean, diff };
    };
    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择音频文件'); return; }
      status.textContent = '正在本机分析…';
      try {
        const buffer = await decodeAudioFile(file);
        if (!buffer) { output.set('Web Audio 不可用'); return; }
        const result = estimate(buffer);
        big.textContent = result.bpm ? result.bpm.toFixed(1) : '—';
        output.set([
          `文件      ${file.name}`,
          `时长      ${buffer.duration.toFixed(2)} 秒`,
          `估计 BPM  ${result.bpm ? result.bpm.toFixed(1) : '未能确定'}`,
          `原始峰值  ${result.raw.toFixed(1)}（已按 60–200 区间折半 / 翻倍归一化）`,
          `平均能量  ${result.mean.toFixed(4)}`,
          `节奏强度  ${result.diff.toFixed(4)}（变化越明显越容易估计）`,
          '',
          '基于能量差分的自相关估计，适合节拍清晰的音乐；人声、自由节奏可能不准。',
        ].join('\n'));
        status.textContent = '分析完成';
      } catch (error) { output.set(`分析失败：${error.message}`); status.textContent = ''; }
    };
    const tap = () => {
      const now = performance.now();
      taps = [...taps.filter(t => now - t < 4000), now];
      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        big.textContent = (60000 / avg).toFixed(1);
      }
      output.set(`Tap ${taps.length} 次\n间隔：${taps.slice(1).map((t, i) => `${Math.round(t - taps[i])}ms`).join('  ')}\n\n连点 4 次以上取平均，4 秒无操作自动清空。`);
    };

    root.append(panel('节拍检测', picker,
      el('div', { class: 'now-box' }, el('div', { class: 'now-item' }, el('span', { text: 'BPM' }), big)),
      actions(btn('分析音频', run, 'primary'), btn('Tap 一下', tap),
        btn('清空 Tap', () => { taps = []; big.textContent = '—'; output.clear(); })),
      output.node, status,
      hint('不下载模型、不联网；解码能力取决于浏览器，分析结果仅供娱乐与练习参考。')));
  },
};

const lyricVisualizer = {
  id: 'lyric-visualizer', name: '歌词波形播放器', category: 'audio',
  desc: '本地音频 + LRC 歌词，波形与逐句高亮', keywords: ['歌词', '波形', '播放器', 'LRC', '音频'],
  render(root) {
    const picker = audioPicker();
    const lyrics = txt({ rows: 8, placeholder: '[00:00.00]第一句歌词\n[00:12.50]第二句歌词', value: '[00:00.00]♪ 前奏\n[00:10.00]把常用的小操作\n[00:20.00]收进一个页面里\n[00:30.00]打开就能用' });
    const audio = el('audio', { class: 'preview-audio', controls: true });
    const canvas = makeCanvas(720, 180);
    canvas.className = 'board-canvas';
    const view = el('div', { class: 'lyric-view' });
    const status = el('div', { class: 'status' });
    const output = resultBox();
    let ctx = null, analyser = null, raf = null, lines = [], url = null;

    const parseLrc = text => {
      const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)/;
      return text.split('\n').map(line => {
        const m = line.match(re);
        if (!m) return null;
        const ms = ((Number(m[1]) * 60) + Number(m[2])) * 1000 + Number((m[3] || '0').padEnd(3, '0'));
        return { time: ms, text: m[4].trim() };
      }).filter(Boolean).sort((a, b) => a.time - b.time);
    };
    const stop = () => {
      cancelAnimationFrame(raf); raf = null;
      audio.pause();
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
    };
    const play = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { toast('请先选择音频文件', 'warn'); return; }
      stop();
      url = URL.createObjectURL(file);
      audio.src = url;
      lines = parseLrc(lyrics.value);
      view.replaceChildren(...lines.map((l, i) => el('div', { class: 'lyric-line', 'data-i': i, text: l.text })));
      output.set(`载入 ${lines.length} 行歌词\n${lines.slice(0, 6).map(l => `${(l.time / 1000).toFixed(2)}s  ${l.text}`).join('\n')}`);
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctor();
        const source = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
        source.connect(analyser); analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.fftSize);
        const draw = () => {
          const c = canvas.getContext('2d');
          c.fillStyle = '#0f0f12'; c.fillRect(0, 0, canvas.width, canvas.height);
          analyser.getByteTimeDomainData(data);
          c.strokeStyle = '#8b8b96'; c.lineWidth = 1.5; c.beginPath();
          for (let i = 0; i < data.length; i += 1) {
            const x = i / data.length * canvas.width;
            const y = (data[i] / 128) * canvas.height / 2;
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          }
          c.stroke();
          const now = audio.currentTime * 1000;
          let active = -1;
          lines.forEach((l, i) => { if (now >= l.time) active = i; });
          view.querySelectorAll('.lyric-line').forEach((node, i) => {
            node.classList.toggle('is-on', i === active);
          });
          raf = requestAnimationFrame(draw);
        };
        await audio.play();
        draw();
        status.textContent = '播放中';
      } catch (error) {
        output.set(`播放失败：${error.message}\n常见原因是浏览器要求用户交互，或音频格式不受支持。`);
        status.textContent = '';
      }
    };
    audio.addEventListener('ended', () => { status.textContent = '播放结束'; });
    const cleanup = setInterval(() => { if (!audio.isConnected) { clearInterval(cleanup); stop(); } }, 500);

    root.append(panel('歌词波形', picker, lyrics,
      actions(btn('载入并播放', play, 'primary'), btn('停止', stop),
        btn('复制歌词', () => copyText(lyrics.value))),
      canvas, view, audio, output.node, status,
      hint('LRC 每行一条，时间格式 [mm:ss.xx]；波形由 AnalyserNode 实时绘制，不上传音频或歌词。')));
  },
};

const wavToMp3 = {
  id: 'wav-to-mp3', name: 'WAV 转 MP3', category: 'audio',
  desc: '降级实现：用浏览器原生编码导出 WebM/Opus', keywords: ['wav', 'mp3', '压缩', '音频', '编码'],
  render(root) {
    const picker = audioPicker('audio/wav,.wav,audio/*');
    const mime = sel([
      { value: 'audio/webm;codecs=opus', label: 'WebM / Opus（Chrome 常见）' },
      { value: 'audio/webm', label: 'WebM（自动编码）' },
      { value: 'audio/mp4', label: 'MP4 / AAC（Safari 常见）' },
    ], 'audio/webm;codecs=opus', null);
    const bitrate = inp({ type: 'range', min: '24000', max: '192000', step: '8000', value: '96000' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择 WAV 文件'); return; }
      const Rec = window.MediaRecorder;
      if (!Rec) { output.set('当前浏览器不支持 MediaRecorder，无法压缩导出。'); return; }
      let chosen = mime.value;
      if (Rec.isTypeSupported && !Rec.isTypeSupported(chosen)) {
        chosen = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => Rec.isTypeSupported(t)) || '';
      }
      if (!chosen) { output.set('浏览器没有可用的音频编码器，请在支持 WebM 或 MP4 录制的浏览器中打开。'); return; }
      try {
        const buffer = await (async () => {
          const ctx = audioContext();
          const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
          await ctx.close();
          return decoded;
        })();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createBufferSource(); source.buffer = buffer;
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);
        const recorder = new Rec(dest.stream, { mimeType: chosen, audioBitsPerSecond: num(bitrate.value, 96000) });
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          const ext = chosen.includes('mp4') ? 'm4a' : 'webm';
          const blob = new Blob(chunks, { type: chosen });
          downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
          output.set([
            `源文件    ${file.name}  ${formatBytes(file.size)}`,
            `时长      ${buffer.duration.toFixed(2)} 秒`,
            `输出      ${chosen}  ${formatBytes(blob.size)}`,
            `压缩比    ${(blob.size / file.size * 100).toFixed(1)}%`,
            '',
            '注意：本项目不引入 LGPL 的 MP3 编码器，因此输出的是浏览器原生有损编码（WebM/Opus 或 MP4/AAC），不是 MP3 文件。',
            '录制按音频实时时长进行，需保持页面打开。',
          ].join('\n'));
          status.textContent = '导出完成';
          ctx.close().catch(() => {});
        };
        source.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
        status.textContent = `编码中（约 ${buffer.duration.toFixed(0)} 秒）…`;
        recorder.start(250);
        source.start();
      } catch (error) {
        output.set(`处理失败：${error.message}`);
        status.textContent = '';
      }
    };
    root.append(panel('压缩导出', picker,
      el('div', { class: 'inline-fields' }, labeled('容器 / 编码', mime), labeled('目标码率', bitrate)),
      actions(btn('压缩并下载', run, 'primary')),
      output.node, status,
      hint('真正的 MP3 编码需要 LGPL 库，按本项目许可原则不引入；这里提供可运行的有损压缩替代，文件名后缀会如实反映实际格式。')));
  },
};

export const audioExtraTools = [mp3ToWav, bpmDetector, lyricVisualizer, wavToMp3];

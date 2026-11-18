/* 视频类补充：字幕修复、音轨提取、重编码压缩、GIF 导出。
   GIF 由 shared.js 中自行实现的 LZW 编码器生成，不引入第三方编码器。 */
import {
  panel, inp, sel, txt, filePicker, btn, actions, resultBox, hint, el,
  labeled, toast, copyText, downloadBlob, downloadText, formatBytes,
} from '../../core/ui.js';
import {
  num, clamp, pad, parseCues, formatCues, decodeAudioFile, audioBufferToWav,
  encodeGif, makeCanvas,
} from './shared.js';

const subtitleRepair = {
  id: 'subtitle-repair', name: '字幕检查与同步修复', category: 'video',
  desc: 'SRT / VTT 解析、偏移、变速、去重与格式互转', keywords: ['字幕', 'SRT', 'VTT', '同步', '时间轴'],
  render(root) {
    const source = txt({ rows: 9, placeholder: '粘贴 SRT 或 WebVTT 字幕…', value: '1\n00:00:01,000 --> 00:00:03,500\n第一句\n\n2\n00:00:03,200 --> 00:00:06,000\n第二句\n' });
    const offset = inp({ type: 'number', value: '0', step: '100' });
    const speed = inp({ type: 'range', min: '50', max: '200', step: '1', value: '100' });
    const minDuration = inp({ type: 'number', value: '300', min: '0', step: '100' });
    const mergeGap = inp({ type: 'number', value: '0', min: '0', max: '2000', step: '50' });
    const fixOverlap = el('input', { type: 'checkbox', checked: true });
    const format = sel([{ value: 'srt', label: 'SRT' }, { value: 'vtt', label: 'WebVTT' }, { value: 'lrc', label: 'LRC' }], 'srt', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let rendered = '';

    const run = () => {
      const cues = parseCues(source.value);
      if (!cues.length) { output.set('未解析到字幕块，请检查时间行格式（HH:MM:SS,mmm --> HH:MM:SS,mmm）。'); return; }
      const shift = num(offset.value, 0), rate = clamp(num(speed.value, 100), 50, 200) / 100;
      const issues = [];
      let overlap = 0;
      cues.forEach((c, i) => {
        if (i && c.start < cues[i - 1].end) { overlap += 1; }
        if (c.end <= c.start) issues.push(`第 ${i + 1} 条结束时间不晚于开始时间`);
      });
      let list = cues.map(c => ({
        start: Math.max(0, Math.round((c.start * rate) + shift)),
        end: Math.max(0, Math.round((c.end * rate) + shift)),
        text: c.text,
      }));
      const minD = clamp(num(minDuration.value, 300), 0, 10000);
      list.forEach(c => { if (c.end - c.start < minD) c.end = c.start + minD; });
      if (fixOverlap.checked) {
        for (let i = 1; i < list.length; i += 1) {
          if (list[i].start < list[i - 1].end) {
            list[i - 1].end = Math.max(list[i - 1].start + 1, list[i].start);
          }
        }
      }
      const gap = clamp(num(mergeGap.value, 0), 0, 2000);
      if (gap > 0) {
        const merged = [];
        for (const c of list) {
          const prev = merged[merged.length - 1];
          if (prev && c.start - prev.end <= gap) {
            prev.end = Math.max(prev.end, c.end);
            prev.text += `\n${c.text}`;
          } else merged.push({ ...c });
        }
        list = merged;
      }
      rendered = formatCues(list, format.value);
      output.set([
        `解析 ${cues.length} 条 → 输出 ${list.length} 条`,
        `原始重叠 ${overlap} 处${fixOverlap.checked ? '（已修正）' : '（未修正）'}`,
        `偏移 ${shift >= 0 ? '+' : ''}${shift} ms · 速度 ${(rate * 100).toFixed(0)}% · 最短显示 ${minD} ms`,
        issues.length ? `异常：\n${issues.slice(0, 6).join('\n')}` : '未发现倒序时间轴',
        '',
        '── 输出预览 ──',
        rendered.slice(0, 1200),
      ].join('\n'));
      status.textContent = `已生成 ${format.value.toUpperCase()}`;
    };

    root.append(panel('字幕处理', source,
      el('div', { class: 'inline-fields' },
        labeled('整体偏移 ms', offset), labeled('速度 %', speed),
        labeled('最短显示 ms', minDuration), labeled('合并间隔 ms', mergeGap),
        labeled('修复重叠', fixOverlap), labeled('输出格式', format)),
      actions(btn('检查并修复', run, 'primary'),
        btn('复制结果', () => copyText(rendered)),
        btn('下载字幕', () => downloadText(rendered, `subtitles.${format.value === 'lrc' ? 'lrc' : format.value}`, 'text/plain;charset=utf-8'))),
      output.node, status,
      hint('纯文本解析；不会重新编码视频，也不做语音识别或翻译。LRC 输出会合并多行文本。')));
  },
};

const videoToAudio = {
  id: 'video-to-audio', name: '视频转音频', category: 'video',
  desc: '提取音轨为 WAV，或录制为 WebM 音频', keywords: ['视频', '音频', '提取', '音轨', '转换'],
  render(root) {
    const picker = filePicker({ accept: 'video/*' });
    const video = el('video', { class: 'preview-video', playsinline: true });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let url = null, ctx = null, recorder = null;

    const cleanup = () => {
      if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* noop */ } }
      recorder = null;
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
      video.pause();
      if (url) { URL.revokeObjectURL(url); url = null; }
    };
    const extract = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择视频文件'); return; }
      status.textContent = '正在尝试直接解码音轨…';
      try {
        const buffer = await decodeAudioFile(file);
        if (!buffer) { output.set('Web Audio 不可用'); return; }
        const blob = audioBufferToWav(buffer);
        downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.wav`);
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `音轨    ${buffer.numberOfChannels} 声道 / ${buffer.sampleRate} Hz / ${buffer.duration.toFixed(2)} 秒`,
          `输出    16 位 PCM WAV  ${formatBytes(blob.size)}`,
        ].join('\n'));
        status.textContent = '已导出 WAV';
      } catch {
        output.set('浏览器无法直接解码该容器的音轨。\n请改用下方的「录制音轨」：它会播放视频并录制声音，输出 WebM/Opus（需要按视频时长实时等待）。');
        status.textContent = '直接解码不可用';
      }
    };
    const record = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择视频文件'); return; }
      const Rec = window.MediaRecorder;
      if (!Rec) { output.set('当前浏览器不支持 MediaRecorder'); return; }
      cleanup();
      url = URL.createObjectURL(file);
      video.src = url; video.muted = false;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(video);
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest); source.connect(ctx.destination);
        const mime = Rec.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        recorder = new Rec(dest.stream, { mimeType: mime });
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.webm`);
          output.set(`已录制 ${formatBytes(blob.size)}，格式 ${mime}\n注意：录制按视频实时时长进行。`);
          status.textContent = '录制完成';
          cleanup();
        };
        video.onended = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };
        await video.play();
        recorder.start(250);
        status.textContent = `录制中，时长约 ${(video.duration || 0).toFixed(0)} 秒…`;
      } catch (error) {
        cleanup();
        output.set(`录制失败：${error.message}`);
        status.textContent = '';
      }
    };
    const cleanupTimer = setInterval(() => { if (!video.isConnected) { clearInterval(cleanupTimer); cleanup(); } }, 500);

    root.append(panel('选择视频', picker,
      actions(btn('提取为 WAV', extract, 'primary'), btn('录制音轨为 WebM', record), btn('停止', cleanup)),
      video, output.node, status,
      hint('能否解码视频里的音轨取决于浏览器；录制模式会实时播放一次视频，不上传文件。')));
  },
};

const compressVideo = {
  id: 'compress-video', name: '压缩视频', category: 'video',
  desc: '降级实现：降分辨率 / 码率重录为 WebM', keywords: ['压缩', '视频', '转码', 'WebM', '体积'],
  render(root) {
    const picker = filePicker({ accept: 'video/*' });
    const width = sel([{ value: '480', label: '480 px' }, { value: '640', label: '640 px' }, { value: '854', label: '854 px' }, { value: '1280', label: '1280 px' }], '640', null);
    const fps = sel([{ value: '15', label: '15 fps' }, { value: '24', label: '24 fps' }, { value: '30', label: '30 fps' }], '24', null);
    const bitrate = inp({ type: 'range', min: '200000', max: '4000000', step: '100000', value: '900000' });
    const keepAudio = el('input', { type: 'checkbox', checked: true });
    const video = el('video', { class: 'preview-video', playsinline: true, muted: true });
    const canvas = makeCanvas(640, 360);
    canvas.className = 'board-canvas';
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let url = null, recorder = null, raf = null;

    const cleanup = () => {
      cancelAnimationFrame(raf); raf = null;
      if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* noop */ } }
      recorder = null; video.pause();
      if (url) { URL.revokeObjectURL(url); url = null; }
    };
    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择视频文件'); return; }
      const Rec = window.MediaRecorder;
      if (!Rec || !canvas.captureStream || !video.captureStream) {
        output.set('当前浏览器不支持 MediaRecorder / captureStream，无法在本机重编码。');
        return;
      }
      cleanup();
      url = URL.createObjectURL(file);
      video.src = url; video.muted = true;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('视频无法解码'));
      }).catch(error => { output.set(error.message); cleanup(); return; });
      if (!video.videoWidth) { cleanup(); return; }
      const w = Math.min(Number(width.value), video.videoWidth);
      const h = Math.max(1, Math.round(video.videoHeight * w / video.videoWidth));
      canvas.width = w; canvas.height = h;
      const rate = Number(fps.value);
      const stream = canvas.captureStream(rate);
      if (keepAudio.checked && typeof video.captureStream === 'function') {
        try {
          for (const track of video.captureStream().getAudioTracks()) stream.addTrack(track);
        } catch { /* 音轨不可用时忽略 */ }
      }
      const mime = Rec.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      recorder = new Rec(stream, { mimeType: mime, videoBitsPerSecond: num(bitrate.value, 900000) });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (!blob.size) {
          output.set('浏览器编码器没有产出任何画面（多见于首次调用编码器时）。\n请再点一次「开始压缩」。');
          status.textContent = '压缩无输出';
          cleanup();
          return;
        }
        downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}-compressed.webm`);
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `原尺寸  ${video.videoWidth}×${video.videoHeight}`,
          `输出    ${w}×${h} / ${rate} fps  ${formatBytes(blob.size)}（${(blob.size / file.size * 100).toFixed(1)}%）`,
          `编码    ${mime}${keepAudio.checked ? '（尝试保留音轨）' : '（静音）'}`,
          '',
          '这是按实时播放时长重录的原生编码结果，输出 WebM 而非 MP4；不引入 LGPL / GPL 编码器。',
        ].join('\n'));
        status.textContent = '导出完成';
        cleanup();
      };
      const ctx = canvas.getContext('2d');
      const loop = () => {
        if (!video.paused && !video.ended) ctx.drawImage(video, 0, 0, w, h);
        raf = requestAnimationFrame(loop);
      };
      video.onended = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };
      try {
        await video.play();
        recorder.start(250); loop();
        status.textContent = `重录中，时长约 ${(video.duration || 0).toFixed(0)} 秒…`;
      } catch (error) { cleanup(); output.set(`失败：${error.message}`); }
    };
    const cleanupTimer = setInterval(() => { if (!video.isConnected) { clearInterval(cleanupTimer); cleanup(); } }, 500);

    root.append(panel('压缩参数', picker,
      el('div', { class: 'inline-fields' }, labeled('输出宽度', width), labeled('帧率', fps),
        labeled('目标码率', bitrate), labeled('保留音轨', keepAudio)),
      actions(btn('开始压缩', run, 'primary'), btn('停止', cleanup)),
      canvas, video, output.node, status,
      hint('浏览器原生编码器按实时时长重录，需保持页面打开；能否解码源视频、是否有音轨取决于浏览器。')));
  },
};

const videoToGif = {
  id: 'video-to-gif', name: '视频转 GIF', category: 'video',
  desc: '逐帧截取并用自研 LZW 编码器导出 GIF', keywords: ['GIF', '动图', '视频', '截帧', '转换'],
  render(root) {
    const picker = filePicker({ accept: 'video/*' });
    const start = inp({ type: 'number', value: '0', min: '0', step: '0.1' });
    const seconds = inp({ type: 'number', value: '3', min: '0.2', max: '20', step: '0.1' });
    const fps = sel([{ value: '8', label: '8 fps' }, { value: '10', label: '10 fps' }, { value: '12', label: '12 fps' }, { value: '15', label: '15 fps' }], '10', null);
    const width = sel([{ value: '240', label: '240 px' }, { value: '320', label: '320 px' }, { value: '480', label: '480 px' }], '320', null);
    const video = el('video', { class: 'preview-video', playsinline: true, muted: true });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let url = null, busy = false;

    const run = async () => {
      const file = picker.files && picker.files[0];
      if (!file) { output.set('请先选择视频文件'); return; }
      if (busy) return;
      busy = true;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(file);
      video.src = url; video.muted = true;
      try {
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error('视频无法解码'));
        });
        const from = clamp(num(start.value, 0), 0, Math.max(0, video.duration - 0.1));
        const length = clamp(num(seconds.value, 3), 0.2, 20);
        const rate = Number(fps.value);
        const count = Math.min(120, Math.max(2, Math.round(length * rate)));
        const w = Math.min(Number(width.value), video.videoWidth || Number(width.value));
        const h = Math.max(1, Math.round((video.videoHeight || w * 0.56) * w / (video.videoWidth || w)));
        const canvas = makeCanvas(w, h);
        const ctx = canvas.getContext('2d');
        const frames = [];
        status.textContent = `正在截取 ${count} 帧…`;
        for (let i = 0; i < count; i += 1) {
          const t = Math.min(video.duration || from + length, from + i / rate);
          await new Promise(resolve => {
            const done = () => { video.removeEventListener('seeked', done); resolve(); };
            video.addEventListener('seeked', done);
            video.currentTime = t;
            setTimeout(done, 1500);
          });
          ctx.drawImage(video, 0, 0, w, h);
          frames.push(ctx.getImageData(0, 0, w, h).data.slice());
        }
        status.textContent = '正在编码 GIF…';
        const blob = encodeGif(frames, w, h, Math.round(100 / rate));
        downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}.gif`);
        output.set([
          `源文件  ${file.name}  ${formatBytes(file.size)}`,
          `片段    ${from.toFixed(2)}s → ${(from + count / rate).toFixed(2)}s`,
          `帧数    ${count} 帧 / ${rate} fps · ${w}×${h}`,
          `输出    GIF  ${formatBytes(blob.size)}`,
          '',
          'GIF 由本项目自写的 LZW 编码器生成，使用 256 色全局调色板；颜色会有量化损失。',
        ].join('\n'));
        status.textContent = '导出完成';
      } catch (error) {
        output.set(`失败：${error.message}`);
        status.textContent = '';
      } finally {
        busy = false;
      }
    };
    root.append(panel('GIF 参数', picker,
      el('div', { class: 'inline-fields' }, labeled('起始秒', start), labeled('时长秒', seconds),
        labeled('帧率', fps), labeled('宽度', width)),
      actions(btn('截取并导出 GIF', run, 'primary')),
      video, output.node, status,
      hint('逐帧 seek + Canvas 取样，帧数上限 120；编码全部在本机完成，不上传视频。')));
  },
};

export const videoExtraTools = [subtitleRepair, videoToAudio, compressVideo, videoToGif];

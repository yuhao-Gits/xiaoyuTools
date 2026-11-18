import { panel, inp, sel, btn, actions, resultBox, hint, el, toast } from '../../core/ui.js';

const getCtx = () => {
  const Ctx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) { toast('当前浏览器不支持 Web Audio', 'warn'); return null; }
  return new Ctx();
};

const metronome = {
  id: 'metronome',
  name: '节拍器',
  category: 'audio',
  desc: '30–300 BPM，支持 Tap Tempo',
  keywords: ['节拍', 'BPM', 'metronome', '节奏'],
  render(root) {
    const bpmInput = inp({ type: 'number', value: '120', min: '30', max: '300', step: '1' });
    const beats = sel([{ value: '4', label: '4/4' }, { value: '3', label: '3/4' }, { value: '2', label: '2/4' }], '4', null);
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let ctx = null, timer = null, count = 0, taps = [];

    const bpm = () => Math.max(30, Math.min(300, Number(bpmInput.value) || 120));
    const click = (accent) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 980 : 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.28 : 0.16, ctx.currentTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    };
    const tick = () => {
      if (!status.isConnected) { stop(); return; }
      const perBeat = Number(beats.value) || 4;
      click(count % perBeat === 0);
      count += 1;
      status.textContent = `第 ${count} 拍 · ${bpm()} BPM`;
    };
    const start = () => {
      if (timer !== null) return;
      ctx = getCtx();
      if (!ctx) return;
      count = 0;
      timer = setInterval(tick, 60000 / bpm());
      tick();
      status.textContent = `运行中 · ${bpm()} BPM`;
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (ctx) { ctx.close(); ctx = null; }
      status.textContent = '已停止';
    };
    const restart = () => { if (timer !== null) { stop(); start(); } };
    bpmInput.addEventListener('input', restart);
    beats.addEventListener('change', restart);

    const tap = () => {
      const now = performance.now();
      taps = [...taps.filter(t => now - t < 2500), now].slice(-5);
      if (taps.length < 2) { output.set('继续敲击以估算速度…'); return; }
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const estimated = Math.round(60000 / avg);
      bpmInput.value = String(Math.max(30, Math.min(300, estimated)));
      output.set(`最近 ${taps.length} 次敲击 → 约 ${bpm()} BPM`);
      restart();
    };

    root.append(panel('节拍',
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '速度 BPM' }), bpmInput),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '拍号' }), beats)),
      actions(btn('开始', start, 'primary'), btn('停止', stop), btn('Tap Tempo', tap)),
      status, output.node,
      hint('声音由 Web Audio 振荡器实时合成，重拍音高更高；无音频文件、无网络请求。')));
  },
};

const NOISE_PRESETS = {
  white: { kind: 'white', filter: 0, freq: 0, label: '白噪音' },
  brown: { kind: 'brown', filter: 0, freq: 0, label: '棕噪音' },
  pink: { kind: 'pink', filter: 0, freq: 0, label: '粉噪音' },
  rain: { kind: 'white', filter: 'lowpass', freq: 2200, label: '雨声' },
  wind: { kind: 'brown', filter: 'lowpass', freq: 700, label: '风声' },
  waves: { kind: 'pink', filter: 'lowpass', freq: 1100, label: '海浪' },
  thunder: { kind: 'brown', filter: 'lowpass', freq: 180, label: '闷雷' },
};

function makeNoiseBuffer(ctx, kind, seconds = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    } else if (kind === 'pink') {
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
    } else {
      data[i] = white * 0.55;
    }
  }
  // 首尾淡入淡出，循环时不会出现爆音
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    data[i] *= k;
    data[length - 1 - i] *= k;
  }
  return buffer;
}

const noiseGenerator = {
  id: 'noise-generator',
  name: '环境噪音',
  category: 'audio',
  desc: '白 / 棕 / 粉噪音与雨、风、海浪、闷雷',
  keywords: ['白噪音', '助眠', '噪音', 'rain', 'noise'],
  render(root) {
    const preset = sel(Object.entries(NOISE_PRESETS).map(([value, p]) => ({ value, label: p.label })), 'rain', null);
    const volume = inp({ type: 'range', min: '0', max: '100', value: '45' });
    const status = el('div', { class: 'status' });
    let ctx = null, source = null, gain = null;

    const stop = () => {
      if (source) { try { source.stop(); } catch { /* 已停止 */ } source = null; }
      if (ctx) { ctx.close(); ctx = null; }
      status.textContent = '已停止';
    };
    const start = () => {
      stop();
      ctx = getCtx();
      if (!ctx) return;
      const config = NOISE_PRESETS[preset.value] || NOISE_PRESETS.rain;
      source = ctx.createBufferSource();
      source.buffer = makeNoiseBuffer(ctx, config.kind);
      source.loop = true;
      gain = ctx.createGain();
      gain.gain.value = Number(volume.value) / 100 * 0.5;
      let tail = source;
      if (config.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = config.filter;
        filter.frequency.value = config.freq;
        source.connect(filter);
        tail = filter;
      }
      tail.connect(gain).connect(ctx.destination);
      source.start();
      status.textContent = `播放中：${config.label}`;
    };

    preset.addEventListener('change', () => { if (ctx) start(); });
    volume.addEventListener('input', () => { if (gain) gain.gain.value = Number(volume.value) / 100 * 0.5; });

    root.append(panel('环境声',
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '声音' }), preset),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '音量' }), volume)),
      actions(btn('播放', start, 'primary'), btn('停止', stop)),
      status,
      hint('噪声样本在本机用随机数实时生成并循环，滤波塑造不同环境声；不含任何音频素材文件。')));
  },
};

const textToSpeech = {
  id: 'text-to-speech',
  name: '文本朗读（本地）',
  category: 'audio',
  desc: '用浏览器内置语音引擎朗读，不联网调用 AI 服务',
  keywords: ['TTS', '朗读', '语音', 'speech'],
  render(root) {
    const input = document.createElement('textarea');
    input.className = 'input textarea';
    input.placeholder = '输入要朗读的文字…';
    const rate = inp({ type: 'range', min: '0.5', max: '2', step: '0.1', value: '1' });
    const pitch = inp({ type: 'range', min: '0', max: '2', step: '0.1', value: '1' });
    const voices = (typeof window !== 'undefined' && window.speechSynthesis)
      ? window.speechSynthesis.getVoices() : [];
    const voiceSel = sel([
      { value: '', label: '系统默认' },
      ...voices.map((v, i) => ({ value: String(i), label: `${v.name} (${v.lang})` })),
    ], '', null);
    const status = el('div', { class: 'status' });

    const speak = () => {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        status.textContent = '当前浏览器不支持语音合成';
        return;
      }
      if (!input.value.trim()) { status.textContent = '请输入文字'; return; }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(input.value);
      utterance.rate = Number(rate.value);
      utterance.pitch = Number(pitch.value);
      const chosen = voices[Number(voiceSel.value)];
      if (chosen) utterance.voice = chosen;
      utterance.onend = () => { status.textContent = '朗读结束'; };
      synth.speak(utterance);
      status.textContent = '朗读中…（由浏览器 / 系统语音引擎提供）';
    };

    root.append(panel('朗读',
      input,
      el('div', { class: 'inline-fields' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '语音' }), voiceSel),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '语速' }), rate),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: '音调' }), pitch)),
      actions(btn('朗读', speak, 'primary'), btn('停止', () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        status.textContent = '已停止';
      })),
      status,
      hint('这是 AI 神经语音服务的本地替代：音色由系统提供、数量有限，本项目不调用任何在线 TTS 接口。')));
  },
};

export const audioTools = [metronome, noiseGenerator, textToSpeech];

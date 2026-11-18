import { panel, filePicker, inp, btn, actions, resultBox, hint, el, toast, downloadBlob, formatBytes } from '../../core/ui.js';

const videoScreenshot = {
  id: 'video-screenshot',
  name: '视频截帧',
  category: 'video',
  desc: '选择本地视频，按时间点导出 PNG 画面',
  keywords: ['视频', '截图', '截帧', 'video', '画面'],
  render(root) {
    const picker = filePicker({ accept: 'video/*' });
    const video = el('video', { class: 'preview-video', controls: true, playsinline: true });
    const seek = inp({ type: 'range', min: '0', max: '100', step: '0.1', value: '0' });
    const output = resultBox();
    const status = el('div', { class: 'status' });
    let objectUrl = null;

    picker.addEventListener('change', () => {
      const file = (picker.files || [])[0];
      if (!file) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      status.textContent = `已载入 ${file.name}（${formatBytes(file.size)}）`;
    });
    video.addEventListener('loadedmetadata', () => {
      seek.max = String(video.duration || 100);
      seek.value = '0';
      output.set(`时长 ${video.duration.toFixed(2)} 秒 · 分辨率 ${video.videoWidth}×${video.videoHeight}`);
    });
    seek.addEventListener('input', () => {
      if (Number.isFinite(video.duration)) video.currentTime = Number(seek.value);
    });
    video.addEventListener('timeupdate', () => {
      if (document.activeElement !== seek) seek.value = String(video.currentTime || 0);
    });

    const capture = () => {
      if (!video.videoWidth) { output.set('请先载入可解码的视频'); return; }
      const canvas = el('canvas', { width: video.videoWidth, height: video.videoHeight });
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { toast('截图失败', 'warn'); return; }
        downloadBlob(blob, `frame-${video.currentTime.toFixed(2)}s.png`);
        output.set(`已导出 ${video.videoWidth}×${video.videoHeight} 画面，时间点 ${video.currentTime.toFixed(2)} 秒`);
      }, 'image/png');
    };

    root.append(panel('选择视频', picker, video,
      el('label', { class: 'field' }, el('span', { class: 'field-label', text: '时间轴（秒）' }), seek),
      actions(btn('截取当前帧', capture, 'primary'), btn('播放 / 暂停', () => {
        if (video.paused) video.play(); else video.pause();
      })),
      output.node, status,
      hint('能否解码取决于浏览器对该视频编码的支持；视频只在本机读取，不上传。')));
  },
};

export const videoTools = [videoScreenshot];

/* 工具实现汇总。每加一个工具模块，在这里 import 一次并放进 groups 即可，
   卡片、搜索、路由、收藏全部自动更新。
   脚手架：node scripts/new-tool.mjs <id> <category> "名称" "说明" */

import { devTools } from './dev.js';
import { textTools } from './text.js';
import { calcTools } from './calc.js';
import { imageTools } from './image.js';
import { calcExtraTools } from './modules/calc-extra.js';
import { textExtraTools } from './modules/text-extra.js';
import { timeTools } from './modules/time.js';
import { audioTools } from './modules/audio.js';
import { videoTools } from './modules/video.js';
import { creativeTools } from './modules/creative.js';
import { pdfTools } from './modules/pdf.js';
import { aiLocalTools } from './modules/ai-local.js';
import { imageExtraTools } from './modules/image-extra.js';
import { imageAdvancedTools } from './modules/image-advanced.js';
import { creativeRandomTools } from './modules/creative-random.js';
import { creativeGameTools } from './modules/creative-games.js';
import { creativeGenTools } from './modules/creative-gen.js';
import { creativeGen2Tools } from './modules/creative-gen2.js';
import { calcExtra2Tools } from './modules/calc-extra2.js';
import { timeExtraTools } from './modules/time-extra.js';
import { textExtra2Tools } from './modules/text-extra2.js';
import { audioExtraTools } from './modules/audio-extra.js';
import { videoExtraTools } from './modules/video-extra.js';
import { pdfExtraTools } from './modules/pdf-extra.js';
import { pdfToWordTools } from './modules/pdf-to-word.js';
import { financeTools } from './modules/finance.js';
import { imageProTools } from './modules/image-pro.js';
import { imageEditTools } from './modules/image-edit.js';
import { exifDpiTools } from './modules/exif-dpi.js';
import { gifProTools } from './modules/gif-pro.js';

// __NEW_TOOL_IMPORT__

const groups = [
  devTools, textTools, calcTools, imageTools,
  calcExtraTools, textExtraTools, timeTools, audioTools,
  videoTools, creativeTools, pdfTools, aiLocalTools,
  imageExtraTools, imageAdvancedTools,
  creativeRandomTools, creativeGameTools, creativeGenTools, creativeGen2Tools,
  calcExtra2Tools, timeExtraTools, textExtra2Tools,
  audioExtraTools, videoExtraTools, pdfExtraTools, pdfToWordTools,
  financeTools,
  imageProTools, imageEditTools, exifDpiTools, gifProTools,
  // __NEW_TOOL_GROUP__
];

export const IMPLEMENTATIONS = new Map();

for (const group of groups) {
  for (const tool of group) {
    if (!tool || !tool.id || !tool.name || !tool.category || typeof tool.render !== 'function') {
      throw new Error(`工具定义缺少必填字段：${JSON.stringify(tool && tool.id)}`);
    }
    if (IMPLEMENTATIONS.has(tool.id)) {
      throw new Error(`工具 id 重复：${tool.id}`);
    }
    IMPLEMENTATIONS.set(tool.id, tool);
  }
}

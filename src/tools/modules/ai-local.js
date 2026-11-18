/* 离线互动内容：本地状态机驱动的分支剧情，不调用任何模型、不发请求。
   剧本为本项目独立编写。 */
import { panel, btn, resultBox, hint, el } from '../../core/ui.js';

const SCENES = {
  start: {
    text: '傍晚，你在旧车站下车。站台上只剩一盏灯，值班室里有一张没写完的纸条：「最后一班车改到 23:40」。你口袋里有 12 枚硬币。',
    choices: [
      { label: '留在站台等末班车', to: 'platform' },
      { label: '沿小路去镇上', to: 'town' },
      { label: '先看那张纸条背面', to: 'note' },
    ],
  },
  platform: {
    text: '风把时刻表吹得哗哗响。长椅下有枚旧徽章，远处有人提着灯走来。',
    choices: [
      { label: '捡起徽章', to: 'badge' },
      { label: '向来人问路', to: 'ending-light' },
      { label: '继续等车', to: 'ending-wait' },
    ],
  },
  town: {
    text: '镇口的小店还亮着，老板说能用硬币换一份夜宵，也能换一条关于旧车站的消息。',
    choices: [
      { label: '买夜宵（-3）', to: 'ending-meal' },
      { label: '买消息（-5）', to: 'note' },
      { label: '不花钱，回车站', to: 'platform' },
    ],
  },
  note: {
    text: '纸条背面画着一条穿过树林的捷径，末尾写着：「别等到灯灭。」',
    choices: [
      { label: '走捷径', to: 'ending-shortcut' },
      { label: '把纸条收好，回站台', to: 'platform' },
    ],
  },
  badge: { text: '徽章背面刻着一个名字，和你纸条上的落款一样。灯灭了一瞬。', choices: [{ label: '回到值班室', to: 'ending-light' }] },
  'ending-light': { text: '结局 · 灯下：来人是守站人，他记得每一班错过的车，也记得你。这一晚你没有赶路，却把问题想明白了。', choices: [] },
  'ending-wait': { text: '结局 · 等待：末班车没有来，但天亮时你发现自己并不着急。有时候原地也是一种选择。', choices: [] },
  'ending-meal': { text: '结局 · 夜宵：热汤下肚，老板多送了你一句：「捷径是给认得路的人走的。」你决定慢慢来。', choices: [] },
  'ending-shortcut': { text: '结局 · 捷径：树林比想象中短，灯灭之前你到了镇上。快，但错过了路上的徽章。', choices: [] },
};

const adventure = {
  id: 'ai-text-adventure',
  name: '文字冒险',
  category: 'creative',
  desc: '离线分支剧情，含金币与随机事件',
  keywords: ['文字冒险', '剧情', 'adventure', '互动', '游戏'],
  render(root) {
    const output = resultBox();
    const choices = el('div', { class: 'panel-actions' });
    const status = el('div', { class: 'status' });
    let scene = 'start', gold = 12, steps = 0;

    const show = () => {
      const current = SCENES[scene];
      const event = Math.random() < 0.28 ? (Math.random() < 0.5 ? 2 : -1) : 0;
      gold += event;
      const eventLine = event ? `\n\n【随机事件】${event > 0 ? '路边捡到 2 枚硬币' : '不小心掉了 1 枚硬币'}（当前 ${gold} 枚）` : '';
      output.set(`${current.text}${eventLine}\n\n—— 第 ${steps + 1} 步 · ${gold} 枚硬币 ——`);
      choices.replaceChildren(...(current.choices.length
        ? current.choices.map(choice => btn(choice.label, () => {
          if (choice.label.includes('-3')) gold -= 3;
          if (choice.label.includes('-5')) gold -= 5;
          scene = choice.to; steps += 1; show();
        }))
        : [btn('重新开始', () => { scene = 'start'; gold = 12; steps = 0; show(); }, 'primary')]));
      status.textContent = current.choices.length ? '选择一个行动' : '故事结束，可重新开始';
    };
    show();

    root.append(panel('离线剧情', output.node, choices, status,
      hint('剧情、分支与随机事件全部由本地状态机驱动，剧本为本项目自写，不调用任何模型。')));
  },
};

export const aiLocalTools = [adventure];
/**
 * 关卡界面渲染器（PRD v1.3 更新版）
 * 根据 PRD.md 第十八章节设计
 * - 顶部栏：关卡编号、子关卡节点、2x2功能区
 * - 进度显示：动物头像 + 进度百分比
 * - 棋盘区域：木质桌面背景
 * - 底部道具栏：4个圆角矩形按钮
 */

import PropButton from './PropButton';
import { 
  COLORS, 
  LAYOUT, 
  FONT_SIZES, 
  BUTTON_SIZES, 
  PROP_TYPES,
  drawRoundRect, 
  getBoardRect 
} from './UIConstants';

export default class GameRenderer {
  constructor() {
    // 道具按钮（4个）
    this.propButtons = {};

    // 顶部功能按钮区域
    this.topButtons = {
      settings: null,
      refresh: null,
      background: null,
      pureColor: null
    };

    // 子关卡节点
    this.subLevelNodes = [];

    // 按钮区域
    this.settingsButtonArea = null;
  }

  /**
   * 初始化道具按钮（4个圆角矩形按钮 - 更大更醒目）
   */
  initPropButtons(items) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const bottomY = screenHeight - LAYOUT.BOTTOM_BAR_HEIGHT / 2 - 12; // 上移，留出标签空间
    const buttonSpacing = 8;   // 按钮间距
    const buttonSize = BUTTON_SIZES.PROP;
    
    // 4个按钮的总宽度
    const totalWidth = buttonSize * 4 + buttonSpacing * 3;
    const startX = (screenWidth - totalWidth) / 2 + buttonSize / 2;

    // 抓走道具（蓝色）
    this.propButtons.grab = new PropButton(
      PROP_TYPES.GRAB,
      items.grab || 0,
      startX,
      bottomY
    );

    // 翻转道具（黄色）
    this.propButtons.flip = new PropButton(
      PROP_TYPES.FLIP,
      items.flip || 0,
      startX + buttonSize + buttonSpacing,
      bottomY
    );

    // 洗牌道具-位置（紫色）
    this.propButtons.shufflePos = new PropButton(
      PROP_TYPES.SHUFFLE_POS,
      items.shufflePos || items.shuffle || 0,
      startX + (buttonSize + buttonSpacing) * 2,
      bottomY
    );

    // 洗牌道具-方向（粉紫色）
    this.propButtons.shuffleDir = new PropButton(
      PROP_TYPES.SHUFFLE_DIR,
      items.shuffleDir || 0,
      startX + (buttonSize + buttonSpacing) * 3,
      bottomY
    );
  }

  /**
   * 更新道具数量
   */
  updatePropCount(type, count) {
    if (this.propButtons[type]) {
      this.propButtons[type].updateCount(count);
    }
  }

  /**
   * 渲染游戏界面
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {GameDataBus} databus - 游戏数据总线
   * @param {string} propMode - 当前道具模式（'grab' | null）
   */
  render(ctx, databus, propMode = null) {
    // 绘制背景
    this.drawBackground(ctx);

    // 绘制顶部栏（2x2功能区 + 关卡标题 + 子关卡节点）
    this.drawTopBar(ctx, databus);

    // 绘制进度显示
    this.drawProgress(ctx, databus);

    // 绘制棋盘区域
    this.drawBoardArea(ctx, databus);

    // 绘制底部道具栏（传递道具模式以显示激活状态）
    this.drawBottomBar(ctx, propMode);
  }

  /**
   * 绘制背景（浅绿色草地风格）
   */
  drawBackground(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 浅绿色草地背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, screenHeight);
    gradient.addColorStop(0, '#A8D86B');   // 顶部浅绿
    gradient.addColorStop(0.5, '#9ACD32'); // 中部草绿
    gradient.addColorStop(1, '#8BC34A');   // 底部稍深

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 绘制随机小花和草装饰
    this.drawGrassDecorations(ctx, screenWidth, screenHeight);
  }

  /**
   * 绘制草地装饰（小花、草叶）
   */
  drawGrassDecorations(ctx, screenWidth, screenHeight) {
    // 使用固定种子的随机数，确保每帧装饰位置一致
    const decorations = this.getGrassDecorationPositions(screenWidth, screenHeight);
    
    decorations.forEach(dec => {
      ctx.save();
      ctx.globalAlpha = 0.6;
      
      if (dec.type === 'flower') {
        // 小花
        ctx.fillStyle = dec.color;
        ctx.beginPath();
        ctx.arc(dec.x, dec.y, 4, 0, Math.PI * 2);
        ctx.fill();
        // 花心
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(dec.x, dec.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (dec.type === 'grass') {
        // 小草叶
        ctx.strokeStyle = '#7CB342';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dec.x, dec.y);
        ctx.quadraticCurveTo(dec.x + 3, dec.y - 8, dec.x + 1, dec.y - 12);
        ctx.stroke();
      }
      
      ctx.restore();
    });
  }

  /**
   * 获取草地装饰位置（缓存以避免每帧重新计算）
   */
  getGrassDecorationPositions(screenWidth, screenHeight) {
    if (!this._grassDecorations) {
      this._grassDecorations = [];
      const flowerColors = ['#FFB6C1', '#FFFFFF', '#FFE4B5', '#E6E6FA'];
      
      // 生成随机装饰
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * screenWidth;
        const y = 100 + Math.random() * (screenHeight - 200);
        const type = Math.random() > 0.5 ? 'flower' : 'grass';
        const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        this._grassDecorations.push({ x, y, type, color });
      }
    }
    return this._grassDecorations;
  }

  /**
   * 绘制顶部栏（PRD v1.3: 2x2功能区 + 关卡标题 + 子关卡节点）
   */
  drawTopBar(ctx, databus) {
    const topBarHeight = LAYOUT.TOP_BAR_HEIGHT + 20;

    // 顶部左侧2x2功能区
    this.drawTopFunctionButtons(ctx);

    // 关卡标题（居中，位置下移避免绿叶遮挡）
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${FONT_SIZES.LEVEL_TITLE - 2}px Arial`;  // 稍微减小字号
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(`第${databus.currentLevel}关`, canvas.width / 2, 25);  // 位置上移
    ctx.shadowColor = 'transparent';

    // 子关卡节点（关卡标题下方）
    this.drawSubLevelNodes(ctx, databus);

    // 右上角更多按钮和进度头像
    this.drawRightTopArea(ctx, databus);
  }

  /**
   * 绘制顶部左侧2x2功能区（设计感版本）
   * - 第一排（设置/刷新）：仅图标居中，无文字
   * - 第二排（背景/纯色）：图标居中，白色艺术字体在按钮下方横跨背景
   */
  drawTopFunctionButtons(ctx) {
    const startX = LAYOUT.SIDE_PADDING;
    const startY = 12;
    const buttonSize = 40;           // 紧凑一点
    const gap = 8;
    const row2LabelOffset = 16;      // 第二排文字在按钮下方的偏移

    const buttons = [
      { type: 'settings', label: '', accent: '#4CAF50', row: 0, col: 0 },
      { type: 'refresh', label: '', accent: '#03A9F4', row: 0, col: 1 },
      { type: 'background', label: '背景', accent: '#FF9800', row: 1, col: 0 },
      { type: 'pureColor', label: '纯色', accent: '#8BC34A', row: 1, col: 1 }
    ];

    buttons.forEach(btn => {
      const x = startX + btn.col * (buttonSize + gap);
      // 第二排整体下移一点，给文字留空间
      const rowOffset = btn.row === 1 ? row2LabelOffset : 0;
      const y = startY + btn.row * (buttonSize + gap) + rowOffset;

      // 按钮背景（玻璃拟态：白底+轻阴影+圆角）
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      drawRoundRect(ctx, x, y, buttonSize, buttonSize, 12);
      ctx.fill();
      
      // 细边框
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 图标居中（自绘矢量）
      const iconSize = 18;
      this.drawTopButtonIcon(
        ctx,
        btn.type,
        x + buttonSize / 2,
        y + buttonSize / 2,
        iconSize,
        btn.accent
      );

      // 第二排文字：白色艺术字体，在按钮下方横跨绿色背景
      if (btn.label) {
        const labelX = x + buttonSize / 2;
        const labelY = y + buttonSize + 10;

        ctx.save();
        // 文字阴影（让白字在绿色背景上更清晰）
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold italic 11px "Avenir Next", "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(btn.label, labelX, labelY);
        ctx.restore();
      }

      // 保存按钮区域
      this.topButtons[btn.type] = { x, y, width: buttonSize, height: buttonSize };
    });
  }

  /**
   * 顶部按钮矢量图标绘制
   */
  drawTopButtonIcon(ctx, type, cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (type) {
      case 'settings':
        this.drawIconGear(ctx, cx, cy, size);
        break;
      case 'refresh':
        this.drawIconRefresh(ctx, cx, cy, size);
        break;
      case 'background':
        this.drawIconPicture(ctx, cx, cy, size);
        break;
      case 'pureColor':
        this.drawIconDroplet(ctx, cx, cy, size);
        break;
      default:
        // fallback: dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  drawIconGear(ctx, cx, cy, size) {
    const rOuter = size * 0.38;
    const rInner = size * 0.18;
    const teeth = 8;
    const toothLen = size * 0.14;

    // 外圈
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    // 齿
    for (let i = 0; i < teeth; i++) {
      const a = (Math.PI * 2 * i) / teeth;
      const x1 = cx + Math.cos(a) * (rOuter - toothLen * 0.2);
      const y1 = cy + Math.sin(a) * (rOuter - toothLen * 0.2);
      const x2 = cx + Math.cos(a) * (rOuter + toothLen);
      const y2 = cy + Math.sin(a) * (rOuter + toothLen);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 内孔
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawIconRefresh(ctx, cx, cy, size) {
    const r = size * 0.42;
    const start = Math.PI * 0.1;
    const end = Math.PI * 1.85;

    // 弧线
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end, false);
    ctx.stroke();

    // 箭头（右上）
    const ax = cx + Math.cos(end) * r;
    const ay = cy + Math.sin(end) * r;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - size * 0.16, ay - size * 0.02);
    ctx.lineTo(ax - size * 0.04, ay + size * 0.14);
    ctx.closePath();
    ctx.fill();
  }

  drawIconPicture(ctx, cx, cy, size) {
    const w = size * 0.95;
    const h = size * 0.72;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 4;

    // 外框
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // 太阳
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.3, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 山
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.82);
    ctx.lineTo(x + w * 0.42, y + h * 0.52);
    ctx.lineTo(x + w * 0.62, y + h * 0.7);
    ctx.lineTo(x + w * 0.82, y + h * 0.45);
    ctx.lineTo(x + w * 0.9, y + h * 0.82);
    ctx.stroke();
  }

  drawIconDroplet(ctx, cx, cy, size) {
    const s = size * 0.48;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.quadraticCurveTo(cx + s, cy - s * 0.2, cx + s * 0.55, cy + s * 0.55);
    ctx.quadraticCurveTo(cx, cy + s * 1.1, cx - s * 0.55, cy + s * 0.55);
    ctx.quadraticCurveTo(cx - s, cy - s * 0.2, cx, cy - s);
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * 颜色变亮
   */
  lightenColor(color, percent) {
    if (color === '#FFFFFF') return '#FFFFFF';
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * 颜色变暗
   */
  darkenColor(color, percent) {
    if (color === '#FFFFFF') return '#F0F0F0';
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * 绘制小型广告标记
   */
  drawSmallAdBadge(ctx, x, y) {
    const size = 14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    const triSize = size * 0.3;
    ctx.moveTo(x - triSize * 0.3, y - triSize * 0.5);
    ctx.lineTo(x - triSize * 0.3, y + triSize * 0.5);
    ctx.lineTo(x + triSize * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制子关卡节点（PRD: ① - ②）
   */
  drawSubLevelNodes(ctx, databus) {
    const centerX = canvas.width / 2;
    const nodeY = 50;        // 上移
    const nodeRadius = 12;   // 稍小一点
    const gap = 35;          // 间距缩小

    // 两个子关卡节点
    const nodes = [
      { num: 1, active: true },
      { num: 2, active: false }
    ];

    // 连接线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - gap / 2 + nodeRadius, nodeY);
    ctx.lineTo(centerX + gap / 2 - nodeRadius, nodeY);
    ctx.stroke();

    nodes.forEach((node, index) => {
      const x = centerX + (index - 0.5) * gap;

      // 节点圆形背景
      if (node.active) {
        ctx.fillStyle = '#FFC107';
        ctx.shadowColor = 'rgba(255, 193, 7, 0.5)';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.shadowColor = 'transparent';
      }

      ctx.beginPath();
      ctx.arc(x, nodeY, nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 节点数字
      ctx.fillStyle = node.active ? '#333' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = `bold ${FONT_SIZES.BUTTON - 2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.num.toString(), x, nodeY);
    });
  }

  /**
   * 绘制右上角区域（更多按钮 + 进度头像）
   */
  drawRightTopArea(ctx, databus) {
    const rightX = canvas.width - LAYOUT.SIDE_PADDING;

    // 更多按钮（...）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('···', rightX - 40, 25);

    // 设置/分享圆形按钮
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(rightX - 15, 25, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 绘制进度显示（小熊猫 + 进度百分比）
   */
  drawProgress(ctx, databus) {
    const progress = databus.getProgress();
    const rightX = canvas.width - LAYOUT.SIDE_PADDING;
    const avatarX = rightX - 30;
    const avatarY = 75;

    this.drawPandaAvatar(ctx, avatarX, avatarY);

    // 进度文字（黑色，更醒目）
    ctx.fillStyle = '#333';
    ctx.font = `bold ${FONT_SIZES.HINT}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`进度${progress}%`, avatarX, avatarY + 46);
  }

  drawPandaAvatar(ctx, x, y) {
    const size = 32;

    ctx.save();

    // 身体
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, size * 0.32, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.beginPath();
    ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - size * 0.22, y - size * 0.22, size * 0.12, 0, Math.PI * 2);
    ctx.arc(x + size * 0.22, y - size * 0.22, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 黑眼圈
    ctx.beginPath();
    ctx.ellipse(x - size * 0.13, y - size * 0.02, size * 0.11, size * 0.13, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + size * 0.13, y - size * 0.02, size * 0.11, size * 0.13, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - size * 0.11, y - size * 0.02, size * 0.05, 0, Math.PI * 2);
    ctx.arc(x + size * 0.11, y - size * 0.02, size * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 眼珠
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - size * 0.1, y - size * 0.02, size * 0.025, 0, Math.PI * 2);
    ctx.arc(x + size * 0.1, y - size * 0.02, size * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.08, size * 0.05, size * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();

    // 微笑
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + size * 0.06, size * 0.08, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制棋盘区域（无边框，方块直接在绿色背景上）
   */
  drawBoardArea(ctx, databus) {
    const boardRect = getBoardRect(canvas.width, canvas.height);
    
    // 不绘制棋盘背景，让方块直接显示在绿色草地上
    // 只保存棋盘区域信息用于布局计算
    this.boardArea = { ...boardRect };
  }

  /**
   * 绘制底部道具栏（效果图风格 - 半透明）
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {string} propMode - 当前道具模式（'grab' | null）
   */
  drawBottomBar(ctx, propMode = null) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const bottomBarHeight = LAYOUT.BOTTOM_BAR_HEIGHT;
    const bottomY = screenHeight - bottomBarHeight;

    // 半透明渐变背景（与绿色草地融合）
    const bgGradient = ctx.createLinearGradient(0, bottomY, 0, screenHeight);
    bgGradient.addColorStop(0, 'rgba(139, 195, 74, 0.3)');  // 浅绿半透明
    bgGradient.addColorStop(0.5, 'rgba(104, 159, 56, 0.5)');
    bgGradient.addColorStop(1, 'rgba(85, 139, 47, 0.6)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, bottomY, screenWidth, bottomBarHeight);

    // 顶部分隔线（淡）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(screenWidth, bottomY);
    ctx.stroke();

    // 设置道具按钮的激活状态
    Object.entries(this.propButtons).forEach(([type, button]) => {
      if (button) {
        button.isActive = (propMode === type);
      }
    });

    // 绘制道具按钮
    Object.values(this.propButtons).forEach(button => {
      if (button) {
        button.render(ctx);
      }
    });

    // 道具名称标签（黑色描边白字）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${FONT_SIZES.HINT - 2}px Arial`;

    const propNames = {
      grab: '抓走',
      flip: '翻转',
      shufflePos: '重排',
      shuffleDir: '随机向'
    };

    Object.entries(this.propButtons).forEach(([type, button]) => {
      if (button) {
        const labelY = button.y + button.height / 2 + 8;
        // 描边
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(propNames[type] || type, button.x, labelY);
        // 文字
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(propNames[type] || type, button.x, labelY);
      }
    });
  }

  /**
   * 获取道具按钮
   */
  getPropButton(type) {
    // 兼容旧的shuffle类型
    if (type === 'shuffle') {
      return this.propButtons.shufflePos;
    }
    return this.propButtons[type];
  }

  /**
   * 获取设置按钮区域
   */
  getSettingsButtonArea() {
    return this.topButtons.settings;
  }

  /**
   * 获取顶部功能按钮区域
   */
  getTopButtonArea(type) {
    return this.topButtons[type];
  }

  /**
   * 获取棋盘区域
   */
  getBoardArea() {
    return this.boardArea;
  }

  /**
   * 绘制抓取模式提示（半透明提示框）
   */
  drawGrabModeHint(ctx) {
    const screenWidth = canvas.width;

    // 提示框配置
    const hintWidth = 280;
    const hintHeight = 80;
    const hintX = (screenWidth - hintWidth) / 2;
    const hintY = 120; // 顶部栏下方

    ctx.save();

    // 半透明背景（橙色渐变）
    const gradient = ctx.createLinearGradient(hintX, hintY, hintX, hintY + hintHeight);
    gradient.addColorStop(0, 'rgba(255, 152, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(255, 87, 34, 0.95)');

    // 绘制圆角矩形背景
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = gradient;

    const radius = 15;
    ctx.beginPath();
    ctx.moveTo(hintX + radius, hintY);
    ctx.lineTo(hintX + hintWidth - radius, hintY);
    ctx.quadraticCurveTo(hintX + hintWidth, hintY, hintX + hintWidth, hintY + radius);
    ctx.lineTo(hintX + hintWidth, hintY + hintHeight - radius);
    ctx.quadraticCurveTo(hintX + hintWidth, hintY + hintHeight, hintX + hintWidth - radius, hintY + hintHeight);
    ctx.lineTo(hintX + radius, hintY + hintHeight);
    ctx.quadraticCurveTo(hintX, hintY + hintHeight, hintX, hintY + hintHeight - radius);
    ctx.lineTo(hintX, hintY + radius);
    ctx.quadraticCurveTo(hintX, hintY, hintX + radius, hintY);
    ctx.closePath();
    ctx.fill();

    // 清除阴影
    ctx.shadowColor = 'transparent';

    // 主标题文字（白色）
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${FONT_SIZES.BUTTON + 4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('点击要移除的方块', screenWidth / 2, hintY + 18);

    // 副标题文字（白色，较小）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${FONT_SIZES.HINT}px Arial`;
    ctx.fillText('点击空白处取消', screenWidth / 2, hintY + 50);

    ctx.restore();
  }
}

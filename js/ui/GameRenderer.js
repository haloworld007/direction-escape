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
      undo: null,
      background: null,
      pureColor: null
    };

    // 子关卡节点
    this.subLevelNodes = [];

    // 按钮区域
    this.settingsButtonArea = null;
  }

  /**
   * 初始化道具按钮（4个圆角矩形按钮）
   */
  initPropButtons(items) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const bottomY = screenHeight - LAYOUT.BOTTOM_BAR_HEIGHT / 2 - 8; // 上移一点，留出标签空间
    const buttonSpacing = 10;  // 减小间距适应更小按钮
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
   */
  render(ctx, databus) {
    // 绘制背景
    this.drawBackground(ctx);

    // 绘制顶部栏（2x2功能区 + 关卡标题 + 子关卡节点）
    this.drawTopBar(ctx, databus);

    // 绘制进度显示
    this.drawProgress(ctx, databus);

    // 绘制棋盘区域
    this.drawBoardArea(ctx, databus);

    // 绘制底部道具栏
    this.drawBottomBar(ctx);
  }

  /**
   * 绘制背景（木质纹理）
   */
  drawBackground(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 木质背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, screenHeight);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(0.3, '#6B4423');
    gradient.addColorStop(0.7, '#5D3A1A');
    gradient.addColorStop(1, '#4A2C0F');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 木纹效果
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < screenHeight; i += 12) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(screenWidth, i + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // 顶部绿叶装饰
    this.drawLeafDecoration(ctx, screenWidth);
  }

  /**
   * 绘制顶部绿叶装饰（缩小高度，避免遮挡标题）
   */
  drawLeafDecoration(ctx, screenWidth) {
    // 更小的绿叶装饰，只在顶部边缘
    const leafGradient = ctx.createLinearGradient(0, 0, 0, 35);
    leafGradient.addColorStop(0, '#2E7D32');
    leafGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = leafGradient;
    
    // 左侧叶子（更小更紧凑）
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(25, 15, 50, 0);
    ctx.quadraticCurveTo(40, 20, 75, 5);
    ctx.quadraticCurveTo(50, 30, 0, 35);
    ctx.closePath();
    ctx.fill();

    // 右侧叶子（更小更紧凑）
    ctx.beginPath();
    ctx.moveTo(screenWidth, 0);
    ctx.quadraticCurveTo(screenWidth - 25, 15, screenWidth - 50, 0);
    ctx.quadraticCurveTo(screenWidth - 40, 20, screenWidth - 75, 5);
    ctx.quadraticCurveTo(screenWidth - 50, 30, screenWidth, 35);
    ctx.closePath();
    ctx.fill();
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
   * 绘制顶部左侧2x2功能区
   */
  drawTopFunctionButtons(ctx) {
    const startX = LAYOUT.SIDE_PADDING;
    const startY = 10;
    const buttonSize = 44;
    const gap = 6;

    const buttons = [
      { type: 'settings', icon: '⚙', color: '#4CAF50', row: 0, col: 0 },
      { type: 'undo', icon: '↩', color: '#03A9F4', row: 0, col: 1, hasAd: true },
      { type: 'background', icon: '👕', color: '#FFFFFF', row: 1, col: 0, text: '背景' },
      { type: 'pureColor', icon: '🐻', color: '#8BC34A', row: 1, col: 1, text: '纯色模式' }
    ];

    buttons.forEach(btn => {
      const x = startX + btn.col * (buttonSize + gap);
      const y = startY + btn.row * (buttonSize + gap);

      // 按钮背景
      ctx.fillStyle = btn.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      drawRoundRect(ctx, x, y, buttonSize, buttonSize, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 图标
      ctx.fillStyle = btn.color === '#FFFFFF' ? '#333' : '#FFF';
      ctx.font = `${buttonSize * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.icon, x + buttonSize / 2, y + buttonSize / 2);

      // 视频广告标记
      if (btn.hasAd) {
        this.drawSmallAdBadge(ctx, x + buttonSize - 8, y + 8);
      }

      // 保存按钮区域
      this.topButtons[btn.type] = { x, y, width: buttonSize, height: buttonSize };
    });
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
   * 绘制进度显示（PRD: 右上角动物头像 + 进度百分比）
   */
  drawProgress(ctx, databus) {
    const progress = databus.getProgress();
    const rightX = canvas.width - LAYOUT.SIDE_PADDING;
    const progressY = 70;

    // 小熊猫头像
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.arc(rightX - 25, progressY, 18, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(rightX - 38, progressY - 12, 8, 0, Math.PI * 2);
    ctx.arc(rightX - 12, progressY - 12, 8, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(rightX - 30, progressY - 2, 5, 0, Math.PI * 2);
    ctx.arc(rightX - 20, progressY - 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(rightX - 30, progressY - 2, 2, 0, Math.PI * 2);
    ctx.arc(rightX - 20, progressY - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // 进度文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${FONT_SIZES.HINT}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`进度${progress}%`, rightX, progressY + 25);
  }

  /**
   * 绘制棋盘区域
   */
  drawBoardArea(ctx, databus) {
    const boardRect = getBoardRect(canvas.width, canvas.height);
    const boardY = boardRect.y;
    const boardHeight = boardRect.height;

    // 棋盘背景（深棕色木质效果）
    ctx.save();

    const boardGradient = ctx.createLinearGradient(0, boardY, 0, boardY + boardHeight);
    boardGradient.addColorStop(0, '#5D4037');
    boardGradient.addColorStop(0.5, '#4E342E');
    boardGradient.addColorStop(1, '#3E2723');

    ctx.fillStyle = boardGradient;

    const boardPadding = boardRect.x;
    const boardWidth = boardRect.width;
    drawRoundRect(ctx, boardPadding, boardY, boardWidth, boardHeight, 15);
    ctx.fill();

    // 木质纹理线条
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < boardHeight; i += 10) {
      ctx.beginPath();
      ctx.moveTo(boardPadding, boardY + i);
      ctx.lineTo(boardPadding + boardWidth, boardY + i);
      ctx.stroke();
    }

    // 边框
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, boardPadding, boardY, boardWidth, boardHeight, 15);
    ctx.stroke();

    ctx.restore();

    // 保存棋盘区域信息
    this.boardArea = { ...boardRect };
  }

  /**
   * 绘制底部道具栏（美化版）
   */
  drawBottomBar(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const bottomBarHeight = LAYOUT.BOTTOM_BAR_HEIGHT;
    const bottomY = screenHeight - bottomBarHeight;

    // 渐变背景（更有层次感）
    const bgGradient = ctx.createLinearGradient(0, bottomY, 0, screenHeight);
    bgGradient.addColorStop(0, 'rgba(62, 39, 35, 0.9)');
    bgGradient.addColorStop(0.3, 'rgba(55, 35, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(45, 28, 22, 0.98)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, bottomY, screenWidth, bottomBarHeight);

    // 顶部高光线
    const highlightGradient = ctx.createLinearGradient(0, bottomY, screenWidth, bottomY);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    highlightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    highlightGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = highlightGradient;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(screenWidth, bottomY);
    ctx.stroke();

    // 绘制道具按钮
    Object.values(this.propButtons).forEach(button => {
      if (button) {
        button.render(ctx);
      }
    });

    // 道具名称标签（更清晰）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `${FONT_SIZES.HINT - 3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const propNames = {
      grab: '抓走',
      flip: '翻转',
      shufflePos: '洗牌',
      shuffleDir: '洗牌'
    };

    Object.entries(this.propButtons).forEach(([type, button]) => {
      if (button) {
        ctx.fillText(propNames[type] || type, button.x, button.y + button.height / 2 + 6);
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
}

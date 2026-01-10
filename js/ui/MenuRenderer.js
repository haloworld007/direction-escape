/**
 * 主界面（首页）渲染器
 * 根据 PRD.md 第十八章节设计
 * - 背景风格：森林/草地卡通风格
 * - 顶部左侧功能区：设置、游戏圈、排行榜
 * - 中心主角展示区：Q版小动物
 * - 底部主操作区：开始游戏按钮
 */

import Button from './Button';
import { COLORS, FONT_SIZES, BUTTON_SIZES } from './UIConstants';

export default class MenuRenderer {
  constructor() {
    // 按钮实例
    this.buttons = {};
    this.initButtons();
  }

  /**
   * 初始化按钮
   */
  initButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 开始游戏按钮（居中、大、亮黄）
    const startButtonY = screenHeight * 0.6;
    this.buttons.start = new Button(
      '开始游戏',
      (screenWidth - BUTTON_SIZES.PRIMARY.WIDTH) / 2,
      startButtonY,
      {
        width: 220,
        height: 80,
        backgroundColor: COLORS.PRIMARY_BUTTON,
        fontSize: FONT_SIZES.BUTTON,
        fontWeight: 'bold'
      }
    );

    // 签到按钮（底部左侧）
    this.buttons.checkin = new Button(
      '每日签到',
      20,
      screenHeight - BUTTON_SIZES.SECONDARY.HEIGHT - 20,
      {
        width: BUTTON_SIZES.SECONDARY.WIDTH,
        height: BUTTON_SIZES.SECONDARY.HEIGHT,
        backgroundColor: '#4FC3F7',
        fontSize: 14
      }
    );
    // v1.0 暂时隐藏签到功能
    this.buttons.checkin.setVisible(false);

    // 分享好友按钮（底部右侧）
    this.buttons.share = new Button(
      '分享好友',
      screenWidth - BUTTON_SIZES.SECONDARY.WIDTH - 20,
      screenHeight - BUTTON_SIZES.SECONDARY.HEIGHT - 20,
      {
        width: BUTTON_SIZES.SECONDARY.WIDTH,
        height: BUTTON_SIZES.SECONDARY.HEIGHT,
        backgroundColor: '#66BB6A',
        fontSize: 14
      }
    );
    // v1.0 暂时隐藏分享功能
    this.buttons.share.setVisible(false);
  }

  /**
   * 渲染主界面
   */
  render(ctx) {
    // 绘制背景
    this.drawBackground(ctx);

    // 绘制顶部功能区按钮
    this.drawTopButtons(ctx);

    // 绘制中心主角展示区
    this.drawCenterCharacter(ctx);

    // 绘制主要操作按钮
    this.drawMainButtons(ctx);

    // 绘制底部辅助按钮
    this.drawBottomButtons(ctx);

    // 绘制占位按钮（游戏圈、排行榜等）
    this.drawPlaceholderButtons(ctx);
  }

  /**
   * 绘制背景
   */
  drawBackground(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 浅蓝渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, screenHeight);
    gradient.addColorStop(0, COLORS.BACKGROUND_START);
    gradient.addColorStop(1, COLORS.BACKGROUND_END);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 绘制装饰性草地/森林元素
    this.drawGrassDecoration(ctx, screenWidth, screenHeight);
  }

  /**
   * 绘制草地装饰
   */
  drawGrassDecoration(ctx, width, height) {
    ctx.save();

    // 底部草地
    const grassHeight = 100;
    const grassGradient = ctx.createLinearGradient(0, height - grassHeight, 0, height);
    grassGradient.addColorStop(0, '#81C784');
    grassGradient.addColorStop(1, '#66BB6A');

    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, height - grassHeight, width, grassHeight);

    // 草丛装饰
    ctx.fillStyle = '#4CAF50';
    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i + Math.random() * 30;
      const y = height - grassHeight + 10;
      this.drawGrassCluster(ctx, x, y);
    }

    ctx.restore();
  }

  /**
   * 绘制草丛
   */
  drawGrassCluster(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y - 20);
    ctx.lineTo(x + 5, y - 25);
    ctx.lineTo(x + 10, y - 15);
    ctx.lineTo(x + 15, y - 20);
    ctx.lineTo(x + 10, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制顶部功能区按钮
   */
  drawTopButtons(ctx) {
    const padding = 20;
    const buttonY = padding;
    const buttonSize = 48;
    const spacing = 15;

    // 绘制设置按钮
    this.drawIconButton(ctx, 'settings', padding, buttonY, buttonSize, '⚙', '#78909C');

    // 绘制游戏圈按钮（占位）
    this.drawIconButton(ctx, 'community', padding, buttonY + buttonSize + spacing, buttonSize, '📷', '#EC407A', true);

    // 绘制排行榜按钮（占位）
    this.drawIconButton(ctx, 'rank', padding, buttonY + (buttonSize + spacing) * 2, buttonSize, '🏆', '#FFA726', true);
  }

  /**
   * 绘制图标按钮
   */
  drawIconButton(ctx, type, x, y, size, icon, color, isPlaceholder = false) {
    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // 背景
    const gradient = ctx.createRadialGradient(
      x + size * 0.3, y + size * 0.3, 0,
      x + size / 2, y + size / 2, size / 2
    );
    gradient.addColorStop(0, this.lightenColor(color, 30));
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 边框
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 图标/文字
    ctx.font = `${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + size / 2, y + size / 2);

    // 如果是占位按钮，显示"敬请期待"角标
    if (isPlaceholder) {
      this.drawPlaceholderBadge(ctx, x + size, y);
    }

    ctx.restore();

    // 保存按钮位置供触摸检测使用
    if (!this.iconButtons) {
      this.iconButtons = {};
    }
    this.iconButtons[type] = {
      x: x,
      y: y,
      width: size,
      height: size
    };
  }

  /**
   * 绘制占位角标
   */
  drawPlaceholderBadge(ctx, x, y) {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🔒', x - 5, y + 5);

    ctx.restore();
  }

  /**
   * 绘制中心主角展示区
   */
  drawCenterCharacter(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const centerY = screenHeight * 0.35;

    ctx.save();

    // 绘制Q版小动物（小熊猫）
    this.drawQ版Panda(ctx, centerX, centerY);

    // 绘制"去获得"按钮（占位）
    const buttonY = centerY + 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(centerX - 60, buttonY, 120, 36);

    ctx.fillStyle = COLORS.TEXT_PRIMARY;
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('去获得', centerX, buttonY + 18);

    // 占位角标
    ctx.font = '12px Arial';
    ctx.fillText('🔒', centerX + 50, buttonY + 10);

    ctx.restore();
  }

  /**
   * 绘制Q版小熊猫
   */
  drawQ版Panda(ctx, x, y) {
    const size = 80;

    // 身体
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.ellipse(x, y + 20, size * 0.4, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 25, y - 25, 12, 0, Math.PI * 2);
    ctx.arc(x + 25, y - 25, 12, 0, Math.PI * 2);
    ctx.fill();

    // 黑眼圈
    ctx.beginPath();
    ctx.ellipse(x - 12, y - 5, 10, 12, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + 12, y - 5, 10, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 10, y - 5, 5, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // 眼珠
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - 9, y - 5, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 微笑
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(x, y + 5, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  /**
   * 绘制主要操作按钮
   */
  drawMainButtons(ctx) {
    if (this.buttons.start) {
      this.buttons.start.render(ctx);
    }
  }

  /**
   * 绘制底部辅助按钮
   */
  drawBottomButtons(ctx) {
    if (this.buttons.checkin) {
      this.buttons.checkin.render(ctx);
    }
    if (this.buttons.share) {
      this.buttons.share.render(ctx);
    }
  }

  /**
   * 绘制占位按钮
   */
  drawPlaceholderButtons(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const bottomY = screenHeight - 100;
    const buttonWidth = 100;
    const buttonHeight = 40;
    const spacing = 10;

    // 活动模式（乌龟对对碰）
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(20, bottomY, buttonWidth, buttonHeight);

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('活动🔒', 20 + buttonWidth / 2, bottomY + buttonHeight / 2);
    ctx.restore();

    // 我的收藏
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(screenWidth - buttonWidth - 20, bottomY, buttonWidth, buttonHeight);

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('收藏🔒', screenWidth - buttonWidth - 20 + buttonWidth / 2, bottomY + buttonHeight / 2);
    ctx.restore();
  }

  /**
   * 获取按钮实例
   */
  getButton(name) {
    return this.buttons[name];
  }

  /**
   * 获取图标按钮区域
   */
  getIconButtonArea(type) {
    return this.iconButtons ? this.iconButtons[type] : null;
  }

  /**
   * 使颜色变亮
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }
}

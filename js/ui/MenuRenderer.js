/**
 * 主界面（首页）渲染器
 * 根据 PRD.md 第十八章节设计
 * - 背景风格：森林/草地卡通风格
 * - 顶部左侧功能区：设置、游戏圈、排行榜
 * - 中心主角展示区：Q版小动物
 * - 底部主操作区：开始游戏按钮
 */

import Button from './Button';
import { BUTTON_SIZES, FONT_FAMILIES, drawRoundRect } from './UIConstants';

export default class MenuRenderer {
  constructor() {
    this.theme = {
      skyTop: '#F9F1DE',
      skyMid: '#D7F0FB',
      skyBottom: '#B7E6D1',
      sun: '#FFE29A',
      hillFront: '#77C88B',
      hillBack: '#5EBB7A',
      accent: '#FF7A3D',
      accentDark: '#E55A2C',
      card: 'rgba(255, 255, 255, 0.7)',
      text: '#1F2A33',
      textSoft: '#4B5B66'
    };
    this.fonts = {
      display: FONT_FAMILIES.DISPLAY,
      ui: FONT_FAMILIES.UI
    };

    // 按钮实例
    this.buttons = {};
    this.iconButtons = {};
    this.initButtons();
  }

  /**
   * 初始化按钮
   */
  initButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const startLayout = this.getStartButtonLayout(screenWidth, screenHeight);

    // 开始游戏按钮（居中、大、亮黄）
    this.buttons.start = new Button(
      '开始游戏',
      startLayout.x,
      startLayout.y,
      {
        width: startLayout.width,
        height: startLayout.height,
        backgroundColor: this.theme.accent,
        textColor: '#FFFFFF',
        fontSize: startLayout.fontSize,
        fontWeight: 'bold',
        fontFamily: this.fonts.ui,
        cornerRadius: startLayout.height / 2
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
        fontSize: 14,
        fontFamily: this.fonts.ui
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
        fontSize: 14,
        fontFamily: this.fonts.ui
      }
    );
    // v1.0 暂时隐藏分享功能
    this.buttons.share.setVisible(false);
  }

  getStartButtonLayout(screenWidth, screenHeight) {
    const width = Math.min(screenWidth * 0.72, 280);
    const height = Math.max(70, Math.round(screenHeight * 0.085));
    const x = Math.round((screenWidth - width) / 2);
    const y = Math.round(screenHeight * 0.68);
    const fontSize = Math.round(height * 0.32);
    return { x, y, width, height, fontSize };
  }

  layoutButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const startLayout = this.getStartButtonLayout(screenWidth, screenHeight);

    if (this.buttons.start) {
      Object.assign(this.buttons.start, {
        x: startLayout.x,
        y: startLayout.y,
        width: startLayout.width,
        height: startLayout.height,
        cornerRadius: startLayout.height / 2,
        fontSize: startLayout.fontSize,
        fontFamily: this.fonts.ui,
        backgroundColor: this.theme.accent,
        textColor: '#FFFFFF'
      });
    }
  }

  /**
   * 渲染主界面
   */
  render(ctx) {
    this.layoutButtons();

    // 绘制背景
    this.drawBackground(ctx);

    // 绘制顶部功能区按钮
    this.drawTopButtons(ctx);

    // 绘制标题区
    this.drawTitle(ctx);

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

    const gradient = ctx.createLinearGradient(0, 0, 0, screenHeight);
    gradient.addColorStop(0, this.theme.skyTop);
    gradient.addColorStop(0.55, this.theme.skyMid);
    gradient.addColorStop(1, this.theme.skyBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    this.drawSunGlow(ctx, screenWidth, screenHeight);
    this.drawSoftClouds(ctx, screenWidth, screenHeight);
    this.drawDotPattern(ctx, screenWidth, screenHeight);
    this.drawHills(ctx, screenWidth, screenHeight);
  }

  drawSunGlow(ctx, width, height) {
    const radius = Math.min(width, height) * 0.18;
    const cx = width * 0.82;
    const cy = height * 0.16;
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255, 226, 154, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 226, 154, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSoftClouds(ctx, width, height) {
    const clouds = [
      { x: width * 0.18, y: height * 0.18, size: 60 },
      { x: width * 0.65, y: height * 0.22, size: 48 },
      { x: width * 0.42, y: height * 0.12, size: 36 }
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    clouds.forEach(cloud => {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size * 0.6, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - cloud.size * 0.6, cloud.y + 6, cloud.size * 0.7, cloud.size * 0.45, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + cloud.size * 0.6, cloud.y + 4, cloud.size * 0.65, cloud.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawDotPattern(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const step = Math.max(60, Math.floor(width / 8));
    for (let y = step; y < height * 0.6; y += step) {
      for (let x = step / 2; x < width; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawHills(ctx, width, height) {
    const horizon = height * 0.72;

    ctx.save();

    ctx.fillStyle = this.theme.hillBack;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 40);
    ctx.bezierCurveTo(width * 0.25, horizon - 60, width * 0.55, horizon + 20, width, horizon - 10);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.theme.hillFront;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 80);
    ctx.bezierCurveTo(width * 0.2, horizon + 10, width * 0.55, horizon + 110, width, horizon + 30);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制顶部功能区按钮
   */
  drawTopButtons(ctx) {
    const padding = 18;
    const buttonSize = 44;
    const spacing = 12;
    const screenWidth = canvas.width;
    const startX = screenWidth - padding - (buttonSize * 3 + spacing * 2);
    const buttonY = padding + 6;

    this.drawIconButton(ctx, 'settings', startX, buttonY, buttonSize, '⚙', '#607D8B');
    this.drawIconButton(ctx, 'community', startX + buttonSize + spacing, buttonY, buttonSize, '🎯', '#FF7043', true);
    this.drawIconButton(ctx, 'rank', startX + (buttonSize + spacing) * 2, buttonY, buttonSize, '🏆', '#FFA726', true);
  }

  /**
   * 绘制图标按钮
   */
  drawIconButton(ctx, type, x, y, size, icon, color, isPlaceholder = false) {
    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // 玻璃质感背景
    const gradient = ctx.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 边框
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 图标/文字
    ctx.fillStyle = color;
    ctx.font = `${size * 0.46}px ${this.fonts.ui}`;
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
   * 绘制标题区
   */
  drawTitle(ctx) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const titleY = Math.round(screenHeight * 0.12);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleSize = Math.min(44, Math.round(screenWidth * 0.095));
    const subtitleSize = Math.min(18, Math.round(screenWidth * 0.038));

    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = this.theme.text;
    ctx.font = `800 ${titleSize}px ${this.fonts.display}`;
    ctx.fillText('方向出走', screenWidth / 2, titleY);

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = this.theme.textSoft;
    ctx.font = `600 ${subtitleSize}px ${this.fonts.ui}`;
    ctx.fillText('轻松解谜 · 方向挑战', screenWidth / 2, titleY + 36);

    ctx.restore();
  }

  /**
   * 绘制占位角标
   */
  drawPlaceholderBadge(ctx, x, y) {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = `10px ${this.fonts.ui}`;
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
    const centerY = screenHeight * 0.38;

    ctx.save();

    // 舞台底座
    this.drawCharacterStage(ctx, centerX, centerY + 68);

    // 绘制Q版小动物（小熊猫）
    this.drawQ版Panda(ctx, centerX, centerY);

    ctx.restore();
  }

  drawCharacterStage(ctx, x, y) {
    ctx.save();
    const width = 170;
    const height = 32;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    const gradient = ctx.createLinearGradient(x - width / 2, y - height, x + width / 2, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制Q版小熊猫
   */
  drawQ版Panda(ctx, x, y) {
    const size = 86;

    // 身体
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.ellipse(x, y + 22, size * 0.42, size * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.beginPath();
    ctx.arc(x, y, size * 0.36, 0, Math.PI * 2);
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

    // 小围巾
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.ellipse(x, y + 30, size * 0.26, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.theme.accentDark;
    ctx.beginPath();
    ctx.ellipse(x + 14, y + 35, size * 0.12, size * 0.06, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 绘制主要操作按钮
   */
  drawMainButtons(ctx) {
    if (this.buttons.start) {
      const button = this.buttons.start;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 122, 61, 0.45)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = 'rgba(255, 122, 61, 0.2)';
      drawRoundRect(
        ctx,
        button.x - 8,
        button.y - 6,
        button.width + 16,
        button.height + 12,
        button.cornerRadius + 6
      );
      ctx.fill();
      ctx.restore();

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
    const bottomY = Math.round(screenHeight - 86);
    const buttonWidth = 120;
    const buttonHeight = 36;
    const spacing = 14;
    const startX = Math.round((screenWidth - (buttonWidth * 2 + spacing)) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    drawRoundRect(ctx, startX, bottomY, buttonWidth, buttonHeight, 18);
    ctx.fill();

    ctx.fillStyle = this.theme.textSoft;
    ctx.font = `600 14px ${this.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('活动 🔒', startX + buttonWidth / 2, bottomY + buttonHeight / 2);

    const rightX = startX + buttonWidth + spacing;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    drawRoundRect(ctx, rightX, bottomY, buttonWidth, buttonHeight, 18);
    ctx.fill();

    ctx.fillStyle = this.theme.textSoft;
    ctx.fillText('收藏 🔒', rightX + buttonWidth / 2, bottomY + buttonHeight / 2);
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

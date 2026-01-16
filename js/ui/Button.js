/**
 * 通用按钮组件
 * 根据 PRD.md 第十八章节设计
 * 支持主要按钮和次要按钮
 */

import {
  BUTTON_SIZES,
  COLORS,
  FONT_SIZES,
  FONT_FAMILIES,
  drawRoundRect
} from './UIConstants';

export default class Button {
  constructor(text, x, y, options = {}) {
    this.text = text;
    this.x = x;
    this.y = y;

    // 尺寸
    this.width = options.width || BUTTON_SIZES.PRIMARY.WIDTH;
    this.height = options.height || BUTTON_SIZES.PRIMARY.HEIGHT;
    this.cornerRadius = options.cornerRadius || 15;

    // 样式
    this.backgroundColor = options.backgroundColor || COLORS.PRIMARY_BUTTON;
    this.textColor = options.textColor || COLORS.TEXT_PRIMARY;
    this.fontSize = options.fontSize || FONT_SIZES.BUTTON;
    this.fontWeight = options.fontWeight || 'bold';
    this.fontFamily = options.fontFamily || FONT_FAMILIES.UI;

    // 动画状态
    this.scale = 1;
    this.isPressed = false;
    this.isVisible = true;

    // 触摸区域
    this.touchArea = {
      x: x,
      y: y,
      width: this.width,
      height: this.height
    };
  }

  /**
   * 检查点击
   */
  isClicked(x, y) {
    if (!this.isVisible) return false;
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }

  /**
   * 点击反馈
   */
  press() {
    this.isPressed = true;
    this.scale = 0.95;
  }

  /**
   * 释放
   */
  release() {
    this.isPressed = false;
    this.scale = 1;
  }

  /**
   * 设置可见性
   */
  setVisible(visible) {
    this.isVisible = visible;
  }

  /**
   * 渲染按钮
   */
  render(ctx) {
    if (!this.isVisible) return;

    ctx.save();

    // 应用缩放动画
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-centerX, -centerY);

    // 绘制按钮主体
    this.drawButtonBody(ctx);

    // 绘制按钮文字
    this.drawText(ctx);

    ctx.restore();
  }

  /**
   * 绘制按钮主体
   */
  drawButtonBody(ctx) {
    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // 渐变背景
    const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    gradient.addColorStop(0, this.lightenColor(this.backgroundColor, 20));
    gradient.addColorStop(1, this.backgroundColor);

    ctx.fillStyle = gradient;

    // 绘制圆角矩形
    drawRoundRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
    ctx.fill();

    // 高光边框
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 顶部高光
    const highlightGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height * 0.3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    drawRoundRect(ctx, this.x, this.y, this.width, this.height * 0.3, this.cornerRadius);
    ctx.fill();
  }

  /**
   * 绘制按钮文字
   */
  drawText(ctx) {
    ctx.fillStyle = this.textColor;
    ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    // 文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillText(this.text, centerX, centerY);
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

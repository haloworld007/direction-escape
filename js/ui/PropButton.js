/**
 * 道具按钮组件（PRD v1.3 更新版）
 * 根据 PRD.md 第十七、十八章节设计
 * 支持四种道具：抓走、翻转、洗牌(位置)、洗牌(方向)
 * 按钮形状：圆角矩形
 */

import {
  BUTTON_SIZES,
  PROP_TYPES,
  PROP_NAMES,
  getPropColor,
  FONT_SIZES,
  drawRoundRect
} from './UIConstants';

export default class PropButton {
  constructor(type, count, x, y) {
    this.type = type;
    this.count = count;
    this.x = x;  // 按钮中心x
    this.y = y;  // 按钮中心y
    this.width = BUTTON_SIZES.PROP;
    this.height = BUTTON_SIZES.PROP;
    this.cornerRadius = 10;  // 适配更小的按钮

    // 动画状态
    this.scale = 1;
    this.isPressed = false;

    // 是否需要观看广告（右上角视频图标）
    this.needsAd = true;

    // 触摸区域（比按钮稍大，便于点击）
    this.touchArea = {
      x: x - this.width / 2 - 4,
      y: y - this.height / 2 - 4,
      width: this.width + 8,
      height: this.height + 8
    };
  }

  /**
   * 更新道具数量
   */
  updateCount(count) {
    this.count = count;
  }

  /**
   * 检查点击（圆角矩形碰撞检测）
   */
  isClicked(clickX, clickY) {
    const left = this.x - this.width / 2;
    const top = this.y - this.height / 2;
    return clickX >= left && clickX <= left + this.width &&
           clickY >= top && clickY <= top + this.height;
  }

  /**
   * 点击反馈
   */
  press() {
    this.isPressed = true;
    this.scale = 0.9;
  }

  /**
   * 释放
   */
  release() {
    this.isPressed = false;
    this.scale = 1;
  }

  /**
   * 渲染按钮
   */
  render(ctx) {
    ctx.save();

    // 应用缩放动画
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);

    // 绘制按钮主体（圆角矩形）
    this.drawButtonBody(ctx);

    // 绘制图标
    this.drawIcon(ctx);

    // 绘制视频图标（右上角）
    if (this.needsAd) {
      this.drawAdBadge(ctx);
    }

    ctx.restore();
  }

  /**
   * 绘制按钮主体（圆角矩形）
   */
  drawButtonBody(ctx) {
    const color = getPropColor(this.type);
    const left = this.x - this.width / 2;
    const top = this.y - this.height / 2;

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 渐变背景
    const gradient = ctx.createLinearGradient(left, top, left, top + this.height);
    gradient.addColorStop(0, this.lightenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 15));

    ctx.fillStyle = gradient;

    // 绘制圆角矩形按钮
    drawRoundRect(ctx, left, top, this.width, this.height, this.cornerRadius);
    ctx.fill();

    // 高光边框
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 内部高光
    const highlightGradient = ctx.createLinearGradient(left, top, left, top + this.height / 2);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    drawRoundRect(ctx, left + 2, top + 2, this.width - 4, this.height / 2, this.cornerRadius - 2);
    ctx.fill();
  }

  /**
   * 绘制图标
   */
  drawIcon(ctx) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const iconSize = this.width * 0.35;

    switch (this.type) {
      case PROP_TYPES.GRAB:
        this.drawGrabIcon(ctx, iconSize);
        break;

      case PROP_TYPES.FLIP:
        this.drawFlipIcon(ctx, iconSize);
        break;

      case PROP_TYPES.SHUFFLE_POS:
        this.drawShuffleIcon(ctx, iconSize, false);
        break;

      case PROP_TYPES.SHUFFLE_DIR:
        this.drawShuffleIcon(ctx, iconSize, true);
        break;

      default:
        // 兼容旧的shuffle类型
        if (this.type === 'shuffle') {
          this.drawShuffleIcon(ctx, iconSize, false);
        }
    }
  }

  /**
   * 绘制抓手图标（爪子）
   */
  drawGrabIcon(ctx, size) {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 爪子形状
    const pawY = this.y - size * 0.1;
    
    // 三个爪指
    ctx.beginPath();
    ctx.moveTo(this.x - size * 0.5, pawY + size * 0.2);
    ctx.quadraticCurveTo(this.x - size * 0.5, pawY - size * 0.3, this.x - size * 0.3, pawY - size * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x, pawY + size * 0.2);
    ctx.lineTo(this.x, pawY - size * 0.6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x + size * 0.5, pawY + size * 0.2);
    ctx.quadraticCurveTo(this.x + size * 0.5, pawY - size * 0.3, this.x + size * 0.3, pawY - size * 0.5);
    ctx.stroke();

    // 爪掌
    ctx.beginPath();
    ctx.arc(this.x, pawY + size * 0.4, size * 0.4, 0, Math.PI);
    ctx.fill();
  }

  /**
   * 绘制翻转图标（旋转箭头）
   */
  drawFlipIcon(ctx, size) {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // 圆形箭头
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 0.5, -Math.PI * 0.7, Math.PI * 0.5);
    ctx.stroke();

    // 箭头头部1
    ctx.beginPath();
    ctx.moveTo(this.x + size * 0.5, this.y);
    ctx.lineTo(this.x + size * 0.3, this.y - size * 0.25);
    ctx.moveTo(this.x + size * 0.5, this.y);
    ctx.lineTo(this.x + size * 0.7, this.y - size * 0.15);
    ctx.stroke();

    // 箭头头部2
    ctx.beginPath();
    ctx.moveTo(this.x - size * 0.35, this.y - size * 0.35);
    ctx.lineTo(this.x - size * 0.55, this.y - size * 0.55);
    ctx.moveTo(this.x - size * 0.35, this.y - size * 0.35);
    ctx.lineTo(this.x - size * 0.15, this.y - size * 0.55);
    ctx.stroke();
  }

  /**
   * 绘制洗牌图标（工字形）
   * @param {boolean} hasHeart - 是否带爱心装饰（洗牌方向）
   */
  drawShuffleIcon(ctx, size, hasHeart) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // 工字形
    const topY = this.y - size * 0.4;
    const bottomY = this.y + size * 0.4;
    const halfWidth = size * 0.5;

    // 上横线
    ctx.beginPath();
    ctx.moveTo(this.x - halfWidth, topY);
    ctx.lineTo(this.x + halfWidth, topY);
    ctx.stroke();

    // 中间竖线
    ctx.beginPath();
    ctx.moveTo(this.x, topY);
    ctx.lineTo(this.x, bottomY);
    ctx.stroke();

    // 下横线
    ctx.beginPath();
    ctx.moveTo(this.x - halfWidth, bottomY);
    ctx.lineTo(this.x + halfWidth, bottomY);
    ctx.stroke();

    // 爱心装饰（洗牌方向专用）
    if (hasHeart) {
      ctx.fillStyle = '#FF69B4';
      ctx.shadowColor = 'transparent';
      this.drawHeart(ctx, this.x + size * 0.5, this.y - size * 0.5, size * 0.25);
    }
  }

  /**
   * 绘制爱心
   */
  drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size * 0.5, y - size * 0.3, x - size, y + size * 0.3, x, y + size);
    ctx.bezierCurveTo(x + size, y + size * 0.3, x + size * 0.5, y - size * 0.3, x, y + size * 0.3);
    ctx.fill();
  }

  /**
   * 绘制广告标记（右上角视频图标）
   */
  drawAdBadge(ctx) {
    const badgeSize = 16;
    const badgeX = this.x + this.width / 2 - badgeSize / 2 - 4;
    const badgeY = this.y - this.height / 2 + badgeSize / 2 + 4;

    // 圆形背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // 播放三角形图标
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    const triSize = badgeSize * 0.35;
    ctx.moveTo(badgeX - triSize * 0.3, badgeY - triSize * 0.6);
    ctx.lineTo(badgeX - triSize * 0.3, badgeY + triSize * 0.6);
    ctx.lineTo(badgeX + triSize * 0.6, badgeY);
    ctx.closePath();
    ctx.fill();
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

  /**
   * 使颜色变暗
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 +
      (R > 0 ? R : 0) * 0x10000 +
      (G > 0 ? G : 0) * 0x100 +
      (B > 0 ? B : 0)
    ).toString(16).slice(1);
  }
}

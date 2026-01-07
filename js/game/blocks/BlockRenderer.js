/**
 * 方块渲染器
 * 使用Canvas绘制纯色几何图形和方向箭头
 */
import { DIRECTIONS } from './Block';

export default class BlockRenderer {
  /**
   * 渲染方块
   */
  static render(ctx, block) {
    const { x, y, width, height, direction, type } = block;

    ctx.save();

    // 绘制方块主体
    this.drawBlockBody(ctx, x, y, width, height, type);

    // 绘制方向箭头
    this.drawArrow(ctx, x, y, width, height, direction);

    ctx.restore();
  }

  /**
   * 绘制方块主体
   */
  static drawBlockBody(ctx, x, y, width, height, type) {
    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 渐变填充
    const color = this.getBlockColor(type);
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(color, 20));
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;

    // 绘制圆角矩形
    this.drawRoundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    // 绘制边框
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 绘制方向箭头
   */
  static drawArrow(ctx, x, y, width, height, direction) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const arrowSize = Math.min(width, height) * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);

    // 根据方向旋转
    const rotations = {
      [DIRECTIONS.UP]: 0,
      [DIRECTIONS.RIGHT]: Math.PI / 2,
      [DIRECTIONS.DOWN]: Math.PI,
      [DIRECTIONS.LEFT]: -Math.PI / 2
    };
    ctx.rotate(rotations[direction] || 0);

    // 绘制箭头
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.moveTo(0, -arrowSize / 2);
    ctx.lineTo(arrowSize / 2, arrowSize / 2);
    ctx.lineTo(-arrowSize / 2, arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * 获取方块颜色
   */
  static getBlockColor(type) {
    const colors = {
      'square': '#4ECDC4',    // 青色
      'circle': '#FF6B6B',    // 红色
      'triangle': '#FFE66D',  // 黄色
      'diamond': '#A8E6CF'    // 绿色
    };
    return colors[type] || colors['square'];
  }

  /**
   * 绘制圆角矩形
   */
  static drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 使颜色变亮
   */
  static lightenColor(color, percent) {
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

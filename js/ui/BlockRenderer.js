/**
 * 动物方块渲染器（PRD v1.3 更新版）
 * 根据参考截图设计：
 * - 胶囊状/长条形造型
 * - 主要3种动物：猪（粉色）、羊（白色）、狗（橙黄色）
 * - 有明显的动物头尾区分
 */

import { DIRECTIONS } from "../game/blocks/Block";
import {
  ANIMAL_TYPES,
  getAnimalColor,
} from "./UIConstants";

export default class BlockRenderer {
  /**
   * 渲染方块
   */
  static render(ctx, block) {
    const { x, y, width, height, direction, type } = block;

    // 计算综合缩放（滑出缩放 + 弹跳缩放）
    const slideScale = block.slideScale || 1;
    const bounceScale = block.bounceScale || 1;
    const scale = slideScale * bounceScale;

    ctx.save();

    // 以碰撞盒中心为原点，旋转绘制“胶囊本体45°”
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const bodyW = block.bodyWidth || Math.max(width, height);
    const bodyH = block.bodyHeight || Math.min(width, height);
    const rotation = typeof block.rotation === "number" ? block.rotation : 0;

    ctx.translate(centerX, centerY);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.rotate(rotation);

    // 在局部坐标系中绘制（头部默认朝向 +X）
    this.drawAnimalBody(
      ctx,
      -bodyW / 2,
      -bodyH / 2,
      bodyW,
      bodyH,
      direction,
      type
    );

    ctx.restore();
  }

  /**
   * 绘制动物身体（胶囊状）- 效果图风格
   */
  static drawAnimalBody(ctx, x, y, width, height, direction, animalType) {
    const color = getAnimalColor(animalType);

    // 阴影效果（更强烈）
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // 身体渐变（沿长轴）
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, this.lightenColor(color, 20));
    gradient.addColorStop(0.45, color);
    gradient.addColorStop(1, this.darkenColor(color, 18));

    ctx.fillStyle = gradient;

    // 绘制流线型身体
    this.drawTaperedBodyPath(ctx, x, y, width, height);
    ctx.fill();

    // 清除阴影
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 明显的深色边框（效果图风格）
    ctx.strokeStyle = this.darkenColor(color, 45);
    ctx.lineWidth = 2;
    this.drawTaperedBodyPath(ctx, x, y, width, height);
    ctx.stroke();

    // 顶部高光
    const highlightGradient = ctx.createLinearGradient(
      x,
      y,
      x,
      y + height * 0.5
    );
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.save();
    this.drawTaperedBodyPath(ctx, x, y, width, height);
    ctx.clip();
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width, height * 0.5);
    ctx.restore();

    // 轻微头部阴影，强调头部但不割裂
    ctx.save();
    this.drawTaperedBodyPath(ctx, x, y, width, height);
    ctx.clip();
    const headGlow = ctx.createRadialGradient(
      x + width * 0.82,
      y + height * 0.5,
      height * 0.08,
      x + width * 0.82,
      y + height * 0.5,
      height * 0.55
    );
    headGlow.addColorStop(0, 'rgba(0, 0, 0, 0.08)');
    headGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = headGlow;
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // 绘制动物特征
    this.drawAnimalFeatures(ctx, x, y, width, height, direction, animalType);
  }

  /**
   * 绘制流线型身体路径（尾部略窄、腹部更宽）
   */
  static drawTaperedBodyPath(ctx, x, y, width, height) {
    const centerY = y + height / 2;
    const maxRadius = height / 2;
    let tailRadius = height * 0.5;
    let headRadius = height * 0.4;
    const minGap = Math.max(4, width * 0.06);
    if (tailRadius + headRadius + minGap > width) {
      const scale = (width - minGap) / (tailRadius + headRadius);
      tailRadius *= scale;
      headRadius *= scale;
    }
    tailRadius = Math.min(maxRadius, tailRadius);
    headRadius = Math.min(maxRadius, headRadius);

    const tailCenterX = x + tailRadius;
    const headCenterX = x + width - headRadius;
    const c1x = x + width * 0.35;
    const c2x = x + width * 0.7;

    ctx.beginPath();
    ctx.moveTo(tailCenterX, centerY - tailRadius);
    ctx.bezierCurveTo(
      c1x,
      centerY - tailRadius,
      c2x,
      centerY - headRadius,
      headCenterX,
      centerY - headRadius
    );
    ctx.arc(headCenterX, centerY, headRadius, -Math.PI / 2, Math.PI / 2, false);
    ctx.bezierCurveTo(
      c2x,
      centerY + headRadius,
      c1x,
      centerY + tailRadius,
      tailCenterX,
      centerY + tailRadius
    );
    ctx.arc(tailCenterX, centerY, tailRadius, Math.PI / 2, -Math.PI / 2, false);
    ctx.closePath();
  }

  /**
   * 绘制动物特征（头部和尾部）
   */
  static drawAnimalFeatures(ctx, x, y, width, height, direction, animalType) {
    ctx.save();

    // 已在 render() 里整体 rotate 过（对角线方向），这里不再按方向旋转
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.translate(centerX, centerY);

    const bodyLength = Math.max(width, height);
    const bodyWidth = Math.min(width, height);

    // 根据动物类型绘制不同特征
    switch (animalType) {
      case ANIMAL_TYPES.PIG:
      case "pig":
        this.drawPigFeatures(ctx, bodyLength, bodyWidth);
        break;
      case ANIMAL_TYPES.SHEEP:
      case "sheep":
        this.drawSheepFeatures(ctx, bodyLength, bodyWidth);
        break;
      case ANIMAL_TYPES.DOG:
      case "dog":
        this.drawDogFeatures(ctx, bodyLength, bodyWidth);
        break;
      default:
        this.drawDefaultFeatures(ctx, bodyLength, bodyWidth);
    }

    ctx.restore();
  }

  /**
   * 绘制猪特征（粉色）
   */
  static drawPigFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - 8;
    const tailX = -bodyLength / 2 + 6;

    // 猪鼻子
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.ellipse(headX, 0, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鼻孔
    ctx.fillStyle = "#C71585";
    ctx.beginPath();
    ctx.arc(headX - 2, 0, 1.5, 0, Math.PI * 2);
    ctx.arc(headX + 2, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(headX - 8, -bodyWidth * 0.15, 2.5, 0, Math.PI * 2);
    ctx.arc(headX - 8, bodyWidth * 0.15, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(headX - 9, -bodyWidth * 0.15 - 1, 1, 0, Math.PI * 2);
    ctx.arc(headX - 9, bodyWidth * 0.15 - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.ellipse(headX - 12, -bodyWidth * 0.35, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX - 12, bodyWidth * 0.35, 5, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 猪尾巴（卷曲）
    ctx.strokeStyle = "#FFB6C1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.bezierCurveTo(tailX - 5, -3, tailX - 8, 3, tailX - 6, -5);
    ctx.stroke();
  }

  /**
   * 绘制羊特征（白色）
   */
  static drawSheepFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - 6;
    const tailX = -bodyLength / 2 + 5;

    // 羊头（深色）
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.ellipse(headX, 0, 7, bodyWidth * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(headX + 2, -bodyWidth * 0.12, 2, 0, Math.PI * 2);
    ctx.arc(headX + 2, bodyWidth * 0.12, 2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(headX + 1, -bodyWidth * 0.12 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.arc(headX + 1, bodyWidth * 0.12 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 羊耳朵
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.ellipse(headX - 5, -bodyWidth * 0.4, 4, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX - 5, bodyWidth * 0.4, 4, 6, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 羊毛纹理（身体上的小圆）
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    for (let i = 0; i < 5; i++) {
      const wx = -bodyLength * 0.3 + i * 8;
      ctx.beginPath();
      ctx.arc(wx, ((i % 2) - 0.5) * 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 尾巴
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(tailX, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 绘制狗特征（橙黄色）
   */
  static drawDogFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - 6;
    const tailX = -bodyLength / 2 + 5;

    // 狗头（圆形）
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(headX, 0, bodyWidth * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(headX + 5, 0, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(headX - 2, -bodyWidth * 0.15, 2.5, 0, Math.PI * 2);
    ctx.arc(headX - 2, bodyWidth * 0.15, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(headX - 3, -bodyWidth * 0.15 - 1, 1, 0, Math.PI * 2);
    ctx.arc(headX - 3, bodyWidth * 0.15 - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // 狗耳朵（垂耳）
    ctx.fillStyle = "#D2691E";
    ctx.beginPath();
    ctx.ellipse(headX - 8, -bodyWidth * 0.4, 4, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX - 8, bodyWidth * 0.4, 4, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.strokeStyle = "#D2691E";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.quadraticCurveTo(tailX - 8, -6, tailX - 5, -10);
    ctx.stroke();
  }

  /**
   * 绘制默认特征（兼容旧类型）
   */
  static drawDefaultFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - 8;

    // 简单的头部
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(headX, 0, bodyWidth * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(headX + 3, -bodyWidth * 0.12, 2, 0, Math.PI * 2);
    ctx.arc(headX + 3, bodyWidth * 0.12, 2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(headX + 2, -bodyWidth * 0.12 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.arc(headX + 2, bodyWidth * 0.12 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 默认耳朵
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.beginPath();
    ctx.arc(headX - 6, -bodyWidth * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX - 6, bodyWidth * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 使颜色变亮
   */
  static lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      "#" +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  /**
   * 使颜色变暗
   */
  static darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      "#" +
      (
        0x1000000 +
        (R > 0 ? R : 0) * 0x10000 +
        (G > 0 ? G : 0) * 0x100 +
        (B > 0 ? B : 0)
      )
        .toString(16)
        .slice(1)
    );
  }
}

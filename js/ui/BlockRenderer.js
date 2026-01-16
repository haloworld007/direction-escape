/**
 * 动物方块渲染器（圆润胶囊风格 2.5:1 版本）
 * 设计特点：
 * - 圆润的胶囊状身体（长宽比 2.5:1）
 * - 简洁的头部特征：眼睛 + 鼻子 + 小耳朵
 * - 5种主要动物：猪（粉色）、羊（白色）、狗（橙黄色）、狐狸（橙红色）、熊猫（黑白）
 * - Q萌可爱的整体造型
 */

import { DIRECTIONS } from "../game/blocks/Block";
import { ANIMAL_TYPES, getAnimalColor } from "./UIConstants";

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

    // 以碰撞盒中心为原点，旋转绘制"胶囊本体45°"
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
   * 绘制动物身体（圆润胶囊状）- Q萌风格
   */
  static drawAnimalBody(ctx, x, y, width, height, direction, animalType) {
    const color = getAnimalColor(animalType);

    // 阴影效果
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // 身体渐变（沿长轴）
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, this.lightenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 15));

    ctx.fillStyle = gradient;

    // 绘制圆润胶囊身体
    this.drawCapsulePath(ctx, x, y, width, height);
    ctx.fill();

    // 清除阴影
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 柔和边框
    ctx.strokeStyle = this.darkenColor(color, 30);
    ctx.lineWidth = 1.5;
    this.drawCapsulePath(ctx, x, y, width, height);
    ctx.stroke();

    // 顶部高光
    const highlightGradient = ctx.createLinearGradient(
      x,
      y,
      x,
      y + height * 0.4
    );
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.45)");
    highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.save();
    this.drawCapsulePath(ctx, x, y, width, height);
    ctx.clip();
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width, height * 0.45);
    ctx.restore();

    // 绘制动物特征
    this.drawAnimalFeatures(ctx, x, y, width, height, direction, animalType);
  }

  /**
   * 绘制圆润胶囊路径（2.5:1 比例优化）
   */
  static drawCapsulePath(ctx, x, y, width, height) {
    const centerY = y + height / 2;
    const radius = height / 2;

    // 左右两端使用相同的圆角半径，形成标准胶囊形
    const leftCenterX = x + radius;
    const rightCenterX = x + width - radius;

    ctx.beginPath();
    // 顶部直线
    ctx.moveTo(leftCenterX, y);
    ctx.lineTo(rightCenterX, y);
    // 右端圆弧（头部）
    ctx.arc(rightCenterX, centerY, radius, -Math.PI / 2, Math.PI / 2, false);
    // 底部直线
    ctx.lineTo(leftCenterX, y + height);
    // 左端圆弧（尾部）
    ctx.arc(leftCenterX, centerY, radius, Math.PI / 2, -Math.PI / 2, false);
    ctx.closePath();
  }

  /**
   * 绘制动物特征（头部和尾部）
   */
  static drawAnimalFeatures(ctx, x, y, width, height, direction, animalType) {
    ctx.save();

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
      case ANIMAL_TYPES.FOX:
      case "fox":
        this.drawFoxFeatures(ctx, bodyLength, bodyWidth);
        break;
      case ANIMAL_TYPES.PANDA:
      case "panda":
        this.drawPandaFeatures(ctx, bodyLength, bodyWidth);
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
   * 绘制猪特征（粉色）- 简洁版
   * 眼睛 + 椭圆粉鼻+鼻孔 + 小三角耳 + 卷尾
   */
  static drawPigFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const tailX = -bodyLength / 2 + bodyWidth * 0.25;
    const s = bodyWidth / 18; // 缩放因子

    // 小三角耳朵
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.moveTo(headX - 4 * s, -bodyWidth * 0.3);
    ctx.lineTo(headX - 8 * s, -bodyWidth * 0.55);
    ctx.lineTo(headX - 1 * s, -bodyWidth * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX - 4 * s, bodyWidth * 0.3);
    ctx.lineTo(headX - 8 * s, bodyWidth * 0.55);
    ctx.lineTo(headX - 1 * s, bodyWidth * 0.35);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    const eyeX = headX - 3 * s;
    const eyeY = bodyWidth * 0.15;
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.8 * s, -eyeY - 0.8 * s, 1 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.8 * s, eyeY - 0.8 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();

    // 椭圆粉鼻子
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.ellipse(headX + 3 * s, 0, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // 鼻孔
    ctx.fillStyle = "#C71585";
    ctx.beginPath();
    ctx.arc(headX + 3 * s, -1.2 * s, 1 * s, 0, Math.PI * 2);
    ctx.arc(headX + 3 * s, 1.2 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();

    // 卷尾
    ctx.strokeStyle = "#FFB6C1";
    ctx.lineWidth = 2 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.bezierCurveTo(
      tailX - 4 * s,
      -2 * s,
      tailX - 6 * s,
      2 * s,
      tailX - 4 * s,
      -4 * s
    );
    ctx.stroke();
  }

  /**
   * 绘制羊特征（白色）- 简洁版
   * 眼睛 + 小黑鼻 + 小垂耳 + 绒球尾
   */
  static drawSheepFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const tailX = -bodyLength / 2 + bodyWidth * 0.25;
    const s = bodyWidth / 18;

    // 小垂耳
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.ellipse(
      headX - 4 * s,
      -bodyWidth * 0.35,
      2.5 * s,
      4 * s,
      -0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      headX - 4 * s,
      bodyWidth * 0.35,
      2.5 * s,
      4 * s,
      0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 眼睛
    const eyeX = headX - 1 * s;
    const eyeY = bodyWidth * 0.12;
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.6 * s, -eyeY - 0.6 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.6 * s, eyeY - 0.6 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fill();

    // 小黑鼻
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.ellipse(headX + 4 * s, 0, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 绒球尾巴
    ctx.fillStyle = "#F5F5F5";
    ctx.beginPath();
    ctx.arc(tailX, 0, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#DDD";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * 绘制狗特征（橙黄色）- 简洁版
   * 眼睛 + 黑鼻头 + 小垂耳 + 翘尾
   */
  static drawDogFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const tailX = -bodyLength / 2 + bodyWidth * 0.25;
    const s = bodyWidth / 18;

    // 小垂耳
    ctx.fillStyle = "#C97C3C";
    ctx.beginPath();
    ctx.ellipse(
      headX - 4 * s,
      -bodyWidth * 0.35,
      3 * s,
      5 * s,
      -0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      headX - 4 * s,
      bodyWidth * 0.35,
      3 * s,
      5 * s,
      0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 眼睛
    const eyeX = headX - 1 * s;
    const eyeY = bodyWidth * 0.14;
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.7 * s, -eyeY - 0.7 * s, 1 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.7 * s, eyeY - 0.7 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();

    // 黑鼻头
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.ellipse(headX + 4 * s, 0, 2.5 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 翘尾
    ctx.strokeStyle = "#C97C3C";
    ctx.lineWidth = 3 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.quadraticCurveTo(tailX - 5 * s, -4 * s, tailX - 3 * s, -7 * s);
    ctx.stroke();
  }

  /**
   * 绘制狐狸特征（橙红色）- 简洁版
   * 眼睛 + 黑鼻尖 + 小尖耳 + 白尖尾
   */
  static drawFoxFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const tailX = -bodyLength / 2 + bodyWidth * 0.25;
    const s = bodyWidth / 18;

    // 小尖耳
    ctx.fillStyle = "#E65100";
    ctx.beginPath();
    ctx.moveTo(headX - 3 * s, -bodyWidth * 0.25);
    ctx.lineTo(headX - 7 * s, -bodyWidth * 0.55);
    ctx.lineTo(headX, -bodyWidth * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX - 3 * s, bodyWidth * 0.25);
    ctx.lineTo(headX - 7 * s, bodyWidth * 0.55);
    ctx.lineTo(headX, bodyWidth * 0.3);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    const eyeX = headX - 1 * s;
    const eyeY = bodyWidth * 0.12;
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.3 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.3 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.6 * s, -eyeY - 0.6 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.6 * s, eyeY - 0.6 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fill();

    // 黑鼻尖
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.ellipse(headX + 4 * s, 0, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴主体
    ctx.fillStyle = "#E65100";
    ctx.beginPath();
    ctx.ellipse(tailX - 2 * s, 0, 5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // 白尖尾
    ctx.fillStyle = "#FFF8E1";
    ctx.beginPath();
    ctx.ellipse(tailX - 6 * s, 0, 2.5 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 绘制熊猫特征（黑白）- 简洁版
   * 黑眼圈+眼珠 + 黑鼻 + 小圆耳 + 小黑尾
   */
  static drawPandaFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const tailX = -bodyLength / 2 + bodyWidth * 0.25;
    const s = bodyWidth / 18;

    // 小圆耳
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(headX - 5 * s, -bodyWidth * 0.38, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX - 5 * s, bodyWidth * 0.38, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // 黑眼圈
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.ellipse(
      headX - 1 * s,
      -bodyWidth * 0.14,
      3.5 * s,
      2.5 * s,
      -0.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      headX - 1 * s,
      bodyWidth * 0.14,
      3.5 * s,
      2.5 * s,
      0.2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 眼珠
    const eyeX = headX - 0.5 * s;
    const eyeY = bodyWidth * 0.14;
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 1.8 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.5 * s, -eyeY - 0.5 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.5 * s, eyeY - 0.5 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // 黑鼻
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.ellipse(headX + 3.5 * s, 0, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 小黑尾
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(tailX, 0, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 绘制默认特征（兼容旧类型）
   */
  static drawDefaultFeatures(ctx, bodyLength, bodyWidth) {
    const headX = bodyLength / 2 - bodyWidth * 0.35;
    const s = bodyWidth / 18;

    // 眼睛
    const eyeX = headX - 2 * s;
    const eyeY = bodyWidth * 0.13;
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(eyeX - 0.6 * s, -eyeY - 0.6 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.arc(eyeX - 0.6 * s, eyeY - 0.6 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.ellipse(headX + 4 * s, 0, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 小耳朵
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(headX - 5 * s, -bodyWidth * 0.35, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX - 5 * s, bodyWidth * 0.35, 3 * s, 0, Math.PI * 2);
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

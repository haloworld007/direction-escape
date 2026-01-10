/**
 * 弹窗渲染器
 * 根据 PRD.md 第十六、十八章节设计
 * - 胜利弹窗
 * - 失败弹窗（死局）
 * - 道具确认弹窗
 */

import Button from './Button';
import { COLORS, FONT_SIZES, BUTTON_SIZES, drawRoundRect } from './UIConstants';

export default class ModalRenderer {
  constructor() {
    this.currentModal = null;
    this.buttons = {};
    this.animationProgress = 0;
    this.isAnimating = false;
  }

  /**
   * 显示胜利弹窗
   */
  showVictory() {
    this.currentModal = 'victory';
    this.initVictoryButtons();
    this.startAnimation();
  }

  /**
   * 显示失败弹窗
   */
  showDefeat() {
    this.currentModal = 'defeat';
    this.initDefeatButtons();
    this.startAnimation();
  }

  /**
   * 隐藏弹窗
   */
  hide() {
    this.currentModal = null;
    this.buttons = {};
    this.animationProgress = 0;
  }

  /**
   * 启动动画
   */
  startAnimation() {
    this.isAnimating = true;
    this.animationProgress = 0;
  }

  /**
   * 初始化胜利弹窗按钮
   */
  initVictoryButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const buttonY = modalY + 180;

    // 下一关按钮（主按钮）
    this.buttons.next = new Button(
      '下一关',
      centerX - BUTTON_SIZES.PRIMARY.WIDTH / 2,
      buttonY,
      {
        width: BUTTON_SIZES.PRIMARY.WIDTH,
        height: BUTTON_SIZES.PRIMARY.HEIGHT,
        backgroundColor: COLORS.PRIMARY_BUTTON,
        fontSize: FONT_SIZES.BUTTON
      }
    );

    // 重玩按钮（次按钮，较小）
    this.buttons.replay = new Button(
      '重玩',
      centerX - BUTTON_SIZES.SECONDARY.WIDTH / 2,
      buttonY + BUTTON_SIZES.PRIMARY.HEIGHT + 15,
      {
        width: BUTTON_SIZES.SECONDARY.WIDTH,
        height: BUTTON_SIZES.SECONDARY.HEIGHT,
        backgroundColor: '#78909C',
        fontSize: 14
      }
    );
  }

  /**
   * 初始化失败弹窗按钮
   */
  initDefeatButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const buttonY = modalY + 180;

    // 使用道具按钮
    this.buttons.useProp = new Button(
      '使用道具',
      centerX - BUTTON_SIZES.PRIMARY.WIDTH / 2,
      buttonY,
      {
        width: BUTTON_SIZES.PRIMARY.WIDTH,
        height: BUTTON_SIZES.PRIMARY.HEIGHT,
        backgroundColor: '#4FC3F7',
        fontSize: FONT_SIZES.BUTTON
      }
    );

    // 重试按钮（次按钮）
    this.buttons.retry = new Button(
      '重试',
      centerX - BUTTON_SIZES.SECONDARY.WIDTH / 2,
      buttonY + BUTTON_SIZES.PRIMARY.HEIGHT + 15,
      {
        width: BUTTON_SIZES.SECONDARY.WIDTH,
        height: BUTTON_SIZES.SECONDARY.HEIGHT,
        backgroundColor: '#78909C',
        fontSize: 14
      }
    );
  }

  /**
   * 更新动画
   */
  update() {
    if (this.isAnimating) {
      this.animationProgress += 0.05;
      if (this.animationProgress >= 1) {
        this.animationProgress = 1;
        this.isAnimating = false;
      }
    }
  }

  /**
   * 渲染弹窗
   */
  render(ctx, databus) {
    if (!this.currentModal) return;

    // 更新动画
    this.update();

    // 绘制半透明背景遮罩
    this.drawBackdrop(ctx);

    // 计算动画缩放
    const scale = this.easeOutBack(this.animationProgress);

    // 根据类型绘制弹窗
    if (this.currentModal === 'victory') {
      this.drawVictoryModal(ctx, databus, scale);
    } else if (this.currentModal === 'defeat') {
      this.drawDefeatModal(ctx, databus, scale);
    }

    // 绘制按钮
    Object.values(this.buttons).forEach(button => {
      button.render(ctx);
    });
  }

  /**
   * 绘制背景遮罩
   */
  drawBackdrop(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * 绘制胜利弹窗
   */
  drawVictoryModal(ctx, databus, scale) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const modalWidth = screenWidth * 0.8;
    const modalHeight = 300;

    ctx.save();

    // 应用缩放动画
    ctx.translate(centerX, modalY + modalHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(modalY + modalHeight / 2));

    // 弹窗背景（白色圆角卡片）
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = 'white';
    drawRoundRect(
      ctx,
      centerX - modalWidth / 2,
      modalY,
      modalWidth,
      modalHeight,
      20
    );
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // 标题
    ctx.fillStyle = COLORS.TEXT_PRIMARY;
    ctx.font = `bold ${FONT_SIZES.TITLE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('关卡完成！', centerX, modalY + 30);

    // 庆祝动画（简单粒子效果）
    this.drawCelebration(ctx, centerX, modalY + 100);

    // 进度信息
    const progress = databus.getProgress();
    ctx.fillStyle = COLORS.TEXT_SECONDARY;
    ctx.font = `${FONT_SIZES.SUBTITLE}px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText(`已消除 ${databus.removedBlocks} / ${databus.totalBlocks} 个方块`, centerX, modalY + 150);

    // 星级评价（可选）
    this.drawStars(ctx, centerX, modalY + 200, 3);

    ctx.restore();
  }

  /**
   * 绘制失败弹窗
   */
  drawDefeatModal(ctx, databus, scale) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const modalWidth = screenWidth * 0.8;
    const modalHeight = 300;

    ctx.save();

    // 应用缩放动画
    ctx.translate(centerX, modalY + modalHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(modalY + modalHeight / 2));

    // 弹窗背景
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = 'white';
    drawRoundRect(
      ctx,
      centerX - modalWidth / 2,
      modalY,
      modalWidth,
      modalHeight,
      20
    );
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // 标题（避免使用"失败"字样）
    ctx.fillStyle = COLORS.TEXT_PRIMARY;
    ctx.font = `bold ${FONT_SIZES.TITLE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('没有可消除的方块啦', centerX, modalY + 30);

    // 困惑的动物表情
    this.drawConfusedFace(ctx, centerX, modalY + 100);

    // 提示文字
    ctx.fillStyle = COLORS.TEXT_SECONDARY;
    ctx.font = `${FONT_SIZES.HINT}px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText('使用道具可以帮助你解围哦', centerX, modalY + 160);

    // 道具数量提示
    const totalProps = databus.items.grab + databus.items.flip + databus.items.shuffle;
    ctx.fillText(`剩余道具: ${totalProps} 个`, centerX, modalY + 190);

    ctx.restore();
  }

  /**
   * 绘制庆祝动画
   */
  drawCelebration(ctx, x, y) {
    // 简单的彩带效果
    const colors = ['#FF5252', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'];
    const time = Date.now() / 1000;

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i + time;
      const radius = 30 + Math.sin(time * 3 + i) * 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 绘制困惑表情
   */
  drawConfusedFace(ctx, x, y) {
    const size = 60;

    // 脸部
    ctx.fillStyle = '#FFCC80';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛（困惑眼神）
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 20, y - 10, 8, 0, Math.PI * 2);
    ctx.arc(x + 20, y - 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // 眼珠（看向两边）
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x - 22, y - 10, 3, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // 疑问号
    ctx.fillStyle = '#333';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + 25);
  }

  /**
   * 绘制星星
   */
  drawStars(ctx, x, y, count) {
    const starSize = 20;
    const spacing = 30;
    const startX = x - ((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      this.drawStar(ctx, startX + i * spacing, y, starSize, '#FFC107');
    }
  }

  /**
   * 绘制单个星星
   */
  drawStar(ctx, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 5;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }

      const innerAngle = angle + Math.PI / 5;
      const innerX = x + Math.cos(innerAngle) * (size * 0.4);
      const innerY = y + Math.sin(innerAngle) * (size * 0.4);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 缓动函数：easeOutBack
   */
  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * 获取按钮
   */
  getButton(name) {
    return this.buttons[name];
  }

  /**
   * 检查是否正在显示弹窗
   */
  isModalVisible() {
    return this.currentModal !== null;
  }
}

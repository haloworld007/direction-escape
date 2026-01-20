/**
 * 弹窗渲染器（简洁版）
 * - 胜利弹窗
 * - 失败弹窗（死局）
 * - Toast 提示（自动消失）
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

    // Toast 相关
    this.toastMessage = '';
    this.toastStartTime = 0;
    this.toastDuration = 1500; // 默认1.5秒
    this.showingToast = false;

    // 确认弹窗相关
    this.confirmData = null;
    this.confirmCallback = null;
  }

  // ==================== Toast 提示 ====================

  /**
   * 显示 Toast 提示（简洁版，自动消失）
   * @param {string} message - 提示文字
   * @param {number} duration - 持续时间（毫秒）
   */
  showToast(message, duration = 1500) {
    this.toastMessage = message;
    this.toastDuration = duration;
    this.toastStartTime = Date.now();
    this.showingToast = true;
  }

  /**
   * 隐藏 Toast
   */
  hideToast() {
    this.showingToast = false;
    this.toastMessage = '';
  }

  /**
   * 渲染 Toast（简洁卡片风格）
   */
  renderToast(ctx) {
    if (!this.showingToast) return;

    // 检查是否超时
    const elapsed = Date.now() - this.toastStartTime;
    if (elapsed >= this.toastDuration) {
      this.hideToast();
      return;
    }

    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 计算淡入淡出
    let alpha = 1;
    if (elapsed < 150) {
      alpha = elapsed / 150; // 淡入
    } else if (elapsed > this.toastDuration - 300) {
      alpha = (this.toastDuration - elapsed) / 300; // 淡出
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Toast 尺寸
    ctx.font = `${FONT_SIZES.BUTTON}px Arial`;
    const textWidth = ctx.measureText(this.toastMessage).width;
    const toastWidth = Math.min(screenWidth * 0.8, textWidth + 40);
    const toastHeight = 44;
    const toastX = (screenWidth - toastWidth) / 2;
    const toastY = screenHeight * 0.4;

    // 背景（深色半透明）
    ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
    drawRoundRect(ctx, toastX, toastY, toastWidth, toastHeight, 22);
    ctx.fill();

    // 文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${FONT_SIZES.BUTTON}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.toastMessage, screenWidth / 2, toastY + toastHeight / 2);

    ctx.restore();
  }

  // ==================== 确认弹窗 ====================

  /**
   * 显示确认弹窗（简洁版）
   * @param {Object} data - { title, message, confirmText, cancelText }
   * @param {Function} callback - 确认后的回调
   */
  showConfirm(data, callback) {
    this.currentModal = 'confirm';
    this.confirmData = {
      title: data.title || '提示',
      message: data.message || '',
      confirmText: data.confirmText || '确定',
      cancelText: data.cancelText || '取消'
    };
    this.confirmCallback = callback;
    this.initConfirmButtons();
    this.startAnimation();
  }

  /**
   * 初始化确认弹窗按钮
   */
  initConfirmButtons() {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const buttonY = modalY + 120;
    const buttonGap = 15;
    const buttonWidth = 100;

    // 取消按钮
    this.buttons.cancel = new Button(
      this.confirmData.cancelText,
      centerX - buttonWidth - buttonGap / 2,
      buttonY,
      {
        width: buttonWidth,
        height: 44,
        backgroundColor: '#9E9E9E',
        fontSize: 15
      }
    );

    // 确认按钮
    this.buttons.confirm = new Button(
      this.confirmData.confirmText,
      centerX + buttonGap / 2,
      buttonY,
      {
        width: buttonWidth,
        height: 44,
        backgroundColor: '#4CAF50',
        fontSize: 15
      }
    );
  }

  /**
   * 绘制确认弹窗（简洁版）
   */
  drawConfirmModal(ctx, scale) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const modalWidth = screenWidth * 0.75;
    const modalHeight = 180;

    ctx.save();

    // 缩放动画
    ctx.translate(centerX, modalY + modalHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(modalY + modalHeight / 2));

    // 白色圆角卡片
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'white';
    drawRoundRect(ctx, centerX - modalWidth / 2, modalY, modalWidth, modalHeight, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 标题
    ctx.fillStyle = COLORS.TEXT_PRIMARY;
    ctx.font = `bold 18px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.confirmData.title, centerX, modalY + 25);

    // 内容
    ctx.fillStyle = COLORS.TEXT_SECONDARY;
    ctx.font = `15px Arial`;
    ctx.fillText(this.confirmData.message, centerX, modalY + 60);

    ctx.restore();
  }

  // ==================== 胜利/失败弹窗 ====================

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
    this.confirmData = null;
    this.confirmCallback = null;
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
    const buttonY = modalY + 140;

    // 下一关按钮
    this.buttons.next = new Button(
      '下一关',
      centerX - BUTTON_SIZES.PRIMARY.WIDTH / 2,
      buttonY,
      {
        width: BUTTON_SIZES.PRIMARY.WIDTH,
        height: BUTTON_SIZES.PRIMARY.HEIGHT,
        backgroundColor: '#4CAF50',
        fontSize: FONT_SIZES.BUTTON
      }
    );

    // 重玩按钮
    this.buttons.replay = new Button(
      '重玩',
      centerX - BUTTON_SIZES.SECONDARY.WIDTH / 2,
      buttonY + BUTTON_SIZES.PRIMARY.HEIGHT + 12,
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
    const buttonY = modalY + 130;

    // 使用道具按钮
    this.buttons.useProp = new Button(
      '使用道具',
      centerX - BUTTON_SIZES.PRIMARY.WIDTH / 2,
      buttonY,
      {
        width: BUTTON_SIZES.PRIMARY.WIDTH,
        height: BUTTON_SIZES.PRIMARY.HEIGHT,
        backgroundColor: '#2196F3',
        fontSize: FONT_SIZES.BUTTON
      }
    );

    // 重试按钮
    this.buttons.retry = new Button(
      '重开本关',
      centerX - BUTTON_SIZES.SECONDARY.WIDTH / 2,
      buttonY + BUTTON_SIZES.PRIMARY.HEIGHT + 12,
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
      this.animationProgress += 0.08;
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
    // 先渲染 Toast（不阻挡其他操作）
    this.renderToast(ctx);

    if (!this.currentModal) return;

    // 更新动画
    this.update();

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 缩放动画
    const scale = this.easeOutBack(this.animationProgress);

    // 根据类型绘制
    if (this.currentModal === 'victory') {
      this.drawVictoryModal(ctx, databus, scale);
    } else if (this.currentModal === 'defeat') {
      this.drawDefeatModal(ctx, databus, scale);
    } else if (this.currentModal === 'confirm') {
      this.drawConfirmModal(ctx, scale);
    }

    // 绘制按钮
    Object.values(this.buttons).forEach(button => {
      button.render(ctx);
    });
  }

  /**
   * 绘制胜利弹窗（简洁版）
   */
  drawVictoryModal(ctx, databus, scale) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const modalWidth = screenWidth * 0.75;
    const modalHeight = 240;

    ctx.save();

    ctx.translate(centerX, modalY + modalHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(modalY + modalHeight / 2));

    // 白色卡片
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'white';
    drawRoundRect(ctx, centerX - modalWidth / 2, modalY, modalWidth, modalHeight, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 标题
    ctx.fillStyle = '#4CAF50';
    ctx.font = `bold 24px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('关卡完成！', centerX, modalY + 30);

    // 进度信息
    ctx.fillStyle = COLORS.TEXT_SECONDARY;
    ctx.font = `16px Arial`;
    ctx.fillText(`已消除 ${databus.removedBlocks} / ${databus.totalBlocks} 个方块`, centerX, modalY + 75);

    // 简洁星星
    this.drawSimpleStars(ctx, centerX, modalY + 110, 3);

    ctx.restore();
  }

  /**
   * 绘制失败弹窗（简洁版）
   */
  drawDefeatModal(ctx, databus, scale) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const centerX = screenWidth / 2;
    const modalY = screenHeight * 0.35;
    const modalWidth = screenWidth * 0.75;
    const modalHeight = 220;

    ctx.save();

    ctx.translate(centerX, modalY + modalHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(modalY + modalHeight / 2));

    // 白色卡片
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'white';
    drawRoundRect(ctx, centerX - modalWidth / 2, modalY, modalWidth, modalHeight, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 标题
    ctx.fillStyle = '#FF9800';
    ctx.font = `bold 20px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('没有可消除的方块了', centerX, modalY + 30);

    // 提示
    ctx.fillStyle = COLORS.TEXT_SECONDARY;
    ctx.font = `15px Arial`;
    ctx.fillText('使用道具可以帮助你解围', centerX, modalY + 70);

    // 道具数量
    const totalProps = (databus.items.grab || 0) + (databus.items.flip || 0) + 
                       (databus.items.shufflePos || 0) + (databus.items.shuffleDir || 0);
    ctx.fillText(`剩余道具: ${totalProps} 个`, centerX, modalY + 95);

    ctx.restore();
  }

  /**
   * 绘制简洁星星
   */
  drawSimpleStars(ctx, x, y, count) {
    const size = 18;
    const spacing = 28;
    const startX = x - ((count - 1) * spacing) / 2;

    ctx.fillStyle = '#FFC107';
    for (let i = 0; i < count; i++) {
      const cx = startX + i * spacing;
      // 简单的五角星
    ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const angle = (Math.PI * 2 * j) / 5 - Math.PI / 2;
        const px = cx + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      const innerAngle = angle + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(innerAngle) * (size * 0.4), y + Math.sin(innerAngle) * (size * 0.4));
    }
    ctx.closePath();
    ctx.fill();
    }
  }

  /**
   * 缓动函数
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
   * 检查是否显示弹窗
   */
  isModalVisible() {
    return this.currentModal !== null;
  }

  /**
   * 获取确认回调
   */
  getConfirmCallback() {
    return this.confirmCallback;
  }
}

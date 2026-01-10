/**
 * 方块类（更新版）
 * 每个方块有固定朝向（上/下/左/右）
 * 可以检测是否可消除，执行消除动画等
 * 根据 PRD.md 第十三章节设计：胶囊状动物造型
 */
import Sprite from '../../base/sprite';
import BlockRenderer from '../../ui/BlockRenderer';
import DirectionDetector from '../algorithms/DirectionDetector';
import { ANIMAL_TYPES, BLOCK_SIZES } from '../../ui/UIConstants';

// 方向常量
export const DIRECTIONS = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3
};

export default class Block extends Sprite {
  constructor() {
    super('', 0, 0, 0, 0); // 不使用图片资源，只使用Canvas绘制

    // 核心属性
    this.direction = DIRECTIONS.UP; // 朝向
    this.type = ANIMAL_TYPES.CAT; // 动物类型（默认为猫）
    this.isRemoved = false; // 是否已消除
    this.isMoving = false; // 是否正在移动
    this.isShaking = false; // 是否正在抖动

    // 滑出动画相关（使用缓动）
    this.slideStartTime = 0; // 滑动开始时间
    this.slideDuration = 400; // 滑动持续时间（ms）
    this.startX = 0; // 滑动起始X
    this.startY = 0; // 滑动起始Y
    this.targetX = 0; // 目标位置X
    this.targetY = 0; // 目标位置Y
    this.slideScale = 1; // 滑动时的缩放（美化效果）

    // 抖动相关
    this.shakeTimer = 0; // 抖动计时器
    this.shakeDuration = 0; // 抖动持续时间
    this.originalX = 0; // 原始X位置
    this.originalY = 0; // 原始Y位置

    // 点击弹跳效果
    this.bounceScale = 1;      // 弹跳缩放
    this.isBouncing = false;   // 是否正在弹跳
    this.bounceStartTime = 0;  // 弹跳开始时间
    this.bounceDuration = 150; // 弹跳持续时间（ms）
  }

  /**
   * 初始化方块
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} direction - 朝向（DIRECTIONS枚举）
   * @param {string} type - 动物类型
   * @param {number|null} size - 自定义尺寸（短边长度），null则使用默认尺寸
   */
  init(x, y, direction, type = ANIMAL_TYPES.CAT, size = null) {
    this.x = x;
    this.y = y;

    // 计算胶囊尺寸
    const shortSide = size || BLOCK_SIZES.WIDTH;  // 短边（宽度）
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);  // 长边（长度），保持比例

    // 根据方向设置尺寸（胶囊状）
    const isVertical = direction === DIRECTIONS.UP || direction === DIRECTIONS.DOWN;

    if (isVertical) {
      // 竖向：宽度短边，高度长边
      this.width = shortSide;
      this.height = longSide;
    } else {
      // 横向：宽度长边，高度短边
      this.width = longSide;
      this.height = shortSide;
    }

    this.direction = direction;
    this.type = type;
    this.isRemoved = false;
    this.isMoving = false;
    this.isShaking = false;
    this.visible = true;
    this.originalX = x;
    this.originalY = y;

    // 不使用图片资源
    this.img = null;

    return this;
  }

  /**
   * 检测是否可消除
   * 规则：沿朝向方向到屏幕边界无其他方块阻挡
   */
  canRemove(allBlocks) {
    if (this.isRemoved) return false;

    const isBlocked = DirectionDetector.isBlocked(this, allBlocks, canvas.width, canvas.height);
    console.log(`方块检测: position=(${this.x}, ${this.y}), direction=${this.direction}, isBlocked=${isBlocked}`);
    return !isBlocked;
  }

  /**
   * 消除方块
   * 沿朝向方向平滑滑动出屏幕边缘
   */
  remove() {
    if (this.isRemoved) return;

    this.isRemoved = true;
    this.isMoving = true;

    // 记录滑动起始位置和时间
    this.startX = this.x;
    this.startY = this.y;
    this.slideStartTime = Date.now();
    this.slideScale = 1;

    // 计算滑动到屏幕边缘的目标位置
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    switch (this.direction) {
      case DIRECTIONS.UP:
        this.targetX = this.x;
        this.targetY = -this.height - 20; // 滑出顶部
        break;
      case DIRECTIONS.RIGHT:
        this.targetX = screenWidth + 20; // 滑出右侧
        this.targetY = this.y;
        break;
      case DIRECTIONS.DOWN:
        this.targetX = this.x;
        this.targetY = screenHeight + 20; // 滑出底部
        break;
      case DIRECTIONS.LEFT:
        this.targetX = -this.width - 20; // 滑出左侧
        this.targetY = this.y;
        break;
    }

    // 根据滑动距离调整持续时间
    const dx = this.targetX - this.startX;
    const dy = this.targetY - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 短距离快一点，长距离慢一点（200-500ms）
    this.slideDuration = Math.min(500, Math.max(200, distance * 0.8));

    // 触发事件
    this.emit('remove', this);
  }

  /**
   * 抖动反馈
   * 当方块不可消除时调用
   */
  shake() {
    if (this.isShaking || this.isRemoved) return;

    this.isShaking = true;
    this.shakeDuration = 300; // 300ms
    this.shakeTimer = Date.now();
    this.originalX = this.x;
    this.originalY = this.y;
  }

  /**
   * 点击弹跳效果
   * 当方块被成功点击时调用
   */
  bounce() {
    if (this.isBouncing) return;
    
    this.isBouncing = true;
    this.bounceStartTime = Date.now();
  }

  /**
   * 翻转朝向
   * 用于道具效果
   */
  flip() {
    this.direction = (this.direction + 2) % 4;
  }

  /**
   * 更新状态
   */
  update() {
    // 更新移动
    if (this.isMoving) {
      this.updateMove();
    }

    // 更新抖动
    if (this.isShaking) {
      this.updateShake();
    }

    // 更新弹跳
    if (this.isBouncing) {
      this.updateBounce();
    }
  }

  /**
   * 更新移动动画（使用缓动函数）
   */
  updateMove() {
    const elapsed = Date.now() - this.slideStartTime;
    const progress = Math.min(elapsed / this.slideDuration, 1);
    
    // easeOutCubic 缓动：先快后慢，更自然的滑出效果
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // 计算当前位置
    this.x = this.startX + (this.targetX - this.startX) * eased;
    this.y = this.startY + (this.targetY - this.startY) * eased;
    
    // 滑出时轻微缩小（美化效果）
    this.slideScale = 1 - progress * 0.15;
    
    if (progress >= 1) {
      // 动画完成，完全移除
      this.visible = false;
      this.isMoving = false;
      this.emit('moveComplete', this);
    }
  }

  /**
   * 更新抖动动画
   */
  updateShake() {
    const elapsed = Date.now() - this.shakeTimer;

    if (elapsed >= this.shakeDuration) {
      // 抖动结束
      this.isShaking = false;
      this.x = this.originalX;
      this.y = this.originalY;
      return;
    }

    // 正弦波抖动（更自然）
    const progress = elapsed / this.shakeDuration;
    const amplitude = 4 * (1 - progress); // 幅度逐渐减小
    const frequency = 20; // 频率
    const offset = Math.sin(elapsed * frequency / 100) * amplitude;
    
    this.x = this.originalX + offset;
    this.y = this.originalY;
  }

  /**
   * 更新弹跳动画
   */
  updateBounce() {
    const elapsed = Date.now() - this.bounceStartTime;

    if (elapsed >= this.bounceDuration) {
      // 弹跳结束
      this.isBouncing = false;
      this.bounceScale = 1;
      return;
    }

    // 弹跳曲线：先放大后恢复
    const progress = elapsed / this.bounceDuration;
    
    if (progress < 0.4) {
      // 放大阶段
      this.bounceScale = 1 + 0.15 * (progress / 0.4);
    } else {
      // 恢复阶段
      const shrinkProgress = (progress - 0.4) / 0.6;
      this.bounceScale = 1.15 - 0.15 * shrinkProgress;
    }
  }

  /**
   * 渲染方块
   */
  render(ctx) {
    if (!this.visible) return;

    BlockRenderer.render(ctx, this);
  }
}

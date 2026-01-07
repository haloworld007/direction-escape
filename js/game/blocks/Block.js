/**
 * 方块类
 * 每个方块有固定朝向（上/下/左/右）
 * 可以检测是否可消除，执行消除动画等
 */
import Sprite from '../../base/sprite';
import BlockRenderer from './BlockRenderer';
import DirectionDetector from '../algorithms/DirectionDetector';

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
    this.type = 'square'; // 方块类型：square, circle, triangle, diamond
    this.isRemoved = false; // 是否已消除
    this.isMoving = false; // 是否正在移动
    this.isShaking = false; // 是否正在抖动

    // 移动相关
    this.moveSpeed = 15; // 移动速度
    this.targetX = 0; // 目标位置X
    this.targetY = 0; // 目标位置Y

    // 抖动相关
    this.shakeTimer = 0; // 抖动计时器
    this.shakeDuration = 0; // 抖动持续时间
    this.originalX = 0; // 原始X位置
    this.originalY = 0; // 原始Y位置
  }

  /**
   * 初始化方块
   */
  init(x, y, direction, type = 'square', size = 60) {
    this.x = x;
    this.y = y;
    this.width = size;
    this.height = size;
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
   * 沿朝向方向飞出屏幕
   */
  remove() {
    if (this.isRemoved) return;

    this.isRemoved = true;
    this.isMoving = true;

    // 计算飞出目标（屏幕外）
    const directionVectors = {
      [DIRECTIONS.UP]: { x: 0, y: -1 },
      [DIRECTIONS.RIGHT]: { x: 1, y: 0 },
      [DIRECTIONS.DOWN]: { x: 0, y: 1 },
      [DIRECTIONS.LEFT]: { x: -1, y: 0 }
    };

    const vector = directionVectors[this.direction];

    // 目标位置：沿方向飞出1000像素
    this.targetX = this.x + vector.x * 1000;
    this.targetY = this.y + vector.y * 1000;

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
  }

  /**
   * 更新移动动画
   */
  updateMove() {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.moveSpeed) {
      // 到达目标，完全移除
      this.visible = false;
      this.isMoving = false;
      this.emit('moveComplete', this);
    } else {
      // 继续移动
      this.x += (dx / distance) * this.moveSpeed;
      this.y += (dy / distance) * this.moveSpeed;
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

    // 随机抖动
    const amplitude = 3; // 抖动幅度
    this.x = this.originalX + (Math.random() - 0.5) * amplitude;
    this.y = this.originalY + (Math.random() - 0.5) * amplitude;
  }

  /**
   * 渲染方块
   */
  render(ctx) {
    if (!this.visible) return;

    BlockRenderer.render(ctx, this);
  }
}

/**
 * 方块类（更新版）
 * 每个方块有固定朝向（对角线 45°：右上/右下/左下/左上）
 * 可以检测是否可消除，执行消除动画等
 * 根据 PRD.md 第十三章节设计：胶囊状动物造型
 */
import Sprite from '../../base/sprite';
import BlockRenderer from '../../ui/BlockRenderer';
import DirectionDetector from '../algorithms/DirectionDetector';
import { ANIMAL_TYPES, BLOCK_SIZES } from '../../ui/UIConstants';

// 方向常量
export const DIRECTIONS = {
  // 兼容旧命名，但语义改为对角线方向（方块本体45°）
  // UP   = 右上（NE）
  // RIGHT= 右下（SE）
  // DOWN = 左下（SW）
  // LEFT = 左上（NW）
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
    this.type = ANIMAL_TYPES.PIG; // 动物类型（默认主动物）
    this.shortSide = null; // 记录该方块的短边尺寸（用于翻转/洗牌时保持形状一致）
    this.bodyWidth = 0;    // 胶囊本体宽（未旋转前，长边）
    this.bodyHeight = 0;   // 胶囊本体高（未旋转前，短边）
    this.rotation = 0;     // 当前旋转角（弧度）
    this.isRemoved = false; // 是否已消除
    this.isMoving = false; // 是否正在移动
    this.isShaking = false; // 是否正在抖动
    this.axis = null; // 网格轴向（row/col）
    this.gridRow = null; // 网格行
    this.gridCol = null; // 网格列

    // 滑出动画相关（使用缓动）
    this.slideStartTime = 0; // 滑动开始时间
    this.slideDuration = 400; // 滑动持续时间（ms）
    this.slideMode = null; // 'out' | 'block'
    this.startX = 0; // 滑动起始X
    this.startY = 0; // 滑动起始Y
    this.targetX = 0; // 目标位置X
    this.targetY = 0; // 目标位置Y
    this.slideScale = 1; // 滑动时的缩放（美化效果）
    this.slideGridDeltaRow = 0; // 滑动后的网格行偏移
    this.slideGridDeltaCol = 0; // 滑动后的网格列偏移

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
  init(x, y, direction, type = ANIMAL_TYPES.PIG, size = null) {
    this.x = x;
    this.y = y;

    // 计算胶囊尺寸
    const shortSide = size || BLOCK_SIZES.WIDTH;  // 短边（宽度）
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);  // 长边（长度），保持比例
    this.shortSide = shortSide;
    this.bodyWidth = longSide;
    this.bodyHeight = shortSide;

    this.direction = direction;
    this.applyDirectionGeometry(direction, /*keepCenter*/ false);
    this.type = type;
    this.isRemoved = false;
    this.isMoving = false;
    this.isShaking = false;
    this.visible = true;
    this.originalX = x;
    this.originalY = y;
    this.slideGridDeltaRow = 0;
    this.slideGridDeltaCol = 0;

    // 不使用图片资源
    this.img = null;

    return this;
  }

  /**
   * 对角线方向对应的旋转角（Canvas坐标系：y向下，rotate 正方向为顺时针）
   */
  static getDirectionAngle(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    // 右上（NE）
        return -Math.PI / 4;
      case DIRECTIONS.RIGHT: // 右下（SE）
        return Math.PI / 4;
      case DIRECTIONS.DOWN:  // 左下（SW）
        return (3 * Math.PI) / 4;
      case DIRECTIONS.LEFT:  // 左上（NW）
        return (-3 * Math.PI) / 4;
      default:
        return -Math.PI / 4;
    }
  }

  /**
   * 根据方向更新旋转角与碰撞盒尺寸
   * - 碰撞盒 width/height 始终是“旋转后的 AABB”，用于点击/碰撞/阻挡检测
   * - bodyWidth/bodyHeight 用于实际绘制（在渲染里再 rotate）
   */
  applyDirectionGeometry(direction, keepCenter = true) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    this.rotation = Block.getDirectionAngle(direction);

    const bw = this.bodyWidth || 0;
    const bh = this.bodyHeight || 0;
    const c = Math.abs(Math.cos(this.rotation));
    const s = Math.abs(Math.sin(this.rotation));
    const bboxW = c * bw + s * bh;
    const bboxH = s * bw + c * bh;
    this.width = bboxW;
    this.height = bboxH;

    if (keepCenter) {
      this.x = centerX - this.width / 2;
      this.y = centerY - this.height / 2;
    }
    this.originalX = this.x;
    this.originalY = this.y;
  }

  /**
   * 设置方向（并保持中心点不变 + 同步尺寸）
   * 用于洗牌方向等“直接改方向”的场景
   */
  setDirection(newDirection) {
    this.direction = newDirection;
    // 对角线方向：更新旋转与碰撞盒，保持中心不变
    this.applyDirectionGeometry(newDirection, /*keepCenter*/ true);
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
    this.slideMode = 'out';

    // 记录滑动起始位置和时间
    this.startX = this.x;
    this.startY = this.y;
    this.slideStartTime = Date.now();
    this.slideScale = 1;

    // 计算滑动到屏幕边缘的目标位置
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;

    // 对角线滑出：沿方向向量滑出屏幕外
    const vec = this.getDirectionVector();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const ex = this.width / 2;
    const ey = this.height / 2;

    const tX = vec.x > 0 ? (screenWidth - ex - cx) / vec.x : (cx - ex) / (-vec.x);
    const tY = vec.y > 0 ? (screenHeight - ey - cy) / vec.y : (cy - ey) / (-vec.y);
    const tEdge = Math.max(0, Math.min(tX, tY));
    const extra = 80;
    const tc = tEdge + extra;
    const targetCx = cx + vec.x * tc;
    const targetCy = cy + vec.y * tc;
    this.targetX = targetCx - this.width / 2;
    this.targetY = targetCy - this.height / 2;

    // 根据滑动距离调整持续时间
    const dx = this.targetX - this.startX;
    const dy = this.targetY - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 调慢滑动速度，让玩家能清楚看到滑出过程（520-1300ms，更顺滑）
    this.slideDuration = Math.min(1300, Math.max(520, distance * 2.0));

    // 触发事件
    this.emit('remove', this);
  }

  /**
   * 获取当前方块的网格步长（中心点位移长度）
   */
  getGridCellStep() {
    const shortSide = this.shortSide || BLOCK_SIZES.WIDTH;
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
    const baseGap = Math.max(4, Math.round(shortSide * 0.35));
    const cellGap = Math.max(baseGap, Math.round(longSide - 2 * shortSide));
    return shortSide + cellGap;
  }

  /**
   * 向阻挡位置滑动（不消除）
   */
  slideToBlocked(allBlocks) {
    if (this.isRemoved || this.isMoving) return false;

    const gridInfo = DirectionDetector.getGridBlockingSteps(this, allBlocks);
    if (gridInfo && gridInfo.hasBlock) {
      const steps = gridInfo.steps;
      if (steps <= 0) return false;

      const cellStep = this.getGridCellStep();
      const vec = this.getDirectionVector();
      const moveDist = cellStep * steps;
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const targetCx = cx + vec.x * moveDist;
      const targetCy = cy + vec.y * moveDist;

      this.slideGridDeltaRow = gridInfo.deltaRow * steps;
      this.slideGridDeltaCol = gridInfo.deltaCol * steps;

      this.startX = this.x;
      this.startY = this.y;
      this.targetX = targetCx - this.width / 2;
      this.targetY = targetCy - this.height / 2;
      this.slideStartTime = Date.now();
      this.slideScale = 1;
      this.slideMode = 'block';
      this.isMoving = true;

      const dx = this.targetX - this.startX;
      const dy = this.targetY - this.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.slideDuration = Math.min(900, Math.max(360, distance * 1.6));

      return true;
    }

    const hit = DirectionDetector.getFirstBlockingInfo(this, allBlocks, canvas.width, canvas.height);
    if (!hit) return false;

    const stopGap = Math.max(2, BLOCK_SIZES.SPACING, BLOCK_SIZES.HITBOX_INSET || 0);
    const travel = Math.max(0, hit.t - stopGap);
    if (travel < 1) return false;
    const targetCx = hit.originX + hit.vector.x * travel;
    const targetCy = hit.originY + hit.vector.y * travel;

    this.startX = this.x;
    this.startY = this.y;
    this.targetX = targetCx - this.width / 2;
    this.targetY = targetCy - this.height / 2;
    this.slideStartTime = Date.now();
    this.slideScale = 1;
    this.slideMode = 'block';
    this.isMoving = true;

    const dx = this.targetX - this.startX;
    const dy = this.targetY - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.slideDuration = Math.min(900, Math.max(360, distance * 1.6));

    return true;
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
   * 翻转朝向（同时更新尺寸）
   * 用于道具效果
   */
  flip() {
    // 翻转方向：UP ↔ DOWN, RIGHT ↔ LEFT（对角线互换：NE↔SW, SE↔NW）
    const newDirection = (this.direction + 2) % 4;
    this.setDirection(newDirection);
    console.log(`[Block] 翻转方块: 方向=${this.direction}, 尺寸=${this.width}x${this.height}, shortSide=${this.shortSide}`);
  }

  /**
   * 获取对角线方向单位向量
   */
  getDirectionVector() {
    const inv = 1 / Math.sqrt(2);
    switch (this.direction) {
      case DIRECTIONS.UP:    // 右上
        return { x: inv, y: -inv };
      case DIRECTIONS.RIGHT: // 右下
        return { x: inv, y: inv };
      case DIRECTIONS.DOWN:  // 左下
        return { x: -inv, y: inv };
      case DIRECTIONS.LEFT:  // 左上
        return { x: -inv, y: -inv };
      default:
        return { x: inv, y: -inv };
    }
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
    
    // easeInOutCubic 缓动：更平滑的加速/减速
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // 计算当前位置
    this.x = this.startX + (this.targetX - this.startX) * eased;
    this.y = this.startY + (this.targetY - this.startY) * eased;
    
    // 滑出时轻微缩小（美化效果）
    this.slideScale = 1 - progress * 0.15;
    
    if (progress >= 1) {
      if (this.slideMode === 'out') {
        this.visible = false;
        this.isMoving = false;
        this.emit('moveComplete', this);
        return;
      }

      this.isMoving = false;
      this.slideScale = 1;
      if (this.slideMode === 'block') {
        if (Number.isFinite(this.gridRow) && Number.isFinite(this.gridCol)) {
          this.gridRow += this.slideGridDeltaRow;
          this.gridCol += this.slideGridDeltaCol;
        }
        this.slideGridDeltaRow = 0;
        this.slideGridDeltaCol = 0;
      }
      this.originalX = this.x;
      this.originalY = this.y;
      this.slideMode = null;
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

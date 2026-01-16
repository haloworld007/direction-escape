/**
 * 方向阻挡检测算法
 * 优先使用网格占用判断阻挡，缺失网格信息时回退射线检测
 */
import { DIRECTIONS } from '../blocks/Block';
import { BLOCK_SIZES } from '../../ui/UIConstants';

export default class DirectionDetector {
  /**
   * 检测方块是否被阻挡
   * @param {Block} block - 要检测的方块
   * @param {Array} allBlocks - 所有方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {boolean} true=被阻挡，false=可消除
   */
  static isBlocked(block, allBlocks, screenWidth, screenHeight, options = null) {
    const debug = !options || options.debug !== false;
    const gridInfo = this.getGridBlockingSteps(block, allBlocks);
    if (gridInfo) {
      return gridInfo.hasBlock;
    }

    // 1) 对角线方向向量（单位向量）
    const inv = 1 / Math.sqrt(2);
    const directionVectors = {
      [DIRECTIONS.UP]: { x: inv, y: -inv },     // 右上
      [DIRECTIONS.RIGHT]: { x: inv, y: inv },  // 右下
      [DIRECTIONS.DOWN]: { x: -inv, y: inv },  // 左下
      [DIRECTIONS.LEFT]: { x: -inv, y: -inv }  // 左上
    };

    const vector = directionVectors[block.direction];
    if (!vector) return true;

    if (debug) {
      console.log(`[DirectionDetector] 开始检测: block=(${block.x}, ${block.y}), direction=${block.direction}, size=${block.width}x${block.height}`);
    }

    // 2. 从方块中心点开始检测
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;

    // 3) 沿方向向量向外移动，移出当前方块 AABB
    const offset = Math.max(block.width, block.height) / 2 + 2;
    const startX = centerX + vector.x * offset;
    const startY = centerY + vector.y * offset;

    if (debug) {
      console.log(`[DirectionDetector] 起始点: (${startX}, ${startY}), 屏幕尺寸: ${screenWidth}x${screenHeight}`);
    }

    // 3. 定义检测步长（使用较小值确保不会跳过方块）
    const stepSize = 8; // 对角线射线更密一些

    // 4. 沿射线逐步检测
    let currentX = startX;
    let currentY = startY;

    // 最多检测1000步（防止死循环）
    const maxSteps = 1000;
    let steps = 0;

    while (steps < maxSteps) {
      steps++;

      // 移动到下一个检测点
      currentX += vector.x * stepSize;
      currentY += vector.y * stepSize;

      // 检查是否到达屏幕边界
      if (this.isOutOfBounds(currentX, currentY, screenWidth, screenHeight)) {
        if (debug) {
          console.log(`[DirectionDetector] 到达边界: (${currentX}, ${currentY}), 返回false（可消除）`);
        }
        return false; // 无阻挡，可消除
      }

      // 检查该点是否在任何其他方块内
      for (let other of allBlocks) {
        if (other === block) continue; // 跳过自己
        if (other.isRemoved) continue; // 跳过已消除的方块
        if (other.visible === false) continue; // 跳过不可见的方块

        const hitRect = this.getHitRect(other);
        // 对角线：射线点只要进入其他方块 AABB 即视为阻挡
        if (this.pointInRect(currentX, currentY, hitRect)) {
          if (debug) {
            console.log(`[DirectionDetector] 检测到碰撞! 检测点(${currentX}, ${currentY}), 其他方块: (${other.x}, ${other.y})`);
          }
          return true; // 被阻挡
        }
      }
    }

    // 超过最大步数，视为被阻挡
    if (debug) {
      console.log(`[DirectionDetector] 超过最大步数，返回true（被阻挡）`);
    }
    return true;
  }

  /**
   * 基于网格的阻挡检测（优先使用）
   */
  static getGridBlockingSteps(block, allBlocks) {
    if (!block || !allBlocks) return null;
    if (!Number.isFinite(block.gridRow) || !Number.isFinite(block.gridCol)) return null;

    const axis = this.getBlockAxis(block);
    const delta = this.getGridDirectionDelta(block.direction);
    if (!axis || !delta) return null;

    if (axis === 'row' && delta.col !== 0) return null;
    if (axis === 'col' && delta.row !== 0) return null;

    const laneCol = axis === 'row' ? block.gridCol : null;
    const laneRow = axis === 'col' ? block.gridRow : null;
    const frontRow = axis === 'row'
      ? (delta.row < 0 ? block.gridRow : block.gridRow + 1)
      : block.gridRow;
    const frontCol = axis === 'col'
      ? (delta.col < 0 ? block.gridCol : block.gridCol + 1)
      : block.gridCol;

    let nearest = Infinity;
    let hasBlock = false;

    for (let other of allBlocks) {
      if (other === block) continue;
      if (other.isRemoved) continue;
      if (other.visible === false) continue;

      const cells = this.getBlockCells(other);
      if (!cells) continue;

      for (const cell of cells) {
        if (axis === 'row') {
          if (cell.col !== laneCol) continue;
          const deltaRow = cell.row - frontRow;
          if (delta.row < 0) {
            if (deltaRow <= 0) {
              const steps = -deltaRow - 1;
              if (steps < nearest) {
                nearest = steps;
                hasBlock = true;
              }
            }
          } else {
            if (deltaRow >= 0) {
              const steps = deltaRow - 1;
              if (steps < nearest) {
                nearest = steps;
                hasBlock = true;
              }
            }
          }
        } else {
          if (cell.row !== laneRow) continue;
          const deltaCol = cell.col - frontCol;
          if (delta.col < 0) {
            if (deltaCol <= 0) {
              const steps = -deltaCol - 1;
              if (steps < nearest) {
                nearest = steps;
                hasBlock = true;
              }
            }
          } else {
            if (deltaCol >= 0) {
              const steps = deltaCol - 1;
              if (steps < nearest) {
                nearest = steps;
                hasBlock = true;
              }
            }
          }
        }
      }
    }

    if (!hasBlock) {
      return { hasBlock: false, steps: 0, deltaRow: delta.row, deltaCol: delta.col };
    }

    return {
      hasBlock: true,
      steps: Math.max(0, nearest),
      deltaRow: delta.row,
      deltaCol: delta.col
    };
  }

  static getBlockAxis(block) {
    if (block.axis === 'row' || block.axis === 'col') return block.axis;
    if (block.direction === DIRECTIONS.UP || block.direction === DIRECTIONS.DOWN) return 'row';
    if (block.direction === DIRECTIONS.LEFT || block.direction === DIRECTIONS.RIGHT) return 'col';
    return null;
  }

  static getBlockCells(block) {
    if (!Number.isFinite(block.gridRow) || !Number.isFinite(block.gridCol)) return null;
    const axis = this.getBlockAxis(block);
    if (axis === 'row') {
      return [
        { row: block.gridRow, col: block.gridCol },
        { row: block.gridRow + 1, col: block.gridCol }
      ];
    }
    if (axis === 'col') {
      return [
        { row: block.gridRow, col: block.gridCol },
        { row: block.gridRow, col: block.gridCol + 1 }
      ];
    }
    return null;
  }

  static getGridDirectionDelta(direction) {
    switch (direction) {
      case DIRECTIONS.UP:
        return { row: -1, col: 0 };
      case DIRECTIONS.DOWN:
        return { row: 1, col: 0 };
      case DIRECTIONS.LEFT:
        return { row: 0, col: -1 };
      case DIRECTIONS.RIGHT:
        return { row: 0, col: 1 };
      default:
        return null;
    }
  }

  /**
   * 获取射线方向上的首个阻挡信息
   */
  static getFirstBlockingInfo(block, allBlocks, screenWidth, screenHeight) {
    const inv = 1 / Math.sqrt(2);
    const directionVectors = {
      [DIRECTIONS.UP]: { x: inv, y: -inv },
      [DIRECTIONS.RIGHT]: { x: inv, y: inv },
      [DIRECTIONS.DOWN]: { x: -inv, y: inv },
      [DIRECTIONS.LEFT]: { x: -inv, y: -inv }
    };

    const vector = directionVectors[block.direction];
    if (!vector) return null;

    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;
    const inset = BLOCK_SIZES.HITBOX_INSET || 0;
    const moveHalfW = Math.max(0, block.width - inset * 2) / 2;
    const moveHalfH = Math.max(0, block.height - inset * 2) / 2;

    let closest = null;
    let minT = Infinity;

    for (let other of allBlocks) {
      if (other === block) continue;
      if (other.isRemoved) continue;
      if (other.visible === false) continue;

      const hitRect = this.getHitRect(other);
      const expanded = {
        x: hitRect.x - moveHalfW,
        y: hitRect.y - moveHalfH,
        width: hitRect.width + moveHalfW * 2,
        height: hitRect.height + moveHalfH * 2
      };

      const t = this.rayIntersectAABB(centerX, centerY, vector.x, vector.y, expanded);
      if (t !== null && t >= 0 && t < minT) {
        minT = t;
        closest = other;
      }
    }

    if (!closest) return null;
    return { block: closest, t: minT, originX: centerX, originY: centerY, vector };
  }

  static rayIntersectAABB(startX, startY, dirX, dirY, rect) {
    if (startX >= rect.x && startX <= rect.x + rect.width &&
        startY >= rect.y && startY <= rect.y + rect.height) {
      return 0;
    }

    const invX = 1 / dirX;
    const invY = 1 / dirY;

    let t1 = (rect.x - startX) * invX;
    let t2 = (rect.x + rect.width - startX) * invX;
    let t3 = (rect.y - startY) * invY;
    let t4 = (rect.y + rect.height - startY) * invY;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

    if (tmax < 0 || tmin > tmax) return null;
    return tmin;
  }

  /**
   * 检查点是否在屏幕外
   */
  static isOutOfBounds(x, y, screenWidth, screenHeight) {
    return x < 0 || x > screenWidth || y < 0 || y > screenHeight;
  }

  /**
   * 矩形相交检测
   */
  static rectIntersect(rect1, rect2) {
    return !(rect1.x + rect1.width < rect2.x ||
             rect2.x + rect2.width < rect1.x ||
             rect1.y + rect1.height < rect2.y ||
             rect2.y + rect2.height < rect1.y);
  }

  /**
   * 点与矩形碰撞检测
   * 检测点(x, y)是否在矩形rect内
   */
  static pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  }

  static getHitRect(block) {
    const ratio = BLOCK_SIZES.COLLISION_SHRINK || 0;
    const ratioInset = Math.min(block.width, block.height) * ratio;
    const inset = Math.max(BLOCK_SIZES.HITBOX_INSET || 0, ratioInset);
    const width = Math.max(0, block.width - inset * 2);
    const height = Math.max(0, block.height - inset * 2);
    return {
      x: block.x + inset,
      y: block.y + inset,
      width,
      height
    };
  }

  /**
   * 方向性碰撞检测
   * 根据射线方向判断检测点是否真正与目标方块碰撞
   */
  static checkCollision(direction, checkX, checkY, targetBlock) {
    // 首先检查点是否在目标方块的矩形范围内
    if (!this.pointInRect(checkX, checkY, targetBlock)) {
      return false;
    }

        return true;
  }

  /**
   * 获取射线路径点数组（用于调试/可视化）
   */
  static getRayPath(block, screenWidth, screenHeight) {
    const inv = 1 / Math.sqrt(2);
    const directionVectors = {
      [DIRECTIONS.UP]: { x: inv, y: -inv },
      [DIRECTIONS.RIGHT]: { x: inv, y: inv },
      [DIRECTIONS.DOWN]: { x: -inv, y: inv },
      [DIRECTIONS.LEFT]: { x: -inv, y: -inv }
    };

    const vector = directionVectors[block.direction];
    const startX = block.x + block.width / 2;
    const startY = block.y + block.height / 2;
    const stepSize = 12;

    const path = [{ x: startX, y: startY }];
    let currentX = startX;
    let currentY = startY;

    const maxSteps = 100;
    let steps = 0;

    while (steps < maxSteps) {
      steps++;
      currentX += vector.x * stepSize;
      currentY += vector.y * stepSize;

      path.push({ x: currentX, y: currentY });

      if (this.isOutOfBounds(currentX, currentY, screenWidth, screenHeight)) {
        break;
      }
    }

    return path;
  }
}

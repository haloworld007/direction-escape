/**
 * 方向阻挡检测算法
 * 使用射线检测判断方块沿朝向是否被其他方块阻挡
 */
import { DIRECTIONS } from '../blocks/Block';

export default class DirectionDetector {
  /**
   * 检测方块是否被阻挡
   * @param {Block} block - 要检测的方块
   * @param {Array} allBlocks - 所有方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {boolean} true=被阻挡，false=可消除
   */
  static isBlocked(block, allBlocks, screenWidth, screenHeight) {
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

    console.log(`[DirectionDetector] 开始检测: block=(${block.x}, ${block.y}), direction=${block.direction}, size=${block.width}x${block.height}`);

    // 2. 从方块中心点开始检测
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;

    // 3) 沿方向向量向外移动，移出当前方块 AABB
    const offset = Math.max(block.width, block.height) / 2 + 2;
    const startX = centerX + vector.x * offset;
    const startY = centerY + vector.y * offset;

    console.log(`[DirectionDetector] 起始点: (${startX}, ${startY}), 屏幕尺寸: ${screenWidth}x${screenHeight}`);

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
        console.log(`[DirectionDetector] 到达边界: (${currentX}, ${currentY}), 返回false（可消除）`);
        return false; // 无阻挡，可消除
      }

      // 检查该点是否在任何其他方块内
      for (let other of allBlocks) {
        if (other === block) continue; // 跳过自己
        if (other.isRemoved) continue; // 跳过已消除的方块
        if (!other.visible) continue; // 跳过不可见的方块

        // 对角线：射线点只要进入其他方块 AABB 即视为阻挡
        if (this.pointInRect(currentX, currentY, other)) {
          console.log(`[DirectionDetector] 检测到碰撞! 检测点(${currentX}, ${currentY}), 其他方块: (${other.x}, ${other.y})`);
          return true; // 被阻挡
        }
      }
    }

    // 超过最大步数，视为被阻挡
    console.log(`[DirectionDetector] 超过最大步数，返回true（被阻挡）`);
    return true;
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

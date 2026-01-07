/**
 * 死局检测算法
 * 检测是否所有方块都不可消除
 */
import DirectionDetector from './DirectionDetector';

export default class DeadlockDetector {
  /**
   * 检测是否死局
   * @param {Array} allBlocks - 所有方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {boolean} true=死局，false=有解
   */
  static check(allBlocks, screenWidth, screenHeight) {
    // 遍历所有未消除的方块
    for (let block of allBlocks) {
      if (block.isRemoved) continue;
      if (!block.visible) continue;

      // 检查是否可消除
      if (!DirectionDetector.isBlocked(block, allBlocks, screenWidth, screenHeight)) {
        return false; // 至少有一个可消除，不是死局
      }
    }

    return true; // 所有方块都不可消除，死局
  }

  /**
   * 获取当前可消除的方块数量
   * 用于UI显示或关卡验证
   */
  static getRemovableCount(allBlocks, screenWidth, screenHeight) {
    let count = 0;

    for (let block of allBlocks) {
      if (block.isRemoved) continue;
      if (!block.visible) continue;

      if (!DirectionDetector.isBlocked(block, allBlocks, screenWidth, screenHeight)) {
        count++;
      }
    }

    return count;
  }

  /**
   * 获取所有可消除的方块列表
   */
  static getRemovableBlocks(allBlocks, screenWidth, screenHeight) {
    const removable = [];

    for (let block of allBlocks) {
      if (block.isRemoved) continue;
      if (!block.visible) continue;

      if (!DirectionDetector.isBlocked(block, allBlocks, screenWidth, screenHeight)) {
        removable.push(block);
      }
    }

    return removable;
  }
}

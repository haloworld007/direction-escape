/**
 * 关卡管理器
 * 负责生成关卡和管理关卡数据
 */
import LevelGenerator from './algorithms/LevelGenerator';
import Block from './blocks/Block';

export default class LevelManager {
  /**
   * 生成关卡
   * @param {number} levelNumber - 关卡号
   * @returns {Object} 关卡数据 { blocks: Block[], total: number }
   */
  generateLevel(levelNumber) {
    // 所有关卡统一使用算法生成（包括Level 1）
    const levelData = LevelGenerator.generate(levelNumber, canvas.width, canvas.height);
    return this.createBlockInstances(levelData);
  }

  /**
   * 创建方块实例
   */
  createBlockInstances(levelData) {
    const blocks = [];

    for (let blockData of levelData.blocks) {
      const block = new Block();
      block.init(
        blockData.x,
        blockData.y,
        blockData.direction,
        blockData.type,
        blockData.size
      );
      blocks.push(block);
    }

    return {
      blocks,
      total: blocks.length
    };
  }

  /**
   * 获取关卡难度描述
   */
  getDifficultyDescription(level) {
    if (level <= 3) return '简单';
    if (level <= 10) return '中等';
    if (level <= 20) return '困难';
    return '专家';
  }
}

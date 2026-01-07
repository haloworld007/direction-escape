/**
 * 随机关卡生成算法
 * 根据关卡号生成合适的难度布局
 */
import DirectionDetector from './DirectionDetector';
import { DIRECTIONS } from '../blocks/Block';

export default class LevelGenerator {
  // 方块类型
  static BLOCK_TYPES = ['square', 'circle', 'triangle', 'diamond'];

  /**
   * 生成关卡
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    // 1. 获取难度参数
    const params = this.getDifficultyParams(levelNumber);

    // 2. 最多重试10次生成可解关卡
    for (let attempt = 0; attempt < 10; attempt++) {
      // 3. 生成网格布局
      const blocks = this.generateGridLayout(params, screenWidth, screenHeight);

      // 4. 验证可解性
      if (this.validateLevel(blocks, screenWidth, screenHeight)) {
        console.log(`关卡 ${levelNumber} 生成成功，尝试次数: ${attempt + 1}`);
        return { blocks, total: blocks.length };
      }
    }

    // 5. 如果10次都失败，返回最简单的布局
    console.warn(`关卡 ${levelNumber} 生成失败，使用简单布局`);
    return this.generateSimpleLayout(screenWidth, screenHeight);
  }

  /**
   * 生成网格布局
   */
  static generateGridLayout(params, screenWidth, screenHeight) {
    const blocks = [];
    const cellWidth = screenWidth / params.cols;
    const cellHeight = screenHeight / params.rows;

    // 计算居中偏移（留出顶部UI空间）
    const uiHeight = 80; // 顶部UI区域高度
    const offsetX = (screenWidth - params.cols * cellWidth) / 2;
    const offsetY = uiHeight + (screenHeight - uiHeight - params.rows * cellHeight) / 2;

    // 随机选择占用格子
    const occupiedCells = new Set();
    while (occupiedCells.size < params.blockCount) {
      const row = Math.floor(Math.random() * params.rows);
      const col = Math.floor(Math.random() * params.cols);
      occupiedCells.add(`${row},${col}`);
    }

    // 生成方块
    for (let cell of occupiedCells) {
      const [row, col] = cell.split(',').map(Number);

      // 计算位置
      const x = offsetX + col * cellWidth + (cellWidth - params.blockSize) / 2;
      const y = offsetY + row * cellHeight + (cellHeight - params.blockSize) / 2;

      // 智能分配方向（增加难度）
      const direction = this.assignDirection(row, col, params);

      // 随机类型
      const type = this.BLOCK_TYPES[Math.floor(Math.random() * this.BLOCK_TYPES.length)];

      blocks.push({ x, y, direction, type, size: params.blockSize });
    }

    return blocks;
  }

  /**
   * 智能分配方向
   * 避免全部朝向边界（过于简单）
   */
  static assignDirection(row, col, params) {
    const directions = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

    // 边缘方块倾向于朝内
    if (row === 0) return DIRECTIONS.DOWN; // 顶部朝下
    if (row === params.rows - 1) return DIRECTIONS.UP; // 底部朝上
    if (col === 0) return DIRECTIONS.RIGHT; // 左侧朝右
    if (col === params.cols - 1) return DIRECTIONS.LEFT; // 右侧朝左

    // 中间方块随机
    return directions[Math.floor(Math.random() * 4)];
  }

  /**
   * 验证关卡可解性
   * 确保至少有3个可消除方块
   */
  static validateLevel(blocks, screenWidth, screenHeight) {
    let removableCount = 0;

    for (let block of blocks) {
      if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight)) {
        removableCount++;
      }
    }

    return removableCount >= 3;
  }

  /**
   * 生成简单布局（兜底方案）
   */
  static generateSimpleLayout(screenWidth, screenHeight) {
    const blocks = [];
    const blockSize = 60;

    // 6个方块，全部朝向边界
    const layout = [
      { x: 50, y: 300, direction: DIRECTIONS.RIGHT },
      { x: 130, y: 300, direction: DIRECTIONS.RIGHT },
      { x: 210, y: 300, direction: DIRECTIONS.RIGHT },
      { x: 50, y: 380, direction: DIRECTIONS.LEFT },
      { x: 130, y: 380, direction: DIRECTIONS.LEFT },
      { x: 210, y: 380, direction: DIRECTIONS.LEFT }
    ];

    for (let item of layout) {
      blocks.push({
        x: item.x,
        y: item.y,
        direction: item.direction,
        type: 'square',
        size: blockSize
      });
    }

    return { blocks, total: blocks.length };
  }

  /**
   * 获取难度参数
   */
  static getDifficultyParams(level) {
    // 难度曲线
    if (level <= 3) {
      // Level 1-3: 3x4网格, 8-12个方块
      return {
        cols: 3,
        rows: 4,
        blockCount: 8 + level,
        blockSize: 60
      };
    } else if (level <= 10) {
      // Level 4-10: 4x5网格, 15-20个方块
      return {
        cols: 4,
        rows: 5,
        blockCount: Math.min(15 + (level - 3), 20),
        blockSize: 55
      };
    } else if (level <= 20) {
      // Level 11-20: 5x6网格, 20-25个方块
      return {
        cols: 5,
        rows: 6,
        blockCount: Math.min(20 + (level - 10), 25),
        blockSize: 50
      };
    } else {
      // Level 21+: 6x8网格, 25个方块
      return {
        cols: 6,
        rows: 8,
        blockCount: 25,
        blockSize: 45
      };
    }
  }

  /**
   * 生成第1关（教学关）
   * 所有方块朝向边界，100%可消除
   */
  static generateLevel1(screenWidth, screenHeight) {
    const blocks = [];
    const blockSize = 60;

    // 6个方块，全部朝右，确保100%可消除
    // Y坐标错开，避免射线互相干扰
    const startY = 150;
    const spacing = 120;

    for (let i = 0; i < 6; i++) {
      blocks.push({
        x: 50,
        y: startY + i * spacing,
        direction: DIRECTIONS.RIGHT,
        type: 'square',
        size: blockSize
      });
    }

    return { blocks, total: blocks.length };
  }
}

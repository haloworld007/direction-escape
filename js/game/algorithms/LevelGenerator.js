/**
 * 随机关卡生成算法（PRD v1.3 更新版）
 * 根据关卡号生成合适的难度布局
 * 参考截图：菱形紧密排列，80-120个方块
 */
import DirectionDetector from './DirectionDetector';
import { DIRECTIONS } from '../blocks/Block';
import { MAIN_ANIMAL_TYPES, ANIMAL_TYPES, LAYOUT, BLOCK_SIZES, getBoardRect } from '../../ui/UIConstants';

export default class LevelGenerator {
  // 主要动物类型（猪/羊/狗）
  static ANIMAL_TYPES = MAIN_ANIMAL_TYPES;

  /**
   * 获取方块轴对齐尺寸
   */
  static getBlockDimensions(direction, shortSide) {
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
    const isVertical = direction === DIRECTIONS.UP || direction === DIRECTIONS.DOWN;
    return {
      longSide,
      width: isVertical ? shortSide : longSide,
      height: isVertical ? longSide : shortSide
    };
  }

  /**
   * 生成关卡（主入口）
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);

    console.log(`[LevelGenerator] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}`);

    // 尝试生成菱形布局
    for (let attempt = 0; attempt < 5; attempt++) {
      const blocks = this.generateDiamondLayout(params, screenWidth, screenHeight, boardRect);

      // 验证关卡可解性
      if (this.validateLevel(blocks, screenWidth, screenHeight)) {
        console.log(`[LevelGenerator] 关卡 ${levelNumber} 生成成功，方块数: ${blocks.length}，尝试: ${attempt + 1}`);
        return { blocks, total: blocks.length };
      }
    }

    // 后备方案
    console.warn(`[LevelGenerator] 关卡 ${levelNumber} 使用后备布局`);
    return this.generateSimpleLayout(params, screenWidth, screenHeight, boardRect);
  }

  /**
   * 生成菱形密排布局（PRD v1.3: 45度紧密排列）
   */
  static generateDiamondLayout(params, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize } = params;

    // 方块尺寸（使用更小的尺寸避免溢出）
    const shortSide = blockSize || 20;  // 更小的方块以容纳更多
    const { longSide } = this.getBlockDimensions(DIRECTIONS.RIGHT, shortSide);

    // 计算网格参数 - 紧密排列，但保持足够间距
    const stepX = longSide * 0.9 + BLOCK_SIZES.SPACING;   // 水平步长
    const stepY = shortSide * 1.15 + BLOCK_SIZES.SPACING; // 垂直步长

    // 安全边界（确保方块不会溢出棋盘）
    const safeMargin = BLOCK_SIZES.SAFETY_MARGIN + longSide / 2;
    const safeBoardRect = {
      x: boardRect.x + safeMargin,
      y: boardRect.y + safeMargin,
      width: boardRect.width - safeMargin * 2,
      height: boardRect.height - safeMargin * 2
    };

    // 计算可容纳的行列数
    const maxCols = Math.floor(safeBoardRect.width / stepX);
    const maxRows = Math.floor(safeBoardRect.height / stepY);

    // 根据方块数量计算需要的菱形大小
    const targetArea = Math.sqrt(blockCount * 1.5);
    const diamondSize = Math.min(Math.ceil(targetArea), Math.min(maxCols, maxRows));

    // 菱形中心
    const centerX = safeBoardRect.x + safeBoardRect.width / 2;
    const centerY = safeBoardRect.y + safeBoardRect.height / 2;

    // 生成菱形格点
    const candidates = [];
    const halfSize = Math.floor(diamondSize / 2);

    for (let row = -halfSize; row <= halfSize; row++) {
      const rowWidth = diamondSize - Math.abs(row);
      const startCol = -Math.floor(rowWidth / 2);

      for (let col = 0; col < rowWidth; col++) {
        const gridCol = startCol + col;
        
        // 45度倾斜排列
        const x = centerX + gridCol * stepX + (row % 2) * (stepX * 0.5);
        const y = centerY + row * stepY;

        // 边界检查 - 确保方块不会超出安全区域
        if (x - longSide / 2 < safeBoardRect.x ||
            x + longSide / 2 > safeBoardRect.x + safeBoardRect.width ||
            y - longSide / 2 < safeBoardRect.y ||
            y + longSide / 2 > safeBoardRect.y + safeBoardRect.height) {
          continue; // 跳过超出边界的位置
        }

        // 距离中心的曼哈顿距离（用于排序）
        const dist = Math.abs(gridCol) + Math.abs(row);

        candidates.push({ x, y, row, col: gridCol, dist });
      }
    }

    // 按距离排序，从外到内
    candidates.sort((a, b) => b.dist - a.dist || Math.random() - 0.5);

    // 选取需要的数量（不超过候选数量）
    const actualCount = Math.min(blockCount, candidates.length);
    const selected = candidates.slice(0, actualCount);

    // 生成方块
    selected.forEach((pos, index) => {
      // 方向分配策略：边缘朝外，内部随机
      const direction = this.assignSmartDirection(pos, halfSize, centerX, centerY);

      const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);

      // 方块位置（以格点为中心）
      const blockX = pos.x - bw / 2;
      const blockY = pos.y - bh / 2;

      // 动物类型（循环使用主要3种）
      const animalType = this.ANIMAL_TYPES[index % this.ANIMAL_TYPES.length];

      blocks.push({
        x: blockX,
        y: blockY,
        width: bw,
        height: bh,
        direction,
        type: animalType,
        size: shortSide
      });
    });

    // 确保有足够的可消除方块
    this.ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide);

    return blocks;
  }

  /**
   * 智能方向分配（确保边缘方块可消除）
   */
  static assignSmartDirection(pos, halfSize, centerX, centerY) {
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const distFromCenter = Math.abs(pos.row) + Math.abs(pos.col);
    const isEdge = distFromCenter >= halfSize * 0.7;

    // 边缘方块：80%概率朝外
    if (isEdge && Math.random() < 0.8) {
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      } else {
        return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      }
    }

    // 内部方块：随机方向，但略微倾向于朝向边缘
    const directions = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
    
    if (Math.random() < 0.4) {
      // 40%概率朝向边缘
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      } else {
        return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      }
    }

    return directions[Math.floor(Math.random() * 4)];
  }

  /**
   * 确保有足够的可消除方块
   */
  static ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide) {
    const minRemovable = Math.max(5, Math.floor(blocks.length * 0.15));

    for (let fix = 0; fix < 5; fix++) {
      let removableCount = 0;
      blocks.forEach(block => {
        if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight)) {
          removableCount++;
        }
      });

      if (removableCount >= minRemovable) {
        console.log(`[LevelGenerator] 可消除方块数: ${removableCount}/${blocks.length}`);
        return;
      }

      // 修正：将最外层的方块朝向调整为朝外
      const scored = blocks.map((b, idx) => {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const dx = cx - centerX;
        const dy = cy - centerY;
        const dist = Math.abs(dx) + Math.abs(dy);
        return { idx, dx, dy, dist };
      }).sort((a, b) => b.dist - a.dist);

      // 调整最外层10%的方块朝向
      const adjustCount = Math.ceil(blocks.length * 0.1);
      for (let i = 0; i < adjustCount && i < scored.length; i++) {
        const s = scored[i];
        const block = blocks[s.idx];
        
        if (Math.abs(s.dx) > Math.abs(s.dy)) {
          block.direction = s.dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
          block.direction = s.dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }

        // 更新方块尺寸
        const { width: bw, height: bh } = this.getBlockDimensions(block.direction, shortSide);
        const cx = block.x + block.width / 2;
        const cy = block.y + block.height / 2;
        block.width = bw;
        block.height = bh;
        block.x = cx - bw / 2;
        block.y = cy - bh / 2;
      }
    }
  }

  /**
   * 生成简单布局（后备方案）
   */
  static generateSimpleLayout(params, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize } = params;
    const shortSide = blockSize || 20;  // 更小的默认尺寸
    const { longSide } = this.getBlockDimensions(DIRECTIONS.RIGHT, shortSide);
    const step = longSide + BLOCK_SIZES.SPACING + 2; // 增加间距

    const centerX = boardRect.x + boardRect.width / 2;
    const centerY = boardRect.y + boardRect.height / 2;

    // 螺旋形布局
    const spiralPositions = this.generateSpiralPositions(blockCount, step);

    spiralPositions.forEach((pos, index) => {
      const x = centerX + pos.dx;
      const y = centerY + pos.dy;

      // 外圈朝外
      let direction;
      if (Math.abs(pos.dx) > Math.abs(pos.dy)) {
        direction = pos.dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      } else {
        direction = pos.dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      }

      const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
      const animalType = this.ANIMAL_TYPES[index % this.ANIMAL_TYPES.length];

      blocks.push({
        x: x - bw / 2,
        y: y - bh / 2,
        width: bw,
        height: bh,
        direction,
        type: animalType,
        size: shortSide
      });
    });

    return { blocks, total: blocks.length };
  }

  /**
   * 生成螺旋位置序列
   */
  static generateSpiralPositions(count, step) {
    const positions = [{ dx: 0, dy: 0 }];
    let x = 0, y = 0;
    let dx = step, dy = 0;
    let segmentLength = 1, segmentPassed = 0;
    let direction = 0;

    while (positions.length < count) {
      x += dx;
      y += dy;
      positions.push({ dx: x, dy: y });
      segmentPassed++;

      if (segmentPassed === segmentLength) {
        segmentPassed = 0;
        direction = (direction + 1) % 4;
        
        switch (direction) {
          case 0: dx = step; dy = 0; break;
          case 1: dx = 0; dy = step; break;
          case 2: dx = -step; dy = 0; break;
          case 3: dx = 0; dy = -step; break;
        }

        if (direction % 2 === 0) {
          segmentLength++;
        }
      }
    }

    return positions;
  }

  /**
   * 验证关卡可解性
   */
  static validateLevel(blocks, screenWidth, screenHeight) {
    // 检查重叠
    if (this.hasOverlap(blocks)) {
      console.log('[LevelGenerator] 验证失败：方块重叠');
      return false;
    }

    // 归一化方块数据
    const normalized = blocks.map(b => ({
      ...b,
      isRemoved: false,
      visible: true
    }));

    // 计算可消除方块数
    let removableCount = 0;
    for (const block of normalized) {
      if (!DirectionDetector.isBlocked(block, normalized, screenWidth, screenHeight)) {
        removableCount++;
      }
    }

    const minRequired = Math.max(3, Math.floor(blocks.length * 0.1));
    const isValid = removableCount >= minRequired;

    console.log(`[LevelGenerator] 验证: 可消除 ${removableCount}/${blocks.length}, 最低要求 ${minRequired}, 结果: ${isValid}`);
    return isValid;
  }

  /**
   * 检查方块是否重叠
   */
  static hasOverlap(blocks) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];

        // AABB碰撞检测
        if (a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 获取难度参数（优化版：使用更小的方块避免溢出）
   */
  static getDifficultyParams(level) {
    // 基础方块尺寸（更小以避免溢出）
    const SMALL_BLOCK = 18;   // 最小
    const MEDIUM_BLOCK = 20;  // 中等
    const LARGE_BLOCK = 22;   // 较大（新手关）

    if (level <= 3) {
      // 教学关：较少方块，让玩家熟悉
      return {
        blockCount: 25 + level * 8,  // 33-49个
        blockSize: LARGE_BLOCK
      };
    } else if (level <= 10) {
      // 简单关：中等数量
      return {
        blockCount: 45 + (level - 3) * 6,  // 51-87个
        blockSize: MEDIUM_BLOCK
      };
    } else if (level <= 20) {
      // 中等关：较多方块
      return {
        blockCount: 80 + (level - 10) * 4,  // 84-120个
        blockSize: SMALL_BLOCK
      };
    } else {
      // 困难关：大量方块
      return {
        blockCount: Math.min(140, 120 + (level - 20) * 2),
        blockSize: SMALL_BLOCK
      };
    }
  }
}

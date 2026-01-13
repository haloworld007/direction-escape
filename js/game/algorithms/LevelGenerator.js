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
    // 方块本体固定为“水平胶囊”，再根据 direction 旋转（45°对角方向）
    const bodyW = longSide;
    const bodyH = shortSide;

    const angle = this.getDirectionAngle(direction);
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    const bboxW = c * bodyW + s * bodyH;
    const bboxH = s * bodyW + c * bodyH;

    return {
      longSide,
      bodyW,
      bodyH,
      angle,
      // 用旋转后的 AABB 做布局/碰撞
      width: bboxW,
      height: bboxH
    };
  }

  /**
   * 对角线方向对应的旋转角（与 Block.js 保持一致）
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
   * 生成关卡（主入口）
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);

    console.log(`[LevelGenerator] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}`);

    // 尝试生成“真正45度旋转 + 有空隙”的布局（用户反馈要求）
    for (let attempt = 0; attempt < 5; attempt++) {
      const blocks = this.generateDiagonalSparseLayout(params, levelNumber, screenWidth, screenHeight, boardRect);

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
   * 生成真正45度旋转的稀疏菱形布局
   * PRD 4.1 要求的是“错位网格布局（菱形密排）/蜂巢/砌砖结构”：
   * - 通过“每行水平偏移半格”形成整体45°倾斜观感
   * - 所有方块严格落在离散格位（空隙=空出一个完整格位）
   */
  static generateDiagonalSparseLayout(params, levelNumber, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize, skipRate } = params;

    // 方块尺寸：优先使用 BLOCK_SIZES.WIDTH 的体系（保证渲染比例一致），难度可略调
    const shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const dimsSample = this.getBlockDimensions(DIRECTIONS.UP, shortSide);
    const longSide = dimsSample.longSide;
    const bboxW = dimsSample.width;
    const bboxH = dimsSample.height;
    const halfW = bboxW / 2;
    const halfH = bboxH / 2;

    // 45°斜线对齐网格（等距，不压扁）：
    // - 相邻格点沿两条45°对角线移动：(dx,dy) = (step,step) 或 (-step,step)
    // - 为了“更紧凑但不重叠”，step 取 AABB 边长的最小不重叠距离
    //   hasOverlap() 使用 margin=2，因此最小安全步长约为 bbox - 2*margin = bbox - 4
    const step = Math.max(8, Math.max(bboxW, bboxH) - 4);

    // 安全边界（确保方块不会溢出棋盘）
    // 注意：这里必须按旋转后的 AABB 计算，否则会出现“看起来溢出屏幕”的问题
    const safeMarginX = BLOCK_SIZES.SAFETY_MARGIN + halfW;
    const safeMarginY = BLOCK_SIZES.SAFETY_MARGIN + halfH;
    const safeBoardRect = {
      x: boardRect.x + safeMarginX,
      y: boardRect.y + safeMarginY,
      width: boardRect.width - safeMarginX * 2,
      height: boardRect.height - safeMarginY * 2
    };

    // 布局中心
    const centerX = safeBoardRect.x + safeBoardRect.width / 2;
    const centerY = safeBoardRect.y + safeBoardRect.height / 2;

    // 关卡种子随机：保证“同一关卡”布局稳定，避免每次进来都乱
    const rand = this.createSeededRandom(levelNumber);

    // 生成候选格位（菱形团块），每行偏移半格形成45°倾斜观感
    const candidates = [];
    const gapRate = typeof skipRate === 'number' ? skipRate : 0.28; // “空隙占比”
    const neededSlots = Math.ceil(blockCount / Math.max(0.25, (1 - gapRate)));
    const R = this.solveDiamondRadius(neededSlots);

    // 生成菱形团块（|row|+|col|<=R），格点按45°斜线网格映射到屏幕坐标
    for (let row = -R; row <= R; row++) {
      for (let col = -R; col <= R; col++) {
        // 菱形边界：|row|+|col| <= R
        if (Math.abs(row) + Math.abs(col) > R) continue;

        // 45°斜线对齐：
        // - 固定 (col-row) 的格点落在同一条从左上到右下的斜线上
        // - 固定 (col+row) 的格点落在同一条从右上到左下的斜线上
        const x = centerX + (col - row) * step;
        const y = centerY + (col + row) * step;

        // 边界检查 - 确保方块不会超出安全区域
        if (x - halfW < safeBoardRect.x ||
            x + halfW > safeBoardRect.x + safeBoardRect.width ||
            y - halfH < safeBoardRect.y ||
            y + halfH > safeBoardRect.y + safeBoardRect.height) {
          continue; // 跳过超出边界的位置
        }

        // 距离中心（用于方向分配/可解性修正）
        const dist = Math.abs(col) + Math.abs(row);

        candidates.push({ x, y, row, col, dist });
      }
    }

    // 如果候选不足，直接回退（让外层重试/后备布局）
    if (candidates.length < blockCount) return blocks;

    // 随机选择 blockCount 个格点（剩下的自然就是空隙），但格点本身依然严格对齐
    this.shuffleArray(candidates, rand);

    const selected = candidates.slice(0, blockCount);
    // 再按距离排序（外到内），用于更合理的方向分配
    selected.sort((a, b) => b.dist - a.dist);

    // 用于方向分配的半径（与 dist 同量纲）
    const halfSize = R;

    // 生成方块
    selected.forEach((pos, index) => {
      // 方向分配策略：边缘朝外，内部随机
      const direction = this.assignSmartDirection(pos, halfSize, centerX, centerY, rand);

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
   * 计算菱形网格半径 R，使得 |r|+|c|<=R 的格点数量 >= needed
   * 格点数公式：1 + 2R(R+1)
   */
  static solveDiamondRadius(needed) {
    let R = 0;
    while (1 + 2 * R * (R + 1) < needed) R++;
    return R;
  }

  /**
   * 生成可复现随机数（mulberry32）
   */
  static createSeededRandom(seed) {
    let t = (seed >>> 0) + 0x6D2B79F5;
    return function() {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 洗牌（支持注入随机函数，保证可复现）
   */
  static shuffleArray(arr, rand = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /**
   * 智能方向分配（确保边缘方块可消除）
   * 45度斜线网格中，方向按象限分配：
   * - UP(NE): 右上方向
   * - RIGHT(SE): 右下方向
   * - DOWN(SW): 左下方向
   * - LEFT(NW): 左上方向
   */
  static assignSmartDirection(pos, halfSize, centerX, centerY, rand = Math.random) {
    const distFromCenter = Math.abs(pos.row) + Math.abs(pos.col);
    const isEdge = distFromCenter >= halfSize * 0.7;

    // 使用 row/col 来确定象限（45度网格中更准确）
    const { row, col } = pos;

    // 边缘方块：80%概率朝外（按45度象限）
    if (isEdge && rand() < 0.8) {
      // 根据 row 和 col 的符号确定朝外方向
      if (col >= 0 && row <= 0) return DIRECTIONS.UP;      // 右上象限 → NE
      if (col >= 0 && row >= 0) return DIRECTIONS.RIGHT;   // 右下象限 → SE
      if (col <= 0 && row >= 0) return DIRECTIONS.DOWN;    // 左下象限 → SW
      return DIRECTIONS.LEFT;                               // 左上象限 → NW
    }

    // 内部方块：随机方向，但略微倾向于朝向边缘
    const directions = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
    
    if (rand() < 0.4) {
      // 40%概率朝向边缘（按45度象限）
      if (col >= 0 && row <= 0) return DIRECTIONS.UP;
      if (col >= 0 && row >= 0) return DIRECTIONS.RIGHT;
      if (col <= 0 && row >= 0) return DIRECTIONS.DOWN;
      return DIRECTIONS.LEFT;
    }

    return directions[Math.floor(rand() * 4)];
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

      // 调整最外层10%的方块朝向（按45度象限朝外）
      const adjustCount = Math.ceil(blocks.length * 0.1);
      for (let i = 0; i < adjustCount && i < scored.length; i++) {
        const s = scored[i];
        const block = blocks[s.idx];
        
        // 45度象限方向分配
        if (s.dx >= 0 && s.dy <= 0) block.direction = DIRECTIONS.UP;      // 右上 → NE
        else if (s.dx >= 0 && s.dy >= 0) block.direction = DIRECTIONS.RIGHT; // 右下 → SE
        else if (s.dx <= 0 && s.dy >= 0) block.direction = DIRECTIONS.DOWN;  // 左下 → SW
        else block.direction = DIRECTIONS.LEFT;                              // 左上 → NW

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
    const dims = this.getBlockDimensions(DIRECTIONS.UP, shortSide);
    const step = Math.max(dims.width, dims.height) + BLOCK_SIZES.SPACING + 2;

    const centerX = boardRect.x + boardRect.width / 2;
    const centerY = boardRect.y + boardRect.height / 2;

    // 螺旋形布局
    const spiralPositions = this.generateSpiralPositions(blockCount, step);

    spiralPositions.forEach((pos, index) => {
      const x = centerX + pos.dx;
      const y = centerY + pos.dy;

      // 外圈朝外（按45度象限）
      let direction;
      if (pos.dx >= 0 && pos.dy <= 0) direction = DIRECTIONS.UP;        // 右上 → NE
      else if (pos.dx >= 0 && pos.dy >= 0) direction = DIRECTIONS.RIGHT; // 右下 → SE
      else if (pos.dx <= 0 && pos.dy >= 0) direction = DIRECTIONS.DOWN;  // 左下 → SW
      else direction = DIRECTIONS.LEFT;                                   // 左上 → NW

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

        // AABB碰撞检测（允许轻微接触，避免误判导致反复重试）
        const margin = 2;
        if (a.x + margin < b.x + b.width - margin &&
            a.x + a.width - margin > b.x + margin &&
            a.y + margin < b.y + b.height - margin &&
            a.y + a.height - margin > b.y + margin) {
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
    // 基础方块尺寸（修正：当前胶囊更长，如果仍用 24/26/28 会导致溢出）
    const SMALL_BLOCK = 18;
    const MEDIUM_BLOCK = 20;
    const LARGE_BLOCK = 22;

    if (level <= 3) {
      // 教学关：较少方块，让玩家熟悉
      return {
        blockCount: 20 + level * 6,  // 26-38
        blockSize: LARGE_BLOCK,
        skipRate: 0.34               // 更稀疏（空一格更多）
      };
    } else if (level <= 10) {
      // 简单关：中等数量
      return {
        blockCount: 36 + (level - 3) * 5,  // 41-71
        blockSize: MEDIUM_BLOCK,
        skipRate: 0.28
      };
    } else if (level <= 20) {
      // 中等关：较多方块
      return {
        blockCount: 60 + (level - 10) * 4,  // 64-100
        blockSize: SMALL_BLOCK,
        skipRate: 0.22
      };
    } else {
      // 困难关：大量方块
      return {
        blockCount: Math.min(120, 90 + (level - 20) * 2),
        blockSize: SMALL_BLOCK,
        skipRate: 0.18
      };
    }
  }
}

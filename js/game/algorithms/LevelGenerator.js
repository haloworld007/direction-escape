/**
 * 随机关卡生成算法（旋转网格 + 双格方块）
 * 根据关卡号生成合适的难度布局
 * 规则：正方形网格生成槽位，整体旋转45度，每个动物占据两个相邻格子
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

  static getSeed(levelNumber, attempt) {
    return (levelNumber + 1) * 10007 + attempt * 97;
  }

  /**
   * 生成关卡（主入口）
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);

    console.log(`[LevelGenerator] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}`);

    let lastBlocks = [];
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seed = this.getSeed(levelNumber, attempt);
      const blocks = this.generateRotatedGridDominoLayout(
        params,
        seed,
        screenWidth,
        screenHeight,
        boardRect
      );
      lastBlocks = blocks;

      if (this.validateLevel(blocks, screenWidth, screenHeight, seed)) {
        console.log(`[LevelGenerator] 关卡 ${levelNumber} 生成成功，方块数: ${blocks.length}，尝试: ${attempt + 1}`);
        return { blocks, total: blocks.length };
      }
    }

    console.warn(`[LevelGenerator] 关卡 ${levelNumber} 未通过验证，返回最后一次布局`);
    return { blocks: lastBlocks, total: lastBlocks.length };
  }

  /**
   * 生成旋转网格 + 双格方块布局
   * 规则：
   * - 正方形网格生成格子，整体旋转45度
   * - 每个动物占据两个相邻格子（头尾方向随机）
   * - 格子之间保持固定间距
   */
  static generateRotatedGridDominoLayout(params, seed, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize } = params;

    let shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const minShortSide = 14;
    const rand = this.createSeededRandom(seed);
    const holeRate = this.pickHoleRate(params, rand);

    let layout = this.computeDominoGridLayout(shortSide, holeRate, boardRect);
    while (blockCount > layout.maxBlocks && shortSide > minShortSide) {
      shortSide -= 2;
      layout = this.computeDominoGridLayout(shortSide, holeRate, boardRect);
    }
    const overlapMargin = Math.max(BLOCK_SIZES.HITBOX_INSET || 0, Math.round(shortSide * 0.25));

    const targetBlockCount = Math.min(blockCount, layout.maxBlocks);
    if (targetBlockCount <= 0 || layout.candidates.length < 2) return blocks;

    const {
      candidates,
      safeBoardRect,
      centerX,
      centerY
    } = layout;

    const cellMap = new Map();
    candidates.forEach(cell => cellMap.set(cell.key, cell));

    const holeCount = Math.max(0, Math.min(
      Math.floor(candidates.length * holeRate),
      candidates.length - targetBlockCount * 2
    ));
    const holes = this.selectSparseHoles(candidates, holeCount, rand);

    const used = new Set(holes);
    const ordered = this.orderCandidatesCenterOut(candidates, rand);

    let placed = 0;
    for (const cell of ordered) {
      if (placed >= targetBlockCount) break;
      if (used.has(cell.key)) continue;

      const neighbors = this.getAvailableNeighbors(cell, cellMap, used);
      if (neighbors.length === 0) continue;

      const neighbor = neighbors[Math.floor(rand() * neighbors.length)];
      const axis = neighbor.col !== cell.col ? 'col' : 'row';
      const blockCenterX = (cell.x + neighbor.x) / 2;
      const blockCenterY = (cell.y + neighbor.y) / 2;
      const direction = this.pickDirectionForPair(
        cell,
        neighbor,
        blockCenterX,
        blockCenterY,
        centerX,
        centerY,
        rand
      );

      const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
      const blockX = blockCenterX - bw / 2;
      const blockY = blockCenterY - bh / 2;

      if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) {
        continue;
      }

      if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) {
        continue;
      }

      const animalType = this.ANIMAL_TYPES[blocks.length % this.ANIMAL_TYPES.length];
      blocks.push({
        x: blockX,
        y: blockY,
        width: bw,
        height: bh,
        direction,
        axis,
        type: animalType,
        size: shortSide
      });

      used.add(cell.key);
      used.add(neighbor.key);
      placed++;
    }

    // 二次补充：随机顺序再尝试填充，尽量接近目标数量
    if (placed < targetBlockCount) {
      const shuffled = [...candidates];
      this.shuffleArray(shuffled, rand);
      for (const cell of shuffled) {
        if (placed >= targetBlockCount) break;
        if (used.has(cell.key)) continue;

        const neighbors = this.getAvailableNeighbors(cell, cellMap, used);
        if (neighbors.length === 0) continue;

        const neighbor = neighbors[Math.floor(rand() * neighbors.length)];
        const axis = neighbor.col !== cell.col ? 'col' : 'row';
        const blockCenterX = (cell.x + neighbor.x) / 2;
        const blockCenterY = (cell.y + neighbor.y) / 2;
        const direction = this.pickDirectionForPair(
          cell,
          neighbor,
          blockCenterX,
          blockCenterY,
          centerX,
          centerY,
          rand
        );
        const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
        const blockX = blockCenterX - bw / 2;
        const blockY = blockCenterY - bh / 2;

        if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) {
          continue;
        }

        if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) {
          continue;
        }

        const animalType = this.ANIMAL_TYPES[blocks.length % this.ANIMAL_TYPES.length];
        blocks.push({
          x: blockX,
          y: blockY,
          width: bw,
          height: bh,
          direction,
          axis,
          type: animalType,
          size: shortSide
        });

        used.add(cell.key);
        used.add(neighbor.key);
        placed++;
      }
    }

    this.ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide);
    this.ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed);

    return blocks;
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

  static computeDominoGridLayout(shortSide, holeRate, boardRect) {
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
    const baseGap = Math.max(4, Math.round(shortSide * 0.35));
    const cellGap = Math.max(baseGap, Math.round(longSide - 2 * shortSide));
    const cellStep = shortSide + cellGap;
    const step = cellStep / Math.SQRT2;

    const dimsSample = this.getBlockDimensions(DIRECTIONS.UP, shortSide);
    const halfW = dimsSample.width / 2;
    const halfH = dimsSample.height / 2;
    const safeBoardRect = this.getSafeBoardRect(boardRect, halfW, halfH);
    const centerX = safeBoardRect.x + safeBoardRect.width / 2;
    const centerY = safeBoardRect.y + safeBoardRect.height / 2;

    const candidates = [];
    if (safeBoardRect.width > 0 && safeBoardRect.height > 0) {
      const maxRadius = Math.floor(Math.min(safeBoardRect.width, safeBoardRect.height) / (2 * step));
      for (let row = -maxRadius; row <= maxRadius; row++) {
        for (let col = -maxRadius; col <= maxRadius; col++) {
          const x = centerX + (col - row) * step;
          const y = centerY + (col + row) * step;

          if (x < safeBoardRect.x ||
              x > safeBoardRect.x + safeBoardRect.width ||
              y < safeBoardRect.y ||
              y > safeBoardRect.y + safeBoardRect.height) {
            continue;
          }

          const dist = Math.abs(row) + Math.abs(col);
          const key = `${row},${col}`;
          candidates.push({ x, y, row, col, dist, key });
        }
      }
    }

    const maxBlocks = Math.floor((candidates.length * (1 - holeRate)) / 2);

    return {
      candidates,
      maxBlocks,
      cellGap,
      cellStep,
      step,
      safeBoardRect,
      centerX,
      centerY
    };
  }

  static getSafeBoardRect(boardRect, halfW, halfH) {
    const renderMargin = BLOCK_SIZES.RENDER_MARGIN || 0;
    const safeMarginX = BLOCK_SIZES.SAFETY_MARGIN + halfW + renderMargin;
    const safeMarginY = BLOCK_SIZES.SAFETY_MARGIN + halfH + renderMargin;
    return {
      x: boardRect.x + safeMarginX,
      y: boardRect.y + safeMarginY,
      width: Math.max(0, boardRect.width - safeMarginX * 2),
      height: Math.max(0, boardRect.height - safeMarginY * 2)
    };
  }

  static orderCandidatesCenterOut(candidates, rand) {
    const buckets = new Map();
    candidates.forEach(pos => {
      const key = pos.dist;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pos);
    });

    const distances = Array.from(buckets.keys()).sort((a, b) => a - b);
    const ordered = [];
    distances.forEach(dist => {
      const ring = buckets.get(dist);
      this.shuffleArray(ring, rand);
      ordered.push(...ring);
    });

    return ordered;
  }

  static pickHoleRate(params, rand) {
    const range = params.holeRateRange || [0.12, 0.2];
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    const rate = min + (max - min) * rand();
    return Math.max(0.05, Math.min(0.5, rate));
  }

  static selectSparseHoles(candidates, holeCount, rand) {
    if (holeCount <= 0) return new Set();

    const holes = new Set();
    const blocked = new Set();
    const shuffled = [...candidates];
    this.shuffleArray(shuffled, rand);

    for (const cell of shuffled) {
      if (holes.size >= holeCount) break;
      if (blocked.has(cell.key)) continue;
      holes.add(cell.key);
      const neighbors = this.getNeighborKeys(cell);
      neighbors.forEach(key => blocked.add(key));
    }

    if (holes.size < holeCount) {
      for (const cell of shuffled) {
        if (holes.size >= holeCount) break;
        if (holes.has(cell.key)) continue;
        holes.add(cell.key);
      }
    }

    return holes;
  }

  static getNeighborKeys(cell) {
    return [
      `${cell.row - 1},${cell.col}`,
      `${cell.row + 1},${cell.col}`,
      `${cell.row},${cell.col - 1}`,
      `${cell.row},${cell.col + 1}`
    ];
  }

  static getAvailableNeighbors(cell, cellMap, used) {
    const neighbors = [];
    const keys = this.getNeighborKeys(cell);
    for (const key of keys) {
      if (used.has(key)) continue;
      const neighbor = cellMap.get(key);
      if (neighbor) neighbors.push(neighbor);
    }
    return neighbors;
  }

  static pickDirectionForPair(cell, neighbor, blockCenterX, blockCenterY, centerX, centerY, rand) {
    const dx = blockCenterX - centerX;
    const dy = blockCenterY - centerY;
    let preferred;

    if (neighbor.col !== cell.col) {
      // col+1 方向对应屏幕 SE，col-1 对应 NW
      const score = dx + dy;
      preferred = score >= 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    } else {
      // row+1 方向对应屏幕 SW，row-1 对应 NE
      const score = dx - dy;
      preferred = score >= 0 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
    }

    if (rand() < 0.12) return this.getOppositeDirection(preferred);
    return preferred;
  }

  static getAxisDirections(block) {
    if (block.axis === 'row') {
      return [DIRECTIONS.UP, DIRECTIONS.DOWN];
    }
    if (block.axis === 'col') {
      return [DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
    }
    return [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
  }

  static pickOutwardDirectionForAxis(block, centerX, centerY) {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const dx = cx - centerX;
    const dy = cy - centerY;

    if (block.axis === 'col') {
      return (dx + dy) >= 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    }
    if (block.axis === 'row') {
      return (dx - dy) >= 0 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
    }

    if (dx >= 0 && dy <= 0) return DIRECTIONS.UP;
    if (dx >= 0 && dy >= 0) return DIRECTIONS.RIGHT;
    if (dx <= 0 && dy >= 0) return DIRECTIONS.DOWN;
    return DIRECTIONS.LEFT;
  }

  static setBlockDirection(block, direction, shortSide) {
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    block.direction = direction;
    block.width = bw;
    block.height = bh;
    block.x = cx - bw / 2;
    block.y = cy - bh / 2;
  }

  static wouldBeBlockedWithDirection(block, direction, shortSide, blocks, screenWidth, screenHeight) {
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const temp = {
      ...block,
      direction,
      width: bw,
      height: bh,
      x: cx - bw / 2,
      y: cy - bh / 2,
      isRemoved: false,
      visible: true
    };
    const tempBlocks = blocks.map(b => (b === block ? temp : b));
    return DirectionDetector.isBlocked(temp, tempBlocks, screenWidth, screenHeight, { debug: false });
  }

  static pickUnblockedDirection(block, blocks, screenWidth, screenHeight, centerX, centerY, shortSide) {
    const preferred = this.pickOutwardDirectionForAxis(block, centerX, centerY);
    const alternate = this.getOppositeDirection(preferred);
    const candidates = [preferred, alternate];

    for (const dir of candidates) {
      if (!this.wouldBeBlockedWithDirection(block, dir, shortSide, blocks, screenWidth, screenHeight)) {
        return dir;
      }
    }

    const axisDirs = this.getAxisDirections(block);
    for (const dir of axisDirs) {
      if (!this.wouldBeBlockedWithDirection(block, dir, shortSide, blocks, screenWidth, screenHeight)) {
        return dir;
      }
    }

    return preferred;
  }

  static getOppositeDirection(direction) {
    switch (direction) {
      case DIRECTIONS.UP:
        return DIRECTIONS.DOWN;
      case DIRECTIONS.DOWN:
        return DIRECTIONS.UP;
      case DIRECTIONS.LEFT:
        return DIRECTIONS.RIGHT;
      case DIRECTIONS.RIGHT:
        return DIRECTIONS.LEFT;
      default:
        return DIRECTIONS.UP;
    }
  }

  static isBlockInsideSafeRect(x, y, width, height, safeRect) {
    return x >= safeRect.x &&
      x + width <= safeRect.x + safeRect.width &&
      y >= safeRect.y &&
      y + height <= safeRect.y + safeRect.height;
  }

  static wouldOverlap(x, y, width, height, blocks, margin = 1) {
    for (const b of blocks) {
      if (x + margin < b.x + b.width - margin &&
          x + width - margin > b.x + margin &&
          y + margin < b.y + b.height - margin &&
          y + height - margin > b.y + margin) {
        return true;
      }
    }
    return false;
  }

  /**
   * 确保有足够的可消除方块
   */
  static ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide) {
    const minRemovable = Math.max(8, Math.floor(blocks.length * 0.2));

    for (let fix = 0; fix < 5; fix++) {
      let removableCount = 0;
      blocks.forEach(block => {
        if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight, { debug: false })) {
          removableCount++;
        }
      });

      if (removableCount >= minRemovable) {
        console.log(`[LevelGenerator] 可消除方块数: ${removableCount}/${blocks.length}`);
        return;
      }

      const adjusted = this.relaxBlockedDirections(
        blocks,
        screenWidth,
        screenHeight,
        centerX,
        centerY,
        shortSide,
        Math.ceil(blocks.length * 0.25)
      );

      if (!adjusted) {
        break;
      }
    }
  }

  static relaxBlockedDirections(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, limit) {
    const blocked = [];

    blocks.forEach((block, idx) => {
      if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight, { debug: false })) return;
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const dx = cx - centerX;
      const dy = cy - centerY;
      const dist = Math.abs(dx) + Math.abs(dy);
      blocked.push({ idx, dist });
    });

    if (blocked.length === 0) return false;

    blocked.sort((a, b) => b.dist - a.dist);
    let changed = false;
    const adjustCount = Math.min(limit, blocked.length);
    for (let i = 0; i < adjustCount; i++) {
      const block = blocks[blocked[i].idx];
      const nextDirection = this.pickUnblockedDirection(
        block,
        blocks,
        screenWidth,
        screenHeight,
        centerX,
        centerY,
        shortSide
      );
      if (nextDirection !== block.direction) {
        this.setBlockDirection(block, nextDirection, shortSide);
        changed = true;
      }
    }

    return changed;
  }

  static ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed) {
    const baseSeed = typeof seed === 'number' ? seed : 0;
    const maxFixRounds = 4;
    const attempts = 6;

    for (let round = 0; round < maxFixRounds; round++) {
      if (this.hasSolvablePath(blocks, screenWidth, screenHeight, baseSeed + round * 131, attempts)) {
        return true;
      }
      const adjusted = this.relaxBlockedDirections(
        blocks,
        screenWidth,
        screenHeight,
        centerX,
        centerY,
        shortSide,
        Math.ceil(blocks.length * 0.2)
      );
      if (!adjusted) break;
    }

    return this.hasSolvablePath(blocks, screenWidth, screenHeight, baseSeed + 777, attempts + 2);
  }

  static hasSolvablePath(blocks, screenWidth, screenHeight, seed, attempts = 6) {
    const total = blocks.length;
    if (total === 0) return true;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const rand = this.createSeededRandom(seed + attempt * 97 + 11);
      const working = blocks.map(block => ({
        ...block,
        isRemoved: false,
        visible: true
      }));

      let removed = 0;
      while (removed < total) {
        const removable = [];
        for (const block of working) {
          if (block.isRemoved) continue;
          if (!DirectionDetector.isBlocked(block, working, screenWidth, screenHeight, { debug: false })) {
            removable.push(block);
          }
        }

        if (removable.length === 0) break;

        const pick = removable[Math.floor(rand() * removable.length)];
        pick.isRemoved = true;
        removed++;
      }

      if (removed === total) return true;
    }

    return false;
  }

  /**
   * 验证关卡可解性
   */
  static validateLevel(blocks, screenWidth, screenHeight, seed) {
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
      if (!DirectionDetector.isBlocked(block, normalized, screenWidth, screenHeight, { debug: false })) {
        removableCount++;
      }
    }

    const minRequired = Math.max(6, Math.floor(blocks.length * 0.15));
    const isValid = removableCount >= minRequired;
    if (!isValid) {
      console.log(`[LevelGenerator] 验证: 可消除 ${removableCount}/${blocks.length}, 最低要求 ${minRequired}, 结果: false`);
      return false;
    }

    const baseSeed = typeof seed === 'number' ? seed : 0;
    const solvable = this.hasSolvablePath(normalized, screenWidth, screenHeight, baseSeed, 8);
    console.log(`[LevelGenerator] 验证: 可消除 ${removableCount}/${blocks.length}, 最低要求 ${minRequired}, 可解: ${solvable}`);
    return solvable;
  }

  /**
   * 检查方块是否重叠
   */
  static hasOverlap(blocks) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];

        // AABB碰撞检测（允许一定内缩，减少旋转AABB误判）
        const margin = Math.max(1, BLOCK_SIZES.HITBOX_INSET || 0);
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
   * 获取难度参数（旋转网格 + 双格方块）
   */
  static getDifficultyParams(level) {
    const SMALL_BLOCK = 16;
    const MEDIUM_BLOCK = 18;
    const LARGE_BLOCK = 20;

    if (level <= 3) {
      return {
        blockCount: 48 + level * 6,  // 54-66
        blockSize: LARGE_BLOCK,
        holeRateRange: [0.12, 0.18]
      };
    } else if (level <= 10) {
      return {
        blockCount: 70 + (level - 3) * 6,  // 76-112
        blockSize: MEDIUM_BLOCK,
        holeRateRange: [0.12, 0.18]
      };
    } else if (level <= 20) {
      return {
        blockCount: 100 + (level - 10) * 5,  // 105-150
        blockSize: SMALL_BLOCK,
        holeRateRange: [0.1, 0.16]
      };
    } else {
      return {
        blockCount: Math.min(175, 130 + (level - 20) * 4),
        blockSize: SMALL_BLOCK,
        holeRateRange: [0.08, 0.12]
      };
    }
  }
}

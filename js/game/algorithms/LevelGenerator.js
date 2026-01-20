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
  
  // 关卡结构模板（用于降低同质化）
  static HOLE_TEMPLATES = {
    SPARSE: 'sparse',
    RING: 'ring',
    DIAGONAL_BAND: 'diagonalBand',
    CENTER_HOLLOW: 'centerHollow',
    TWO_LUMPS: 'twoLumps'
  };
  
  static DIRECTION_MODES = {
    PEEL: 'peel',
    SPLIT: 'split',
    PINCH: 'pinch'
  };

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
   * 使用 lane 同向原则，保证算法本身不产生对向死锁，无需重试
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);
    const seed = this.getSeed(levelNumber, 0);

    console.log(`[LevelGenerator] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}`);

    const blocks = this.generateRotatedGridDominoLayout(
      params,
      seed,
      screenWidth,
      screenHeight,
      boardRect
    );

    // 开发环境下检测对向死锁（用于验证算法正确性）
    if (typeof __wxConfig !== 'undefined' || typeof process !== 'undefined') {
      const deadlocks = this.detectFacingDeadlocks(blocks);
      if (deadlocks.length > 0) {
        console.error('[LevelGenerator] BUG: 产生了对向死锁', deadlocks);
      }
    }

    console.log(`[LevelGenerator] 关卡 ${levelNumber} 生成完成，方块数: ${blocks.length}`);
    return { blocks, total: blocks.length };
  }
  
  /**
   * 检测对向死锁（开发调试用）
   * 检查同一 lane 内是否有方向相反的方块
   */
  static detectFacingDeadlocks(blocks) {
    const deadlocks = [];
    
    // 构建 lane 索引
    const rowLanes = new Map(); // gridCol -> [blocks with axis='row']
    const colLanes = new Map(); // gridRow -> [blocks with axis='col']
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.axis === 'row') {
        const key = block.gridCol;
        if (!rowLanes.has(key)) rowLanes.set(key, []);
        rowLanes.get(key).push({ block, index: i });
      } else if (block.axis === 'col') {
        const key = block.gridRow;
        if (!colLanes.has(key)) colLanes.set(key, []);
        colLanes.get(key).push({ block, index: i });
      }
    }
    
    // 检查每个 row-lane 内是否有对向（UP vs DOWN）
    for (const [col, items] of rowLanes) {
      const directions = new Set(items.map(item => item.block.direction));
      if (directions.has(DIRECTIONS.UP) && directions.has(DIRECTIONS.DOWN)) {
        deadlocks.push({ type: 'row-lane', col, items: items.map(it => ({ gridRow: it.block.gridRow, direction: it.block.direction })) });
      }
    }
    
    // 检查每个 col-lane 内是否有对向（LEFT vs RIGHT）
    for (const [row, items] of colLanes) {
      const directions = new Set(items.map(item => item.block.direction));
      if (directions.has(DIRECTIONS.LEFT) && directions.has(DIRECTIONS.RIGHT)) {
        deadlocks.push({ type: 'col-lane', row, items: items.map(it => ({ gridCol: it.block.gridCol, direction: it.block.direction })) });
      }
    }
    
    return deadlocks;
  }
  
  /**
   * 快速验证关卡（用于预检）
   * 利用 _solvable 缓存避免重复计算
   */
  static validateLevelFast(blocks, screenWidth, screenHeight, seed) {
    // 检查重叠
    if (this.hasOverlap(blocks)) {
      return { valid: false, removableRatio: 0 };
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

    const removableRatio = blocks.length > 0 ? removableCount / blocks.length : 0;
    const minRequired = Math.max(6, Math.floor(blocks.length * 0.15));
    
    if (removableCount < minRequired) {
      return { valid: false, removableRatio };
    }

    // 如果预判结果存在，直接使用（避免重复计算）
    const knownSolvable = blocks._solvable;
    if (knownSolvable === true) {
      return { valid: true, removableRatio };
    }
    if (knownSolvable === false) {
      return { valid: false, removableRatio };
    }

    // 使用完整验证次数
    const baseSeed = typeof seed === 'number' ? seed : 0;
    const solvable = this.hasSolvablePath(normalized, screenWidth, screenHeight, baseSeed, 6);
    return { valid: solvable, removableRatio };
  }

  /**
   * 生成旋转网格 + 双格方块布局（基于阻挡深度系统）
   * 
   * 新流程：
   * 1. 生成方块位置（原有网格布局）
   * 2. 使用阻挡深度系统分配方向
   * 3. 验证可解性
   */
  static generateRotatedGridDominoLayout(params, seed, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize, animalTypes = 5 } = params;

    let shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const minShortSide = 12;
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
    
    const holeTemplate = this.resolveHoleTemplate(params, seed, rand);
    const holes = this.selectHolesByTemplate(candidates, holeCount, holeTemplate, rand, centerX, centerY);

    const used = new Set(holes);
    const ordered = this.orderCandidatesCenterOut(candidates, rand);

    // 第一阶段：放置方块（先用临时方向）
    let placed = 0;
    for (const cell of ordered) {
      if (placed >= targetBlockCount) break;
      if (used.has(cell.key)) continue;

      const neighbors = this.getAvailableNeighbors(cell, cellMap, used);
      if (neighbors.length === 0) continue;

      const neighbor = neighbors[Math.floor(rand() * neighbors.length)];
      const axis = neighbor.col !== cell.col ? 'col' : 'row';
      const gridRow = axis === 'row' ? Math.min(cell.row, neighbor.row) : cell.row;
      const gridCol = axis === 'col' ? Math.min(cell.col, neighbor.col) : cell.col;
      const blockCenterX = (cell.x + neighbor.x) / 2;
      const blockCenterY = (cell.y + neighbor.y) / 2;
      
      // 临时方向（后续会被 assignDirectionsByLane 重新分配）
      const tempDirection = DIRECTIONS.UP;
      const { width: bw, height: bh } = this.getBlockDimensions(tempDirection, shortSide);
      const blockX = blockCenterX - bw / 2;
      const blockY = blockCenterY - bh / 2;

      if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) {
        continue;
      }

      if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) {
        continue;
      }

      blocks.push({
        x: blockX,
        y: blockY,
        width: bw,
        height: bh,
        direction: tempDirection,
        axis,
        gridRow,
        gridCol,
        type: null, // 后续分配
        size: shortSide
      });

      used.add(cell.key);
      used.add(neighbor.key);
      placed++;
    }

    // 二次补充：随机顺序再尝试填充
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
        const gridRow = axis === 'row' ? Math.min(cell.row, neighbor.row) : cell.row;
        const gridCol = axis === 'col' ? Math.min(cell.col, neighbor.col) : cell.col;
        const blockCenterX = (cell.x + neighbor.x) / 2;
        const blockCenterY = (cell.y + neighbor.y) / 2;
        
        const tempDirection = DIRECTIONS.UP;
        const { width: bw, height: bh } = this.getBlockDimensions(tempDirection, shortSide);
        const blockX = blockCenterX - bw / 2;
        const blockY = blockCenterY - bh / 2;

        if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) {
          continue;
        }

        if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) {
          continue;
        }

        blocks.push({
          x: blockX,
          y: blockY,
          width: bw,
          height: bh,
          direction: tempDirection,
          axis,
          gridRow,
          gridCol,
          type: null,
          size: shortSide
        });

        used.add(cell.key);
        used.add(neighbor.key);
        placed++;
      }
    }

    // 第二阶段：使用 lane 同向原则分配方向（彻底杜绝对向死锁）
    this.assignDirectionsByLane(
      blocks,
      params,
      screenWidth,
      screenHeight,
      centerX,
      centerY,
      shortSide,
      rand
    );

    // 第三阶段：分配动物类型（打乱后均匀分配）
    const usedAnimalTypes = this.ANIMAL_TYPES.slice(0, animalTypes);
    const shuffledBlocks = [...blocks];
    this.shuffleArray(shuffledBlocks, rand);
    shuffledBlocks.forEach((block, i) => {
      block.type = usedAnimalTypes[i % usedAnimalTypes.length];
    });

    // 第四阶段：验证可解性
    const solvable = this.ensureSolvablePath(
      blocks,
      screenWidth,
      screenHeight,
      centerX,
      centerY,
      shortSide,
      seed,
      params
    );
    blocks._solvable = solvable;

    // 输出深度统计
    const depthInfo = this.calculateBlockDepths(blocks, screenWidth, screenHeight);
    console.log(`[LevelGenerator] 最终深度: 平均=${depthInfo.avgDepth.toFixed(2)}, 最大=${depthInfo.maxDepth}, 方块数=${blocks.length}`);

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
      const maxRow = Math.floor(safeBoardRect.height / (2 * step));
      const maxCol = Math.floor(safeBoardRect.width / (2 * step));
      for (let row = -maxRow; row <= maxRow; row++) {
        for (let col = -maxCol; col <= maxCol; col++) {
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
  
  static resolveHoleTemplate(params, seed, rand) {
    const direct = params.holeTemplate;
    if (direct && direct !== 'rotate') return direct;
    const templates = params.holeTemplates && params.holeTemplates.length
      ? params.holeTemplates
      : [
          this.HOLE_TEMPLATES.SPARSE,
          this.HOLE_TEMPLATES.RING,
          this.HOLE_TEMPLATES.DIAGONAL_BAND,
          this.HOLE_TEMPLATES.CENTER_HOLLOW,
          this.HOLE_TEMPLATES.TWO_LUMPS
        ];
    const idx = Math.floor(rand() * templates.length);
    return templates[idx];
  }
  
  static selectHolesByTemplate(candidates, holeCount, template, rand, centerX, centerY) {
    if (holeCount <= 0) return new Set();
    if (!template || template === this.HOLE_TEMPLATES.SPARSE) {
      return this.selectSparseHoles(candidates, holeCount, rand);
    }
    
    // 基于模板的“加权候选集”，再复用稀疏选择规则
    const scored = candidates.map(cell => {
      let score = 0;
      
      // candidates 自带 dist = |row| + |col|
      const d = cell.dist;
      const absRow = Math.abs(cell.row);
      const absCol = Math.abs(cell.col);
      
      if (template === this.HOLE_TEMPLATES.CENTER_HOLLOW) {
        // 优先挖空中心
        score = -d;
      } else if (template === this.HOLE_TEMPLATES.RING) {
        // 优先在中环挖洞，制造“外圈/内圈”节奏
        const r0 = Math.max(2, Math.floor(Math.sqrt(candidates.length) * 0.22));
        const r1 = Math.max(r0 + 1, Math.floor(Math.sqrt(candidates.length) * 0.32));
        const inRing = d >= r0 && d <= r1;
        score = inRing ? 100 - d : -Math.abs(d - r0);
      } else if (template === this.HOLE_TEMPLATES.DIAGONAL_BAND) {
        // 斜带：根据 row-col 的接近程度选洞
        const band = Math.max(1, Math.floor(Math.sqrt(candidates.length) * 0.10));
        const v = Math.abs(cell.row - cell.col);
        score = -Math.abs(v - band) - d * 0.05;
      } else if (template === this.HOLE_TEMPLATES.TWO_LUMPS) {
        // 双团块：优先在中心十字/带状挖洞，形成两个团
        const v1 = Math.abs(cell.row + cell.col);
        const v2 = Math.abs(cell.row - cell.col);
        const stripe = Math.min(v1, v2);
        score = -(stripe) - d * 0.03;
      } else {
        score = -d;
      }
      
      // 注入少量噪声，避免过于规则
      score += (rand() - 0.5) * 0.25;
      return { cell, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map(s => s.cell);
    
    // 使用“稀疏洞”规则选取 holeCount 个洞
    const holes = new Set();
    const blocked = new Set();
    for (const cell of ordered) {
      if (holes.size >= holeCount) break;
      if (blocked.has(cell.key)) continue;
      holes.add(cell.key);
      this.getNeighborKeys(cell).forEach(k => blocked.add(k));
    }
    
    // 若不足，放宽约束补齐
    if (holes.size < holeCount) {
      for (const cell of ordered) {
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

  /**
   * 为方块对选择方向
   * @param {Object} cell - 当前格子
   * @param {Object} neighbor - 邻居格子
   * @param {number} blockCenterX - 方块中心X
   * @param {number} blockCenterY - 方块中心Y
   * @param {number} centerX - 棋盘中心X
   * @param {number} centerY - 棋盘中心Y
   * @param {Function} rand - 随机函数
   * @param {number} outwardBias - 朝外偏好 (0-1)，越高越倾向于朝外
   */
  static pickDirectionForPair(cell, neighbor, blockCenterX, blockCenterY, centerX, centerY, rand, outwardBias = 0.88) {
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

    // 使用 outwardBias 控制朝外概率
    // outwardBias = 0.88 意味着 88% 概率朝外，12% 概率朝内
    if (rand() >= outwardBias) return this.getOppositeDirection(preferred);
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

  /**
   * 基于 lane 同向原则分配方向（核心修复：彻底杜绝对向死锁）
   * 
   * 核心规则：
   * - 同一 row-lane（相同 gridCol，axis='row'）上的方块必须都朝 UP 或都朝 DOWN
   * - 同一 col-lane（相同 gridRow，axis='col'）上的方块必须都朝 LEFT 或都朝 RIGHT
   * 
   * 这样保证：
   * - 不可能产生对向死锁
   * - lane 最外侧的方块可以消除
   * - 消除后，下一个变成最外侧，依次可消
   */
  static assignDirectionsByLane(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const n = blocks.length;
    if (n === 0) return;
    
    // 1. 构建 lane 索引
    const rowLanes = new Map(); // gridCol -> [blocks with axis='row']
    const colLanes = new Map(); // gridRow -> [blocks with axis='col']
    
    for (const block of blocks) {
      if (block.axis === 'row') {
        const key = block.gridCol;
        if (!rowLanes.has(key)) rowLanes.set(key, []);
        rowLanes.get(key).push(block);
      } else if (block.axis === 'col') {
        const key = block.gridRow;
        if (!colLanes.has(key)) colLanes.set(key, []);
        colLanes.get(key).push(block);
      }
    }
    
    // 2. 对每个 row-lane 分配方向（同一 lane 内所有方块同向）
    for (const [col, laneBlocks] of rowLanes) {
      // 按 gridRow 排序，确定 lane 内方块的顺序
      laneBlocks.sort((a, b) => a.gridRow - b.gridRow);
      const direction = this.pickLaneExitDirection(laneBlocks, 'row', centerX, centerY, rand, params);
      for (const block of laneBlocks) {
        this.setBlockDirection(block, direction, shortSide);
      }
    }
    
    // 3. 对每个 col-lane 分配方向（同一 lane 内所有方块同向）
    for (const [row, laneBlocks] of colLanes) {
      // 按 gridCol 排序，确定 lane 内方块的顺序
      laneBlocks.sort((a, b) => a.gridCol - b.gridCol);
      const direction = this.pickLaneExitDirection(laneBlocks, 'col', centerX, centerY, rand, params);
      for (const block of laneBlocks) {
        this.setBlockDirection(block, direction, shortSide);
      }
    }
    
    // 4. 验证并微调以满足初始可消除比例
    this.adjustForRemovableRatio(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand);
  }
  
  /**
   * 选择 lane 的出口方向
   * 
   * 策略：
   * - 根据 lane 中心位置相对于棋盘中心的位置决定出口方向
   * - 使用 laneExitBias 参数控制"朝外"的偏好（越高越简单）
   * - 适当引入随机性增加变化
   */
  static pickLaneExitDirection(laneBlocks, axis, centerX, centerY, rand, params = {}) {
    if (laneBlocks.length === 0) return DIRECTIONS.UP;
    
    // 计算 lane 的中心位置
    const firstBlock = laneBlocks[0];
    const lastBlock = laneBlocks[laneBlocks.length - 1];
    const laneCenterX = (firstBlock.x + firstBlock.width / 2 + lastBlock.x + lastBlock.width / 2) / 2;
    const laneCenterY = (firstBlock.y + firstBlock.height / 2 + lastBlock.y + lastBlock.height / 2) / 2;
    
    // laneExitBias 控制朝外概率（0.5 = 随机，1.0 = 全部朝外，0.0 = 全部朝内）
    const laneExitBias = params.laneExitBias !== undefined ? params.laneExitBias : 0.7;
    
    if (axis === 'row') {
      // row-lane: 选择 UP 或 DOWN
      // laneCenterY < centerY 意味着 lane 在上半部分，朝 UP 是"朝外"
      const outwardDir = laneCenterY < centerY ? DIRECTIONS.UP : DIRECTIONS.DOWN;
      const inwardDir = laneCenterY < centerY ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      return rand() < laneExitBias ? outwardDir : inwardDir;
    } else {
      // col-lane: 选择 LEFT 或 RIGHT
      // laneCenterX < centerX 意味着 lane 在左半部分，朝 LEFT 是"朝外"
      const outwardDir = laneCenterX < centerX ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
      const inwardDir = laneCenterX < centerX ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      return rand() < laneExitBias ? outwardDir : inwardDir;
    }
  }
  
  /**
   * 调整方向以满足初始可消除比例
   * 注意：只能在 lane 级别调整（整条 lane 翻转），不能单独调整某个方块
   */
  static adjustForRemovableRatio(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const n = blocks.length;
    if (n === 0) return;
    
    const targetRemovableRatio = params.initialRemovableRatio || 0.25;
    const targetRemovable = Math.max(6, Math.floor(n * targetRemovableRatio));
    
    // 构建 lane 索引（用于整体翻转）
    const rowLanes = new Map();
    const colLanes = new Map();
    
    for (const block of blocks) {
      if (block.axis === 'row') {
        const key = block.gridCol;
        if (!rowLanes.has(key)) rowLanes.set(key, []);
        rowLanes.get(key).push(block);
      } else if (block.axis === 'col') {
        const key = block.gridRow;
        if (!colLanes.has(key)) colLanes.set(key, []);
        colLanes.get(key).push(block);
      }
    }
    
    // 计算当前可消除数量
    const countRemovable = () => {
      let count = 0;
      for (const block of blocks) {
        if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight, { debug: false })) {
          count++;
        }
      }
      return count;
    };
    
    let removableCount = countRemovable();
    
    // 如果可消除数量不足，翻转一些"朝内"的 lane 使其"朝外"
    if (removableCount < targetRemovable) {
      // 收集所有可翻转的 lane（按距离中心远近排序，优先翻转外围的 lane）
      const lanesToFlip = [];
      
      for (const [col, laneBlocks] of rowLanes) {
        const cx = (laneBlocks[0].x + laneBlocks[0].width / 2);
        const cy = laneBlocks.reduce((sum, b) => sum + b.y + b.height / 2, 0) / laneBlocks.length;
        const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
        // 判断当前是否"朝内"
        const currentDir = laneBlocks[0].direction;
        const outwardDir = cy < centerY ? DIRECTIONS.UP : DIRECTIONS.DOWN;
        const isInward = currentDir !== outwardDir;
        if (isInward) {
          lanesToFlip.push({ axis: 'row', key: col, blocks: laneBlocks, dist });
        }
      }
      
      for (const [row, laneBlocks] of colLanes) {
        const cy = (laneBlocks[0].y + laneBlocks[0].height / 2);
        const cx = laneBlocks.reduce((sum, b) => sum + b.x + b.width / 2, 0) / laneBlocks.length;
        const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
        const currentDir = laneBlocks[0].direction;
        const outwardDir = cx < centerX ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
        const isInward = currentDir !== outwardDir;
        if (isInward) {
          lanesToFlip.push({ axis: 'col', key: row, blocks: laneBlocks, dist });
        }
      }
      
      // 按距离中心由远到近排序（优先翻转外围）
      lanesToFlip.sort((a, b) => b.dist - a.dist);
      
      // 逐个翻转 lane，直到满足可消除数量
      for (const lane of lanesToFlip) {
        if (removableCount >= targetRemovable) break;
        
        const newDir = this.getOppositeDirection(lane.blocks[0].direction);
        for (const block of lane.blocks) {
          this.setBlockDirection(block, newDir, shortSide);
        }
        
        removableCount = countRemovable();
      }
    }
    
    console.log(`[LevelGenerator] 方向调整完成: 可消除=${removableCount}/${n}, 目标=${targetRemovable}`);
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
   * @param {number} initialRemovableRatio - 初始可消除比例 (0-1)
   */
  static ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, initialRemovableRatio = 0.20) {
    const minRemovable = Math.max(6, Math.floor(blocks.length * initialRemovableRatio));

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

  /**
   * 确保关卡有可解路径
   * 恢复完整验证次数确保可靠性
   */
  static ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed, params = null) {
    const baseSeed = typeof seed === 'number' ? seed : 0;
    const maxFixRounds = 4; // 恢复为 4 轮修复
    const attempts = params && Number.isFinite(params.solvabilityAttempts) ? params.solvabilityAttempts : 6;

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

    // 最后一次检查
    return this.hasSolvablePath(blocks, screenWidth, screenHeight, baseSeed + 777, attempts + 2);
  }

  /**
   * 检查是否有可解路径
   * 恢复完整验证次数确保可靠性
   */
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

      // 早期返回：一旦找到可解路径就立即返回
      if (removed === total) return true;
    }

    return false;
  }

  /**
   * 验证关卡可解性
   */
  static validateLevel(blocks, screenWidth, screenHeight, seed, params = null) {
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

    const knownSolvable = blocks._solvable;
    if (knownSolvable === false) {
      console.log('[LevelGenerator] 验证: 预判不可解');
      return false;
    }

    if (knownSolvable === true) {
      console.log(`[LevelGenerator] 验证: 可消除 ${removableCount}/${blocks.length}, 最低要求 ${minRequired}, 可解: true`);
      return true;
    }

    const baseSeed = typeof seed === 'number' ? seed : 0;
    const solvabilityAttempts = params && Number.isFinite(params.solvabilityAttempts) ? params.solvabilityAttempts : 6;
    const solvable = this.hasSolvablePath(normalized, screenWidth, screenHeight, baseSeed, solvabilityAttempts);
    console.log(`[LevelGenerator] 验证: 可消除 ${removableCount}/${blocks.length}, 最低要求 ${minRequired}, 可解: ${solvable}`);
    if (!solvable) return false;
    
    // 体验门槛：用随机策略死局概率估算“难度/挫败感”（用于 L3+ 提高难度、避免过于顺滑）
    const range = params && params.deadlockProbRange;
    if (range && Array.isArray(range) && range.length === 2) {
      const runs = params && Number.isFinite(params.deadlockEstimateRuns) ? params.deadlockEstimateRuns : 12;
      const estimate = this.estimateDeadlockProbability(normalized, screenWidth, screenHeight, baseSeed + 991, runs);
      const min = Math.min(range[0], range[1]);
      const max = Math.max(range[0], range[1]);
      const ok = estimate >= min && estimate <= max;
      console.log(`[LevelGenerator] 验证: deadlockProb≈${estimate.toFixed(2)} (目标区间 ${min.toFixed(2)}-${max.toFixed(2)}), 结果: ${ok}`);
      if (!ok) return false;
    }
    
    return true;
  }
  
  static estimateDeadlockProbability(blocks, screenWidth, screenHeight, seed, runs = 12) {
    if (!blocks || blocks.length === 0) return 0;
    let deadlocks = 0;
    for (let r = 0; r < runs; r++) {
      const rand = this.createSeededRandom(seed + r * 97 + 11);
      const working = blocks.map(b => ({ ...b, isRemoved: false, visible: true }));
      let removed = 0;
      let stuck = false;
      while (removed < working.length) {
        const removable = [];
        for (const block of working) {
          if (block.isRemoved) continue;
          if (!DirectionDetector.isBlocked(block, working, screenWidth, screenHeight, { debug: false })) {
            removable.push(block);
          }
        }
        if (removable.length === 0) { stuck = true; break; }
        const pick = removable[Math.floor(rand() * removable.length)];
        pick.isRemoved = true;
        removed++;
      }
      if (stuck) deadlocks++;
    }
    return deadlocks / runs;
  }
  
  /**
   * 调试/评审用：输出单关质量指标（用于对比同质化与难度递增）
   * 注意：该方法不会被正常流程调用，仅用于开发者工具/日志分析。
   */
  static analyzeLevel(levelNumber, screenWidth, screenHeight, attempt = 0) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);
    const seed = this.getSeed(levelNumber, attempt);
    const blocks = this.generateRotatedGridDominoLayout(params, seed, screenWidth, screenHeight, boardRect);
    
    const normalized = blocks.map(b => ({ ...b, isRemoved: false, visible: true }));
    const depthInfo = this.calculateBlockDepths(normalized, screenWidth, screenHeight);
    const initialRemovable = depthInfo.depths.filter(d => d === 0).length;
    const deadlockProb = this.estimateDeadlockProbability(normalized, screenWidth, screenHeight, seed + 991, params.deadlockEstimateRuns || 12);
    
    return {
      levelNumber,
      phaseName: params.phaseName,
      blockCount: blocks.length,
      coreCount: params.coreCount || 1,
      holeTemplate: params.holeTemplate,
      directionMode: params.directionMode,
      targetAvgDepth: params.targetAvgDepth,
      targetMaxDepth: params.targetMaxDepth,
      initialRemovableRatio: initialRemovable / Math.max(1, blocks.length),
      avgDepth: depthInfo.avgDepth,
      maxDepth: depthInfo.maxDepth,
      deadlockProbEstimate: deadlockProb,
      deadlockProbRange: params.deadlockProbRange
    };
  }
  
  static analyzeRange(startLevel, endLevel, screenWidth, screenHeight) {
    const out = [];
    for (let lv = startLevel; lv <= endLevel; lv++) {
      out.push(this.analyzeLevel(lv, screenWidth, screenHeight, 0));
    }
    return out;
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
   * 获取难度参数（简化版，基于 lane 同向原则）
   * 
   * 阶段划分：
   * - 教程期 (1-2): 高朝外比例，简单顺滑
   * - 上手挑战期 (3-8): 朝外比例下降，开始有难度
   * - 加速成长期 (9-18): 难度稳步提升
   * - 挑战期 (19-35): 较高难度
   * - 大师期 (36-60): 高难度
   * - 传奇期 (61+): 极限难度
   * 
   * 核心参数：
   * - laneExitBias: 控制 lane 朝外的概率（越高越简单）
   * - initialRemovableRatio: 初始可消除比例
   * - blockCount: 方块数量
   * 
   * 锯齿波动：每5关一个周期，第5关是"休息关"
   */
  static getDifficultyParams(level) {
    // 固定方块尺寸（所有关卡一致）
    const BLOCK_SIZE = 16;
    
    // 简化后的阶段定义
    const phases = [
      {
        maxLevel: 2,
        name: '教程期',
        blockCount: [92, 120],
        removableRatio: [0.36, 0.44],
        laneExitBias: [0.90, 0.85],  // 高朝外概率，简单
        animalTypes: 3,
        holeTemplates: [this.HOLE_TEMPLATES.CENTER_HOLLOW, this.HOLE_TEMPLATES.SPARSE]
      },
      {
        maxLevel: 8,
        name: '上手挑战期',
        blockCount: [125, 155],
        removableRatio: [0.28, 0.24],
        laneExitBias: [0.80, 0.65],  // 朝外概率下降
        animalTypes: 4,
        holeTemplates: [this.HOLE_TEMPLATES.TWO_LUMPS, this.HOLE_TEMPLATES.RING, this.HOLE_TEMPLATES.DIAGONAL_BAND]
      },
      {
        maxLevel: 18,
        name: '加速成长期',
        blockCount: [155, 185],
        removableRatio: [0.22, 0.18],
        laneExitBias: [0.62, 0.52],
        animalTypes: 5,
        holeTemplates: [this.HOLE_TEMPLATES.TWO_LUMPS, this.HOLE_TEMPLATES.DIAGONAL_BAND, this.HOLE_TEMPLATES.SPARSE]
      },
      {
        maxLevel: 35,
        name: '挑战期',
        blockCount: [175, 200],
        removableRatio: [0.18, 0.15],
        laneExitBias: [0.50, 0.42],
        animalTypes: 5,
        holeTemplates: [this.HOLE_TEMPLATES.DIAGONAL_BAND, this.HOLE_TEMPLATES.RING, this.HOLE_TEMPLATES.SPARSE]
      },
      {
        maxLevel: 60,
        name: '大师期',
        blockCount: [190, 210],
        removableRatio: [0.15, 0.12],
        laneExitBias: [0.40, 0.32],
        animalTypes: 5,
        holeTemplates: [this.HOLE_TEMPLATES.RING, this.HOLE_TEMPLATES.DIAGONAL_BAND, this.HOLE_TEMPLATES.SPARSE]
      },
      {
        maxLevel: Infinity,
        name: '传奇期',
        blockCount: [205, 220],
        removableRatio: [0.12, 0.10],
        laneExitBias: [0.30, 0.22],
        animalTypes: 5,
        holeTemplates: [this.HOLE_TEMPLATES.DIAGONAL_BAND, this.HOLE_TEMPLATES.TWO_LUMPS, this.HOLE_TEMPLATES.RING]
      }
    ];

    // 找到当前阶段
    let phase = phases[0];
    let phaseStartLevel = 1;
    for (let i = 0; i < phases.length; i++) {
      if (level <= phases[i].maxLevel) {
        phase = phases[i];
        phaseStartLevel = i === 0 ? 1 : phases[i - 1].maxLevel + 1;
        break;
      }
    }

    // 计算阶段内进度 (0 ~ 1)
    const phaseLength = phase.maxLevel === Infinity ? 40 : phase.maxLevel - phaseStartLevel + 1;
    const levelInPhase = level - phaseStartLevel;
    const phaseProgress = Math.min(1, levelInPhase / phaseLength);

    // 锯齿波动：每5关一个周期
    const cycleLength = 5;
    const cyclePosition = (level - 1) % cycleLength; // 0, 1, 2, 3, 4
    const isReliefLevel = cyclePosition === cycleLength - 1; // 第5关是休息关
    
    // 锯齿调整系数
    const sawtoothFactor = isReliefLevel ? -0.15 : cyclePosition * 0.04;

    // 计算方块数量（线性插值 + 锯齿）
    const baseBlockCount = this.lerp(phase.blockCount[0], phase.blockCount[1], phaseProgress);
    const blockCountAdjust = baseBlockCount * sawtoothFactor;
    const blockCount = Math.round(Math.max(80, Math.min(220, baseBlockCount + blockCountAdjust)));

    // 计算初始可消除比例（锯齿调整：休息关更高）
    const baseRemovableRatio = this.lerp(phase.removableRatio[0], phase.removableRatio[1], phaseProgress);
    const removableAdjust = isReliefLevel ? 0.06 : -cyclePosition * 0.01;
    const initialRemovableRatio = Math.max(0.10, Math.min(0.45, baseRemovableRatio + removableAdjust));

    // 计算 lane 朝外概率（核心难度控制参数）
    const baseLaneExitBias = this.lerp(phase.laneExitBias[0], phase.laneExitBias[1], phaseProgress);
    const biasAdjust = isReliefLevel ? 0.10 : -cyclePosition * 0.02;
    const laneExitBias = Math.max(0.15, Math.min(0.95, baseLaneExitBias + biasAdjust));

    // 空洞率根据方块数量自适应
    const holeRateBase = blockCount > 170 ? 0.05 : blockCount > 140 ? 0.07 : 0.09;
    const holeRateRange = [holeRateBase, holeRateBase + 0.03];

    // 动物种类数
    const animalTypes = phase.animalTypes;
    
    // 结构模板（与关卡号绑定，保证可复现）
    const holeTemplates = phase.holeTemplates || [this.HOLE_TEMPLATES.SPARSE];
    const holeTemplate = holeTemplates[level % holeTemplates.length];

    return {
      blockCount,
      blockSize: BLOCK_SIZE,
      holeRateRange,
      initialRemovableRatio,
      laneExitBias,        // 新增：lane 朝外概率（核心难度参数）
      animalTypes,
      isReliefLevel,
      phaseName: phase.name,
      holeTemplate,
      holeTemplates
    };
  }

  /**
   * 线性插值
   */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // ==================== 阻挡深度系统 ====================

  /**
   * 计算所有方块的阻挡深度
   * 深度定义：消除该方块前需要先消除多少个阻挡它的方块
   * - 深度0：直接可消（无阻挡）
   * - 深度1：被1个方块阻挡
   * - 深度N：需要解N层才能消除
   */
  static calculateBlockDepths(blocks, screenWidth, screenHeight) {
    const n = blocks.length;
    if (n === 0) return { depths: [], avgDepth: 0, maxDepth: 0 };

    // 初始化：所有方块深度未知(-1)
    const depths = new Array(n).fill(-1);
    const working = blocks.map(b => ({ ...b, isRemoved: false, visible: true }));

    // BFS计算深度：每轮找出当前可消除的方块，标记深度
    let currentDepth = 0;
    let remaining = n;
    
    while (remaining > 0) {
      const removableIndices = [];
      
      for (let i = 0; i < n; i++) {
        if (depths[i] !== -1) continue; // 已计算
        if (working[i].isRemoved) continue;
        
        if (!DirectionDetector.isBlocked(working[i], working, screenWidth, screenHeight, { debug: false })) {
          removableIndices.push(i);
        }
      }

      if (removableIndices.length === 0) {
        // 剩余方块无法消除（死局），标记为最大深度+1
        for (let i = 0; i < n; i++) {
          if (depths[i] === -1) {
            depths[i] = currentDepth + 1;
          }
        }
        break;
      }

      // 标记这批方块的深度
      for (const idx of removableIndices) {
        depths[idx] = currentDepth;
        working[idx].isRemoved = true;
        remaining--;
      }

      currentDepth++;
    }

    // 计算统计数据
    const validDepths = depths.filter(d => d >= 0);
    const avgDepth = validDepths.length > 0 
      ? validDepths.reduce((a, b) => a + b, 0) / validDepths.length 
      : 0;
    const maxDepth = Math.max(...validDepths, 0);

    return { depths, avgDepth, maxDepth };
  }

  /**
   * 基于阻挡深度分配方向
   * 核心策略：
   * 1. 按距离中心排序，划分核心区/中间区/边缘区
   * 2. 边缘区朝外（可直接消除）
   * 3. 核心区构建多层阻挡结构
   * 4. 验证并调整以满足目标深度分布
   */
  static assignDirectionsByDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand, coreCenters = null) {
    const { targetAvgDepth, targetMaxDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    if (n === 0) return;
    
    const mode = params.directionMode || this.DIRECTION_MODES.PEEL;
    const centers = Array.isArray(coreCenters) && coreCenters.length ? coreCenters : [{ x: centerX, y: centerY }];
    if (centers.length > 1) {
      this.assignDirectionsByDepthMultiCore(blocks, params, screenWidth, screenHeight, centerX, centerY, centers, shortSide, rand);
      return;
    }

    // 1. 按距离中心排序
    const sorted = blocks.map((block, idx) => {
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
      return { block, idx, dist, cx, cy };
    }).sort((a, b) => a.dist - b.dist);

    // 2. 划分区域
    // 核心区比例随目标深度增加而增加
    const coreRatio = Math.min(0.5, 0.25 + targetAvgDepth * 0.12);
    let edgeRatio = Math.max(0.3, initialRemovableRatio + 0.05);
    if (mode === this.DIRECTION_MODES.PINCH) edgeRatio = Math.max(0.26, edgeRatio - 0.04);
    if (mode === this.DIRECTION_MODES.SPLIT) edgeRatio = Math.min(0.42, edgeRatio + 0.03);
    
    const coreCount = Math.floor(n * coreRatio);
    const edgeCount = Math.floor(n * edgeRatio);
    const midCount = n - coreCount - edgeCount;

    // 3. 边缘区：朝向屏幕边缘（可消除）
    for (let i = n - edgeCount; i < n; i++) {
      const { block, cx, cy } = sorted[i];
      const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
      this.setBlockDirection(block, outward, shortSide);
    }

    // 4. 核心区：构建阻挡层
    this.buildBlockingLayers(
      sorted.slice(0, coreCount).map(s => s.block),
      targetMaxDepth,
      centerX, centerY, shortSide, rand,
      mode
    );

    // 5. 中间区：混合策略（部分朝外，部分指向核心）
    const midBlocks = sorted.slice(coreCount, coreCount + midCount);
    let inwardRatio = 0.3 + targetAvgDepth * 0.15; // 深度越高，朝内比例越高
    if (mode === this.DIRECTION_MODES.PINCH) inwardRatio = Math.min(0.90, inwardRatio + 0.18);
    if (mode === this.DIRECTION_MODES.SPLIT) inwardRatio = Math.max(0.18, inwardRatio - 0.10);
    
    for (const { block, cx, cy } of midBlocks) {
      if (rand() < inwardRatio) {
        // 朝向中心（被阻挡）
        const inward = this.getOppositeDirection(
          this.pickOutwardDirectionForAxis(block, centerX, centerY)
        );
        this.setBlockDirection(block, inward, shortSide);
      } else {
        // 朝向边缘（可消除）
        const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
        this.setBlockDirection(block, outward, shortSide);
      }
    }

    // 6. 验证并微调
    this.adjustForTargetDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand);
  }
  
  static assignDirectionsByDepthMultiCore(blocks, params, screenWidth, screenHeight, globalCenterX, globalCenterY, coreCenters, shortSide, rand) {
    const { targetAvgDepth, targetMaxDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    const mode = params.directionMode || this.DIRECTION_MODES.PEEL;
    
    // 1) 计算到“最近核心”的距离，形成多核心的 core/mid/edge 分层
    const nearest = blocks.map(block => {
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      let best = null;
      let bestDist = Infinity;
      for (const c of coreCenters) {
        const dx = cx - c.x;
        const dy = cy - c.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      return { block, cx, cy, core: best, distToCore: bestDist };
    });
    
    nearest.sort((a, b) => a.distToCore - b.distToCore);
    
    const coreRatio = Math.min(0.52, 0.22 + targetAvgDepth * 0.14);
    let edgeRatio = Math.max(0.28, initialRemovableRatio + 0.04);
    if (mode === this.DIRECTION_MODES.PINCH) edgeRatio = Math.max(0.24, edgeRatio - 0.05);
    if (mode === this.DIRECTION_MODES.SPLIT) edgeRatio = Math.min(0.42, edgeRatio + 0.03);
    
    const coreCount = Math.floor(n * coreRatio);
    const edgeCount = Math.floor(n * edgeRatio);
    const midCount = Math.max(0, n - coreCount - edgeCount);
    
    // 2) edge：朝向全局边缘（提供开局可消点，且飞出方向更“像直觉”）
    for (let i = n - edgeCount; i < n; i++) {
      const { block } = nearest[i];
      const outward = this.pickOutwardDirectionForAxis(block, globalCenterX, globalCenterY);
      this.setBlockDirection(block, outward, shortSide);
    }
    
    // 3) core：按核心中心分组构建层
    const coreBlocks = nearest.slice(0, coreCount);
    const byCore = new Map();
    for (const item of coreBlocks) {
      const key = `${item.core.x},${item.core.y}`;
      if (!byCore.has(key)) byCore.set(key, { center: item.core, blocks: [] });
      byCore.get(key).blocks.push(item);
    }
    
    for (const [, group] of byCore) {
      // 按到该核心中心的距离排序
      group.blocks.sort((a, b) => a.distToCore - b.distToCore);
      this.buildBlockingLayers(
        group.blocks.map(x => x.block),
        targetMaxDepth,
        group.center.x,
        group.center.y,
        shortSide,
        rand,
        mode
      );
    }
    
    // 4) mid：混合策略（多核心下，inward 指向“最近核心”）
    const mid = nearest.slice(coreCount, coreCount + midCount);
    let inwardRatio = 0.32 + targetAvgDepth * 0.16;
    if (mode === this.DIRECTION_MODES.PINCH) inwardRatio = Math.min(0.92, inwardRatio + 0.20);
    if (mode === this.DIRECTION_MODES.SPLIT) inwardRatio = Math.max(0.16, inwardRatio - 0.10);
    
    for (const item of mid) {
      const block = item.block;
      if (rand() < inwardRatio) {
        const inward = this.getOppositeDirection(
          this.pickOutwardDirectionForAxis(block, item.core.x, item.core.y)
        );
        this.setBlockDirection(block, inward, shortSide);
      } else {
        const outward = this.pickOutwardDirectionForAxis(block, globalCenterX, globalCenterY);
        this.setBlockDirection(block, outward, shortSide);
      }
    }
    
    // 5) 轻度跨核心耦合：少量把 mid/edge 改为“指向另一个核心”，制造路线选择
    const crossRatio = Math.max(0, Math.min(0.5, Number(params.crossCoreBlockRatio) || 0));
    if (crossRatio > 0 && coreCenters.length >= 2) {
      const candidates = nearest.slice(coreCount, n - edgeCount);
      const adjustCount = Math.min(candidates.length, Math.floor(n * crossRatio));
      for (let i = 0; i < adjustCount; i++) {
        const pick = candidates[Math.floor(rand() * candidates.length)];
        const other = coreCenters[Math.floor(rand() * coreCenters.length)];
        if (other === pick.core) continue;
        const inwardToOther = this.getOppositeDirection(
          this.pickOutwardDirectionForAxis(pick.block, other.x, other.y)
        );
        this.setBlockDirection(pick.block, inwardToOther, shortSide);
      }
    }
    
    // 6) 微调深度目标（仍使用全局中心做“外围优先放松”）
    this.adjustForTargetDepth(blocks, params, screenWidth, screenHeight, globalCenterX, globalCenterY, shortSide, rand);
  }

  /**
   * 构建核心区的阻挡层
   * 策略：从最内层开始，逐层设置方向，形成"洋葱结构"
   */
  static buildBlockingLayers(coreBlocks, targetMaxDepth, centerX, centerY, shortSide, rand, mode = null) {
    if (coreBlocks.length === 0) return;

    // 按距离中心排序（已排序的核心区）
    const n = coreBlocks.length;
    const layerCount = Math.min(targetMaxDepth, Math.ceil(n / 3)); // 每层至少3个方块
    const blocksPerLayer = Math.ceil(n / layerCount);

    for (let layer = 0; layer < layerCount; layer++) {
      const start = layer * blocksPerLayer;
      const end = Math.min(start + blocksPerLayer, n);
      
      for (let i = start; i < end; i++) {
        const block = coreBlocks[i];
        
        if (layer === layerCount - 1) {
          // 最外层核心：50%朝外，50%朝内
          const outwardChance = mode === this.DIRECTION_MODES.PINCH ? 0.35 : mode === this.DIRECTION_MODES.SPLIT ? 0.60 : 0.50;
          if (rand() < outwardChance) {
            const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
            this.setBlockDirection(block, outward, shortSide);
          } else {
            const inward = this.getOppositeDirection(
              this.pickOutwardDirectionForAxis(block, centerX, centerY)
            );
            this.setBlockDirection(block, inward, shortSide);
          }
        } else {
          // 内层：大部分朝内（被阻挡），少部分随机
          const inwardChance = mode === this.DIRECTION_MODES.PINCH ? 0.88 : mode === this.DIRECTION_MODES.SPLIT ? 0.68 : 0.75;
          if (rand() < inwardChance) {
            const inward = this.getOppositeDirection(
              this.pickOutwardDirectionForAxis(block, centerX, centerY)
            );
            this.setBlockDirection(block, inward, shortSide);
          } else {
            // 随机方向增加变化
            const dirs = this.getAxisDirections(block);
            const dir = dirs[Math.floor(rand() * dirs.length)];
            this.setBlockDirection(block, dir, shortSide);
          }
        }
      }
    }
  }

  /**
   * 调整方向以接近目标深度分布
   */
  static adjustForTargetDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const { targetAvgDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    
    // 计算当前深度分布
    let depthInfo = this.calculateBlockDepths(blocks, screenWidth, screenHeight);
    
    // 目标可消除数量
    const targetRemovable = Math.floor(n * initialRemovableRatio);
    
    // 迭代调整（最多5轮）
    for (let round = 0; round < 5; round++) {
      // 计算当前可消除数量
      let removableCount = depthInfo.depths.filter(d => d === 0).length;
      
      // 如果可消除数量不足，将一些方块改为朝外
      if (removableCount < targetRemovable) {
        const deficit = targetRemovable - removableCount;
        const blockedIndices = [];
        
        for (let i = 0; i < n; i++) {
          if (depthInfo.depths[i] > 0) {
            const block = blocks[i];
            const cx = block.x + block.width / 2;
            const cy = block.y + block.height / 2;
            const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
            blockedIndices.push({ idx: i, dist });
          }
        }
        
        // 优先调整外围的方块
        blockedIndices.sort((a, b) => b.dist - a.dist);
        const toAdjust = Math.min(deficit, blockedIndices.length);
        
        for (let i = 0; i < toAdjust; i++) {
          const block = blocks[blockedIndices[i].idx];
          const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
          this.setBlockDirection(block, outward, shortSide);
        }
      }
      
      // 如果平均深度太低，将一些边缘方块改为朝内
      else if (depthInfo.avgDepth < targetAvgDepth * 0.8) {
        const removableIndices = [];
        
        for (let i = 0; i < n; i++) {
          if (depthInfo.depths[i] === 0) {
            const block = blocks[i];
            const cx = block.x + block.width / 2;
            const cy = block.y + block.height / 2;
            const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
            removableIndices.push({ idx: i, dist });
          }
        }
        
        // 优先调整靠近中心的可消除方块
        removableIndices.sort((a, b) => a.dist - b.dist);
        const excess = removableCount - targetRemovable;
        const toAdjust = Math.min(Math.max(1, Math.floor(excess * 0.3)), removableIndices.length);
        
        for (let i = 0; i < toAdjust; i++) {
          const block = blocks[removableIndices[i].idx];
          const inward = this.getOppositeDirection(
            this.pickOutwardDirectionForAxis(block, centerX, centerY)
          );
          this.setBlockDirection(block, inward, shortSide);
        }
      }
      
      // 重新计算深度
      depthInfo = this.calculateBlockDepths(blocks, screenWidth, screenHeight);
      
      // 检查是否满足条件
      removableCount = depthInfo.depths.filter(d => d === 0).length;
      if (removableCount >= targetRemovable && depthInfo.avgDepth >= targetAvgDepth * 0.7) {
        break;
      }
    }

    console.log(`[LevelGenerator] 深度调整完成: 平均深度=${depthInfo.avgDepth.toFixed(2)}, 最大深度=${depthInfo.maxDepth}, 可消除=${depthInfo.depths.filter(d => d === 0).length}/${n}`);
  }
  
  static pickCoreCenters(params, centerX, centerY, safeBoardRect, seed, rand) {
    const count = Math.max(1, Math.min(3, Number(params.coreCount) || 1));
    if (count === 1) return [{ x: centerX, y: centerY }];
    
    const w = safeBoardRect && Number.isFinite(safeBoardRect.width) ? safeBoardRect.width : 0;
    const h = safeBoardRect && Number.isFinite(safeBoardRect.height) ? safeBoardRect.height : 0;
    const spread = Math.max(30, Math.min(w, h) * 0.22);
    const jitter = spread * 0.12;
    
    // 两种可复现的排布：对角/反对角（再加轻微抖动）
    const diag = rand() < 0.5;
    const centers = [];
    
    if (count >= 2) {
      const dx = diag ? spread : spread;
      const dy = diag ? spread : -spread;
      centers.push({ x: centerX - dx + (rand() - 0.5) * jitter, y: centerY - dy + (rand() - 0.5) * jitter });
      centers.push({ x: centerX + dx + (rand() - 0.5) * jitter, y: centerY + dy + (rand() - 0.5) * jitter });
    }
    
    if (count >= 3) {
      centers.push({ x: centerX + (rand() - 0.5) * spread * 0.7, y: centerY + (rand() - 0.5) * spread * 0.7 });
    }
    
    return centers;
  }
}

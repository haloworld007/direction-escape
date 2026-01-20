/**
 * 关卡生成 Worker
 * 在后台线程中执行关卡生成，避免阻塞主线程
 */

// ==================== 常量定义 ====================

const DIRECTIONS = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3
};

const BLOCK_SIZES = {
  LENGTH: 45,
  WIDTH: 18,
  MIN_CLICK_AREA: 24,
  SPACING: 2,
  CORNER_RADIUS: 9,
  GRID_CELL_SIZE: 48,
  GRID_SPACING: 4,
  SAFETY_MARGIN: 6,
  RENDER_MARGIN: 10,
  HITBOX_INSET: 4,
  COLLISION_SHRINK: 0.22,
  CAPSULE_ASPECT_RATIO: 45 / 18,
};

const LAYOUT = {
  TOP_BAR_HEIGHT: 60,
  BOTTOM_BAR_HEIGHT: 110,
  PROGRESS_BAR_HEIGHT: 12,
  SIDE_PADDING: 16,
  BOARD_SIDE_PADDING: 4,
  TOP_PADDING: 16,
  BOARD_TOP_OFFSET: 60,
  BOARD_BOTTOM_MARGIN: 10,
};

const MAIN_ANIMAL_TYPES = ['pig', 'sheep', 'dog', 'fox', 'panda'];

// ==================== 辅助函数 ====================

function getBoardRect(screenWidth, screenHeight) {
  const sidePadding = typeof LAYOUT.BOARD_SIDE_PADDING === 'number'
    ? LAYOUT.BOARD_SIDE_PADDING
    : LAYOUT.SIDE_PADDING;
  const x = sidePadding;
  const y = LAYOUT.TOP_BAR_HEIGHT + LAYOUT.BOARD_TOP_OFFSET;
  const width = screenWidth - sidePadding * 2;
  const bottomY = screenHeight - LAYOUT.BOTTOM_BAR_HEIGHT - LAYOUT.BOARD_BOTTOM_MARGIN;
  const height = Math.max(0, bottomY - y);
  return { x, y, width, height };
}

// ==================== 方向检测器 ====================

const DirectionDetector = {
  isBlocked(block, allBlocks, screenWidth, screenHeight, options = null) {
    const gridInfo = this.getGridBlockingSteps(block, allBlocks);
    if (gridInfo) {
      return gridInfo.hasBlock;
    }

    const inv = 1 / Math.sqrt(2);
    const directionVectors = {
      [DIRECTIONS.UP]: { x: inv, y: -inv },
      [DIRECTIONS.RIGHT]: { x: inv, y: inv },
      [DIRECTIONS.DOWN]: { x: -inv, y: inv },
      [DIRECTIONS.LEFT]: { x: -inv, y: -inv }
    };

    const vector = directionVectors[block.direction];
    if (!vector) return true;

    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;
    const offset = Math.max(block.width, block.height) / 2 + 2;
    const startX = centerX + vector.x * offset;
    const startY = centerY + vector.y * offset;
    const stepSize = 8;

    let currentX = startX;
    let currentY = startY;
    const maxSteps = 1000;
    let steps = 0;

    while (steps < maxSteps) {
      steps++;
      currentX += vector.x * stepSize;
      currentY += vector.y * stepSize;

      if (this.isOutOfBounds(currentX, currentY, screenWidth, screenHeight)) {
        return false;
      }

      for (let other of allBlocks) {
        if (other === block) continue;
        if (other.isRemoved) continue;
        if (other.visible === false) continue;

        const hitRect = this.getHitRect(other);
        if (this.pointInRect(currentX, currentY, hitRect)) {
          return true;
        }
      }
    }

    return true;
  },

  getGridBlockingSteps(block, allBlocks) {
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
  },

  getBlockAxis(block) {
    if (block.axis === 'row' || block.axis === 'col') return block.axis;
    if (block.direction === DIRECTIONS.UP || block.direction === DIRECTIONS.DOWN) return 'row';
    if (block.direction === DIRECTIONS.LEFT || block.direction === DIRECTIONS.RIGHT) return 'col';
    return null;
  },

  getBlockCells(block) {
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
  },

  getGridDirectionDelta(direction) {
    switch (direction) {
      case DIRECTIONS.UP: return { row: -1, col: 0 };
      case DIRECTIONS.DOWN: return { row: 1, col: 0 };
      case DIRECTIONS.LEFT: return { row: 0, col: -1 };
      case DIRECTIONS.RIGHT: return { row: 0, col: 1 };
      default: return null;
    }
  },

  isOutOfBounds(x, y, screenWidth, screenHeight) {
    return x < 0 || x > screenWidth || y < 0 || y > screenHeight;
  },

  pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  },

  getHitRect(block) {
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
};

// ==================== 关卡生成器 ====================

const LevelGenerator = {
  ANIMAL_TYPES: MAIN_ANIMAL_TYPES,
  
  HOLE_TEMPLATES: {
    SPARSE: 'sparse',
    RING: 'ring',
    DIAGONAL_BAND: 'diagonalBand',
    CENTER_HOLLOW: 'centerHollow',
    TWO_LUMPS: 'twoLumps'
  },
  
  DIRECTION_MODES: {
    PEEL: 'peel',
    SPLIT: 'split',
    PINCH: 'pinch'
  },

  getBlockDimensions(direction, shortSide) {
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
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
      width: bboxW,
      height: bboxH
    };
  },

  getDirectionAngle(direction) {
    switch (direction) {
      case DIRECTIONS.UP: return -Math.PI / 4;
      case DIRECTIONS.RIGHT: return Math.PI / 4;
      case DIRECTIONS.DOWN: return (3 * Math.PI) / 4;
      case DIRECTIONS.LEFT: return (-3 * Math.PI) / 4;
      default: return -Math.PI / 4;
    }
  },

  getSeed(levelNumber, attempt) {
    return (levelNumber + 1) * 10007 + attempt * 97;
  },

  generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);
    const seed = this.getSeed(levelNumber, 0);

    const blocks = this.generateRotatedGridDominoLayout(
      params,
      seed,
      screenWidth,
      screenHeight,
      boardRect
    );

    // 开发环境下检测对向死锁（用于验证算法正确性）
    const deadlocks = this.detectFacingDeadlocks(blocks);
    if (deadlocks.length > 0) {
      console.error('[LevelGenerator Worker] BUG: 产生了对向死锁', deadlocks);
    }

    return { blocks, total: blocks.length };
  },
  
  /**
   * 检测对向死锁（开发调试用）
   * 检查同一 lane 内是否有方向相反的方块
   */
  detectFacingDeadlocks(blocks) {
    const deadlocks = [];
    
    // 构建 lane 索引
    const rowLanes = new Map();
    const colLanes = new Map();
    
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
  },

  generateRotatedGridDominoLayout(params, seed, screenWidth, screenHeight, boardRect) {
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

    const { candidates, safeBoardRect, centerX, centerY } = layout;

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

    // 第一阶段：放置方块（临时方向）
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

      const tempDirection = DIRECTIONS.UP;
      const { width: bw, height: bh } = this.getBlockDimensions(tempDirection, shortSide);
      const blockX = blockCenterX - bw / 2;
      const blockY = blockCenterY - bh / 2;

      if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) continue;
      if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) continue;

      blocks.push({
        x: blockX, y: blockY, width: bw, height: bh,
        direction: tempDirection, axis, gridRow, gridCol, type: null, size: shortSide
      });

      used.add(cell.key);
      used.add(neighbor.key);
      placed++;
    }

    // 二次补充
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

        if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) continue;
        if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) continue;

        blocks.push({
          x: blockX, y: blockY, width: bw, height: bh,
          direction: tempDirection, axis, gridRow, gridCol, type: null, size: shortSide
        });

        used.add(cell.key);
        used.add(neighbor.key);
        placed++;
      }
    }

    // 第二阶段：使用 lane 同向原则分配方向（彻底杜绝对向死锁）
    this.assignDirectionsByLane(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand);

    // 第三阶段：分配动物类型
    const usedAnimalTypes = this.ANIMAL_TYPES.slice(0, animalTypes);
    const shuffledBlocks = [...blocks];
    this.shuffleArray(shuffledBlocks, rand);
    shuffledBlocks.forEach((block, i) => {
      block.type = usedAnimalTypes[i % usedAnimalTypes.length];
    });

    // 第四阶段：验证可解性
    const solvable = this.ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed, params);
    blocks._solvable = solvable;

    return blocks;
  },

  createSeededRandom(seed) {
    let t = (seed >>> 0) + 0x6D2B79F5;
    return function() {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  },

  shuffleArray(arr, rand = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  computeDominoGridLayout(shortSide, holeRate, boardRect) {
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

          if (x < safeBoardRect.x || x > safeBoardRect.x + safeBoardRect.width ||
              y < safeBoardRect.y || y > safeBoardRect.y + safeBoardRect.height) {
            continue;
          }

          const dist = Math.abs(row) + Math.abs(col);
          const key = `${row},${col}`;
          candidates.push({ x, y, row, col, dist, key });
        }
      }
    }

    const maxBlocks = Math.floor((candidates.length * (1 - holeRate)) / 2);

    return { candidates, maxBlocks, cellGap, cellStep, step, safeBoardRect, centerX, centerY };
  },

  getSafeBoardRect(boardRect, halfW, halfH) {
    const renderMargin = BLOCK_SIZES.RENDER_MARGIN || 0;
    const safeMarginX = BLOCK_SIZES.SAFETY_MARGIN + halfW + renderMargin;
    const safeMarginY = BLOCK_SIZES.SAFETY_MARGIN + halfH + renderMargin;
    return {
      x: boardRect.x + safeMarginX,
      y: boardRect.y + safeMarginY,
      width: Math.max(0, boardRect.width - safeMarginX * 2),
      height: Math.max(0, boardRect.height - safeMarginY * 2)
    };
  },

  orderCandidatesCenterOut(candidates, rand) {
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
  },

  pickHoleRate(params, rand) {
    const range = params.holeRateRange || [0.12, 0.2];
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    const rate = min + (max - min) * rand();
    return Math.max(0.05, Math.min(0.5, rate));
  },

  selectSparseHoles(candidates, holeCount, rand) {
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
  },
  
  resolveHoleTemplate(params, seed, rand) {
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
  },
  
  selectHolesByTemplate(candidates, holeCount, template, rand, centerX, centerY) {
    if (holeCount <= 0) return new Set();
    if (!template || template === this.HOLE_TEMPLATES.SPARSE) {
      return this.selectSparseHoles(candidates, holeCount, rand);
    }
    
    const scored = candidates.map(cell => {
      let score = 0;
      const d = cell.dist;
      
      if (template === this.HOLE_TEMPLATES.CENTER_HOLLOW) {
        score = -d;
      } else if (template === this.HOLE_TEMPLATES.RING) {
        const r0 = Math.max(2, Math.floor(Math.sqrt(candidates.length) * 0.22));
        const r1 = Math.max(r0 + 1, Math.floor(Math.sqrt(candidates.length) * 0.32));
        const inRing = d >= r0 && d <= r1;
        score = inRing ? 100 - d : -Math.abs(d - r0);
      } else if (template === this.HOLE_TEMPLATES.DIAGONAL_BAND) {
        const band = Math.max(1, Math.floor(Math.sqrt(candidates.length) * 0.10));
        const v = Math.abs(cell.row - cell.col);
        score = -Math.abs(v - band) - d * 0.05;
      } else if (template === this.HOLE_TEMPLATES.TWO_LUMPS) {
        const v1 = Math.abs(cell.row + cell.col);
        const v2 = Math.abs(cell.row - cell.col);
        const stripe = Math.min(v1, v2);
        score = -(stripe) - d * 0.03;
      } else {
        score = -d;
      }
      
      score += (rand() - 0.5) * 0.25;
      return { cell, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map(s => s.cell);
    
    const holes = new Set();
    const blocked = new Set();
    for (const cell of ordered) {
      if (holes.size >= holeCount) break;
      if (blocked.has(cell.key)) continue;
      holes.add(cell.key);
      this.getNeighborKeys(cell).forEach(k => blocked.add(k));
    }
    
    if (holes.size < holeCount) {
      for (const cell of ordered) {
        if (holes.size >= holeCount) break;
        if (holes.has(cell.key)) continue;
        holes.add(cell.key);
      }
    }
    
    return holes;
  },

  getNeighborKeys(cell) {
    return [
      `${cell.row - 1},${cell.col}`,
      `${cell.row + 1},${cell.col}`,
      `${cell.row},${cell.col - 1}`,
      `${cell.row},${cell.col + 1}`
    ];
  },

  getAvailableNeighbors(cell, cellMap, used) {
    const neighbors = [];
    const keys = this.getNeighborKeys(cell);
    for (const key of keys) {
      if (used.has(key)) continue;
      const neighbor = cellMap.get(key);
      if (neighbor) neighbors.push(neighbor);
    }
    return neighbors;
  },

  pickDirectionForPair(cell, neighbor, blockCenterX, blockCenterY, centerX, centerY, rand, outwardBias = 0.88) {
    const dx = blockCenterX - centerX;
    const dy = blockCenterY - centerY;
    let preferred;

    if (neighbor.col !== cell.col) {
      const score = dx + dy;
      preferred = score >= 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    } else {
      const score = dx - dy;
      preferred = score >= 0 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
    }

    if (rand() >= outwardBias) return this.getOppositeDirection(preferred);
    return preferred;
  },

  getAxisDirections(block) {
    if (block.axis === 'row') return [DIRECTIONS.UP, DIRECTIONS.DOWN];
    if (block.axis === 'col') return [DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
    return [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
  },

  pickOutwardDirectionForAxis(block, centerX, centerY) {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const dx = cx - centerX;
    const dy = cy - centerY;

    if (block.axis === 'col') return (dx + dy) >= 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    if (block.axis === 'row') return (dx - dy) >= 0 ? DIRECTIONS.UP : DIRECTIONS.DOWN;

    if (dx >= 0 && dy <= 0) return DIRECTIONS.UP;
    if (dx >= 0 && dy >= 0) return DIRECTIONS.RIGHT;
    if (dx <= 0 && dy >= 0) return DIRECTIONS.DOWN;
    return DIRECTIONS.LEFT;
  },

  setBlockDirection(block, direction, shortSide) {
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    block.direction = direction;
    block.width = bw;
    block.height = bh;
    block.x = cx - bw / 2;
    block.y = cy - bh / 2;
  },

  /**
   * 基于 lane 同向原则分配方向（核心修复：彻底杜绝对向死锁）
   */
  assignDirectionsByLane(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const n = blocks.length;
    if (n === 0) return;
    
    // 1. 构建 lane 索引
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
    
    // 2. 对每个 row-lane 分配方向（同一 lane 内所有方块同向）
    for (const [col, laneBlocks] of rowLanes) {
      laneBlocks.sort((a, b) => a.gridRow - b.gridRow);
      const direction = this.pickLaneExitDirection(laneBlocks, 'row', centerX, centerY, rand, params);
      for (const block of laneBlocks) {
        this.setBlockDirection(block, direction, shortSide);
      }
    }
    
    // 3. 对每个 col-lane 分配方向（同一 lane 内所有方块同向）
    for (const [row, laneBlocks] of colLanes) {
      laneBlocks.sort((a, b) => a.gridCol - b.gridCol);
      const direction = this.pickLaneExitDirection(laneBlocks, 'col', centerX, centerY, rand, params);
      for (const block of laneBlocks) {
        this.setBlockDirection(block, direction, shortSide);
      }
    }
    
    // 4. 验证并微调以满足初始可消除比例
    this.adjustForRemovableRatio(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand);
  },
  
  /**
   * 选择 lane 的出口方向
   */
  pickLaneExitDirection(laneBlocks, axis, centerX, centerY, rand, params = {}) {
    if (laneBlocks.length === 0) return DIRECTIONS.UP;
    
    const firstBlock = laneBlocks[0];
    const lastBlock = laneBlocks[laneBlocks.length - 1];
    const laneCenterX = (firstBlock.x + firstBlock.width / 2 + lastBlock.x + lastBlock.width / 2) / 2;
    const laneCenterY = (firstBlock.y + firstBlock.height / 2 + lastBlock.y + lastBlock.height / 2) / 2;
    
    const laneExitBias = params.laneExitBias !== undefined ? params.laneExitBias : 0.7;
    
    if (axis === 'row') {
      const outwardDir = laneCenterY < centerY ? DIRECTIONS.UP : DIRECTIONS.DOWN;
      const inwardDir = laneCenterY < centerY ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      return rand() < laneExitBias ? outwardDir : inwardDir;
    } else {
      const outwardDir = laneCenterX < centerX ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
      const inwardDir = laneCenterX < centerX ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      return rand() < laneExitBias ? outwardDir : inwardDir;
    }
  },
  
  /**
   * 调整方向以满足初始可消除比例
   */
  adjustForRemovableRatio(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const n = blocks.length;
    if (n === 0) return;
    
    const targetRemovableRatio = params.initialRemovableRatio || 0.25;
    const targetRemovable = Math.max(6, Math.floor(n * targetRemovableRatio));
    
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
    
    if (removableCount < targetRemovable) {
      const lanesToFlip = [];
      
      for (const [col, laneBlocks] of rowLanes) {
        const cx = (laneBlocks[0].x + laneBlocks[0].width / 2);
        const cy = laneBlocks.reduce((sum, b) => sum + b.y + b.height / 2, 0) / laneBlocks.length;
        const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
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
      
      lanesToFlip.sort((a, b) => b.dist - a.dist);
      
      for (const lane of lanesToFlip) {
        if (removableCount >= targetRemovable) break;
        
        const newDir = this.getOppositeDirection(lane.blocks[0].direction);
        for (const block of lane.blocks) {
          this.setBlockDirection(block, newDir, shortSide);
        }
        
        removableCount = countRemovable();
      }
    }
  },

  wouldBeBlockedWithDirection(block, direction, shortSide, blocks, screenWidth, screenHeight) {
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const temp = {
      ...block,
      direction, width: bw, height: bh,
      x: cx - bw / 2, y: cy - bh / 2,
      isRemoved: false, visible: true
    };
    const tempBlocks = blocks.map(b => (b === block ? temp : b));
    return DirectionDetector.isBlocked(temp, tempBlocks, screenWidth, screenHeight, { debug: false });
  },

  pickUnblockedDirection(block, blocks, screenWidth, screenHeight, centerX, centerY, shortSide) {
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
  },

  getOppositeDirection(direction) {
    switch (direction) {
      case DIRECTIONS.UP: return DIRECTIONS.DOWN;
      case DIRECTIONS.DOWN: return DIRECTIONS.UP;
      case DIRECTIONS.LEFT: return DIRECTIONS.RIGHT;
      case DIRECTIONS.RIGHT: return DIRECTIONS.LEFT;
      default: return DIRECTIONS.UP;
    }
  },

  isBlockInsideSafeRect(x, y, width, height, safeRect) {
    return x >= safeRect.x && x + width <= safeRect.x + safeRect.width &&
           y >= safeRect.y && y + height <= safeRect.y + safeRect.height;
  },

  wouldOverlap(x, y, width, height, blocks, margin = 1) {
    for (const b of blocks) {
      if (x + margin < b.x + b.width - margin &&
          x + width - margin > b.x + margin &&
          y + margin < b.y + b.height - margin &&
          y + height - margin > b.y + margin) {
        return true;
      }
    }
    return false;
  },

  ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, initialRemovableRatio = 0.20) {
    const minRemovable = Math.max(6, Math.floor(blocks.length * initialRemovableRatio));

    for (let fix = 0; fix < 5; fix++) {
      let removableCount = 0;
      blocks.forEach(block => {
        if (!DirectionDetector.isBlocked(block, blocks, screenWidth, screenHeight, { debug: false })) {
          removableCount++;
        }
      });

      if (removableCount >= minRemovable) return;

      const adjusted = this.relaxBlockedDirections(
        blocks, screenWidth, screenHeight, centerX, centerY, shortSide,
        Math.ceil(blocks.length * 0.25)
      );

      if (!adjusted) break;
    }
  },

  relaxBlockedDirections(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, limit) {
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
        block, blocks, screenWidth, screenHeight, centerX, centerY, shortSide
      );
      if (nextDirection !== block.direction) {
        this.setBlockDirection(block, nextDirection, shortSide);
        changed = true;
      }
    }

    return changed;
  },

  ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed, params = null) {
    const baseSeed = typeof seed === 'number' ? seed : 0;
    const maxFixRounds = 4;
    const attempts = params && Number.isFinite(params.solvabilityAttempts) ? params.solvabilityAttempts : 6;

    for (let round = 0; round < maxFixRounds; round++) {
      if (this.hasSolvablePath(blocks, screenWidth, screenHeight, baseSeed + round * 131, attempts)) {
        return true;
      }
      const adjusted = this.relaxBlockedDirections(
        blocks, screenWidth, screenHeight, centerX, centerY, shortSide,
        Math.ceil(blocks.length * 0.2)
      );
      if (!adjusted) break;
    }

    return this.hasSolvablePath(blocks, screenWidth, screenHeight, baseSeed + 777, attempts + 2);
  },

  hasSolvablePath(blocks, screenWidth, screenHeight, seed, attempts = 6) {
    const total = blocks.length;
    if (total === 0) return true;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const rand = this.createSeededRandom(seed + attempt * 97 + 11);
      const working = blocks.map(block => ({
        ...block, isRemoved: false, visible: true
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
  },

  validateLevel(blocks, screenWidth, screenHeight, seed, params = null) {
    if (this.hasOverlap(blocks)) return false;

    const normalized = blocks.map(b => ({
      ...b, isRemoved: false, visible: true
    }));

    let removableCount = 0;
    for (const block of normalized) {
      if (!DirectionDetector.isBlocked(block, normalized, screenWidth, screenHeight, { debug: false })) {
        removableCount++;
      }
    }

    const minRequired = Math.max(6, Math.floor(blocks.length * 0.15));
    if (removableCount < minRequired) return false;

    const knownSolvable = blocks._solvable;
    if (knownSolvable === false) return false;
    if (knownSolvable === true) return true;

    const baseSeed = typeof seed === 'number' ? seed : 0;
    const solvabilityAttempts = params && Number.isFinite(params.solvabilityAttempts) ? params.solvabilityAttempts : 6;
    const solvable = this.hasSolvablePath(normalized, screenWidth, screenHeight, baseSeed, solvabilityAttempts);
    if (!solvable) return false;
    
    const range = params && params.deadlockProbRange;
    if (range && Array.isArray(range) && range.length === 2) {
      const runs = params && Number.isFinite(params.deadlockEstimateRuns) ? params.deadlockEstimateRuns : 12;
      const estimate = this.estimateDeadlockProbability(normalized, screenWidth, screenHeight, baseSeed + 991, runs);
      const min = Math.min(range[0], range[1]);
      const max = Math.max(range[0], range[1]);
      if (!(estimate >= min && estimate <= max)) return false;
    }
    
    return true;
  },
  
  estimateDeadlockProbability(blocks, screenWidth, screenHeight, seed, runs = 12) {
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
  },

  hasOverlap(blocks) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
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
  },

  /**
   * 获取难度参数（简化版，基于 lane 同向原则）
   */
  getDifficultyParams(level) {
    const BLOCK_SIZE = 16;
    const lerp = (a, b, t) => a + (b - a) * t;
    
    // 简化后的阶段定义
    const phases = [
      {
        maxLevel: 2,
        name: '教程期',
        blockCount: [92, 120],
        removableRatio: [0.36, 0.44],
        laneExitBias: [0.90, 0.85],
        animalTypes: 3,
        holeTemplates: [this.HOLE_TEMPLATES.CENTER_HOLLOW, this.HOLE_TEMPLATES.SPARSE]
      },
      {
        maxLevel: 8,
        name: '上手挑战期',
        blockCount: [125, 155],
        removableRatio: [0.28, 0.24],
        laneExitBias: [0.80, 0.65],
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

    let phase = phases[0];
    let phaseStartLevel = 1;
    for (let i = 0; i < phases.length; i++) {
      if (level <= phases[i].maxLevel) {
        phase = phases[i];
        phaseStartLevel = i === 0 ? 1 : phases[i - 1].maxLevel + 1;
        break;
      }
    }

    const phaseLength = phase.maxLevel === Infinity ? 40 : phase.maxLevel - phaseStartLevel + 1;
    const levelInPhase = level - phaseStartLevel;
    const phaseProgress = Math.min(1, levelInPhase / phaseLength);

    const cycleLength = 5;
    const cyclePosition = (level - 1) % cycleLength;
    const isReliefLevel = cyclePosition === cycleLength - 1;
    const sawtoothFactor = isReliefLevel ? -0.15 : cyclePosition * 0.04;

    const baseBlockCount = lerp(phase.blockCount[0], phase.blockCount[1], phaseProgress);
    const blockCount = Math.round(Math.max(80, Math.min(220, baseBlockCount + baseBlockCount * sawtoothFactor)));

    const baseRemovableRatio = lerp(phase.removableRatio[0], phase.removableRatio[1], phaseProgress);
    const removableAdjust = isReliefLevel ? 0.06 : -cyclePosition * 0.01;
    const initialRemovableRatio = Math.max(0.10, Math.min(0.45, baseRemovableRatio + removableAdjust));

    const baseLaneExitBias = lerp(phase.laneExitBias[0], phase.laneExitBias[1], phaseProgress);
    const biasAdjust = isReliefLevel ? 0.10 : -cyclePosition * 0.02;
    const laneExitBias = Math.max(0.15, Math.min(0.95, baseLaneExitBias + biasAdjust));

    const holeRateBase = blockCount > 170 ? 0.05 : blockCount > 140 ? 0.07 : 0.09;
    const holeRateRange = [holeRateBase, holeRateBase + 0.03];

    const holeTemplates = phase.holeTemplates || [this.HOLE_TEMPLATES.SPARSE];
    const holeTemplate = holeTemplates[level % holeTemplates.length];

    return {
      blockCount,
      blockSize: BLOCK_SIZE,
      holeRateRange,
      initialRemovableRatio,
      laneExitBias,
      animalTypes: phase.animalTypes,
      isReliefLevel,
      phaseName: phase.name,
      holeTemplate,
      holeTemplates
    };
  },

  // ==================== 阻挡深度系统 ====================

  calculateBlockDepths(blocks, screenWidth, screenHeight) {
    const n = blocks.length;
    if (n === 0) return { depths: [], avgDepth: 0, maxDepth: 0 };

    const depths = new Array(n).fill(-1);
    const working = blocks.map(b => ({ ...b, isRemoved: false, visible: true }));

    let currentDepth = 0;
    let remaining = n;
    
    while (remaining > 0) {
      const removableIndices = [];
      
      for (let i = 0; i < n; i++) {
        if (depths[i] !== -1) continue;
        if (working[i].isRemoved) continue;
        
        if (!DirectionDetector.isBlocked(working[i], working, screenWidth, screenHeight, { debug: false })) {
          removableIndices.push(i);
        }
      }

      if (removableIndices.length === 0) {
        for (let i = 0; i < n; i++) {
          if (depths[i] === -1) depths[i] = currentDepth + 1;
        }
        break;
      }

      for (const idx of removableIndices) {
        depths[idx] = currentDepth;
        working[idx].isRemoved = true;
        remaining--;
      }

      currentDepth++;
    }

    const validDepths = depths.filter(d => d >= 0);
    const avgDepth = validDepths.length > 0 ? validDepths.reduce((a, b) => a + b, 0) / validDepths.length : 0;
    const maxDepth = Math.max(...validDepths, 0);

    return { depths, avgDepth, maxDepth };
  },

  assignDirectionsByDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand, coreCenters = null) {
    const { targetAvgDepth, targetMaxDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    if (n === 0) return;
    
    const mode = params.directionMode || this.DIRECTION_MODES.PEEL;
    const centers = Array.isArray(coreCenters) && coreCenters.length ? coreCenters : [{ x: centerX, y: centerY }];
    if (centers.length > 1) {
      this.assignDirectionsByDepthMultiCore(blocks, params, screenWidth, screenHeight, centerX, centerY, centers, shortSide, rand);
      return;
    }

    const sorted = blocks.map((block, idx) => {
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
      return { block, idx, dist, cx, cy };
    }).sort((a, b) => a.dist - b.dist);

    const coreRatio = Math.min(0.5, 0.25 + targetAvgDepth * 0.12);
    let edgeRatio = Math.max(0.3, initialRemovableRatio + 0.05);
    if (mode === this.DIRECTION_MODES.PINCH) edgeRatio = Math.max(0.26, edgeRatio - 0.04);
    if (mode === this.DIRECTION_MODES.SPLIT) edgeRatio = Math.min(0.42, edgeRatio + 0.03);
    
    const coreCount = Math.floor(n * coreRatio);
    const edgeCount = Math.floor(n * edgeRatio);
    const midCount = n - coreCount - edgeCount;

    for (let i = n - edgeCount; i < n; i++) {
      const { block } = sorted[i];
      const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
      this.setBlockDirection(block, outward, shortSide);
    }

    this.buildBlockingLayers(
      sorted.slice(0, coreCount).map(s => s.block),
      targetMaxDepth, centerX, centerY, shortSide, rand, mode
    );

    const midBlocks = sorted.slice(coreCount, coreCount + midCount);
    let inwardRatio = 0.3 + targetAvgDepth * 0.15;
    if (mode === this.DIRECTION_MODES.PINCH) inwardRatio = Math.min(0.90, inwardRatio + 0.18);
    if (mode === this.DIRECTION_MODES.SPLIT) inwardRatio = Math.max(0.18, inwardRatio - 0.10);
    
    for (const { block } of midBlocks) {
      if (rand() < inwardRatio) {
        const inward = this.getOppositeDirection(this.pickOutwardDirectionForAxis(block, centerX, centerY));
        this.setBlockDirection(block, inward, shortSide);
      } else {
        const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
        this.setBlockDirection(block, outward, shortSide);
      }
    }

    this.adjustForTargetDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand);
  },
  
  assignDirectionsByDepthMultiCore(blocks, params, screenWidth, screenHeight, globalCenterX, globalCenterY, coreCenters, shortSide, rand) {
    const { targetAvgDepth, targetMaxDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    const mode = params.directionMode || this.DIRECTION_MODES.PEEL;
    
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
    
    for (let i = n - edgeCount; i < n; i++) {
      const { block } = nearest[i];
      const outward = this.pickOutwardDirectionForAxis(block, globalCenterX, globalCenterY);
      this.setBlockDirection(block, outward, shortSide);
    }
    
    const coreBlocks = nearest.slice(0, coreCount);
    const byCore = new Map();
    for (const item of coreBlocks) {
      const key = `${item.core.x},${item.core.y}`;
      if (!byCore.has(key)) byCore.set(key, { center: item.core, blocks: [] });
      byCore.get(key).blocks.push(item);
    }
    
    for (const [, group] of byCore) {
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
    
    const mid = nearest.slice(coreCount, coreCount + midCount);
    let inwardRatio = 0.32 + targetAvgDepth * 0.16;
    if (mode === this.DIRECTION_MODES.PINCH) inwardRatio = Math.min(0.92, inwardRatio + 0.20);
    if (mode === this.DIRECTION_MODES.SPLIT) inwardRatio = Math.max(0.16, inwardRatio - 0.10);
    
    for (const item of mid) {
      const block = item.block;
      if (rand() < inwardRatio) {
        const inward = this.getOppositeDirection(this.pickOutwardDirectionForAxis(block, item.core.x, item.core.y));
        this.setBlockDirection(block, inward, shortSide);
      } else {
        const outward = this.pickOutwardDirectionForAxis(block, globalCenterX, globalCenterY);
        this.setBlockDirection(block, outward, shortSide);
      }
    }
    
    const crossRatio = Math.max(0, Math.min(0.5, Number(params.crossCoreBlockRatio) || 0));
    if (crossRatio > 0 && coreCenters.length >= 2) {
      const candidates = nearest.slice(coreCount, n - edgeCount);
      const adjustCount = Math.min(candidates.length, Math.floor(n * crossRatio));
      for (let i = 0; i < adjustCount; i++) {
        const pick = candidates[Math.floor(rand() * candidates.length)];
        const other = coreCenters[Math.floor(rand() * coreCenters.length)];
        if (other === pick.core) continue;
        const inwardToOther = this.getOppositeDirection(this.pickOutwardDirectionForAxis(pick.block, other.x, other.y));
        this.setBlockDirection(pick.block, inwardToOther, shortSide);
      }
    }
    
    this.adjustForTargetDepth(blocks, params, screenWidth, screenHeight, globalCenterX, globalCenterY, shortSide, rand);
  },

  buildBlockingLayers(coreBlocks, targetMaxDepth, centerX, centerY, shortSide, rand, mode = null) {
    if (coreBlocks.length === 0) return;

    const n = coreBlocks.length;
    const layerCount = Math.min(targetMaxDepth, Math.ceil(n / 3));
    const blocksPerLayer = Math.ceil(n / layerCount);

    for (let layer = 0; layer < layerCount; layer++) {
      const start = layer * blocksPerLayer;
      const end = Math.min(start + blocksPerLayer, n);
      
      for (let i = start; i < end; i++) {
        const block = coreBlocks[i];
        
        if (layer === layerCount - 1) {
          const outwardChance = mode === this.DIRECTION_MODES.PINCH ? 0.35 : mode === this.DIRECTION_MODES.SPLIT ? 0.60 : 0.50;
          if (rand() < outwardChance) {
            const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
            this.setBlockDirection(block, outward, shortSide);
          } else {
            const inward = this.getOppositeDirection(this.pickOutwardDirectionForAxis(block, centerX, centerY));
            this.setBlockDirection(block, inward, shortSide);
          }
        } else {
          const inwardChance = mode === this.DIRECTION_MODES.PINCH ? 0.88 : mode === this.DIRECTION_MODES.SPLIT ? 0.68 : 0.75;
          if (rand() < inwardChance) {
            const inward = this.getOppositeDirection(this.pickOutwardDirectionForAxis(block, centerX, centerY));
            this.setBlockDirection(block, inward, shortSide);
          } else {
            const dirs = this.getAxisDirections(block);
            const dir = dirs[Math.floor(rand() * dirs.length)];
            this.setBlockDirection(block, dir, shortSide);
          }
        }
      }
    }
  },

  adjustForTargetDepth(blocks, params, screenWidth, screenHeight, centerX, centerY, shortSide, rand) {
    const { targetAvgDepth, initialRemovableRatio } = params;
    const n = blocks.length;
    
    let depthInfo = this.calculateBlockDepths(blocks, screenWidth, screenHeight);
    const targetRemovable = Math.floor(n * initialRemovableRatio);
    
    for (let round = 0; round < 5; round++) {
      let removableCount = depthInfo.depths.filter(d => d === 0).length;
      
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
        
        blockedIndices.sort((a, b) => b.dist - a.dist);
        const toAdjust = Math.min(deficit, blockedIndices.length);
        
        for (let i = 0; i < toAdjust; i++) {
          const block = blocks[blockedIndices[i].idx];
          const outward = this.pickOutwardDirectionForAxis(block, centerX, centerY);
          this.setBlockDirection(block, outward, shortSide);
        }
      } else if (depthInfo.avgDepth < targetAvgDepth * 0.8) {
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
        
        removableIndices.sort((a, b) => a.dist - b.dist);
        const excess = removableCount - targetRemovable;
        const toAdjust = Math.min(Math.max(1, Math.floor(excess * 0.3)), removableIndices.length);
        
        for (let i = 0; i < toAdjust; i++) {
          const block = blocks[removableIndices[i].idx];
          const inward = this.getOppositeDirection(this.pickOutwardDirectionForAxis(block, centerX, centerY));
          this.setBlockDirection(block, inward, shortSide);
        }
      }
      
      depthInfo = this.calculateBlockDepths(blocks, screenWidth, screenHeight);
      removableCount = depthInfo.depths.filter(d => d === 0).length;
      if (removableCount >= targetRemovable && depthInfo.avgDepth >= targetAvgDepth * 0.7) break;
    }
  }
  ,
  pickCoreCenters(params, centerX, centerY, safeBoardRect, seed, rand) {
    const count = Math.max(1, Math.min(3, Number(params.coreCount) || 1));
    if (count === 1) return [{ x: centerX, y: centerY }];
    
    const w = safeBoardRect && Number.isFinite(safeBoardRect.width) ? safeBoardRect.width : 0;
    const h = safeBoardRect && Number.isFinite(safeBoardRect.height) ? safeBoardRect.height : 0;
    const spread = Math.max(30, Math.min(w, h) * 0.22);
    const jitter = spread * 0.12;
    
    const diag = rand() < 0.5;
    const centers = [];
    if (count >= 2) {
      const dx = spread;
      const dy = diag ? spread : -spread;
      centers.push({ x: centerX - dx + (rand() - 0.5) * jitter, y: centerY - dy + (rand() - 0.5) * jitter });
      centers.push({ x: centerX + dx + (rand() - 0.5) * jitter, y: centerY + dy + (rand() - 0.5) * jitter });
    }
    if (count >= 3) {
      centers.push({ x: centerX + (rand() - 0.5) * spread * 0.7, y: centerY + (rand() - 0.5) * spread * 0.7 });
    }
    return centers;
  }
};

// ==================== Worker 消息处理 ====================

worker.onMessage(function(msg) {
  if (msg.type === 'generate') {
    const { levelNumber, screenWidth, screenHeight, requestId } = msg;
    
    try {
      const startTime = Date.now();
      const levelData = LevelGenerator.generate(levelNumber, screenWidth, screenHeight);
      const duration = Date.now() - startTime;
      
      worker.postMessage({
        type: 'levelReady',
        requestId,
        levelNumber,
        levelData,
        duration
      });
    } catch (error) {
      worker.postMessage({
        type: 'error',
        requestId,
        levelNumber,
        error: error.message || 'Unknown error'
      });
    }
  }
});

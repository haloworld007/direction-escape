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

// ==================== 逆向填空生成器 ====================

const ReverseLevelGenerator = {
  ANIMAL_TYPES: MAIN_ANIMAL_TYPES,

  generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);
    const seed = this.getSeed(levelNumber, 0);

    console.log(`[ReverseLevelGenerator Worker] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}, 阶段: ${params.phaseName}`);

    const blocks = this.generateByReverseFilling(params, seed, screenWidth, screenHeight, boardRect);

    console.log(`[ReverseLevelGenerator Worker] 关卡 ${levelNumber} 生成完成，方块数: ${blocks.length}`);
    return { blocks, total: blocks.length };
  },

  getSeed(levelNumber, attempt) {
    // 基础种子 + 时间戳的低位，确保同一关卡每次生成不同
    const timePart = Date.now() % 100000;
    return (levelNumber + 1) * 10007 + attempt * 97 + timePart;
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

  generateByReverseFilling(params, seed, screenWidth, screenHeight, boardRect) {
    const { blockCount, blockSize, depthFactor, animalTypes = 5 } = params;
    const rand = this.createSeededRandom(seed);

    const shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const grid = this.initializeGrid(shortSide, boardRect);
    
    if (grid.maxPossibleBlocks < 2) {
      console.warn('[ReverseLevelGenerator Worker] 棋盘太小，无法生成方块');
      return [];
    }

    const targetCount = Math.min(blockCount, grid.maxPossibleBlocks);
    const blocks = [];
    const generationOrder = [];

    let attempts = 0;
    const maxAttempts = targetCount * 20;

    while (blocks.length < targetCount && attempts < maxAttempts) {
      attempts++;

      const insertionResult = this.tryInsertBlock(grid, blocks, rand, depthFactor, shortSide, screenWidth, screenHeight);

      if (insertionResult) {
        blocks.push(insertionResult.block);
        generationOrder.push(insertionResult.block);
        grid.occupyBlock(insertionResult.block);
      }
    }

    // 填充率检查和补充填充
    const minFillRate = blockCount > 50 ? 0.55 : 0.3;
    const filledCells = blocks.length * 2;
    const totalCells = grid.cells.size;
    const currentFillRate = totalCells > 0 ? filledCells / totalCells : 0;
    
    if (currentFillRate < minFillRate && blocks.length < grid.maxPossibleBlocks) {
      console.log(`[ReverseLevelGenerator Worker] 填充率不足 (${(currentFillRate * 100).toFixed(1)}%)，尝试补充填充...`);
      
      const additionalAttempts = Math.min(50, (grid.maxPossibleBlocks - blocks.length) * 10);
      let additionalInserted = 0;
      
      for (let i = 0; i < additionalAttempts && blocks.length < grid.maxPossibleBlocks; i++) {
        const insertionResult = this.tryInsertBlock(
          grid, blocks, rand, 1.0, shortSide, screenWidth, screenHeight
        );

        if (insertionResult) {
          blocks.push(insertionResult.block);
          generationOrder.push(insertionResult.block);
          grid.occupyBlock(insertionResult.block);
          additionalInserted++;
        }
      }
      
      if (additionalInserted > 0) {
        console.log(`[ReverseLevelGenerator Worker] 补充填充了 ${additionalInserted} 个方块`);
      }
    }

    this.assignAnimalTypes(blocks, generationOrder, animalTypes, rand);
    blocks._solvable = true;
    
    // 记录填充率统计
    const finalFillRate = totalCells > 0 ? (blocks.length * 2) / totalCells : 0;
    console.log(`[ReverseLevelGenerator Worker] 生成完成: 方块=${blocks.length}, 填充率=${(finalFillRate * 100).toFixed(1)}%`);

    return blocks;
  },

  initializeGrid(shortSide, boardRect) {
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
    const baseGap = Math.max(4, Math.round(shortSide * 0.35));
    const cellGap = Math.max(baseGap, Math.round(longSide - 2 * shortSide));
    const cellStep = shortSide + cellGap;
    const step = cellStep / Math.SQRT2;

    const dimsSample = this.getBlockDimensions(DIRECTIONS.UP, shortSide);
    const halfW = dimsSample.width / 2;
    const halfH = dimsSample.height / 2;
    const safeMarginX = BLOCK_SIZES.SAFETY_MARGIN + halfW + (BLOCK_SIZES.RENDER_MARGIN || 0);
    const safeMarginY = BLOCK_SIZES.SAFETY_MARGIN + halfH + (BLOCK_SIZES.RENDER_MARGIN || 0);
    
    const safeBoardRect = {
      x: boardRect.x + safeMarginX,
      y: boardRect.y + safeMarginY,
      width: Math.max(0, boardRect.width - safeMarginX * 2),
      height: Math.max(0, boardRect.height - safeMarginY * 2)
    };

    const centerX = safeBoardRect.x + safeBoardRect.width / 2;
    const centerY = safeBoardRect.y + safeBoardRect.height / 2;

    const cells = new Map();
    if (safeBoardRect.width > 0 && safeBoardRect.height > 0) {
      const maxRow = Math.floor(safeBoardRect.height / (2 * step));
      const maxCol = Math.floor(safeBoardRect.width / (2 * step));
      
      for (let row = -maxRow; row <= maxRow; row++) {
        for (let col = -maxCol; col <= maxCol; col++) {
          const x = centerX + (col - row) * step;
          const y = centerY + (col + row) * step;

          if (x >= safeBoardRect.x && x <= safeBoardRect.x + safeBoardRect.width &&
              y >= safeBoardRect.y && y <= safeBoardRect.y + safeBoardRect.height) {
            const key = `${row},${col}`;
            cells.set(key, { row, col, x, y, key, occupied: false, blockId: null });
          }
        }
      }
    }

    // 计算初始边界单元（棋盘物理边缘）
    let boundaryCells = this.findBoundaryCells(cells);
    
    // 边界单元 Set（用于快速查找和去重）
    const boundarySet = new Set(boundaryCells.map(c => c.key));
    
    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const self = this;

    const grid = {
      cells,
      boundaryCells,
      centerX,
      centerY,
      step,
      cellStep,
      shortSide,
      safeBoardRect,
      maxPossibleBlocks: Math.floor(cells.size / 2),
      
      getCell(row, col) {
        return cells.get(`${row},${col}`);
      },
      
      isOccupied(row, col) {
        const cell = cells.get(`${row},${col}`);
        return cell ? cell.occupied : true;
      },
      
      occupyBlock(block) {
        const blockCells = self.getBlockCells(block);
        const newBoundaryCandidates = [];
        
        for (const c of blockCells) {
          const cell = cells.get(`${c.row},${c.col}`);
          if (cell) {
            cell.occupied = true;
            cell.blockId = block._id;
            
            // 从边界中移除已占用的格子
            if (boundarySet.has(cell.key)) {
              boundarySet.delete(cell.key);
            }
            
            // 收集周围的空格子作为新边界候选
            for (const [dr, dc] of neighborOffsets) {
              const neighborKey = `${c.row + dr},${c.col + dc}`;
              const neighbor = cells.get(neighborKey);
              if (neighbor && !neighbor.occupied && !boundarySet.has(neighborKey)) {
                newBoundaryCandidates.push(neighbor);
              }
            }
          }
        }
        
        // 将新的边界候选加入
        for (const candidate of newBoundaryCandidates) {
          if (!boundarySet.has(candidate.key)) {
            boundarySet.add(candidate.key);
            boundaryCells.push(candidate);
          }
        }
        
        // 清理 boundaryCells 数组（移除已占用的）
        this.boundaryCells = boundaryCells.filter(c => !c.occupied);
        boundaryCells = this.boundaryCells;
      }
    };
    
    return grid;
  },

  getBlockCells(block) {
    if (block.axis === 'row') {
      return [
        { row: block.gridRow, col: block.gridCol },
        { row: block.gridRow + 1, col: block.gridCol }
      ];
    } else {
      return [
        { row: block.gridRow, col: block.gridCol },
        { row: block.gridRow, col: block.gridCol + 1 }
      ];
    }
  },

  findBoundaryCells(cells) {
    const boundary = [];
    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [key, cell] of cells) {
      let isBoundary = false;
      for (const [dr, dc] of neighborOffsets) {
        const neighborKey = `${cell.row + dr},${cell.col + dc}`;
        if (!cells.has(neighborKey)) {
          isBoundary = true;
          break;
        }
      }
      if (isBoundary) {
        boundary.push(cell);
      }
    }

    return boundary;
  },

  tryInsertBlock(grid, existingBlocks, rand, depthFactor, shortSide, screenWidth, screenHeight) {
    const preferGap = rand() < depthFactor;
    
    const maxTries = 50;
    for (let i = 0; i < maxTries; i++) {
      const entry = this.selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor);
      if (!entry) continue;

      const slideResult = this.simulateSlide(grid, entry, existingBlocks, shortSide, screenWidth, screenHeight);

      if (slideResult && slideResult.valid) {
        const block = this.createBlockFromSlide(slideResult, shortSide, existingBlocks.length);
        return { block, slideResult };
      }
    }

    return null;
  },

  selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor = 0.5) {
    const availableBoundary = grid.boundaryCells.filter(cell => !cell.occupied);
    if (availableBoundary.length === 0) return null;

    let selectedCell;
    if (preferGap && existingBlocks.length > 0) {
      const scored = availableBoundary.map(cell => {
        let minDist = Infinity;
        for (const block of existingBlocks) {
          const dx = cell.x - (block.x + block.width / 2);
          const dy = cell.y - (block.y + block.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }
        return { cell, score: -minDist + rand() * 30 };
      });
      scored.sort((a, b) => b.score - a.score);
      // 从前几个高分中随机选择，增加变化
      const topN = Math.min(5, scored.length);
      selectedCell = scored[Math.floor(rand() * topN)].cell;
    } else {
      selectedCell = availableBoundary[Math.floor(rand() * availableBoundary.length)];
    }

    // ========== 关键改进：方向多样化 ==========
    // 随机选择轴向（row 或 col），而不是仅基于位置
    let axis;
    if (rand() < 0.5) {
      axis = 'row';
    } else {
      axis = 'col';
    }
    
    // 检查是否有有效的邻居来组成双格方块
    let neighbor = this.findNeighborForPair(grid, selectedCell, axis);
    if (!neighbor) {
      // 尝试另一个轴向
      axis = axis === 'row' ? 'col' : 'row';
      neighbor = this.findNeighborForPair(grid, selectedCell, axis);
      if (!neighbor) return null;
    }

    // ========== 关键改进：方向随机化 + 深度控制 + lane 冲突检测 ==========
    // outwardChance: 朝外方向的概率（朝外 = 可直接消除）
    // depthFactor 越高，朝内的概率越大 → 产生更多阻挡
    const outwardChance = 1 - depthFactor * 0.7; // depthFactor=0 → 100% 朝外; depthFactor=1 → 30% 朝外
    
    let direction;
    const goOutward = rand() < outwardChance;
    
    // 计算方块的 gridRow/gridCol
    const gridRow = axis === 'row' ? Math.min(selectedCell.row, neighbor.row) : selectedCell.row;
    const gridCol = axis === 'col' ? Math.min(selectedCell.col, neighbor.col) : selectedCell.col;
    
    if (axis === 'row') {
      // row 轴方块：可以朝 UP 或 DOWN
      const isAboveCenter = selectedCell.y < grid.centerY;
      let preferredDirection;
      if (goOutward) {
        // 朝外：远离中心的方向
        preferredDirection = isAboveCenter ? DIRECTIONS.UP : DIRECTIONS.DOWN;
      } else {
        // 朝内：朝向中心的方向（会被其他方块阻挡）
        preferredDirection = isAboveCenter ? DIRECTIONS.DOWN : DIRECTIONS.UP;
      }
      
      // **关键：检查同一 lane 是否有对向方块**
      const laneDirection = this.getLaneDirection(existingBlocks, 'row', gridCol);
      if (laneDirection !== null) {
        // 该 lane 已有方块，必须使用相同方向
        direction = laneDirection;
      } else {
        direction = preferredDirection;
      }
    } else {
      // col 轴方块：可以朝 LEFT 或 RIGHT
      const isLeftOfCenter = selectedCell.x < grid.centerX;
      let preferredDirection;
      if (goOutward) {
        // 朝外：远离中心
        preferredDirection = isLeftOfCenter ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
      } else {
        // 朝内：朝向中心
        preferredDirection = isLeftOfCenter ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
      }
      
      // **关键：检查同一 lane 是否有对向方块**
      const laneDirection = this.getLaneDirection(existingBlocks, 'col', gridRow);
      if (laneDirection !== null) {
        // 该 lane 已有方块，必须使用相同方向
        direction = laneDirection;
      } else {
        direction = preferredDirection;
      }
    }

    return { cell: selectedCell, neighbor, direction, axis };
  },
  
  /**
   * 获取指定 lane 中已有方块的方向
   * 用于确保同一 lane 内所有方块方向一致，避免对向死锁
   */
  getLaneDirection(blocks, axis, laneIndex) {
    for (const block of blocks) {
      if (block.axis !== axis) continue;
      
      if (axis === 'row' && block.gridCol === laneIndex) {
        return block.direction;
      }
      if (axis === 'col' && block.gridRow === laneIndex) {
        return block.direction;
      }
    }
    return null;
  },

  findNeighborForPair(grid, cell, axis) {
    let neighborOffsets;
    if (axis === 'row') {
      neighborOffsets = [[1, 0], [-1, 0]];
    } else {
      neighborOffsets = [[0, 1], [0, -1]];
    }

    for (const [dr, dc] of neighborOffsets) {
      const neighborKey = `${cell.row + dr},${cell.col + dc}`;
      const neighbor = grid.cells.get(neighborKey);
      if (neighbor && !neighbor.occupied) {
        return neighbor;
      }
    }

    return null;
  },

  simulateSlide(grid, entry, existingBlocks, shortSide, screenWidth, screenHeight) {
    const { cell, neighbor, direction, axis } = entry;

    const blockCenterX = (cell.x + neighbor.x) / 2;
    const blockCenterY = (cell.y + neighbor.y) / 2;

    const slideDir = this.getOppositeDirection(direction);
    const slideDelta = this.getGridDelta(slideDir);

    let gridRow = axis === 'row' ? Math.min(cell.row, neighbor.row) : cell.row;
    let gridCol = axis === 'col' ? Math.min(cell.col, neighbor.col) : cell.col;

    let slideSteps = 0;
    const maxSlideSteps = 20;
    
    while (slideSteps < maxSlideSteps) {
      const nextRow = gridRow + slideDelta.row;
      const nextCol = gridCol + slideDelta.col;

      if (axis === 'row') {
        const cell1 = grid.getCell(nextRow, nextCol);
        const cell2 = grid.getCell(nextRow + 1, nextCol);
        
        if (!cell1 || !cell2 || cell1.occupied || cell2.occupied) {
          break;
        }
      } else {
        const cell1 = grid.getCell(nextRow, nextCol);
        const cell2 = grid.getCell(nextRow, nextCol + 1);
        
        if (!cell1 || !cell2 || cell1.occupied || cell2.occupied) {
          break;
        }
      }

      gridRow = nextRow;
      gridCol = nextCol;
      slideSteps++;
    }

    let cell1Valid, cell2Valid;
    if (axis === 'row') {
      cell1Valid = grid.getCell(gridRow, gridCol);
      cell2Valid = grid.getCell(gridRow + 1, gridCol);
    } else {
      cell1Valid = grid.getCell(gridRow, gridCol);
      cell2Valid = grid.getCell(gridRow, gridCol + 1);
    }

    if (!cell1Valid || !cell2Valid || cell1Valid.occupied || cell2Valid.occupied) {
      return null;
    }

    const finalCenterX = (cell1Valid.x + cell2Valid.x) / 2;
    const finalCenterY = (cell1Valid.y + cell2Valid.y) / 2;

    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const finalX = finalCenterX - bw / 2;
    const finalY = finalCenterY - bh / 2;

    if (!this.isInsideSafeRect(finalX, finalY, bw, bh, grid.safeBoardRect)) {
      return null;
    }

    return {
      valid: true,
      gridRow,
      gridCol,
      x: finalX,
      y: finalY,
      width: bw,
      height: bh,
      direction,
      axis,
      slideSteps,
      centerX: finalCenterX,
      centerY: finalCenterY
    };
  },

  createBlockFromSlide(slideResult, shortSide, index) {
    return {
      _id: index,
      x: slideResult.x,
      y: slideResult.y,
      width: slideResult.width,
      height: slideResult.height,
      direction: slideResult.direction,
      axis: slideResult.axis,
      gridRow: slideResult.gridRow,
      gridCol: slideResult.gridCol,
      type: null,
      size: shortSide,
      depth: slideResult.slideSteps
    };
  },

  assignAnimalTypes(blocks, generationOrder, animalTypeCount, rand) {
    const usedTypes = MAIN_ANIMAL_TYPES.slice(0, animalTypeCount);
    
    const depthGroups = new Map();
    for (const block of blocks) {
      const depth = block.depth || 0;
      if (!depthGroups.has(depth)) {
        depthGroups.set(depth, []);
      }
      depthGroups.get(depth).push(block);
    }

    let typeIndex = 0;
    for (const [depth, group] of depthGroups) {
      this.shuffleArray(group, rand);
      for (const block of group) {
        block.type = usedTypes[typeIndex % usedTypes.length];
        typeIndex++;
      }
    }
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

    return { longSide, bodyW, bodyH, angle, width: bboxW, height: bboxH };
  },

  getDirectionAngle(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return -Math.PI / 4;
      case DIRECTIONS.RIGHT: return Math.PI / 4;
      case DIRECTIONS.DOWN:  return (3 * Math.PI) / 4;
      case DIRECTIONS.LEFT:  return (-3 * Math.PI) / 4;
      default:               return -Math.PI / 4;
    }
  },

  getOppositeDirection(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return DIRECTIONS.DOWN;
      case DIRECTIONS.DOWN:  return DIRECTIONS.UP;
      case DIRECTIONS.LEFT:  return DIRECTIONS.RIGHT;
      case DIRECTIONS.RIGHT: return DIRECTIONS.LEFT;
      default:               return DIRECTIONS.DOWN;
    }
  },

  getGridDelta(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return { row: -1, col: 0 };
      case DIRECTIONS.DOWN:  return { row: 1, col: 0 };
      case DIRECTIONS.LEFT:  return { row: 0, col: -1 };
      case DIRECTIONS.RIGHT: return { row: 0, col: 1 };
      default:               return { row: 0, col: 0 };
    }
  },

  isInsideSafeRect(x, y, width, height, safeRect) {
    return x >= safeRect.x &&
      x + width <= safeRect.x + safeRect.width &&
      y >= safeRect.y &&
      y + height <= safeRect.y + safeRect.height;
  },

  getDifficultyParams(level) {
    // Level 1: 极简教学
    if (level === 1) {
      return {
        phaseName: '教学关',
        blockCount: 6,
        blockSize: 28,
        depthFactor: 0,
        animalTypes: 3,
        scale: 1.5
      };
    }

    // Level 2: 难度陡增 (The Spike)
    if (level === 2) {
      return {
        phaseName: '难度飙升',
        blockCount: 110,
        blockSize: 16,
        depthFactor: 0.75,    // 较高深度 → 更多阻挡关系
        animalTypes: 4,
        scale: 1.0,
        showWarning: true
      };
    }

    // Level 3+: 线性递增（从 Level 2 的难度起步，持续递增）
    const progress = Math.min(1, (level - 3) / 50); // 50关达到最大难度
    
    // 方块数量: 115 -> 180（比 Level 2 的 110 略多起步）
    const blockCount = Math.round(115 + progress * 65);
    
    // 深度因子: 0.75 -> 0.95（从 Level 2 的 0.75 起步，确保难度递增）
    const depthFactor = 0.75 + progress * 0.2;
    
    const animalTypes = level < 10 ? 4 : 5;

    // 锯齿波动：每5关一个周期，第5关略微休息
    const cyclePosition = (level - 1) % 5;
    const isReliefLevel = cyclePosition === 4;
    
    // 调整幅度减小，避免休息关难度下降太多
    const blockCountAdjust = isReliefLevel ? -10 : cyclePosition * 3;
    const depthAdjust = isReliefLevel ? -0.05 : cyclePosition * 0.01;

    return {
      phaseName: level <= 10 ? '成长期' : level <= 30 ? '挑战期' : level <= 60 ? '大师期' : '传奇期',
      blockCount: Math.max(110, Math.min(200, blockCount + blockCountAdjust)),
      blockSize: 16,
      depthFactor: Math.max(0.7, Math.min(0.95, depthFactor + depthAdjust)),
      animalTypes,
      scale: 1.0,
      isReliefLevel
    };
  }
};

// ==================== Worker 消息处理 ====================

// 使用逆向填空生成器作为默认算法
const USE_REVERSE_GENERATOR = true;

worker.onMessage(function(msg) {
  if (msg.type === 'generate') {
    const { levelNumber, screenWidth, screenHeight, requestId, useOldAlgorithm } = msg;
    
    try {
      const startTime = Date.now();
      
      // 选择生成算法
      const generator = (USE_REVERSE_GENERATOR && !useOldAlgorithm) 
        ? ReverseLevelGenerator 
        : LevelGenerator;
      
      const levelData = generator.generate(levelNumber, screenWidth, screenHeight);
      const duration = Date.now() - startTime;
      
      console.log(`[Worker] 使用 ${generator === ReverseLevelGenerator ? '逆向填空' : '传统'} 算法生成关卡 ${levelNumber}，耗时 ${duration}ms`);
      
      worker.postMessage({
        type: 'levelReady',
        requestId,
        levelNumber,
        levelData,
        duration
      });
    } catch (error) {
      console.error('[Worker] 生成关卡出错:', error);
      worker.postMessage({
        type: 'error',
        requestId,
        levelNumber,
        error: error.message || 'Unknown error'
      });
    }
  }
});

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

      if (blocks._solvable === true) {
        return { blocks, total: blocks.length };
      }

      if (this.validateLevel(blocks, screenWidth, screenHeight, seed)) {
        return { blocks, total: blocks.length };
      }
    }

    return { blocks: lastBlocks, total: lastBlocks.length };
  },

  generateRotatedGridDominoLayout(params, seed, screenWidth, screenHeight, boardRect) {
    const blocks = [];
    const { blockCount, blockSize, outwardBias = 0.88, animalTypes = 5 } = params;

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
      const gridRow = axis === 'row' ? Math.min(cell.row, neighbor.row) : cell.row;
      const gridCol = axis === 'col' ? Math.min(cell.col, neighbor.col) : cell.col;
      const blockCenterX = (cell.x + neighbor.x) / 2;
      const blockCenterY = (cell.y + neighbor.y) / 2;
      const direction = this.pickDirectionForPair(
        cell, neighbor, blockCenterX, blockCenterY, centerX, centerY, rand, outwardBias
      );

      const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
      const blockX = blockCenterX - bw / 2;
      const blockY = blockCenterY - bh / 2;

      if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) continue;
      if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) continue;

      const usedAnimalTypes = this.ANIMAL_TYPES.slice(0, animalTypes);
      const animalType = usedAnimalTypes[blocks.length % usedAnimalTypes.length];
      blocks.push({
        x: blockX, y: blockY, width: bw, height: bh,
        direction, axis, gridRow, gridCol, type: animalType, size: shortSide
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
        const direction = this.pickDirectionForPair(
          cell, neighbor, blockCenterX, blockCenterY, centerX, centerY, rand, outwardBias
        );
        const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
        const blockX = blockCenterX - bw / 2;
        const blockY = blockCenterY - bh / 2;

        if (!this.isBlockInsideSafeRect(blockX, blockY, bw, bh, safeBoardRect)) continue;
        if (this.wouldOverlap(blockX, blockY, bw, bh, blocks, overlapMargin)) continue;

        const usedAnimalTypes = this.ANIMAL_TYPES.slice(0, animalTypes);
        const animalType = usedAnimalTypes[blocks.length % usedAnimalTypes.length];
        blocks.push({
          x: blockX, y: blockY, width: bw, height: bh,
          direction, axis, gridRow, gridCol, type: animalType, size: shortSide
        });

        used.add(cell.key);
        used.add(neighbor.key);
        placed++;
      }
    }

    const initialRemovableRatio = params.initialRemovableRatio || 0.20;
    this.ensureRemovableBlocks(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, initialRemovableRatio);
    const solvable = this.ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed);
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

  ensureSolvablePath(blocks, screenWidth, screenHeight, centerX, centerY, shortSide, seed) {
    const baseSeed = typeof seed === 'number' ? seed : 0;
    const maxFixRounds = 4;
    const attempts = 6;

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

  validateLevel(blocks, screenWidth, screenHeight, seed) {
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
    return this.hasSolvablePath(normalized, screenWidth, screenHeight, baseSeed, 6);
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
   * 获取难度参数（锯齿曲线 + 多维度，固定尺寸）
   */
  getDifficultyParams(level) {
    // 固定方块尺寸
    const BLOCK_SIZE = 16;
    
    // 阶段定义（无新手期）
    const phases = [
      { maxLevel: 15, blockCount: [100, 140], removableRatio: [0.22, 0.28], outwardBias: 0.82, animalTypes: 4 },
      { maxLevel: 35, blockCount: [140, 175], removableRatio: [0.18, 0.22], outwardBias: 0.72, animalTypes: 5 },
      { maxLevel: 60, blockCount: [175, 200], removableRatio: [0.15, 0.18], outwardBias: 0.62, animalTypes: 5 },
      { maxLevel: Infinity, blockCount: [200, 220], removableRatio: [0.12, 0.15], outwardBias: 0.55, animalTypes: 5 }
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

    // 计算阶段内进度
    const phaseLength = phase.maxLevel === Infinity ? 40 : phase.maxLevel - phaseStartLevel + 1;
    const levelInPhase = level - phaseStartLevel;
    const phaseProgress = Math.min(1, levelInPhase / phaseLength);

    // 锯齿波动
    const cycleLength = 5;
    const cyclePosition = (level - 1) % cycleLength;
    const isReliefLevel = cyclePosition === cycleLength - 1;
    let sawtoothFactor = isReliefLevel ? -0.12 : cyclePosition * 0.03;

    // 计算方块数量
    const lerp = (a, b, t) => a + (b - a) * t;
    const baseBlockCount = lerp(phase.blockCount[0], phase.blockCount[1], phaseProgress);
    const blockCount = Math.round(Math.max(80, Math.min(220, baseBlockCount + baseBlockCount * sawtoothFactor)));

    // 计算可消除比例
    const baseRemovableRatio = lerp(phase.removableRatio[0], phase.removableRatio[1], 1 - phaseProgress);
    const removableAdjust = isReliefLevel ? 0.06 : -cyclePosition * 0.012;
    const initialRemovableRatio = Math.max(0.10, Math.min(0.35, baseRemovableRatio + removableAdjust));

    // 计算朝外偏好
    const outwardAdjust = isReliefLevel ? 0.08 : -cyclePosition * 0.015;
    const outwardBias = Math.max(0.45, Math.min(0.90, phase.outwardBias + outwardAdjust));

    // 空洞率
    const holeRateBase = blockCount > 170 ? 0.05 : blockCount > 140 ? 0.07 : 0.09;
    const holeRateRange = [holeRateBase, holeRateBase + 0.03];

    return {
      blockCount,
      blockSize: BLOCK_SIZE,
      holeRateRange,
      initialRemovableRatio,
      outwardBias,
      animalTypes: phase.animalTypes,
      isReliefLevel
    };
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

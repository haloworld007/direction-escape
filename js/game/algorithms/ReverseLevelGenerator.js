/**
 * 逆向填空关卡生成器 (Reverse Filling Level Generator)
 * 
 * 核心理念: 生成顺序 = 玩家消除的逆序
 * - 从边缘"射入"方块，让其滑到碰撞位置
 * - 后射入的方块天然在"外层"，先射入的在"内层"
 * - 100% 保证可解，无需蒙特卡洛验证
 */
import { DIRECTIONS } from '../blocks/Block';
import { MAIN_ANIMAL_TYPES, BLOCK_SIZES, getBoardRect } from '../../ui/UIConstants';
import DependencyGraph from './DependencyGraph';

export default class ReverseLevelGenerator {
  // 主要动物类型
  static ANIMAL_TYPES = MAIN_ANIMAL_TYPES;

  /**
   * 生成关卡（主入口）
   * @param {number} levelNumber - 关卡号
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {{ blocks: Array, total: number }}
   */
  static generate(levelNumber, screenWidth, screenHeight) {
    const params = this.getDifficultyParams(levelNumber);
    const boardRect = getBoardRect(screenWidth, screenHeight);
    const seed = this.getSeed(levelNumber, 0);

    console.log(`[ReverseLevelGenerator] 生成关卡 ${levelNumber}, 目标方块数: ${params.blockCount}, 阶段: ${params.phaseName}`);

    const result = this.generateWithValidation(
      params,
      seed,
      screenWidth,
      screenHeight,
      boardRect
    );

    console.log(`[ReverseLevelGenerator] 关卡 ${levelNumber} 生成完成，方块数: ${result.blocks.length}`);
    return { blocks: result.blocks, total: result.blocks.length };
  }

  /**
   * 获取种子（加入时间戳确保每次不同）
   */
  static getSeed(levelNumber, attempt) {
    // 基础种子 + 时间戳的低位，确保同一关卡每次生成不同
    const timePart = Date.now() % 100000;
    return (levelNumber + 1) * 10007 + attempt * 97 + timePart;
  }

  /**
   * 创建可复现随机数生成器 (mulberry32)
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
   * 洗牌算法
   */
  static shuffleArray(arr, rand = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /**
   * 逆向填空生成算法
   * 
   * 核心流程:
   * 1. 初始化空的网格
   * 2. 从边缘选择入射点和方向
   * 3. 方块沿反方向"滑入"直到碰撞
   * 4. 放置方块，重复直到达到目标数量
   */
  static generateWithValidation(params, seed, screenWidth, screenHeight, boardRect) {
    const maxAttempts = Number.isFinite(params.maxGenerateAttempts) ? params.maxGenerateAttempts : 6;
    const maxTotalTimeMs = Number.isFinite(params.maxGenerateTimeMs) ? params.maxGenerateTimeMs : 3000;
    const startTime = Date.now();
    let best = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() - startTime > maxTotalTimeMs) break;
      const attemptSeed = seed + attempt * 131;
      const result = this.generateByReverseFilling(
        params,
        attemptSeed,
        screenWidth,
        screenHeight,
        boardRect
      );

      if (!result || !result.blocks || result.blocks.length === 0) continue;

      const stats = this.validateAndRecordStats(result.blocks, screenWidth, screenHeight, result.grid, params);
      const directionDistribution = this.getDirectionDistribution(result.blocks);
      const difficultyScore = this.computeDifficultyScore(stats, directionDistribution);
      const verdict = this.isDifficultyAcceptable(params, stats, directionDistribution, difficultyScore);

      result.blocks._stats = stats;
      result.blocks._difficulty = difficultyScore;
      result.blocks._directionDistribution = directionDistribution;
      result.blocks._layoutProfile = result.layoutProfile ? result.layoutProfile.name : null;

      if (verdict.ok) {
        return { blocks: result.blocks };
      }

      if (!best || verdict.distance < best.distance) {
        best = { blocks: result.blocks, distance: verdict.distance };
      }
    }

    return best ? { blocks: best.blocks } : { blocks: [] };
  }

  static generateByReverseFilling(params, seed, screenWidth, screenHeight, boardRect) {
    const { blockCount, blockSize, depthFactor, animalTypes = 5 } = params;
    const rand = this.createSeededRandom(seed);
    const maxGenerateTimeMs = Number.isFinite(params.maxGenerateTimeMs) ? params.maxGenerateTimeMs : 3000;
    const startTime = Date.now();

    // 计算网格参数
    const shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const grid = this.initializeGrid(shortSide, boardRect);
    const layoutProfile = this.createLayoutProfile(params, rand, grid);
    
    if (grid.maxPossibleBlocks < 2) {
      console.warn('[ReverseLevelGenerator] 棋盘太小，无法生成方块');
      return { blocks: [], layoutProfile, grid };
    }

    const targetFillRate = Number.isFinite(params.targetFillRate) ? params.targetFillRate : 0.7;
    const fillTarget = Math.floor(grid.maxPossibleBlocks * targetFillRate);
    const targetCount = params.forceFillRate
      ? Math.min(grid.maxPossibleBlocks, fillTarget)
      : Math.min(blockCount, grid.maxPossibleBlocks, fillTarget);

    const blocks = this.generateDenseLayout(
      grid,
      targetCount,
      layoutProfile,
      rand,
      shortSide,
      startTime,
      maxGenerateTimeMs,
      params
    );

    if (!blocks || blocks.length < targetCount) {
      return { blocks: [], layoutProfile, grid };
    }

    const peelResult = this.peelAssignDirections(
      grid,
      blocks,
      params,
      rand,
      shortSide,
      startTime,
      maxGenerateTimeMs
    );

    if (!peelResult) {
      return { blocks: [], layoutProfile, grid };
    }

    this.assignAnimalTypes(blocks, peelResult.order, animalTypes, rand);
    blocks._solvable = true;
    return { blocks, layoutProfile, grid };
  }

  /**
   * 使用 DependencyGraph 验证生成结果并记录统计
   */
  static validateAndRecordStats(blocks, screenWidth, screenHeight, grid, params) {
    // 构建依赖图
    const graph = DependencyGraph.build(blocks, screenWidth, screenHeight);
    const graphStats = graph.getStats();
    
    // 计算填充率
    const filledCells = blocks.length * 2; // 每个方块占 2 格
    const totalCells = grid.cells.size;
    const fillRate = totalCells > 0 ? filledCells / totalCells : 0;
    const localStats = this.computeLocalDirectionStats(blocks, grid, params);
    const lineStats = this.computeLineDirectionStats(blocks, params);
    
    return {
      avgDepth: graphStats.avgDepth,
      maxDepth: graphStats.maxDepth,
      removableCount: graphStats.removableCount,
      removableRatio: graphStats.removableRatio,
      fillRate,
      totalCells,
      filledCells,
      maxLocalDirectionRatio: localStats.maxLocalDirectionRatio,
      maxLineDirectionRatio: lineStats.maxLineDirectionRatio
    };
  }

  static computeLocalDirectionStats(blocks, grid, params) {
    const localGrid = Number.isFinite(params && params.localDirectionGrid) ? params.localDirectionGrid : 3;
    if (!grid || !grid.safeBoardRect || localGrid <= 1) {
      return { maxLocalDirectionRatio: 0.25 };
    }
    const rect = grid.safeBoardRect;
    const sectors = new Map();
    const getSectorKey = (block) => {
      if (rect.width <= 0 || rect.height <= 0) return '0,0';
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const col = Math.min(localGrid - 1, Math.max(0, Math.floor(((cx - rect.x) / rect.width) * localGrid)));
      const row = Math.min(localGrid - 1, Math.max(0, Math.floor(((cy - rect.y) / rect.height) * localGrid)));
      return `${row},${col}`;
    };

    for (const block of blocks) {
      const key = getSectorKey(block);
      if (!sectors.has(key)) {
        sectors.set(key, {
          total: 0,
          [DIRECTIONS.UP]: 0,
          [DIRECTIONS.RIGHT]: 0,
          [DIRECTIONS.DOWN]: 0,
          [DIRECTIONS.LEFT]: 0
        });
      }
      const stats = sectors.get(key);
      stats.total += 1;
      stats[block.direction] += 1;
    }

    let maxLocalDirectionRatio = 0;
    for (const stats of sectors.values()) {
      if (!stats.total) continue;
      const localMax = Math.max(
        stats[DIRECTIONS.UP],
        stats[DIRECTIONS.RIGHT],
        stats[DIRECTIONS.DOWN],
        stats[DIRECTIONS.LEFT]
      ) / stats.total;
      if (localMax > maxLocalDirectionRatio) maxLocalDirectionRatio = localMax;
    }

    return { maxLocalDirectionRatio };
  }

  static computeLineDirectionStats(blocks, params) {
    const minCount = Number.isFinite(params && params.lineDirectionMinCount) ? params.lineDirectionMinCount : 3;
    const lines = new Map();
    for (const block of blocks) {
      const key = block.axis === 'row' ? `col:${block.gridCol}` : `row:${block.gridRow}`;
      if (!lines.has(key)) {
        lines.set(key, {
          total: 0,
          [DIRECTIONS.UP]: 0,
          [DIRECTIONS.RIGHT]: 0,
          [DIRECTIONS.DOWN]: 0,
          [DIRECTIONS.LEFT]: 0
        });
      }
      const stats = lines.get(key);
      stats.total += 1;
      stats[block.direction] += 1;
    }

    let maxLineDirectionRatio = 0;
    for (const stats of lines.values()) {
      if (stats.total < minCount) continue;
      const localMax = Math.max(
        stats[DIRECTIONS.UP],
        stats[DIRECTIONS.RIGHT],
        stats[DIRECTIONS.DOWN],
        stats[DIRECTIONS.LEFT]
      ) / stats.total;
      if (localMax > maxLineDirectionRatio) maxLineDirectionRatio = localMax;
    }

    if (!maxLineDirectionRatio) maxLineDirectionRatio = 0.25;
    return { maxLineDirectionRatio };
  }

  static getDirectionBias(existingBlocks, params) {
    const target = (params && params.directionMixTarget) || { up: 0.25, right: 0.25, down: 0.25, left: 0.25 };
    const counts = { [DIRECTIONS.UP]: 0, [DIRECTIONS.RIGHT]: 0, [DIRECTIONS.DOWN]: 0, [DIRECTIONS.LEFT]: 0 };
    for (const block of existingBlocks) {
      counts[block.direction] = (counts[block.direction] || 0) + 1;
    }
    const total = existingBlocks.length || 1;
    const ratios = {
      up: counts[DIRECTIONS.UP] / total,
      right: counts[DIRECTIONS.RIGHT] / total,
      down: counts[DIRECTIONS.DOWN] / total,
      left: counts[DIRECTIONS.LEFT] / total
    };
    return {
      [DIRECTIONS.UP]: target.up - ratios.up,
      [DIRECTIONS.RIGHT]: target.right - ratios.right,
      [DIRECTIONS.DOWN]: target.down - ratios.down,
      [DIRECTIONS.LEFT]: target.left - ratios.left
    };
  }

  static getDirectionDistribution(blocks) {
    const counts = { [DIRECTIONS.UP]: 0, [DIRECTIONS.RIGHT]: 0, [DIRECTIONS.DOWN]: 0, [DIRECTIONS.LEFT]: 0 };
    for (const block of blocks) {
      counts[block.direction] = (counts[block.direction] || 0) + 1;
    }
    const total = blocks.length || 1;
    const ratios = {
      up: counts[DIRECTIONS.UP] / total,
      right: counts[DIRECTIONS.RIGHT] / total,
      down: counts[DIRECTIONS.DOWN] / total,
      left: counts[DIRECTIONS.LEFT] / total
    };
    return { counts, ratios };
  }

  static computeDifficultyScore(stats, directionDistribution) {
    const avgDepthNorm = Math.min(1, stats.avgDepth / 8);
    const maxDepthNorm = Math.min(1, stats.maxDepth / 16);
    const removablePenalty = Math.min(1, Math.max(0, 1 - stats.removableRatio));
    const maxDirRatio = Math.max(
      directionDistribution.ratios.up,
      directionDistribution.ratios.right,
      directionDistribution.ratios.down,
      directionDistribution.ratios.left
    );
    const diversity = Math.max(0, Math.min(1, 1 - (maxDirRatio - 0.25) / 0.75));
    const localMax = Number.isFinite(stats.maxLocalDirectionRatio) ? stats.maxLocalDirectionRatio : 1;
    const lineMax = Number.isFinite(stats.maxLineDirectionRatio) ? stats.maxLineDirectionRatio : 1;
    const localDiversity = Math.max(0, Math.min(1, 1 - (localMax - 0.25) / 0.75));
    const lineDiversity = Math.max(0, Math.min(1, 1 - (lineMax - 0.25) / 0.75));
    const score = 100 * (0.36 * avgDepthNorm + 0.27 * maxDepthNorm + 0.2 * removablePenalty + 0.07 * diversity + 0.05 * localDiversity + 0.05 * lineDiversity);
    return Math.round(score * 10) / 10;
  }

  static isDifficultyAcceptable(params, stats, directionDistribution, difficultyScore) {
    const target = params.targetDifficulty || 0;
    const tolerance = Number.isFinite(params.targetDifficultyTolerance) ? params.targetDifficultyTolerance : 6;
    const minScore = Math.max(0, target - tolerance);
    const maxScore = target + tolerance;

    const maxDirRatio = Math.max(
      directionDistribution.ratios.up,
      directionDistribution.ratios.right,
      directionDistribution.ratios.down,
      directionDistribution.ratios.left
    );
    const directionOk = maxDirRatio <= (params.maxDirectionRatio || 0.7);
    const localMaxDirRatio = Number.isFinite(stats.maxLocalDirectionRatio) ? stats.maxLocalDirectionRatio : 1;
    const localDirectionOk = !params.maxLocalDirectionRatio || localMaxDirRatio <= params.maxLocalDirectionRatio;
    const lineMaxDirRatio = Number.isFinite(stats.maxLineDirectionRatio) ? stats.maxLineDirectionRatio : 1;
    const lineDirectionOk = !params.maxLineDirectionRatio || lineMaxDirRatio <= params.maxLineDirectionRatio;

    const avgDepthOk = !params.depthTargetRange ||
      (stats.avgDepth >= params.depthTargetRange[0] && stats.avgDepth <= params.depthTargetRange[1]);
    const removableOk = !params.removableRatioTarget ||
      (stats.removableRatio >= params.removableRatioTarget[0] && stats.removableRatio <= params.removableRatioTarget[1]);
    const scoreOk = target === 0 || (difficultyScore >= minScore && difficultyScore <= maxScore);

    const ok = directionOk && localDirectionOk && lineDirectionOk && avgDepthOk && removableOk && scoreOk;
    const distance = Math.abs(difficultyScore - target);
    return { ok, distance };
  }

  static createLayoutProfile(params, rand, grid) {
    const profiles = params.layoutProfiles && params.layoutProfiles.length
      ? params.layoutProfiles
      : ['uniform', 'ring', 'diagonalBand', 'twoLumps', 'centerHollow'];
    const name = params.layoutProfile || profiles[Math.floor(rand() * profiles.length)];
    const centerX = grid.centerX + (rand() - 0.5) * grid.safeBoardRect.width * 0.2;
    const centerY = grid.centerY + (rand() - 0.5) * grid.safeBoardRect.height * 0.2;
    const maxR = Math.max(grid.safeBoardRect.width, grid.safeBoardRect.height) * 0.5;
    const rotation = rand() * Math.PI * 2;
    const ringBand = 0.55 + rand() * 0.2;
    const ringSigma = 0.12;
    const bandWidth = maxR * (0.18 + rand() * 0.08);
    const lumpsOffset = maxR * (0.35 + rand() * 0.1);

    const weight = (cell) => {
      const dx = cell.x - centerX;
      const dy = cell.y - centerY;
      const r = Math.sqrt(dx * dx + dy * dy) / (maxR || 1);

      if (name === 'ring') {
        const d = r - ringBand;
        return Math.exp(-(d * d) / (2 * ringSigma * ringSigma)) + 0.2;
      }

      if (name === 'diagonalBand') {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const nx = dx * cos - dy * sin;
        const ny = dx * sin + dy * cos;
        const dist = Math.abs(ny);
        return Math.max(0.2, 1 - dist / bandWidth);
      }

      if (name === 'twoLumps') {
        const c1x = centerX - lumpsOffset;
        const c2x = centerX + lumpsOffset;
        const c1y = centerY + lumpsOffset * 0.3;
        const c2y = centerY - lumpsOffset * 0.3;
        const d1 = Math.hypot(cell.x - c1x, cell.y - c1y);
        const d2 = Math.hypot(cell.x - c2x, cell.y - c2y);
        const sigma = maxR * 0.35;
        return Math.max(0.2, Math.exp(-(d1 * d1) / (2 * sigma * sigma)) + Math.exp(-(d2 * d2) / (2 * sigma * sigma)));
      }

      if (name === 'centerHollow') {
        return Math.max(0.2, r);
      }

      return 1;
    };

    return { name, weight };
  }

  /**
   * 初始化网格系统
   * 使用 45° 旋转的菱形网格，与现有系统兼容
   */
  static initializeGrid(shortSide, boardRect) {
    const longSide = shortSide * (BLOCK_SIZES.LENGTH / BLOCK_SIZES.WIDTH);
    const baseGap = Math.max(4, Math.round(shortSide * 0.35));
    const cellGap = Math.max(baseGap, Math.round(longSide - 2 * shortSide));
    const cellStep = shortSide + cellGap;
    const step = cellStep / Math.SQRT2;

    // 计算安全区域
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

    // 生成所有可用的网格单元
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
            cells.set(key, {
              row, col, x, y, key,
              occupied: false,
              blockId: null
            });
          }
        }
      }
    }

    // 计算初始边界单元（棋盘物理边缘）
    let boundaryCells = this.findBoundaryCells(cells);
    const edgeCells = boundaryCells.slice();
    
    // 边界单元 Set（用于快速查找和去重）
    const boundarySet = new Set(boundaryCells.map(c => c.key));
    
    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    const grid = {
      cells,
      boundaryCells,
      edgeCells,
      centerX,
      centerY,
      step,
      cellStep,
      shortSide,
      safeBoardRect,
      maxPossibleBlocks: Math.floor(cells.size / 2),
      
      // 网格操作方法
      getCell(row, col) {
        return cells.get(`${row},${col}`);
      },
      
      isOccupied(row, col) {
        const cell = cells.get(`${row},${col}`);
        return cell ? cell.occupied : true; // 不存在视为被占用
      },
      
      occupyBlock(block) {
        const blockCells = this.getBlockCells(block);
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
      }
    };
    
    return grid;
  }

  /**
   * 找出边界单元（用于入射点选择）
   */
  static findBoundaryCells(cells) {
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
  }

  static generateDenseLayout(grid, targetCount, layoutProfile, rand, shortSide, startTime, maxGenerateTimeMs, params) {
    const cells = Array.from(grid.cells.values());
    const weightOf = (cell) => (layoutProfile ? layoutProfile.weight(cell) : 1);
    const maxDist = Math.sqrt(
      Math.pow(grid.safeBoardRect.width / 2, 2) + Math.pow(grid.safeBoardRect.height / 2, 2)
    );
    const axisBalanceWeight = Number.isFinite(params && params.axisBalanceWeight) ? params.axisBalanceWeight : 0.25;
    let bestBlocks = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() - startTime > maxGenerateTimeMs) break;
      this.resetGridOccupancy(grid);
      const blocks = [];
      const axisCounts = { row: 0, col: 0 };
      const axisBias = (axis) => {
        const total = axisCounts.row + axisCounts.col;
        if (!total) return 0;
        const ratio = axisCounts[axis] / total;
        return 0.5 - ratio;
      };

      const ordered = cells.map(cell => ({
        cell,
        weight: weightOf(cell) + (rand() - 0.5) * 0.1
      })).sort((a, b) => b.weight - a.weight);

      const tryFill = (list) => {
        for (const entry of list) {
          if (Date.now() - startTime > maxGenerateTimeMs) break;
          if (blocks.length >= targetCount) break;
          const cell = entry.cell;
          if (cell.occupied) continue;
          const neighbors = this.getUnoccupiedNeighbors(grid, cell);
          if (neighbors.length === 0) continue;

          const neighborScore = (n) => {
            const axis = n.row !== cell.row ? 'row' : 'col';
            return weightOf(n) + axisBias(axis) * axisBalanceWeight + (rand() - 0.5) * 0.05;
          };
          neighbors.sort((a, b) => neighborScore(b) - neighborScore(a));
          const neighbor = neighbors[0];
          const axis = neighbor.row !== cell.row ? 'row' : 'col';
          const block = this.createBlockFromCells(cell, neighbor, axis, shortSide, DIRECTIONS.UP, blocks.length, grid, maxDist);
          blocks.push(block);
          this.occupyBlockCells(grid, block);
          axisCounts[axis] += 1;
        }
      };

      tryFill(ordered);

      if (blocks.length < targetCount) {
        const shuffled = [...cells];
        this.shuffleArray(shuffled, rand);
        tryFill(shuffled.map(cell => ({ cell, weight: weightOf(cell) })));
      }

      if (blocks.length > bestBlocks.length) {
        bestBlocks = blocks;
      }

      if (blocks.length >= targetCount) {
        return blocks;
      }
    }

    this.resetGridOccupancy(grid);
    for (const block of bestBlocks) {
      this.occupyBlockCells(grid, block);
    }

    return bestBlocks;
  }

  static getUnoccupiedNeighbors(grid, cell) {
    const neighbors = [];
    const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dr, dc] of offsets) {
      const neighbor = grid.getCell(cell.row + dr, cell.col + dc);
      if (!neighbor || neighbor.occupied) continue;
      neighbors.push(neighbor);
    }
    return neighbors;
  }

  static createBlockFromCells(cellA, cellB, axis, shortSide, direction, index, grid, maxDist) {
    const gridRow = axis === 'row' ? Math.min(cellA.row, cellB.row) : cellA.row;
    const gridCol = axis === 'col' ? Math.min(cellA.col, cellB.col) : cellA.col;
    const centerX = (cellA.x + cellB.x) / 2;
    const centerY = (cellA.y + cellB.y) / 2;
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const dx = centerX - grid.centerX;
    const dy = centerY - grid.centerY;
    const distNorm = maxDist > 0 ? Math.min(1, Math.sqrt(dx * dx + dy * dy) / maxDist) : 0;
    return {
      _id: index,
      x: centerX - bw / 2,
      y: centerY - bh / 2,
      width: bw,
      height: bh,
      direction,
      axis,
      gridRow,
      gridCol,
      type: null,
      size: shortSide,
      depth: 0,
      _distNorm: distNorm
    };
  }

  static applyBlockDirection(block, direction, shortSide) {
    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    block.direction = direction;
    block.width = bw;
    block.height = bh;
    block.x = cx - bw / 2;
    block.y = cy - bh / 2;
  }

  static peelAssignDirections(grid, blocks, params, rand, shortSide, startTime, maxGenerateTimeMs) {
    const total = blocks.length;
    const targetMix = (params && params.directionMixTarget) || { up: 0.25, right: 0.25, down: 0.25, left: 0.25 };
    const targetCounts = {
      [DIRECTIONS.UP]: targetMix.up * total,
      [DIRECTIONS.RIGHT]: targetMix.right * total,
      [DIRECTIONS.DOWN]: targetMix.down * total,
      [DIRECTIONS.LEFT]: targetMix.left * total
    };
    const counts = { [DIRECTIONS.UP]: 0, [DIRECTIONS.RIGHT]: 0, [DIRECTIONS.DOWN]: 0, [DIRECTIONS.LEFT]: 0 };
    const remaining = new Set(blocks);
    const order = [];
    const depthBias = Number.isFinite(params.depthFactor) ? params.depthFactor : 0.6;
    const localGrid = Number.isFinite(params && params.localDirectionGrid) ? params.localDirectionGrid : 3;
    const localWeight = Number.isFinite(params && params.localDirectionWeight) ? params.localDirectionWeight : 0.2;
    const lineWeight = Number.isFinite(params && params.lineDirectionWeight) ? params.lineDirectionWeight : 0.2;
    const rect = grid.safeBoardRect;
    const sectorCounts = new Map();
    const lineCounts = new Map();
    const getSectorKey = (block) => {
      if (!rect || rect.width <= 0 || rect.height <= 0 || localGrid <= 1) return '0,0';
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const col = Math.min(localGrid - 1, Math.max(0, Math.floor(((cx - rect.x) / rect.width) * localGrid)));
      const row = Math.min(localGrid - 1, Math.max(0, Math.floor(((cy - rect.y) / rect.height) * localGrid)));
      return `${row},${col}`;
    };
    const getSectorStats = (key) => {
      if (!sectorCounts.has(key)) {
        sectorCounts.set(key, {
          total: 0,
          [DIRECTIONS.UP]: 0,
          [DIRECTIONS.RIGHT]: 0,
          [DIRECTIONS.DOWN]: 0,
          [DIRECTIONS.LEFT]: 0
        });
      }
      return sectorCounts.get(key);
    };
    const getLineKey = (block) => {
      if (block.axis === 'row') return `col:${block.gridCol}`;
      if (block.axis === 'col') return `row:${block.gridRow}`;
      return 'unknown';
    };
    const getLineStats = (key) => {
      if (!lineCounts.has(key)) {
        lineCounts.set(key, {
          total: 0,
          [DIRECTIONS.UP]: 0,
          [DIRECTIONS.RIGHT]: 0,
          [DIRECTIONS.DOWN]: 0,
          [DIRECTIONS.LEFT]: 0
        });
      }
      return lineCounts.get(key);
    };

    while (order.length < total) {
      if (Date.now() - startTime > maxGenerateTimeMs) return null;

      let best = null;
      for (const block of remaining) {
        const dirs = this.getAvailableDirections(grid, block);
        if (dirs.length === 0) continue;
        const sectorKey = getSectorKey(block);
        const sectorStats = getSectorStats(sectorKey);
        const lineKey = getLineKey(block);
        const lineStats = getLineStats(lineKey);
        for (const dir of dirs) {
          const deficit = targetCounts[dir] - counts[dir];
          const localTotal = sectorStats.total || 0;
          const localRatio = localTotal ? sectorStats[dir] / localTotal : 0;
          const localDeficit = localWeight ? (targetMix[dir] - localRatio) * localWeight : 0;
          const lineTotal = lineStats.total || 0;
          const lineRatio = lineTotal ? lineStats[dir] / lineTotal : 0;
          const lineDeficit = lineWeight ? (targetMix[dir] - lineRatio) * lineWeight : 0;
          const score = deficit + localDeficit + lineDeficit + block._distNorm * depthBias + (rand() - 0.5) * 0.1;
          if (!best || score > best.score) {
            best = { block, direction: dir, score, sectorKey, lineKey };
          }
        }
      }

      if (!best) return null;

      this.releaseBlock(grid, best.block);
      const sectorStats = getSectorStats(best.sectorKey);
      sectorStats.total += 1;
      sectorStats[best.direction] += 1;
      const lineStats = getLineStats(best.lineKey);
      lineStats.total += 1;
      lineStats[best.direction] += 1;
      counts[best.direction] += 1;
      order.push({ block: best.block, direction: best.direction });
      remaining.delete(best.block);
    }

    for (let i = 0; i < order.length; i++) {
      const item = order[i];
      this.applyBlockDirection(item.block, item.direction, shortSide);
      item.block.depth = i;
    }

    return { order };
  }

  static getAvailableDirections(grid, block) {
    const dirs = [];
    if (block.axis === 'row') {
      if (this.isPathClearToEdgeForDirection(grid, block, DIRECTIONS.UP)) dirs.push(DIRECTIONS.UP);
      if (this.isPathClearToEdgeForDirection(grid, block, DIRECTIONS.DOWN)) dirs.push(DIRECTIONS.DOWN);
    } else if (block.axis === 'col') {
      if (this.isPathClearToEdgeForDirection(grid, block, DIRECTIONS.LEFT)) dirs.push(DIRECTIONS.LEFT);
      if (this.isPathClearToEdgeForDirection(grid, block, DIRECTIONS.RIGHT)) dirs.push(DIRECTIONS.RIGHT);
    }
    return dirs;
  }

  static releaseBlock(grid, block) {
    const cells = this.getBlockCells(block);
    if (!cells) return;
    for (const c of cells) {
      const cell = grid.getCell(c.row, c.col);
      if (cell) {
        cell.occupied = false;
        cell.blockId = null;
      }
    }
  }

  static occupyBlockCells(grid, block) {
    const cells = this.getBlockCells(block);
    if (!cells) return;
    for (const c of cells) {
      const cell = grid.getCell(c.row, c.col);
      if (cell) {
        cell.occupied = true;
        cell.blockId = block._id;
      }
    }
  }

  static resetGridOccupancy(grid) {
    for (const cell of grid.cells.values()) {
      cell.occupied = false;
      cell.blockId = null;
    }
  }

  static isPathClearToEdgeForDirection(grid, block, direction) {
    if (!Number.isFinite(block.gridRow) || !Number.isFinite(block.gridCol)) return false;
    if (!block.axis) return false;

    if (block.axis === 'row') {
      if (direction === DIRECTIONS.UP) {
        let row = block.gridRow - 1;
        while (true) {
          const cell = grid.getCell(row, block.gridCol);
          if (!cell) return true;
          if (cell.occupied) return false;
          row -= 1;
        }
      }
      if (direction === DIRECTIONS.DOWN) {
        let row = block.gridRow + 2;
        while (true) {
          const cell = grid.getCell(row, block.gridCol);
          if (!cell) return true;
          if (cell.occupied) return false;
          row += 1;
        }
      }
    }

    if (block.axis === 'col') {
      if (direction === DIRECTIONS.LEFT) {
        let col = block.gridCol - 1;
        while (true) {
          const cell = grid.getCell(block.gridRow, col);
          if (!cell) return true;
          if (cell.occupied) return false;
          col -= 1;
        }
      }
      if (direction === DIRECTIONS.RIGHT) {
        let col = block.gridCol + 2;
        while (true) {
          const cell = grid.getCell(block.gridRow, col);
          if (!cell) return true;
          if (cell.occupied) return false;
          col += 1;
        }
      }
    }

    return false;
  }

  /**
   * 尝试插入一个方块
   * 
   * @param {Object} grid - 网格系统
   * @param {Array} existingBlocks - 已放置的方块
   * @param {Function} rand - 随机数生成器
   * @param {number} depthFactor - 深度因子 (0=浅层, 1=深层)
   * @param {number} shortSide - 方块短边尺寸
   */
  static tryInsertBlock(grid, existingBlocks, rand, depthFactor, shortSide, screenWidth, screenHeight, layoutProfile, params) {
    // 选择入射点策略
    const preferGap = rand() < depthFactor; // 深层插入时更倾向于选择缝隙
    
    // 尝试找到有效的入射点
    const maxTries = 50;
    for (let i = 0; i < maxTries; i++) {
      const entry = this.selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor, layoutProfile, params);
      if (!entry) continue;

      // 执行滑入模拟
      const slideResult = this.simulateSlide(
        grid,
        entry,
        existingBlocks,
        shortSide,
        screenWidth,
        screenHeight
      );

      if (slideResult && slideResult.valid) {
        // 创建方块并验证其在当前状态下可立即出界（确保逆序可解）
        const block = this.createBlockFromSlide(slideResult, shortSide, existingBlocks.length);
        if (!this.isPathClearToEdge(grid, block)) {
          continue;
        }
        return { block, slideResult };
      }
    }

    return null;
  }

  /**
   * 选择入射点
   * 
   * @param {Object} grid - 网格系统
   * @param {Function} rand - 随机数生成器
   * @param {boolean} preferGap - 是否优先选择缝隙
   * @param {Array} existingBlocks - 已有方块
   * @param {number} depthFactor - 深度因子，影响方向选择
   */
  static selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor = 0.5, layoutProfile = null, params = null) {
    // 获取所有可用的边界单元
    const useEdgeEntries = !params || params.useEdgeEntries !== false;
    const boundarySource = useEdgeEntries && grid.edgeCells ? grid.edgeCells : grid.boundaryCells;
    const availableBoundary = boundarySource.filter(cell => !cell.occupied);
    if (availableBoundary.length === 0) return null;

    // 选择一个边界单元
    let selectedCell;
    if (preferGap && existingBlocks.length > 0) {
      // 深层插入：优先选择靠近已有方块的边界
      const scored = availableBoundary.map(cell => {
        let minDist = Infinity;
        for (const block of existingBlocks) {
          const dx = cell.x - (block.x + block.width / 2);
          const dy = cell.y - (block.y + block.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }
        const layoutWeight = layoutProfile ? layoutProfile.weight(cell) : 1;
        return { cell, score: (-minDist + rand() * 30) * layoutWeight }; // 越近分数越高，加布局权重
      });
      scored.sort((a, b) => b.score - a.score);
      // 从前几个高分中随机选择，增加变化
      const topN = Math.min(5, scored.length);
      selectedCell = scored[Math.floor(rand() * topN)].cell;
    } else {
      // 浅层填充：带布局权重的随机选择
      const scored = availableBoundary.map(cell => {
        const layoutWeight = layoutProfile ? layoutProfile.weight(cell) : 1;
        return { cell, score: rand() * layoutWeight };
      });
      scored.sort((a, b) => b.score - a.score);
      const topN = Math.min(8, scored.length);
      selectedCell = scored[Math.floor(rand() * topN)].cell;
    }

    // 计算相对于中心的位置
    const dx = grid.centerX - selectedCell.x;
    const dy = grid.centerY - selectedCell.y;
    
    // ========== 关键改进：方向多样化（基于已有方向分布） ==========
    const directionBias = this.getDirectionBias(existingBlocks, params);
    const axisOptions = [];

    for (const axisCandidate of ['row', 'col']) {
      const neighborCandidate = this.findNeighborForPair(grid, selectedCell, axisCandidate);
      if (!neighborCandidate) continue;

      let preferredDirection;
      if (axisCandidate === 'row') {
        preferredDirection = selectedCell.y < grid.centerY ? DIRECTIONS.UP : DIRECTIONS.DOWN;
      } else {
        preferredDirection = selectedCell.x < grid.centerX ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
      }

      axisOptions.push({
        axis: axisCandidate,
        neighbor: neighborCandidate,
        preferredDirection,
        bias: directionBias[preferredDirection] || 0
      });
    }

    if (axisOptions.length === 0) return null;

    axisOptions.sort((a, b) => (b.bias + rand() * 0.05) - (a.bias + rand() * 0.05));
    const chosen = axisOptions[0];
    const axis = chosen.axis;
    const neighbor = chosen.neighbor;

    // ========== 固定朝外方向 + lane 冲突检测 ==========
    let direction;
    const gridRow = axis === 'row' ? Math.min(selectedCell.row, neighbor.row) : selectedCell.row;
    const gridCol = axis === 'col' ? Math.min(selectedCell.col, neighbor.col) : selectedCell.col;

    if (axis === 'row') {
      const preferredDirection = chosen.preferredDirection;
      const laneDirection = this.getLaneDirection(existingBlocks, 'row', gridCol);
      direction = laneDirection !== null ? laneDirection : preferredDirection;
    } else {
      const preferredDirection = chosen.preferredDirection;
      const laneDirection = this.getLaneDirection(existingBlocks, 'col', gridRow);
      direction = laneDirection !== null ? laneDirection : preferredDirection;
    }

    return {
      cell: selectedCell,
      neighbor,
      direction,
      axis
    };
  }

  static isPathClearToEdge(grid, block) {
    if (!block || block.direction === undefined || block.direction === null) return false;
    return this.isPathClearToEdgeForDirection(grid, block, block.direction);
  }
  
  /**
   * 获取指定 lane 中已有方块的方向
   * 用于确保同一 lane 内所有方块方向一致，避免对向死锁
   * 
   * @param {Array} blocks - 已有方块
   * @param {string} axis - 'row' 或 'col'
   * @param {number} laneIndex - lane 的索引（row轴用gridCol，col轴用gridRow）
   * @returns {number|null} 该 lane 中方块的方向，如果 lane 为空返回 null
   */
  static getLaneDirection(blocks, axis, laneIndex) {
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
  }

  /**
   * 找到配对邻居（双格方块需要两个相邻格子）
   */
  static findNeighborForPair(grid, cell, axis) {
    let neighborOffsets;
    if (axis === 'row') {
      neighborOffsets = [[1, 0], [-1, 0]]; // 上下邻居
    } else {
      neighborOffsets = [[0, 1], [0, -1]]; // 左右邻居
    }

    for (const [dr, dc] of neighborOffsets) {
      const neighborKey = `${cell.row + dr},${cell.col + dc}`;
      const neighbor = grid.cells.get(neighborKey);
      if (neighbor && !neighbor.occupied) {
        return neighbor;
      }
    }

    return null;
  }

  /**
   * 模拟方块滑入
   * 
   * 方块从入射点沿反方向滑入，直到：
   * 1. 碰到已有方块
   * 2. 到达棋盘边界
   */
  static simulateSlide(grid, entry, existingBlocks, shortSide, screenWidth, screenHeight) {
    const { cell, neighbor, direction, axis } = entry;

    // 计算方块中心位置（两个格子的中点）
    const blockCenterX = (cell.x + neighbor.x) / 2;
    const blockCenterY = (cell.y + neighbor.y) / 2;

    // 获取滑动方向（与朝向相反，即方块要滑向的方向）
    const slideDir = this.getOppositeDirection(direction);
    const slideDelta = this.getGridDelta(slideDir);

    // 计算起始网格位置
    let gridRow = axis === 'row' ? Math.min(cell.row, neighbor.row) : cell.row;
    let gridCol = axis === 'col' ? Math.min(cell.col, neighbor.col) : cell.col;

    // 模拟滑动
    let slideSteps = 0;
    const maxSlideSteps = 20;
    
    while (slideSteps < maxSlideSteps) {
      // 计算下一个位置
      const nextRow = gridRow + slideDelta.row;
      const nextCol = gridCol + slideDelta.col;

      // 检查下一个位置是否有效
      if (axis === 'row') {
        // row 轴方块占据 (gridRow, gridCol) 和 (gridRow+1, gridCol)
        // 滑动时检查 (nextRow, nextCol) 和 (nextRow+1, nextCol)
        const cell1 = grid.getCell(nextRow, nextCol);
        const cell2 = grid.getCell(nextRow + 1, nextCol);
        
        if (!cell1 || !cell2 || cell1.occupied || cell2.occupied) {
          // 碰到障碍或边界，停在当前位置
          break;
        }
      } else {
        // col 轴方块占据 (gridRow, gridCol) 和 (gridRow, gridCol+1)
        const cell1 = grid.getCell(nextRow, nextCol);
        const cell2 = grid.getCell(nextRow, nextCol + 1);
        
        if (!cell1 || !cell2 || cell1.occupied || cell2.occupied) {
          break;
        }
      }

      // 移动到下一个位置
      gridRow = nextRow;
      gridCol = nextCol;
      slideSteps++;
    }

    // 检查最终位置是否有效
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

    // 计算最终像素位置
    const finalCenterX = (cell1Valid.x + cell2Valid.x) / 2;
    const finalCenterY = (cell1Valid.y + cell2Valid.y) / 2;

    const { width: bw, height: bh } = this.getBlockDimensions(direction, shortSide);
    const finalX = finalCenterX - bw / 2;
    const finalY = finalCenterY - bh / 2;

    // 检查是否在安全区域内
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
  }

  /**
   * 根据滑动结果创建方块
   */
  static createBlockFromSlide(slideResult, shortSide, index) {
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
      type: null, // 稍后分配
      size: shortSide,
      depth: slideResult.slideSteps // 滑动步数代表"深度"
    };
  }

  /**
   * 分配动物类型
   * 考虑深度均衡：同类型方块的深度差不应过大
   */
  static assignAnimalTypes(blocks, generationOrder, animalTypeCount, rand) {
    const usedTypes = MAIN_ANIMAL_TYPES.slice(0, animalTypeCount);
    
    // 按生成顺序分配（早生成=深层=后消除）
    // 简单策略：打乱后均匀分配，但保证每种类型在各深度层都有分布
    
    // 将方块按深度分组
    const depthGroups = new Map();
    for (const block of blocks) {
      const depth = block.depth || 0;
      if (!depthGroups.has(depth)) {
        depthGroups.set(depth, []);
      }
      depthGroups.get(depth).push(block);
    }

    // 在每个深度组内分配类型
    let typeIndex = 0;
    for (const [depth, group] of depthGroups) {
      this.shuffleArray(group, rand);
      for (const block of group) {
        block.type = usedTypes[typeIndex % usedTypes.length];
        typeIndex++;
      }
    }
  }

  /**
   * 获取方块尺寸
   */
  static getBlockDimensions(direction, shortSide) {
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
  }

  /**
   * 方向对应的旋转角
   */
  static getDirectionAngle(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return -Math.PI / 4;
      case DIRECTIONS.RIGHT: return Math.PI / 4;
      case DIRECTIONS.DOWN:  return (3 * Math.PI) / 4;
      case DIRECTIONS.LEFT:  return (-3 * Math.PI) / 4;
      default:               return -Math.PI / 4;
    }
  }

  /**
   * 获取反向
   */
  static getOppositeDirection(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return DIRECTIONS.DOWN;
      case DIRECTIONS.DOWN:  return DIRECTIONS.UP;
      case DIRECTIONS.LEFT:  return DIRECTIONS.RIGHT;
      case DIRECTIONS.RIGHT: return DIRECTIONS.LEFT;
      default:               return DIRECTIONS.DOWN;
    }
  }

  /**
   * 获取网格移动增量
   */
  static getGridDelta(direction) {
    switch (direction) {
      case DIRECTIONS.UP:    return { row: -1, col: 0 };
      case DIRECTIONS.DOWN:  return { row: 1, col: 0 };
      case DIRECTIONS.LEFT:  return { row: 0, col: -1 };
      case DIRECTIONS.RIGHT: return { row: 0, col: 1 };
      default:               return { row: 0, col: 0 };
    }
  }

  /**
   * 检查是否在安全区域内
   */
  static isInsideSafeRect(x, y, width, height, safeRect) {
    return x >= safeRect.x &&
      x + width <= safeRect.x + safeRect.width &&
      y >= safeRect.y &&
      y + height <= safeRect.y + safeRect.height;
  }

  /**
   * 获取难度参数
   * 
   * 核心参数:
   * - blockCount: 方块数量
   * - depthFactor: 深度因子 (0=扁平结构, 1=深层结构)
   * - blockSize: 方块尺寸
   */
  static getDifficultyParams(level) {
    // Level 1: 极简教学
    if (level === 1) {
      return {
        phaseName: '教学关',
        blockCount: 6,
        blockSize: 28,        // 1.5x 放大
        depthFactor: 0.05,    // 极低深度
        animalTypes: 3,
        scale: 1.5,
        targetDifficulty: 10,
        targetDifficultyTolerance: 4,
        depthTargetRange: [0, 1.8],
        removableRatioTarget: [0.6, 1.0],
        maxDirectionRatio: 0.9,
        maxLocalDirectionRatio: 0.9,
        maxLineDirectionRatio: 0.9,
        localDirectionGrid: 2,
        localDirectionWeight: 0.1,
        axisBalanceWeight: 0.2,
        lineDirectionWeight: 0.15,
        lineDirectionMinCount: 2,
        directionMixTarget: { up: 0.3, right: 0.25, down: 0.25, left: 0.2 },
        layoutProfiles: ['uniform', 'centerHollow'],
        maxGenerateAttempts: 3
      };
    }

    // Level 2: 难度陡增 (The Spike)
    if (level === 2) {
      return {
        phaseName: '难度飙升',
        blockCount: 120,
        blockSize: 16,
        depthFactor: 0.9,     // 高深度 → 强依赖
        animalTypes: 4,
        scale: 1.0,
        showWarning: true,    // 显示警告
        targetDifficulty: 80,
        targetDifficultyTolerance: 8,
        depthTargetRange: [4.5, 7.5],
        removableRatioTarget: [0.08, 0.22],
        maxDirectionRatio: 0.7,
        maxLocalDirectionRatio: 0.65,
        maxLineDirectionRatio: 0.7,
        localDirectionGrid: 3,
        localDirectionWeight: 0.35,
        axisBalanceWeight: 0.35,
        lineDirectionWeight: 0.45,
        lineDirectionMinCount: 3,
        directionMixTarget: { up: 0.25, right: 0.25, down: 0.25, left: 0.25 },
        layoutProfiles: ['ring', 'diagonalBand', 'twoLumps', 'centerHollow'],
        maxGenerateAttempts: 3,
        maxGenerateTimeMs: 2000,
        useEdgeEntries: true,
        targetFillRate: 0.85,
        forceFillRate: true
      };
    }

    // Level 3+: 线性递增（从 Level 2 的难度起步，持续递增）
    const progress = Math.min(1, (level - 3) / 50); // 50关达到最大难度
    
    // 方块数量: 120 -> 190
    const blockCount = Math.round(120 + progress * 70);
    
    // 深度因子: 0.90 -> 0.95
    const depthFactor = 0.9 + progress * 0.05;
    
    // 动物种类数: 4 -> 5
    const animalTypes = level < 10 ? 4 : 5;

    // 锯齿波动：每5关一个周期，第5关略微休息
    const cyclePosition = (level - 1) % 5;
    const isReliefLevel = cyclePosition === 4;
    
    // 调整幅度减小，避免休息关难度下降太多
    const blockCountAdjust = isReliefLevel ? -10 : cyclePosition * 3;
    const depthAdjust = isReliefLevel ? -0.05 : cyclePosition * 0.01;

    const targetDifficulty = 80 + (level - 2) * 2;
    const avgDepthTarget = 5.0 + progress * 2.6;
    const removableTargetBase = Math.max(0.1, 0.2 - progress * 0.08);
    const targetFillRate = Math.min(0.9, 0.83 + progress * 0.05);

    return {
      phaseName: level <= 10 ? '成长期' : level <= 30 ? '挑战期' : level <= 60 ? '大师期' : '传奇期',
      blockCount: Math.max(120, Math.min(200, blockCount + blockCountAdjust)),
      blockSize: 16,
      depthFactor: Math.max(0.85, Math.min(0.95, depthFactor + depthAdjust)),
      animalTypes,
      scale: 1.0,
      isReliefLevel,
      targetDifficulty,
      targetDifficultyTolerance: 6,
      depthTargetRange: [avgDepthTarget - 1.2, avgDepthTarget + 1.2],
      removableRatioTarget: [Math.max(0.06, removableTargetBase - 0.05), Math.min(0.28, removableTargetBase + 0.05)],
      maxDirectionRatio: 0.7,
      maxLocalDirectionRatio: 0.6,
      maxLineDirectionRatio: 0.65,
      localDirectionGrid: 4,
      localDirectionWeight: 0.5,
      axisBalanceWeight: 0.35,
      lineDirectionWeight: 0.5,
      lineDirectionMinCount: 3,
      directionMixTarget: { up: 0.25, right: 0.25, down: 0.25, left: 0.25 },
      layoutProfiles: ['ring', 'diagonalBand', 'twoLumps', 'centerHollow', 'uniform'],
      maxGenerateAttempts: 6,
      maxGenerateTimeMs: 2500,
      useEdgeEntries: true,
      targetFillRate
    };
  }

  /**
   * 线性插值
   */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }
}

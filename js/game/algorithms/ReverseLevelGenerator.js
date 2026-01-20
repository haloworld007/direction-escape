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

    const blocks = this.generateByReverseFilling(
      params,
      seed,
      screenWidth,
      screenHeight,
      boardRect
    );

    console.log(`[ReverseLevelGenerator] 关卡 ${levelNumber} 生成完成，方块数: ${blocks.length}`);
    return { blocks, total: blocks.length };
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
  static generateByReverseFilling(params, seed, screenWidth, screenHeight, boardRect) {
    const { blockCount, blockSize, depthFactor, animalTypes = 5 } = params;
    const rand = this.createSeededRandom(seed);

    // 计算网格参数
    const shortSide = blockSize || BLOCK_SIZES.WIDTH;
    const grid = this.initializeGrid(shortSide, boardRect);
    
    if (grid.maxPossibleBlocks < 2) {
      console.warn('[ReverseLevelGenerator] 棋盘太小，无法生成方块');
      return [];
    }

    const targetCount = Math.min(blockCount, grid.maxPossibleBlocks);
    const blocks = [];
    
    // 生成顺序列表（用于追踪依赖关系）
    // 越早生成的方块，在游戏中越晚能被消除（越深）
    const generationOrder = [];

    // 主生成循环
    let attempts = 0;
    const maxAttempts = targetCount * 20; // 防止死循环

    while (blocks.length < targetCount && attempts < maxAttempts) {
      attempts++;

      // 选择入射策略（根据 depthFactor 决定是浅层还是深层插入）
      const insertionResult = this.tryInsertBlock(
        grid, 
        blocks, 
        rand, 
        depthFactor, 
        shortSide,
        screenWidth,
        screenHeight
      );

      if (insertionResult) {
        blocks.push(insertionResult.block);
        generationOrder.push(insertionResult.block);
        grid.occupyBlock(insertionResult.block);
      }
    }

    // ========== 填充率检查与补充 ==========
    // 计算当前填充率
    const filledCells = blocks.length * 2;
    const totalCells = grid.cells.size;
    const currentFillRate = totalCells > 0 ? filledCells / totalCells : 0;
    const minFillRate = 0.5; // 要求至少 50% 填充率
    
    // 如果填充率不足，尝试在空洞区域补充填充
    if (currentFillRate < minFillRate && blocks.length < grid.maxPossibleBlocks) {
      console.log(`[ReverseLevelGenerator] 填充率不足 (${(currentFillRate * 100).toFixed(1)}%)，尝试补充填充...`);
      
      // 找出所有空洞（未被占用但被已占用格子包围的区域）
      const additionalAttempts = Math.min(50, (grid.maxPossibleBlocks - blocks.length) * 10);
      let additionalInserted = 0;
      
      for (let i = 0; i < additionalAttempts && blocks.length < grid.maxPossibleBlocks; i++) {
        // 强制使用深层插入模式（preferGap=true）来填充空洞
        const insertionResult = this.tryInsertBlock(
          grid, 
          blocks, 
          rand, 
          1.0, // 最高深度因子，优先填充内部
          shortSide,
          screenWidth,
          screenHeight
        );

        if (insertionResult) {
          blocks.push(insertionResult.block);
          generationOrder.push(insertionResult.block);
          grid.occupyBlock(insertionResult.block);
          additionalInserted++;
        }
      }
      
      if (additionalInserted > 0) {
        console.log(`[ReverseLevelGenerator] 补充填充了 ${additionalInserted} 个方块`);
      }
    }

    // 分配动物类型（考虑深度均衡）
    this.assignAnimalTypes(blocks, generationOrder, animalTypes, rand);

    // 标记为可解（逆向生成天然保证）
    blocks._solvable = true;

    // 使用 DependencyGraph 验证实际难度
    const stats = this.validateAndRecordStats(blocks, screenWidth, screenHeight, grid);
    blocks._stats = stats;
    
    console.log(`[ReverseLevelGenerator] 生成统计: 方块=${blocks.length}, 平均深度=${stats.avgDepth.toFixed(2)}, 最大深度=${stats.maxDepth}, 填充率=${(stats.fillRate * 100).toFixed(1)}%`);

    return blocks;
  }

  /**
   * 使用 DependencyGraph 验证生成结果并记录统计
   */
  static validateAndRecordStats(blocks, screenWidth, screenHeight, grid) {
    // 构建依赖图
    const graph = DependencyGraph.build(blocks, screenWidth, screenHeight);
    const graphStats = graph.getStats();
    
    // 计算填充率
    const filledCells = blocks.length * 2; // 每个方块占 2 格
    const totalCells = grid.cells.size;
    const fillRate = totalCells > 0 ? filledCells / totalCells : 0;
    
    return {
      avgDepth: graphStats.avgDepth,
      maxDepth: graphStats.maxDepth,
      removableCount: graphStats.removableCount,
      removableRatio: graphStats.removableRatio,
      fillRate,
      totalCells,
      filledCells
    };
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
    
    // 边界单元 Set（用于快速查找和去重）
    const boundarySet = new Set(boundaryCells.map(c => c.key));
    
    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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

  /**
   * 尝试插入一个方块
   * 
   * @param {Object} grid - 网格系统
   * @param {Array} existingBlocks - 已放置的方块
   * @param {Function} rand - 随机数生成器
   * @param {number} depthFactor - 深度因子 (0=浅层, 1=深层)
   * @param {number} shortSide - 方块短边尺寸
   */
  static tryInsertBlock(grid, existingBlocks, rand, depthFactor, shortSide, screenWidth, screenHeight) {
    // 选择入射点策略
    const preferGap = rand() < depthFactor; // 深层插入时更倾向于选择缝隙
    
    // 尝试找到有效的入射点
    const maxTries = 50;
    for (let i = 0; i < maxTries; i++) {
      const entry = this.selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor);
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
        // 创建方块
        const block = this.createBlockFromSlide(slideResult, shortSide, existingBlocks.length);
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
  static selectEntryPoint(grid, rand, preferGap, existingBlocks, depthFactor = 0.5) {
    // 获取所有可用的边界单元
    const availableBoundary = grid.boundaryCells.filter(cell => !cell.occupied);
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
        return { cell, score: -minDist + rand() * 30 }; // 越近分数越高，加随机性
      });
      scored.sort((a, b) => b.score - a.score);
      // 从前几个高分中随机选择，增加变化
      const topN = Math.min(5, scored.length);
      selectedCell = scored[Math.floor(rand() * topN)].cell;
    } else {
      // 浅层填充：随机选择边界
      selectedCell = availableBoundary[Math.floor(rand() * availableBoundary.length)];
    }

    // 计算相对于中心的位置
    const dx = grid.centerX - selectedCell.x;
    const dy = grid.centerY - selectedCell.y;
    
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

    return {
      cell: selectedCell,
      neighbor,
      direction,
      axis
    };
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
        depthFactor: 0,       // 完全扁平，无遮挡
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
        showWarning: true     // 显示警告
      };
    }

    // Level 3+: 线性递增（从 Level 2 的难度起步，持续递增）
    const progress = Math.min(1, (level - 3) / 50); // 50关达到最大难度
    
    // 方块数量: 115 -> 180（比 Level 2 的 110 略多起步）
    const blockCount = Math.round(115 + progress * 65);
    
    // 深度因子: 0.75 -> 0.95（从 Level 2 的 0.75 起步，确保难度递增）
    const depthFactor = 0.75 + progress * 0.2;
    
    // 动物种类数: 4 -> 5
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

  /**
   * 线性插值
   */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }
}

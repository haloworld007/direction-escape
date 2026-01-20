/**
 * 依赖图工具类 (Dependency Graph)
 * 
 * 将关卡建模为有向图 G = (V, E):
 * - 节点 V: 每个方块
 * - 边 E: A -> B 表示 "A 挡住 B"（必须先消 A 才能消 B）
 * 
 * 提供图论分析工具:
 * - 环检测 (Cycle Detection): 检测死锁
 * - 深度计算 (Depth Calculation): 评估难度
 * - 拓扑排序 (Topological Sort): 获取最优消除路径
 * - 安全步骤分析 (Safe Moves): 找出不会导致死锁的消除选择
 */
import DirectionDetector from './DirectionDetector';

export default class DependencyGraph {
  /**
   * 构建依赖图
   * 
   * @param {Array} blocks - 方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {Object} 依赖图对象
   */
  static build(blocks, screenWidth, screenHeight) {
    const n = blocks.length;
    if (n === 0) {
      return this.createEmptyGraph();
    }

    // 为每个方块分配唯一 ID（如果没有）
    const nodeMap = new Map();
    blocks.forEach((block, index) => {
      const id = block._id !== undefined ? block._id : index;
      nodeMap.set(id, {
        id,
        block,
        index,
        blockedBy: [],    // 阻挡当前方块的其他方块
        blocking: [],     // 当前方块阻挡的其他方块
        inDegree: 0,      // 入度（被多少方块阻挡）
        outDegree: 0,     // 出度（阻挡多少方块）
        depth: -1,        // 消除深度（需要先消除多少层才能消除此方块）
        isRemovable: false // 当前是否可消除
      });
    });

    // 构建边（阻挡关系）
    // 对于每个方块 B，找出所有阻挡它的方块 A
    for (let i = 0; i < n; i++) {
      const blockB = blocks[i];
      const idB = blockB._id !== undefined ? blockB._id : i;
      const nodeB = nodeMap.get(idB);

      // 获取阻挡 blockB 的方块
      const blockersInfo = this.findBlockers(blockB, blocks, screenWidth, screenHeight);
      
      for (const blockerIndex of blockersInfo.blockerIndices) {
        const blockA = blocks[blockerIndex];
        const idA = blockA._id !== undefined ? blockA._id : blockerIndex;
        const nodeA = nodeMap.get(idA);

        // A -> B (A 挡住 B)
        if (!nodeA.blocking.includes(idB)) {
          nodeA.blocking.push(idB);
          nodeA.outDegree++;
        }
        if (!nodeB.blockedBy.includes(idA)) {
          nodeB.blockedBy.push(idA);
          nodeB.inDegree++;
        }
      }

      // 检查当前是否可消除
      nodeB.isRemovable = blockersInfo.blockerIndices.length === 0;
    }

    // 计算深度
    this.calculateDepths(nodeMap);

    // 构建图对象
    const graph = {
      nodes: nodeMap,
      blocks,
      screenWidth,
      screenHeight,
      size: n,
      
      // 便捷方法
      getNode(id) {
        return nodeMap.get(id);
      },
      
      getNodeByIndex(index) {
        const block = blocks[index];
        if (!block) return null;
        const id = block._id !== undefined ? block._id : index;
        return nodeMap.get(id);
      },
      
      // 获取所有可消除的节点
      getRemovableNodes() {
        const removable = [];
        for (const [id, node] of nodeMap) {
          if (node.isRemovable && !node.block.isRemoved) {
            removable.push(node);
          }
        }
        return removable;
      },
      
      // 获取统计信息
      getStats() {
        let maxDepth = 0;
        let totalDepth = 0;
        let removableCount = 0;
        let validCount = 0;
        
        for (const [id, node] of nodeMap) {
          if (node.depth >= 0) {
            maxDepth = Math.max(maxDepth, node.depth);
            totalDepth += node.depth;
            validCount++;
          }
          if (node.isRemovable) {
            removableCount++;
          }
        }
        
        return {
          nodeCount: n,
          maxDepth,
          avgDepth: validCount > 0 ? totalDepth / validCount : 0,
          removableCount,
          removableRatio: n > 0 ? removableCount / n : 0
        };
      }
    };

    return graph;
  }

  /**
   * 创建空图
   */
  static createEmptyGraph() {
    return {
      nodes: new Map(),
      blocks: [],
      screenWidth: 0,
      screenHeight: 0,
      size: 0,
      getNode() { return null; },
      getNodeByIndex() { return null; },
      getRemovableNodes() { return []; },
      getStats() {
        return {
          nodeCount: 0,
          maxDepth: 0,
          avgDepth: 0,
          removableCount: 0,
          removableRatio: 0
        };
      }
    };
  }

  /**
   * 找出阻挡指定方块的所有方块
   * 
   * @param {Object} targetBlock - 目标方块
   * @param {Array} allBlocks - 所有方块
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {Object} { isBlocked: boolean, blockerIndices: number[] }
   */
  static findBlockers(targetBlock, allBlocks, screenWidth, screenHeight) {
    if (targetBlock.isRemoved) {
      return { isBlocked: false, blockerIndices: [] };
    }

    const blockerIndices = [];

    // 使用射线检测找出阻挡方块
    // 首先检查是否被阻挡
    const isBlocked = DirectionDetector.isBlocked(
      targetBlock, 
      allBlocks, 
      screenWidth, 
      screenHeight, 
      { debug: false }
    );

    if (!isBlocked) {
      return { isBlocked: false, blockerIndices: [] };
    }

    // 找出具体的阻挡者
    // 使用射线方向逐个检测
    const blockingInfo = DirectionDetector.getFirstBlockingInfo(
      targetBlock, 
      allBlocks, 
      screenWidth, 
      screenHeight
    );

    if (blockingInfo && blockingInfo.block) {
      const blockerIndex = allBlocks.indexOf(blockingInfo.block);
      if (blockerIndex !== -1) {
        blockerIndices.push(blockerIndex);
      }
    }

    // 如果使用网格检测，获取更完整的阻挡信息
    const gridInfo = DirectionDetector.getGridBlockingSteps(targetBlock, allBlocks);
    if (gridInfo && gridInfo.hasBlock) {
      // 遍历同一 lane 上的方块，找出阻挡者
      for (let i = 0; i < allBlocks.length; i++) {
        const other = allBlocks[i];
        if (other === targetBlock || other.isRemoved) continue;
        
        if (this.isDirectBlocker(targetBlock, other)) {
          if (!blockerIndices.includes(i)) {
            blockerIndices.push(i);
          }
        }
      }
    }

    return { isBlocked: true, blockerIndices };
  }

  /**
   * 检查 other 是否直接阻挡 target
   */
  static isDirectBlocker(target, other) {
    // 检查是否在同一 lane 上且在 target 的前方
    if (target.axis !== other.axis) return false;
    
    if (target.axis === 'row') {
      // row 轴：检查 gridCol 相同
      if (target.gridCol !== other.gridCol) return false;
      
      // 检查方向
      const delta = this.getDirectionDelta(target.direction);
      if (delta.row < 0) {
        // 向上移动：检查 other 是否在 target 上方
        return other.gridRow < target.gridRow;
      } else {
        // 向下移动：检查 other 是否在 target 下方
        return other.gridRow > target.gridRow + 1;
      }
    } else {
      // col 轴：检查 gridRow 相同
      if (target.gridRow !== other.gridRow) return false;
      
      const delta = this.getDirectionDelta(target.direction);
      if (delta.col < 0) {
        return other.gridCol < target.gridCol;
      } else {
        return other.gridCol > target.gridCol + 1;
      }
    }
  }

  /**
   * 获取方向的网格增量
   */
  static getDirectionDelta(direction) {
    // DIRECTIONS: UP=0, RIGHT=1, DOWN=2, LEFT=3
    switch (direction) {
      case 0: return { row: -1, col: 0 };  // UP
      case 1: return { row: 0, col: 1 };   // RIGHT
      case 2: return { row: 1, col: 0 };   // DOWN
      case 3: return { row: 0, col: -1 };  // LEFT
      default: return { row: 0, col: 0 };
    }
  }

  /**
   * 计算所有节点的深度（使用 BFS）
   * 深度定义：消除该方块前需要先消除多少层其他方块
   * - 深度 0：直接可消（入度为 0）
   * - 深度 N：需要先消除 N 层阻挡方块
   */
  static calculateDepths(nodeMap) {
    // BFS 层次遍历
    const queue = [];
    
    // 入度为 0 的节点深度为 0
    for (const [id, node] of nodeMap) {
      if (node.inDegree === 0) {
        node.depth = 0;
        queue.push(node);
      }
    }

    // BFS 计算深度
    while (queue.length > 0) {
      const current = queue.shift();
      
      for (const blockedId of current.blocking) {
        const blockedNode = nodeMap.get(blockedId);
        if (!blockedNode) continue;
        
        // 更新深度为 max(当前深度, 阻挡者深度 + 1)
        const newDepth = current.depth + 1;
        if (blockedNode.depth < 0 || blockedNode.depth < newDepth) {
          blockedNode.depth = newDepth;
        }
        
        // 如果这是最后一个阻挡者被处理，加入队列
        // （简化：我们直接检查是否所有阻挡者都已有深度）
        const allBlockersHaveDepth = blockedNode.blockedBy.every(blockerId => {
          const blockerNode = nodeMap.get(blockerId);
          return blockerNode && blockerNode.depth >= 0;
        });
        
        if (allBlockersHaveDepth && !queue.includes(blockedNode)) {
          queue.push(blockedNode);
        }
      }
    }

    // 处理循环依赖（如果有环，相关节点深度为 -1）
    // 将未计算深度的节点标记为特殊值
    for (const [id, node] of nodeMap) {
      if (node.depth < 0) {
        node.depth = Infinity; // 表示无法消除（死锁）
      }
    }
  }

  /**
   * 检测图中是否有环（使用 DFS）
   * 
   * @param {Object} graph - 依赖图
   * @returns {Object} { hasCycle: boolean, cycleNodes: Array }
   */
  static detectCycle(graph) {
    const { nodes } = graph;
    if (nodes.size === 0) {
      return { hasCycle: false, cycleNodes: [] };
    }

    // 状态: 0=未访问, 1=访问中, 2=已完成
    const state = new Map();
    for (const [id] of nodes) {
      state.set(id, 0);
    }

    const cycleNodes = [];
    let hasCycle = false;

    const dfs = (nodeId, path) => {
      if (hasCycle) return;
      
      state.set(nodeId, 1); // 标记为访问中
      path.push(nodeId);
      
      const node = nodes.get(nodeId);
      for (const blockedId of node.blocking) {
        const blockedState = state.get(blockedId);
        
        if (blockedState === 1) {
          // 发现环
          hasCycle = true;
          // 提取环上的节点
          const cycleStart = path.indexOf(blockedId);
          cycleNodes.push(...path.slice(cycleStart));
          return;
        }
        
        if (blockedState === 0) {
          dfs(blockedId, path);
        }
      }
      
      path.pop();
      state.set(nodeId, 2); // 标记为已完成
    };

    // 对所有未访问的节点进行 DFS
    for (const [id] of nodes) {
      if (state.get(id) === 0) {
        dfs(id, []);
        if (hasCycle) break;
      }
    }

    return { hasCycle, cycleNodes };
  }

  /**
   * 获取拓扑排序（消除顺序）
   * 
   * @param {Object} graph - 依赖图
   * @returns {Array} 拓扑排序结果（节点 ID 数组），如果有环返回 null
   */
  static topologicalSort(graph) {
    const { nodes } = graph;
    if (nodes.size === 0) return [];

    // 复制入度
    const inDegree = new Map();
    for (const [id, node] of nodes) {
      inDegree.set(id, node.inDegree);
    }

    // 入度为 0 的节点入队
    const queue = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result = [];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);
      
      const node = nodes.get(nodeId);
      for (const blockedId of node.blocking) {
        const newDegree = inDegree.get(blockedId) - 1;
        inDegree.set(blockedId, newDegree);
        
        if (newDegree === 0) {
          queue.push(blockedId);
        }
      }
    }

    // 如果结果数量不等于节点数量，说明有环
    if (result.length !== nodes.size) {
      return null;
    }

    return result;
  }

  /**
   * 获取安全的消除选择
   * "安全"意味着：消除这个方块后，剩余关卡仍然可解
   * 
   * @param {Object} graph - 依赖图
   * @param {Array} currentBlocks - 当前方块状态（用于模拟）
   * @returns {Array} 安全的节点 ID 列表
   */
  static getSafeMoves(graph, currentBlocks = null) {
    const removableNodes = graph.getRemovableNodes();
    if (removableNodes.length === 0) return [];

    const safeMoves = [];
    const blocks = currentBlocks || graph.blocks;

    for (const node of removableNodes) {
      // 模拟消除这个方块
      const simulatedBlocks = blocks.map(b => ({
        ...b,
        isRemoved: b === node.block ? true : b.isRemoved
      }));

      // 重建图检查是否仍可解
      const simulatedGraph = this.build(
        simulatedBlocks.filter(b => !b.isRemoved),
        graph.screenWidth,
        graph.screenHeight
      );

      // 检查是否有死锁
      const cycleResult = this.detectCycle(simulatedGraph);
      if (!cycleResult.hasCycle) {
        // 还需要检查是否所有剩余方块都能被消除
        const topoResult = this.topologicalSort(simulatedGraph);
        if (topoResult !== null) {
          safeMoves.push(node.id);
        }
      }
    }

    return safeMoves;
  }

  /**
   * 计算"容错率"
   * 容错率 = 安全选择数 / 可消除选择数
   * 
   * @param {Object} graph - 依赖图
   * @returns {Object} { safeCount, removableCount, toleranceRate }
   */
  static calculateToleranceRate(graph) {
    const removableNodes = graph.getRemovableNodes();
    const removableCount = removableNodes.length;
    
    if (removableCount === 0) {
      return {
        safeCount: 0,
        removableCount: 0,
        toleranceRate: 0
      };
    }

    const safeMoves = this.getSafeMoves(graph);
    const safeCount = safeMoves.length;

    return {
      safeCount,
      removableCount,
      toleranceRate: safeCount / removableCount
    };
  }

  /**
   * 分析关卡难度指标
   * 
   * @param {Array} blocks - 方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {Object} 难度指标
   */
  static analyzeDifficulty(blocks, screenWidth, screenHeight) {
    const graph = this.build(blocks, screenWidth, screenHeight);
    const stats = graph.getStats();
    const cycleResult = this.detectCycle(graph);
    const topoResult = this.topologicalSort(graph);
    
    // 计算容错率（可能比较耗时，可选）
    let toleranceInfo = null;
    if (blocks.length <= 50) {
      // 小关卡才计算完整容错率
      toleranceInfo = this.calculateToleranceRate(graph);
    }

    // 计算深度分布
    const depthDistribution = new Map();
    for (const [id, node] of graph.nodes) {
      const depth = node.depth === Infinity ? 'deadlock' : node.depth;
      depthDistribution.set(depth, (depthDistribution.get(depth) || 0) + 1);
    }

    // 计算分支因子（平均出度）
    let totalOutDegree = 0;
    let nodeWithOutDegree = 0;
    for (const [id, node] of graph.nodes) {
      if (node.outDegree > 0) {
        totalOutDegree += node.outDegree;
        nodeWithOutDegree++;
      }
    }
    const avgBranchFactor = nodeWithOutDegree > 0 ? totalOutDegree / nodeWithOutDegree : 0;

    return {
      // 基础统计
      blockCount: blocks.length,
      maxDepth: stats.maxDepth,
      avgDepth: stats.avgDepth,
      removableCount: stats.removableCount,
      removableRatio: stats.removableRatio,
      
      // 图结构分析
      hasCycle: cycleResult.hasCycle,
      cycleNodes: cycleResult.cycleNodes,
      isSolvable: topoResult !== null,
      
      // 难度指标
      depthDistribution: Object.fromEntries(depthDistribution),
      avgBranchFactor,
      
      // 容错率（可选）
      toleranceRate: toleranceInfo ? toleranceInfo.toleranceRate : null,
      safeMovesCount: toleranceInfo ? toleranceInfo.safeCount : null,
      
      // 综合难度评分 (0-100)
      difficultyScore: this.calculateDifficultyScore(stats, cycleResult, avgBranchFactor)
    };
  }

  /**
   * 计算综合难度评分
   * 
   * @param {Object} stats - 图统计信息
   * @param {Object} cycleResult - 环检测结果
   * @param {number} avgBranchFactor - 平均分支因子
   * @returns {number} 0-100 的难度评分
   */
  static calculateDifficultyScore(stats, cycleResult, avgBranchFactor) {
    if (cycleResult.hasCycle) {
      return 100; // 死锁关卡最高难度
    }

    let score = 0;

    // 深度贡献 (0-40分)
    // maxDepth: 0->0分, 5->20分, 10->40分
    score += Math.min(40, stats.maxDepth * 4);

    // 平均深度贡献 (0-25分)
    // avgDepth: 0->0分, 3->15分, 5->25分
    score += Math.min(25, stats.avgDepth * 5);

    // 可消除比例贡献 (0-20分)
    // removableRatio: 1->0分, 0.5->10分, 0.1->18分, 0->20分
    score += Math.min(20, (1 - stats.removableRatio) * 20);

    // 分支复杂度贡献 (0-15分)
    // avgBranchFactor: 0->0分, 2->10分, 3->15分
    score += Math.min(15, avgBranchFactor * 5);

    return Math.round(Math.min(100, score));
  }

  /**
   * 验证关卡是否可解
   * 使用图论方法验证，比蒙特卡洛更可靠
   * 
   * @param {Array} blocks - 方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {Object} { isSolvable: boolean, reason: string }
   */
  static validateSolvability(blocks, screenWidth, screenHeight) {
    if (blocks.length === 0) {
      return { isSolvable: true, reason: 'empty' };
    }

    const graph = this.build(blocks, screenWidth, screenHeight);
    
    // 检查是否有环
    const cycleResult = this.detectCycle(graph);
    if (cycleResult.hasCycle) {
      return { 
        isSolvable: false, 
        reason: 'cycle', 
        cycleNodes: cycleResult.cycleNodes 
      };
    }

    // 检查是否能完成拓扑排序
    const topoResult = this.topologicalSort(graph);
    if (topoResult === null) {
      return { 
        isSolvable: false, 
        reason: 'no_topological_order' 
      };
    }

    // 检查初始状态是否有可消除的方块
    const removableNodes = graph.getRemovableNodes();
    if (removableNodes.length === 0) {
      return { 
        isSolvable: false, 
        reason: 'no_initial_removable' 
      };
    }

    return { 
      isSolvable: true, 
      reason: 'valid',
      solutionOrder: topoResult
    };
  }

  /**
   * 获取提示（下一步最优消除）
   * 
   * @param {Object} graph - 依赖图
   * @returns {Object|null} 推荐消除的方块节点，或 null
   */
  static getHint(graph) {
    const safeMoves = this.getSafeMoves(graph);
    
    if (safeMoves.length === 0) {
      // 没有安全步骤，返回任意可消除的
      const removable = graph.getRemovableNodes();
      return removable.length > 0 ? removable[0] : null;
    }

    // 优先选择深度最浅的（最外层）
    let bestNode = null;
    let minDepth = Infinity;
    
    for (const nodeId of safeMoves) {
      const node = graph.getNode(nodeId);
      if (node && node.depth < minDepth) {
        minDepth = node.depth;
        bestNode = node;
      }
    }

    return bestNode;
  }

  /**
   * 获取完整的解题路径
   * 
   * @param {Array} blocks - 方块数组
   * @param {number} screenWidth - 屏幕宽度
   * @param {number} screenHeight - 屏幕高度
   * @returns {Array|null} 消除顺序（方块索引数组），如果无解返回 null
   */
  static getSolutionPath(blocks, screenWidth, screenHeight) {
    const graph = this.build(blocks, screenWidth, screenHeight);
    const topoResult = this.topologicalSort(graph);
    
    if (topoResult === null) {
      return null;
    }

    // 将节点 ID 转换为方块索引
    return topoResult.map(nodeId => {
      const node = graph.getNode(nodeId);
      return node ? node.index : -1;
    }).filter(idx => idx >= 0);
  }

  /**
   * 更新图状态（消除一个方块后）
   * 
   * @param {Object} graph - 依赖图
   * @param {number} removedBlockId - 被消除的方块 ID
   * @returns {Object} 更新后的图
   */
  static updateAfterRemoval(graph, removedBlockId) {
    const removedNode = graph.getNode(removedBlockId);
    if (!removedNode) return graph;

    // 标记为已消除
    removedNode.block.isRemoved = true;

    // 更新所有被它阻挡的方块的入度
    for (const blockedId of removedNode.blocking) {
      const blockedNode = graph.getNode(blockedId);
      if (blockedNode) {
        blockedNode.inDegree--;
        blockedNode.blockedBy = blockedNode.blockedBy.filter(id => id !== removedBlockId);
        
        // 如果入度变为 0，标记为可消除
        if (blockedNode.inDegree === 0) {
          blockedNode.isRemovable = true;
        }
      }
    }

    return graph;
  }
}
/**
 * 关卡管理器
 * 负责生成关卡和管理关卡数据
 * 支持 Worker 后台生成 + 分帧计算降级方案
 * 
 * 更新：仅使用 ReverseLevelGenerator（逆向填空算法）
 */
import ReverseLevelGenerator from './algorithms/ReverseLevelGenerator';
import Block from './blocks/Block';

export default class LevelManager {
  constructor() {
    // Worker 实例
    this.worker = null;
    this.workerReady = false;
    this.workerFailed = false;
    
    // 预加载缓存
    this.preloadedLevels = new Map();
    
    // 请求队列
    this.pendingRequests = new Map();
    this.requestId = 0;
    
    // 分帧计算状态
    this.timeSliceGenerators = new Map(); // 正在进行的分帧生成任务
    this.isTimeSlicing = false;
    
    // 预加载配置（一次只预加载一个关卡，避免 Worker 排队）
    this.preloadAhead = 1;
    
    // Worker 超时时间（增加到 15 秒，给复杂算法足够时间）
    this.workerTimeout = 15000;
    
    // 初始化 Worker
    this.initWorker();
  }

  /**
   * 初始化 Worker
   */
  initWorker() {
    try {
      let useExperimentalWorker = true;
      try {
        const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
        const isDevtools = sys && sys.platform === 'devtools';
        // 开发者工具环境下部分 Worker 能力探测会报 not support，禁用实验 Worker 可显著降低噪声与异常
        if (isDevtools) useExperimentalWorker = false;
      } catch (e) {
        // ignore
      }
      
      // 微信小游戏 Worker API
      this.worker = wx.createWorker('workers/levelGenerator.js', {
        useExperimentalWorker
      });
      
      this.worker.onMessage(this.handleWorkerMessage.bind(this));
      
      // 监听 Worker 被系统回收
      if (this.worker.onProcessKilled) {
        this.worker.onProcessKilled(() => {
          console.warn('[LevelManager] Worker 被系统回收，切换到分帧计算');
          this.workerReady = false;
          this.workerFailed = true;
        });
      }
      
      this.workerReady = true;
      console.log('[LevelManager] Worker 初始化成功');
    } catch (e) {
      console.warn('[LevelManager] Worker 初始化失败，将使用分帧计算', e.message);
      this.workerFailed = true;
      this.workerReady = false;
    }
  }

  /**
   * 处理 Worker 消息
   */
  handleWorkerMessage(msg) {
    if (msg.type === 'levelReady') {
      const { requestId, levelNumber, levelData, duration } = msg;
      console.log(`[LevelManager] Worker 生成关卡 ${levelNumber} 完成，耗时 ${duration}ms`);
      
      // 清除超时定时器
      const pending = this.pendingRequests.get(requestId);
      if (pending && pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      
      // 转换为 Block 实例并缓存
      const result = this.createBlockInstances(levelData);
      
      // 附加关卡元数据
      const params = ReverseLevelGenerator.getDifficultyParams(levelNumber);
      result.meta = {
        scale: params.scale || 1.0,
        showWarning: params.showWarning || false,
        phaseName: params.phaseName || '',
        isReliefLevel: params.isReliefLevel || false
      };
      
      this.preloadedLevels.set(levelNumber, result);
      
      // 解析等待的 Promise
      if (pending) {
        if (pending.resolve) pending.resolve(result);
        this.pendingRequests.delete(requestId);
      }
    } else if (msg.type === 'error') {
      const { requestId, levelNumber, error } = msg;
      console.warn(`[LevelManager] Worker 错误: ${error}，切换到分帧计算`);
      
      const pending = this.pendingRequests.get(requestId);
      if (pending && pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      
      // Worker 出错，使用分帧计算
      if (pending) {
        this.pendingRequests.delete(requestId);
        this.preloadLevelTimeSliced(levelNumber);
      }
    }
  }

  /**
   * 同步生成关卡（用于即时需要的场景）
   */
  generateLevelSync(levelNumber) {
    console.log(`[LevelManager] 同步生成关卡 ${levelNumber}`);
    const startTime = Date.now();
    
    // 选择生成算法
    const levelData = ReverseLevelGenerator.generate(levelNumber, canvas.width, canvas.height);
    const result = this.createBlockInstances(levelData);
    
    // 附加关卡元数据（scale, showWarning 等）
    const params = ReverseLevelGenerator.getDifficultyParams(levelNumber);
    result.meta = {
      scale: params.scale || 1.0,
      showWarning: params.showWarning || false,
      phaseName: params.phaseName || '',
      isReliefLevel: params.isReliefLevel || false
    };
    
    console.log(`[LevelManager] 同步生成完成，耗时 ${Date.now() - startTime}ms，算法: 逆向填空`);
    return result;
  }

  /**
   * 生成关卡（优先使用缓存）
   */
  generateLevel(levelNumber) {
    // 优先使用缓存
    if (this.preloadedLevels.has(levelNumber)) {
      const cached = this.preloadedLevels.get(levelNumber);
      this.preloadedLevels.delete(levelNumber);
      console.log(`[LevelManager] 使用缓存关卡 ${levelNumber}`);
      return cached;
    }
    
    // 没有缓存，同步生成
    return this.generateLevelSync(levelNumber);
  }

  /**
   * 预加载关卡（仅通过 Worker，Worker 不可用时跳过预加载）
   */
  preloadLevel(levelNumber) {
    if (levelNumber <= 0) return;
    if (this.preloadedLevels.has(levelNumber)) return;
    
    // 检查是否已有相同关卡的请求
    for (const [, pending] of this.pendingRequests) {
      if (pending.levelNumber === levelNumber) return;
    }
    
    // 只使用 Worker 预加载，Worker 不可用时跳过（在 generateLevel 时会同步生成）
    if (this.workerReady && !this.workerFailed && this.worker) {
      this.preloadLevelWorker(levelNumber);
    } else {
      console.log(`[LevelManager] Worker 不可用，跳过预加载关卡 ${levelNumber}，将在需要时同步生成`);
    }
  }

  /**
   * 通过 Worker 预加载关卡
   */
  preloadLevelWorker(levelNumber) {
    console.log(`[LevelManager] Worker 预加载关卡 ${levelNumber}`);
    
    const requestId = ++this.requestId;
    
    // 设置超时，超时后记录一次警告并继续等待
    const scheduleTimeout = () => {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        console.warn(`[LevelManager] Worker 超时 ${this.workerTimeout}ms，继续等待关卡 ${levelNumber} 完成`);
        pending.timeoutId = setTimeout(scheduleTimeout, this.workerTimeout);
      }
    };
    const timeoutId = setTimeout(scheduleTimeout, this.workerTimeout);
    
    this.pendingRequests.set(requestId, {
      resolve: null,
      reject: null,
      levelNumber,
      timeoutId
    });
    
    this.worker.postMessage({
      type: 'generate',
      requestId,
      levelNumber,
      screenWidth: canvas.width,
      screenHeight: canvas.height
    });
  }

  /**
   * 通过分帧计算预加载关卡
   * 将生成任务拆分到多个帧中执行，避免阻塞主线程
   */
  preloadLevelTimeSliced(levelNumber) {
    if (this.preloadedLevels.has(levelNumber)) return;
    if (this.timeSliceGenerators.has(levelNumber)) return;
    
    console.log(`[LevelManager] 分帧计算预加载关卡 ${levelNumber}`);
    
    // 创建生成器
    const generator = this.createLevelGenerator(levelNumber);
    this.timeSliceGenerators.set(levelNumber, generator);
    
    // 启动分帧执行（如果还没启动）
    if (!this.isTimeSlicing) {
      this.runTimeSlice();
    }
  }

  /**
  * 创建关卡生成器（Generator）
  * 将生成过程拆分为多个可中断的步骤
  */
  *createLevelGenerator(levelNumber) {
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    ReverseLevelGenerator.getDifficultyParams(levelNumber);
    
    yield { step: 'init', progress: 0.05 };
    
    const levelData = ReverseLevelGenerator.generate(levelNumber, screenWidth, screenHeight);
    return { blocks: levelData.blocks, total: levelData.total };
  }

  /**
   * 分帧执行器
   * 每帧最多执行指定时间，避免阻塞渲染
   */
  runTimeSlice() {
    if (this.timeSliceGenerators.size === 0) {
      this.isTimeSlicing = false;
      return;
    }
    
    this.isTimeSlicing = true;
    const maxTimePerFrame = 8; // 每帧最多执行 8ms，保证 60fps
    
    const tick = () => {
      if (this.timeSliceGenerators.size === 0) {
        this.isTimeSlicing = false;
        return;
      }
      
      const startTime = performance.now();
      
      // 遍历所有正在进行的生成任务
      for (const [levelNumber, generator] of this.timeSliceGenerators) {
        // 检查时间预算
        if (performance.now() - startTime > maxTimePerFrame) {
          break;
        }
        
        try {
          const { value, done } = generator.next();
          
          if (done) {
            // 生成完成
            const levelData = value;
            const result = this.createBlockInstances(levelData);
            this.preloadedLevels.set(levelNumber, result);
            this.timeSliceGenerators.delete(levelNumber);
            console.log(`[LevelManager] 分帧计算完成关卡 ${levelNumber}`);
          }
        } catch (e) {
          console.error(`[LevelManager] 分帧生成关卡 ${levelNumber} 失败:`, e);
          this.timeSliceGenerators.delete(levelNumber);
        }
      }
      
      // 继续下一帧
      if (this.timeSliceGenerators.size > 0) {
        requestAnimationFrame(tick);
      } else {
        this.isTimeSlicing = false;
      }
    };
    
    requestAnimationFrame(tick);
  }

  /**
   * 预加载多个关卡
   */
  preloadLevels(startLevel) {
    for (let i = 0; i < this.preloadAhead; i++) {
      // 延迟启动，避免同时启动多个任务
      setTimeout(() => {
        this.preloadLevel(startLevel + i);
      }, i * 100);
    }
  }

  /**
   * 检查关卡是否已预加载
   */
  isPreloaded(levelNumber) {
    return this.preloadedLevels.has(levelNumber);
  }

  /**
   * 检查关卡是否正在预加载
   */
  isPreloading(levelNumber) {
    if (this.timeSliceGenerators.has(levelNumber)) return true;
    for (const [, pending] of this.pendingRequests) {
      if (pending.levelNumber === levelNumber) return true;
    }
    return false;
  }

  /**
   * 创建方块实例
   * @param {Object} levelData - 关卡数据
   * @param {number} scale - 可选的缩放比例（用于 Level 1 大方块）
   */
  createBlockInstances(levelData, scale = 1.0) {
    const blocks = [];

    for (let blockData of levelData.blocks) {
      const block = new Block();
      
      // 应用缩放
      const effectiveSize = blockData.size * scale;
      
      block.init(
        blockData.x,
        blockData.y,
        blockData.direction,
        blockData.type,
        effectiveSize
      );
      block.axis = blockData.axis || null;
      block.gridRow = Number.isFinite(blockData.gridRow) ? blockData.gridRow : null;
      block.gridCol = Number.isFinite(blockData.gridCol) ? blockData.gridCol : null;
      block.scale = scale; // 保存缩放值供渲染器使用
      blocks.push(block);
    }

    return {
      blocks,
      total: blocks.length
    };
  }

  /**
   * 获取关卡难度描述
   */
  getDifficultyDescription(level) {
    if (level <= 15) return '成长';
    if (level <= 35) return '挑战';
    if (level <= 60) return '大师';
    return '传奇';
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
    
    // 清除所有超时定时器
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    
    this.preloadedLevels.clear();
    this.pendingRequests.clear();
    this.timeSliceGenerators.clear();
  }
}

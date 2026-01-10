/**
 * 全局状态管理器
 * 负责管理游戏的全局状态，包括：
 * - 方块集合
 * - 关卡进度
 * - 道具数量
 * - 本地存档
 */
import Pool from '../base/pool';
import Particle from '../base/particle';

let instance;

export default class GameDataBus {
  blocks = [];              // 当前关卡的所有方块
  particles = [];           // 粒子效果
  totalBlocks = 0;          // 方块总数
  removedBlocks = 0;        // 已消除方块数
  currentLevel = 1;         // 当前关卡
  unlockedLevels = 1;       // 已解锁关卡
  isPlaying = false;        // 游戏进行中
  isDeadlock = false;       // 是否死局
  pool = new Pool();         // 对象池

  // 道具数量（PRD v1.3: 4种道具）
  items = {
    grab: 3,          // 抓走道具
    flip: 2,          // 翻转道具
    shufflePos: 1,    // 洗牌道具（位置）
    shuffleDir: 1,    // 洗牌道具（方向）
    shuffle: 1        // 兼容旧版本
  };

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  /**
   * 重置游戏状态
   */
  reset() {
    this.blocks = [];
    this.particles = [];
    this.totalBlocks = 0;
    this.removedBlocks = 0;
    this.isPlaying = false;
    this.isDeadlock = false;
  }

  /**
   * 获取进度百分比
   */
  getProgress() {
    if (this.totalBlocks === 0) return 0;
    return Math.floor((this.removedBlocks / this.totalBlocks) * 100);
  }

  /**
   * 添加方块
   */
  addBlock(block) {
    this.blocks.push(block);
  }

  /**
   * 移除方块（从数组中移除，并回收对象池）
   */
  removeBlock(block) {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
      this.pool.recover('block', block);
    }
  }

  /**
   * 添加粒子效果
   */
  addParticle(particle) {
    this.particles.push(particle);
  }

  /**
   * 保存进度到本地
   */
  saveProgress() {
    const data = {
      unlockedLevels: this.unlockedLevels,
      currentLevel: this.currentLevel,
      items: this.items,
      lastPlayed: Date.now()
    };

    try {
      wx.setStorageSync('gameProgress', data);
      console.log('进度保存成功', data);
    } catch (e) {
      console.error('保存失败', e);
    }
  }

  /**
   * 从本地加载进度
   */
  loadProgress() {
    try {
      const data = wx.getStorageSync('gameProgress');
      if (data) {
        this.unlockedLevels = data.unlockedLevels || 1;
        this.currentLevel = data.currentLevel || 1;
        // 合并道具数据，使用最新值
        if (data.items) {
          this.items = { ...this.items, ...data.items };
        }
        console.log('进度加载成功', data);
      } else {
        console.log('无存档记录，使用默认值');
      }
    } catch (e) {
      console.error('加载失败', e);
    }
  }

  /**
   * 使用道具
   */
  useItem(itemType) {
    if (this.items[itemType] > 0) {
      this.items[itemType]--;
      this.saveProgress();
      return true;
    }
    return false;
  }

  /**
   * 增加道具数量
   */
  addItem(itemType, count = 1) {
    if (this.items[itemType] !== undefined) {
      this.items[itemType] += count;
      this.saveProgress();
    }
  }

  /**
   * 创建爆炸粒子效果
   */
  createExplosion(x, y, count = 20, color = '#FF6B6B') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = Math.random() * 3 + 2;
      const particle = new Particle(
        x,
        y,
        color,
        Math.random() * 4 + 2,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        30
      );
      this.particles.push(particle);
    }
  }
}

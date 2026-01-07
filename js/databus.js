import Pool from './base/pool';
import Particle from './base/particle';
import Enemy from './npc/enemy';
import Bullet from './player/bullet';
import PowerUp from './runtime/powerup';

let instance;

/**
 * 全局状态管理器
 * 负责管理游戏的状态，包括帧数、分数、子弹、敌人和动画等
 */
export default class DataBus {
  enemys = []; // 存储敌人
  bullets = []; // 存储子弹
  animations = []; // 存储动画
  particles = []; // 存储粒子
  powerUps = []; // 存储道具
  frame = 0; // 当前帧数
  score = 0; // 当前分数
  isGameOver = false; // 游戏是否结束
  pool = new Pool(); // 初始化对象池

  // 新增游戏状态
  combo = 0; // 连击数
  maxCombo = 0; // 最大连击
  comboTimer = 0; // 连击计时器
  difficulty = 1; // 难度等级
  level = 1; // 关卡

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  // 重置游戏状态
  reset() {
    this.frame = 0;
    this.score = 0;
    this.bullets = [];
    this.enemys = [];
    this.animations = [];
    this.particles = [];
    this.powerUps = [];
    this.isGameOver = false;

    // 重置新增状态
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.difficulty = 1;
    this.level = 1;
  }

  // 增加分数（带连击倍率）
  addScore(baseScore) {
    const multiplier = 1 + (this.combo * 0.1); // 连击倍率
    const finalScore = Math.floor(baseScore * multiplier);
    this.score += finalScore;

    // 增加连击
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 120; // 2秒连击时间

    return finalScore;
  }

  // 更新连击计时器
  updateCombo() {
    if (this.comboTimer > 0) {
      this.comboTimer--;
    } else if (this.combo > 0) {
      this.combo = 0;
    }
  }

  // 创建爆炸粒子效果
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

  // 创建射击粒子效果
  createShootEffect(x, y) {
    for (let i = 0; i < 5; i++) {
      const particle = new Particle(
        x,
        y,
        '#FFE66D',
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 2,
        -Math.random() * 3 - 2,
        15
      );
      this.particles.push(particle);
    }
  }

  // 掉落道具
  dropPowerUp(x, y) {
    // 10% 几率掉落道具
    if (Math.random() < 0.1) {
      const types = ['double', 'shield', 'speed'];
      const type = types[Math.floor(Math.random() * types.length)];
      const powerUp = this.pool.getItemByClass('powerup', PowerUp);
      powerUp.init(x, y, type);
      this.powerUps.push(powerUp);
    }
  }

  // 更新难度
  updateDifficulty() {
    // 每500分增加难度
    this.difficulty = 1 + Math.floor(this.score / 500) * 0.5;
    this.level = 1 + Math.floor(this.score / 500);
  }

  /**
   * 回收敌人
   */
  removeEnemy(enemy) {
    const index = this.enemys.indexOf(enemy);
    if (index > -1) {
      this.enemys.splice(index, 1);
      this.pool.recover('enemy', enemy);
    }
  }

  /**
   * 回收子弹
   */
  removeBullets(bullet) {
    const index = this.bullets.indexOf(bullet);
    if (index > -1) {
      this.bullets.splice(index, 1);
      this.pool.recover('bullet', bullet);
    }
  }

  /**
   * 移除道具
   */
  removePowerUp(powerUp) {
    const index = this.powerUps.indexOf(powerUp);
    if (index > -1) {
      this.powerUps.splice(index, 1);
      this.pool.recover('powerup', powerUp);
    }
  }

  /**
   * 移除粒子
   */
  removeParticle(particle) {
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
    }
  }

  // 游戏结束
  gameOver() {
    this.isGameOver = true;
  }
}

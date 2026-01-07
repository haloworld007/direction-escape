import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const ENEMY_IMG_SRC = 'images/enemy.png';
const ENEMY_WIDTH = 60;
const ENEMY_HEIGHT = 60;
const EXPLO_IMG_PREFIX = 'images/explosion';

// 敌机类型配置
const ENEMY_TYPES = {
  normal: { hp: 1, speed: [3, 6], score: 10, color: '#FF6B6B' },
  fast: { hp: 1, speed: [7, 10], score: 20, color: '#4ECDC4' },
  elite: { hp: 3, speed: [2, 4], score: 50, color: '#FFE66D' },
  boss: { hp: 20, speed: [1, 2], score: 500, color: '#FF006E' }
};

export default class Enemy extends Animation {
  constructor(type = 'normal') {
    const config = ENEMY_TYPES[type];
    const width = type === 'boss' ? 120 : ENEMY_WIDTH;
    const height = type === 'boss' ? 120 : ENEMY_HEIGHT;

    super(ENEMY_IMG_SRC, width, height);

    this.type = type;
    this.config = config;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = Math.random() * (config.speed[1] - config.speed[0]) + config.speed[0];
    this.score = config.score;
    this.color = config.color;

    // 移动模式
    this.movePattern = type === 'boss' ? 'sine' : 'straight';
    this.angle = 0;
  }

  init(type = 'normal') {
    this.x = this.getRandomX();
    this.y = -this.height;

    // 重新应用类型配置（用于对象池复用）
    if (type && type !== this.type) {
      const config = ENEMY_TYPES[type];
      this.type = type;
      this.config = config;
      this.maxHp = config.hp;
      this.score = config.score;
      this.color = config.color;

      const width = type === 'boss' ? 120 : ENEMY_WIDTH;
      const height = type === 'boss' ? 120 : ENEMY_HEIGHT;
      this.width = width;
      this.height = height;
    }

    this.hp = this.maxHp;
    this.speed = Math.random() * (this.config.speed[1] - this.config.speed[0]) + this.config.speed[0];
    this.movePattern = this.type === 'boss' ? 'sine' : 'straight';
    this.angle = 0;

    this.isActive = true;
    this.visible = true;
    this.initExplosionAnimation();
  }

  // 生成随机 X 坐标
  getRandomX() {
    return Math.floor(Math.random() * (SCREEN_WIDTH - this.width));
  }

  // 预定义爆炸的帧动画
  initExplosionAnimation() {
    const EXPLO_FRAME_COUNT = 19;
    const frames = Array.from(
      { length: EXPLO_FRAME_COUNT },
      (_, i) => `${EXPLO_IMG_PREFIX}${i + 1}.png`
    );
    this.initFrames(frames);
  }

  // 每一帧更新敌人位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.y += this.speed;

    // 不同移动模式
    if (this.movePattern === 'sine') {
      this.angle += 0.05;
      this.x += Math.sin(this.angle) * 2;
    }

    // 对象回收
    if (this.y > SCREEN_HEIGHT + this.height) {
      this.remove();
    }
  }

  // 受到伤害
  takeDamage(damage = 1) {
    this.hp -= damage;

    // 创建受伤粒子效果
    if (this.hp > 0) {
      GameGlobal.databus.createExplosion(
        this.x + this.width / 2,
        this.y + this.height / 2,
        5,
        this.color
      );
    }

    return this.hp <= 0;
  }

  // 渲染敌机（添加视觉效果）
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    // 为不同类型的敌机添加不同的视觉效果
    if (this.type === 'fast') {
      // 快速敌机 - 发光效果
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      super.render(ctx);
    } else if (this.type === 'elite') {
      // 精英敌机 - 双重光环
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.color;
      super.render(ctx);

      // 额外的光环
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2 + 5,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    } else if (this.type === 'boss') {
      // BOSS - 大范围光晕和旋转效果
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.color;

      // 旋转的外圈
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.angle || 0);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const x1 = Math.cos(angle) * (this.width / 2);
        const y1 = Math.sin(angle) * (this.height / 2);
        const x2 = Math.cos(angle) * (this.width / 2 + 15);
        const y2 = Math.sin(angle) * (this.height / 2 + 15);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      super.render(ctx);
    } else {
      // 普通敌机 - 正常渲染
      super.render(ctx);
    }

    // 绘制血条（精英和BOSS）
    if (this.type === 'elite' || this.type === 'boss') {
      const barWidth = this.width;
      const barHeight = 5;
      const barX = this.x;
      const barY = this.y - 10;

      // 血条背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

      // 血条前景
      const healthPercent = this.hp / this.maxHp;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = this.color;
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  destroy() {
    this.isActive = false;

    // 创建爆炸粒子效果
    GameGlobal.databus.createExplosion(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.type === 'boss' ? 50 : 20,
      this.color
    );

    // 播放销毁动画后移除
    this.playAnimation();
    GameGlobal.musicManager.playExplosion();

    // 只有精英和BOSS击毁时才震动
    if (this.type === 'elite' || this.type === 'boss') {
      wx.vibrateShort({
        type: this.type === 'boss' ? 'heavy' : 'medium'
      });
    }

    this.on('stopAnimation', () => this.remove.bind(this));
  }

  remove() {
    this.isActive = false;
    this.visible = false;
    GameGlobal.databus.removeEnemy(this);
  }
}

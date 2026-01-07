import Sprite from './sprite';

/**
 * 粒子效果类
 * 用于创建爆炸、射击等特效
 */
export default class Particle extends Sprite {
  constructor(x, y, color, size, speedX, speedY, life) {
    super('', size, size);

    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.speedX = speedX;
    this.speedY = speedY;
    this.life = life;
    this.maxLife = life;
    this.alpha = 1;
    this.visible = true;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life--;
    this.alpha = this.life / this.maxLife;

    if (this.life <= 0) {
      this.visible = false;
    }
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

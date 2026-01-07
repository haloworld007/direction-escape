import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const POWERUP_WIDTH = 45;
const POWERUP_HEIGHT = 45;

// 道具类型配置
const POWERUP_TYPES = {
  double: {
    color: '#4ECDC4',
    name: '双发',
    duration: 600,
    icon: '⚡',
    glowColor: 'rgba(78, 205, 196, 0.6)'
  },
  shield: {
    color: '#FFE66D',
    name: '护盾',
    duration: 400,
    icon: '🛡️',
    glowColor: 'rgba(255, 230, 109, 0.6)'
  },
  speed: {
    color: '#FF6B6B',
    name: '加速',
    duration: 300,
    icon: '🔥',
    glowColor: 'rgba(255, 107, 107, 0.6)'
  }
};

export default class PowerUp extends Sprite {
  constructor() {
    super('', POWERUP_WIDTH, POWERUP_HEIGHT);
    this.speed = 2;
    this.type = 'double';
    this.duration = 0;
    this.pulsePhase = 0;
  }

  init(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.config = POWERUP_TYPES[type];
    this.duration = this.config.duration;
    this.visible = true;
    this.angle = 0;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update() {
    this.y += this.speed;
    this.angle += 0.03;
    this.pulsePhase += 0.1;

    // 飘出屏幕后移除
    if (this.y > SCREEN_HEIGHT + this.height) {
      this.remove();
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const pulse = Math.sin(this.pulsePhase) * 0.2 + 1; // 脉动效果
    const radius = (this.width / 2) * pulse;

    ctx.save();

    // 外层光晕
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5);
    glowGradient.addColorStop(0, this.config.glowColor);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 旋转光环
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.config.color;

    // 绘制六边形
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    // 内部填充
    ctx.fillStyle = this.config.color + '40';
    ctx.fill();

    ctx.restore();

    // 绘制图标
    ctx.save();
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.config.color;
    ctx.fillText(this.config.icon, centerX, centerY);
    ctx.restore();

    // 绘制道具名称
    ctx.save();
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText(this.config.name, centerX, this.y - 8);
    ctx.restore();
  }

  remove() {
    this.visible = false;
    GameGlobal.databus.removePowerUp(this);
  }

  // 应用道具效果到玩家
  applyTo(player) {
    player.activatePowerUp(this.type, this.duration);

    // 创建拾取特效
    GameGlobal.databus.createExplosion(
      this.x + this.width / 2,
      this.y + this.height / 2,
      15,
      this.config.color
    );

    // 移除震动反馈，避免频繁震动
    this.remove();
  }
}

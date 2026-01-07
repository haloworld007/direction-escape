import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import Bullet from './bullet';

// 玩家相关常量设置
const PLAYER_IMG_SRC = 'images/hero.png';
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 80;
const EXPLO_IMG_PREFIX = 'images/explosion';
const PLAYER_SHOOT_INTERVAL = 20;

export default class Player extends Animation {
  constructor() {
    super(PLAYER_IMG_SRC, PLAYER_WIDTH, PLAYER_HEIGHT);

    this.init();
    this.initEvent();
  }

  init() {
    this.x = SCREEN_WIDTH / 2 - this.width / 2;
    this.y = SCREEN_HEIGHT - this.height - 30;
    this.touched = false;
    this.isActive = true;
    this.visible = true;
    this.initExplosionAnimation();

    // 道具状态
    this.powerUps = {
      double: 0,    // 双发剩余帧数
      shield: 0,    // 护盾剩余帧数
      speed: 0      // 加速剩余帧数
    };

    this.hasShield = false;
  }

  // 激活道具效果
  activatePowerUp(type, duration) {
    this.powerUps[type] = duration;

    if (type === 'shield') {
      this.hasShield = true;
    }

    // 播放音效
    GameGlobal.musicManager.playShoot();

    // 移除震动反馈，避免频繁震动
  }

  // 更新道具状态
  updatePowerUps() {
    for (let type in this.powerUps) {
      if (this.powerUps[type] > 0) {
        this.powerUps[type]--;
        if (this.powerUps[type] <= 0 && type === 'shield') {
          this.hasShield = false;
        }
      }
    }
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

  /**
   * 判断手指是否在飞机上
   * @param {Number} x: 手指的X轴坐标
   * @param {Number} y: 手指的Y轴坐标
   * @return {Boolean}: 用于标识手指是否在飞机上的布尔值
   */
  checkIsFingerOnAir(x, y) {
    const deviation = 30;
    return (
      x >= this.x - deviation &&
      y >= this.y - deviation &&
      x <= this.x + this.width + deviation &&
      y <= this.y + this.height + deviation
    );
  }

  /**
   * 根据手指的位置设置飞机的位置
   * 保证手指处于飞机中间
   * 同时限定飞机的活动范围限制在屏幕中
   */
  setAirPosAcrossFingerPosZ(x, y) {
    const disX = Math.max(
      0,
      Math.min(x - this.width / 2, SCREEN_WIDTH - this.width)
    );
    const disY = Math.max(
      0,
      Math.min(y - this.height / 2, SCREEN_HEIGHT - this.height)
    );

    this.x = disX;
    this.y = disY;
  }

  /**
   * 玩家响应手指的触摸事件
   * 改变战机的位置
   */
  initEvent() {
    wx.onTouchStart((e) => {
      const { clientX: x, clientY: y } = e.touches[0];

      if (GameGlobal.databus.isGameOver) {
        return;
      }
      if (this.checkIsFingerOnAir(x, y)) {
        this.touched = true;
        this.setAirPosAcrossFingerPosZ(x, y);
      }
    });

    wx.onTouchMove((e) => {
      const { clientX: x, clientY: y } = e.touches[0];

      if (GameGlobal.databus.isGameOver) {
        return;
      }
      if (this.touched) {
        this.setAirPosAcrossFingerPosZ(x, y);
      }
    });

    wx.onTouchEnd((e) => {
      this.touched = false;
    });

    wx.onTouchCancel((e) => {
      this.touched = false;
    });
  }

  /**
   * 玩家射击操作
   * 支持单发和双发
   */
  shoot() {
    const isDouble = this.powerUps.double > 0;
    const shootInterval = this.powerUps.speed > 0 ? 10 : PLAYER_SHOOT_INTERVAL;

    // 单发或双发子弹
    if (isDouble) {
      // 双发模式
      const bullet1 = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);
      const bullet2 = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);

      bullet1.init(this.x, this.y - 10, 10);
      bullet2.init(this.x + this.width - bullet2.width, this.y - 10, 10);

      GameGlobal.databus.bullets.push(bullet1, bullet2);
    } else {
      // 单发模式
      const bullet = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);
      bullet.init(this.x + this.width / 2 - bullet.width / 2, this.y - 10, 10);
      GameGlobal.databus.bullets.push(bullet);
    }

    // 射击粒子效果
    GameGlobal.databus.createShootEffect(this.x + this.width / 2, this.y);

    GameGlobal.musicManager.playShoot();

    // 返回实际射击间隔
    return shootInterval;
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 更新道具状态
    this.updatePowerUps();

    // 根据道具效果调整射击间隔
    const shootInterval = this.powerUps.speed > 0 ? 10 : PLAYER_SHOOT_INTERVAL;

    if (GameGlobal.databus.frame % shootInterval === 0) {
      this.shoot();
    }
  }

  // 绘制护盾效果
  render(ctx) {
    super.render(ctx);

    // 绘制护盾
    if (this.hasShield) {
      ctx.save();
      ctx.strokeStyle = '#FFE66D';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FFE66D';
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2 + 10,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  // 受到伤害
  takeDamage() {
    if (this.hasShield) {
      // 护盾抵消伤害
      this.hasShield = false;
      this.powerUps.shield = 0;

      // 播放护盾破碎效果
      GameGlobal.databus.createExplosion(
        this.x + this.width / 2,
        this.y + this.height / 2,
        15,
        '#FFE66D'
      );

      return false; // 存活
    }

    return true; // 受到伤害
  }

  destroy() {
    this.isActive = false;
    this.playAnimation();
    GameGlobal.musicManager.playExplosion(); // 播放爆炸音效
    wx.vibrateShort({
      type: 'medium'
    }); // 震动
  }
}

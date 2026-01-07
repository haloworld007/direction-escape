import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const atlas = wx.createImage();
atlas.src = 'images/Common.png';

export default class GameInfo extends Emitter {
  constructor() {
    super();

    this.btnArea = {
      startX: SCREEN_WIDTH / 2 - 40,
      startY: SCREEN_HEIGHT / 2 - 100 + 180,
      endX: SCREEN_WIDTH / 2 + 50,
      endY: SCREEN_HEIGHT / 2 - 100 + 255,
    };

    wx.onTouchStart(this.touchEventHandler.bind(this))
  }

  setFont(ctx, size = 20, color = '#ffffff', weight = 'normal') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial`;
  }

  // 绘制圆角矩形的辅助方法（兼容不支持 roundRect 的环境）
  drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  render(ctx) {
    const databus = GameGlobal.databus;
    const player = GameGlobal.player || { powerUps: { double: 0, shield: 0, speed: 0 } };

    // 绘制游戏内HUD
    this.renderHUD(ctx, databus, player);

    // 游戏结束时显示结束画面
    if (databus.isGameOver) {
      this.renderGameOver(ctx, databus);
    }
  }

  // 游戏内HUD显示 - 优化版
  renderHUD(ctx, databus, player) {
    const hudHeight = 70;
    const padding = 10;

    // 背景 - 渐变效果
    const gradient = ctx.createLinearGradient(0, 0, 0, hudHeight);
    gradient.addColorStop(0, 'rgba(20, 20, 40, 0.95)');
    gradient.addColorStop(1, 'rgba(30, 30, 60, 0.9)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, hudHeight);

    // 底部边框线
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, hudHeight - 2, SCREEN_WIDTH, 2);

    // 左侧区域 - 分数和关卡
    this.setFont(ctx, 22, '#FFE66D', 'bold');
    ctx.textAlign = 'left';
    ctx.fillText(`分数`, padding, 22);

    this.setFont(ctx, 28, '#FFF', 'bold');
    ctx.fillText(`${databus.score}`, padding, 52);

    // 关卡徽章
    const levelBadgeX = 100;
    ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
    this.drawRoundRect(ctx, levelBadgeX, 8, 60, 24, 12);
    ctx.fill();

    this.setFont(ctx, 16, '#4ECDC4', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`LV.${databus.level}`, levelBadgeX + 30, 25);

    // 中间区域 - 连击显示
    if (databus.combo > 1) {
      const comboX = SCREEN_WIDTH / 2;
      this.setFont(ctx, 20, '#FF6B6B', 'bold');
      ctx.textAlign = 'center';
      ctx.fillText(`${databus.combo} COMBO!`, comboX, 28);

      // 连击倍率
      const multiplier = (1 + databus.combo * 0.1).toFixed(1);
      this.setFont(ctx, 16, '#FF8E8E');
      ctx.fillText(`×${multiplier} 分数`, comboX, 50);

      // 连击倒计时条
      const barWidth = 120;
      const barHeight = 4;
      const barX = comboX - barWidth / 2;
      const barY = 56;
      const progress = databus.comboTimer / 120;

      // 背景条
      ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // 进度条
      ctx.fillStyle = '#FF6B6B';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF6B6B';
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
      ctx.shadowBlur = 0;
    }

    // 右侧区域 - 难度和最大连击
    const rightX = SCREEN_WIDTH - padding;

    // 难度标签
    const difficultyColors = {
      '简单': '#4ECDC4',
      '普通': '#FFE66D',
      '困难': '#FF8E4F',
      '地狱': '#FF006E'
    };

    const difficultyText = databus.difficulty < 1.5 ? '简单' :
                         databus.difficulty < 2.5 ? '普通' :
                         databus.difficulty < 3.5 ? '困难' : '地狱';
    const diffColor = difficultyColors[difficultyText];

    ctx.fillStyle = `${diffColor}33`;
    this.drawRoundRect(ctx, rightX - 50, 8, 50, 20, 10);
    ctx.fill();

    this.setFont(ctx, 14, diffColor, 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(difficultyText, rightX - 25, 23);

    // 最大连击
    if (databus.maxCombo > 1) {
      this.setFont(ctx, 14, '#999');
      ctx.fillText(`最大: ${databus.maxCombo}`, rightX - 25, 52);
    }

    // 道具状态栏 - 底部
    this.renderPowerUpStatus(ctx, player, hudHeight + 5);

    ctx.textAlign = 'left';
  }

  // 道具状态显示
  renderPowerUpStatus(ctx, player, y) {
    const powerUps = [
      { key: 'double', name: '双发', color: '#4ECDC4', icon: '◆' },
      { key: 'shield', name: '护盾', color: '#FFE66D', icon: '●' },
      { key: 'speed', name: '加速', color: '#FF6B6B', icon: '▲' }
    ];

    const statusWidth = 70;
    const gap = 10;
    const startX = 10;

    powerUps.forEach((powerUp, index) => {
      const remaining = player.powerUps[powerUp.key];
      const x = startX + index * (statusWidth + gap);

      if (remaining > 0) {
        // 背景
        ctx.fillStyle = `${powerUp.color}22`;
        this.drawRoundRect(ctx, x, y, statusWidth, 18, 9);
        ctx.fill();

        // 边框
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 图标
        this.setFont(ctx, 14, powerUp.color, 'bold');
        ctx.textAlign = 'left';
        ctx.fillText(powerUp.icon, x + 8, y + 14);

        // 名称
        this.setFont(ctx, 12, '#FFF', 'bold');
        ctx.fillText(powerUp.name, x + 22, y + 14);

        // 时间条
        const maxTime = powerUp.key === 'shield' ? 400 : (powerUp.key === 'double' ? 600 : 300);
        const progress = remaining / maxTime;

        ctx.fillStyle = powerUp.color;
        ctx.fillRect(x, y + 18, statusWidth * progress, 2);
      }
    });
  }

  renderGameOver(ctx, databus) {
    // 半透明遮罩 - 渐变效果
    const gradient = ctx.createRadialGradient(
      SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 0,
      SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.drawGameOverImage(ctx);
    this.drawGameOverText(ctx, databus);
    this.drawRestartButton(ctx);
  }

  drawGameOverImage(ctx) {
    ctx.drawImage(
      atlas,
      0,
      0,
      119,
      108,
      SCREEN_WIDTH / 2 - 150,
      SCREEN_HEIGHT / 2 - 100,
      300,
      300
    );
  }

  drawGameOverText(ctx, databus) {
    ctx.textAlign = 'center';

    // 标题 - 阴影效果
    ctx.save();
    ctx.shadowColor = '#FF6B6B';
    ctx.shadowBlur = 20;
    this.setFont(ctx, 36, '#FF6B6B', 'bold');
    ctx.fillText('游戏结束', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 70);
    ctx.restore();

    // 分数面板背景
    const panelWidth = 200;
    const panelX = SCREEN_WIDTH / 2 - panelWidth / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.drawRoundRect(ctx, panelX, SCREEN_HEIGHT / 2 - 45, panelWidth, 130, 15);
    ctx.fill();

    // 最终得分
    this.setFont(ctx, 18, '#999');
    ctx.fillText('最终得分', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 15);

    this.setFont(ctx, 32, '#FFE66D', 'bold');
    ctx.fillText(`${databus.score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);

    // 关卡和连击
    this.setFont(ctx, 16, '#4ECDC4');
    ctx.fillText(`到达关卡 ${databus.level}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 50);

    if (databus.maxCombo > 1) {
      this.setFont(ctx, 16, '#FF006E');
      ctx.fillText(`最大连击 ${databus.maxCombo}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 72);
    }
  }

  drawRestartButton(ctx) {
    const btnWidth = 160;
    const btnHeight = 50;
    const btnX = SCREEN_WIDTH / 2 - btnWidth / 2;
    const btnY = SCREEN_HEIGHT / 2 + 100;

    // 按钮阴影
    ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
    this.drawRoundRect(ctx, btnX + 3, btnY + 3, btnWidth, btnHeight, 25);
    ctx.fill();

    // 按钮背景 - 渐变
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    gradient.addColorStop(0, '#4ECDC4');
    gradient.addColorStop(1, '#2DB5B0');

    ctx.fillStyle = gradient;
    this.drawRoundRect(ctx, btnX, btnY, btnWidth, btnHeight, 25);
    ctx.fill();

    // 按钮高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.drawRoundRect(ctx, btnX + 5, btnY + 3, btnWidth - 10, btnHeight / 2 - 5, 20);
    ctx.fill();

    // 按钮文字
    this.setFont(ctx, 22, '#FFF', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, btnY + 32);

    ctx.textAlign = 'left';
  }

  touchEventHandler(event) {
    const { clientX, clientY } = event.touches[0];

    if (GameGlobal.databus.isGameOver) {
      const btnWidth = 160;
      const btnHeight = 50;
      const btnX = SCREEN_WIDTH / 2 - btnWidth / 2;
      const btnY = SCREEN_HEIGHT / 2 + 100;

      if (
        clientX >= btnX &&
        clientX <= btnX + btnWidth &&
        clientY >= btnY &&
        clientY <= btnY + btnHeight
      ) {
        this.emit('restart');
      }
    }
  }
}

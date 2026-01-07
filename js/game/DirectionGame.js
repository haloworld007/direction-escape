/**
 * 游戏主控制器
 * 负责：
 * - 游戏主循环
 * - 渲染协调
 * - 输入事件分发
 * - 游戏状态流转
 */
import GameDataBus from './GameDataBus';
import LevelManager from './LevelManager';
import DeadlockDetector from './algorithms/DeadlockDetector';

const ctx = canvas.getContext('2d');

export default class DirectionGame {
  constructor() {
    // 初始化全局状态
    GameGlobal.databus = new GameDataBus();
    GameGlobal.databus.loadProgress();

    // 关卡管理器
    this.levelManager = new LevelManager();

    // 游戏状态
    this.state = 'menu'; // menu, playing, victory, defeat
    this.aniId = 0;

    // 绑定触摸事件
    this.initTouchEvent();

    // 启动游戏循环
    this.aniId = requestAnimationFrame(this.loop.bind(this));

    console.log('[DirectionGame] 游戏初始化完成，状态: menu');
  }

  /**
   * 初始化触摸事件
   */
  initTouchEvent() {
    wx.onTouchStart(this.handleTouchStart.bind(this));
  }

  /**
   * 触摸事件处理
   */
  handleTouchStart(event) {
    const { clientX, clientY } = event.touches[0];

    console.log(`[DirectionGame] 触摸事件: (${clientX}, ${clientY}), 状态: ${this.state}`);

    if (this.state === 'playing') {
      this.handleGamePlayTouch(clientX, clientY);
    } else if (this.state === 'menu') {
      this.handleMenuTouch(clientX, clientY);
    } else if (this.state === 'victory') {
      this.handleVictoryTouch(clientX, clientY);
    } else if (this.state === 'defeat') {
      this.handleDefeatTouch(clientX, clientY);
    }
  }

  /**
   * 游戏中的触摸处理
   */
  handleGamePlayTouch(x, y) {
    const databus = GameGlobal.databus;

    console.log(`[DirectionGame] 游戏中触摸: (${x}, ${y}), 方块数量: ${databus.blocks.length}`);

    if (!databus.isPlaying) return;

    // TODO: 优先处理UI按钮（后续实现）
    // TODO: 处理道具选择模式（后续实现）

    // 处理方块点击（从上层到下层）
    for (let i = databus.blocks.length - 1; i >= 0; i--) {
      const block = databus.blocks[i];
      if (block.isRemoved) continue;

      if (this.isTouchInBlock(x, y, block)) {
        console.log(`[DirectionGame] 点击到方块: (${block.x}, ${block.y}), direction=${block.direction}`);
        this.onBlockClicked(block);
        break;
      }
    }
  }

  /**
   * 方块点击处理
   */
  onBlockClicked(block) {
    const databus = GameGlobal.databus;

    // 检查是否可消除
    if (block.canRemove(databus.blocks)) {
      block.remove();
      databus.removedBlocks++;

      // 检查胜利
      if (databus.removedBlocks >= databus.totalBlocks) {
        this.onVictory();
        return;
      }

      // 检查死局
      this.checkDeadlock();
    } else {
      // 不可消除，抖动反馈
      block.shake();
    }
  }

  /**
   * 检查是否死局
   */
  checkDeadlock() {
    const databus = GameGlobal.databus;

    // 检测死局
    const isDeadlock = DeadlockDetector.check(databus.blocks, canvas.width, canvas.height);
    if (isDeadlock) {
      databus.isDeadlock = true;
      this.onDefeat();
    }
  }

  /**
   * 判断触摸点是否在方块内
   */
  isTouchInBlock(x, y, block) {
    return x >= block.x && x <= block.x + block.width &&
           y >= block.y && y <= block.y + block.height;
  }

  /**
   * 菜单触摸处理
   */
  handleMenuTouch(x, y) {
    // TODO: 实现菜单界面
    // 点击"开始游戏"按钮
    this.startLevel(1);
  }

  /**
   * 胜利界面触摸处理
   */
  handleVictoryTouch(x, y) {
    // TODO: 实现胜利界面
    // 点击"下一关"按钮
    const databus = GameGlobal.databus;
    this.startLevel(databus.currentLevel + 1);
  }

  /**
   * 失败界面触摸处理
   */
  handleDefeatTouch(x, y) {
    // TODO: 实现失败界面
    // 点击"重试"按钮
    const databus = GameGlobal.databus;
    this.startLevel(databus.currentLevel);
  }

  /**
   * 开始指定关卡
   */
  startLevel(levelNumber) {
    const databus = GameGlobal.databus;

    // 重置状态
    databus.reset();

    // 生成关卡
    const levelData = this.levelManager.generateLevel(levelNumber);

    // 创建方块实例
    databus.blocks = levelData.blocks;
    databus.totalBlocks = levelData.total;
    databus.removedBlocks = 0;
    databus.currentLevel = levelNumber;
    databus.isPlaying = true;
    databus.isDeadlock = false;

    this.state = 'playing';

    console.log(`关卡 ${levelNumber} 开始，方块数量: ${databus.totalBlocks}`);
  }

  /**
   * 胜利处理
   */
  onVictory() {
    const databus = GameGlobal.databus;
    databus.isPlaying = false;

    // 解锁下一关
    if (databus.currentLevel >= databus.unlockedLevels) {
      databus.unlockedLevels++;
    }

    // 保存进度
    databus.saveProgress();

    this.state = 'victory';
  }

  /**
   * 失败处理
   */
  onDefeat() {
    const databus = GameGlobal.databus;
    databus.isPlaying = false;
    this.state = 'defeat';
  }

  /**
   * 更新循环
   */
  update() {
    const databus = GameGlobal.databus;

    if (this.state === 'playing') {
      // 更新所有方块
      databus.blocks.forEach(block => {
        if (block.update) block.update();
      });

      // 更新粒子效果
      for (let i = databus.particles.length - 1; i >= 0; i--) {
        const particle = databus.particles[i];
        particle.update();
        if (!particle.visible) {
          databus.particles.splice(i, 1);
        }
      }
    }
  }

  /**
   * 渲染循环
   */
  render() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景
    this.renderBackground();

    const databus = GameGlobal.databus;

    if (this.state === 'playing' || this.state === 'victory' || this.state === 'defeat') {
      // 绘制方块
      databus.blocks.forEach(block => {
        if (block.render) block.render(ctx);
      });

      // 绘制粒子
      databus.particles.forEach(particle => {
        particle.render(ctx);
      });

      // 绘制游戏UI
      this.renderGameUI(databus);
    }

    if (this.state === 'menu') {
      this.renderMenu();
    } else if (this.state === 'victory') {
      this.renderVictory();
    } else if (this.state === 'defeat') {
      this.renderDefeat();
    }
  }

  /**
   * 绘制背景
   */
  renderBackground() {
    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * 游戏主循环
   */
  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * 绘制游戏UI
   */
  renderGameUI(databus) {
    ctx.save();

    // 顶部信息栏
    const progress = databus.getProgress();

    // 绘制关卡号
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`关卡 ${databus.currentLevel}`, 20, 40);

    // 绘制进度
    ctx.textAlign = 'center';
    ctx.fillText(`${progress}%`, canvas.width / 2, 40);

    // 绘制进度条背景
    const progressBarWidth = 200;
    const progressBarHeight = 10;
    const progressBarX = (canvas.width - progressBarWidth) / 2;
    const progressBarY = 55;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.drawRoundRect(ctx, progressBarX, progressBarY, progressBarWidth, progressBarHeight, 5);
    ctx.fill();

    // 绘制进度条
    ctx.fillStyle = '#4ECDC4';
    this.drawRoundRect(ctx, progressBarX, progressBarY, progressBarWidth * (progress / 100), progressBarHeight, 5);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制菜单
   */
  renderMenu() {
    ctx.save();

    // 标题
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('乐消消', canvas.width / 2, canvas.height / 3);

    ctx.font = '24px Arial';
    ctx.fillText('点击屏幕开始游戏', canvas.width / 2, canvas.height / 2);

    ctx.restore();
  }

  /**
   * 绘制胜利界面
   */
  renderVictory() {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 文本
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('过关！', canvas.width / 2, canvas.height / 3);

    ctx.font = '24px Arial';
    ctx.fillText('点击屏幕继续', canvas.width / 2, canvas.height / 2);

    ctx.restore();
  }

  /**
   * 绘制失败界面
   */
  renderDefeat() {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 文本
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('死局！', canvas.width / 2, canvas.height / 3);

    ctx.font = '24px Arial';
    ctx.fillText('点击屏幕重试', canvas.width / 2, canvas.height / 2);

    ctx.restore();
  }

  /**
   * 绘制圆角矩形辅助函数
   */
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
}

/**
 * 游戏主控制器（更新版）
 * 负责：
 * - 游戏主循环
 * - 渲染协调
 * - 输入事件分发
 * - 游戏状态流转
 * - UI组件管理
 */
import GameDataBus from './GameDataBus';
import LevelManager from './LevelManager';
import DeadlockDetector from './algorithms/DeadlockDetector';
import MenuRenderer from '../ui/MenuRenderer';
import GameRenderer from '../ui/GameRenderer';
import ModalRenderer from '../ui/ModalRenderer';
import BlockRenderer from '../ui/BlockRenderer';

const ctx = canvas.getContext('2d');

export default class DirectionGame {
  constructor() {
    // 初始化全局状态
    GameGlobal.databus = new GameDataBus();
    GameGlobal.databus.loadProgress();

    // 关卡管理器
    this.levelManager = new LevelManager();

    // UI渲染器
    this.menuRenderer = new MenuRenderer();
    this.gameRenderer = new GameRenderer();
    this.modalRenderer = new ModalRenderer();

    // 游戏状态
    this.state = 'menu'; // menu, playing, victory, defeat
    this.aniId = 0;

    // 道具使用模式
    this.propMode = null; // null, 'grab', 'flip', 'shuffle'

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

    // 优先处理弹窗按钮
    if (this.modalRenderer.isModalVisible()) {
      this.handleModalTouch(clientX, clientY);
      return;
    }

    // 根据状态分发事件
    if (this.state === 'playing') {
      this.handleGamePlayTouch(clientX, clientY);
    } else if (this.state === 'menu') {
      this.handleMenuTouch(clientX, clientY);
    }
  }

  /**
   * 菜单界面触摸处理
   */
  handleMenuTouch(x, y) {
    // 检查开始游戏按钮
    const startButton = this.menuRenderer.getButton('start');
    if (startButton && startButton.isClicked(x, y)) {
      startButton.press();
      setTimeout(() => {
        startButton.release();
        this.startLevel(1);
      }, 100);
      return;
    }

    // 检查顶部图标按钮
    const iconButtons = ['settings', 'community', 'rank'];
    for (const type of iconButtons) {
      const area = this.menuRenderer.getIconButtonArea(type);
      if (area && x >= area.x && x <= area.x + area.width &&
          y >= area.y && y <= area.y + area.height) {
        console.log(`[DirectionGame] 点击了 ${type} 按钮`);
        // TODO: 实现相应功能
        if (type === 'community' || type === 'rank') {
          // 显示"敬请期待"
          console.log(`[DirectionGame] ${type} 功能敬请期待`);
        }
        return;
      }
    }

    // 检查其他按钮
    const checkinButton = this.menuRenderer.getButton('checkin');
    const shareButton = this.menuRenderer.getButton('share');

    if (checkinButton && checkinButton.isClicked(x, y)) {
      console.log('[DirectionGame] 点击了签到按钮');
      return;
    }

    if (shareButton && shareButton.isClicked(x, y)) {
      console.log('[DirectionGame] 点击了分享按钮');
      return;
    }
  }

  /**
   * 游戏中的触摸处理
   */
  handleGamePlayTouch(x, y) {
    const databus = GameGlobal.databus;

    // 检查设置按钮
    const settingsArea = this.gameRenderer.getSettingsButtonArea();
    if (settingsArea && x >= settingsArea.x && x <= settingsArea.x + settingsArea.width &&
        y >= settingsArea.y && y <= settingsArea.y + settingsArea.height) {
      console.log('[DirectionGame] 点击了设置按钮');
      // TODO: 打开设置面板
      return;
    }

    // 检查道具按钮（PRD v1.3: 4种道具）
    const propButtons = ['grab', 'flip', 'shufflePos', 'shuffleDir'];
    for (const type of propButtons) {
      const button = this.gameRenderer.getPropButton(type);
      if (button && button.isClicked(x, y)) {
        this.handlePropButtonClick(type);
        return;
      }
    }

    // 如果在道具使用模式，处理道具效果
    if (this.propMode === 'grab') {
      this.handleGrabMode(x, y);
      return;
    }

    // 处理方块点击
    this.handleBlockClick(x, y);
  }

  /**
   * 处理道具按钮点击（PRD v1.3: 4种道具）
   */
  handlePropButtonClick(type) {
    const databus = GameGlobal.databus;

    console.log(`[DirectionGame] 点击了 ${type} 道具，剩余数量: ${databus.items[type]}`);

    // 检查道具数量
    if (databus.items[type] <= 0) {
      console.log('[DirectionGame] 道具数量不足');
      return;
    }

    // 处理不同道具
    if (type === 'grab') {
      // 进入抓取模式
      this.propMode = 'grab';
      console.log('[DirectionGame] 进入抓取模式，请点击要移除的方块');
    } else if (type === 'flip') {
      // 直接使用翻转道具
      this.useFlipProp();
    } else if (type === 'shufflePos') {
      // 使用洗牌道具（位置）
      this.useShufflePosProp();
    } else if (type === 'shuffleDir') {
      // 使用洗牌道具（方向）
      this.useShuffleDirProp();
    } else if (type === 'shuffle') {
      // 兼容旧版本
      this.useShufflePosProp();
    }
  }

  /**
   * 处理抓取模式下的方块点击
   */
  handleGrabMode(x, y) {
    const databus = GameGlobal.databus;

    // 从上层到下层检查
    for (let i = databus.blocks.length - 1; i >= 0; i--) {
      const block = databus.blocks[i];
      if (block.isRemoved) continue;

      if (this.isTouchInBlock(x, y, block)) {
        console.log(`[DirectionGame] 抓取模式：选中方块 (${block.x}, ${block.y})`);

        // 使用抓走道具
        if (databus.useItem('grab')) {
          block.remove();
          databus.removedBlocks++;

          // 更新UI
          this.gameRenderer.updatePropCount('grab', databus.items.grab);

          // 检查胜利
          if (databus.removedBlocks >= databus.totalBlocks) {
            this.onVictory();
            return;
          }

          // 检查死局
          this.checkDeadlock();
        }

        // 退出抓取模式
        this.propMode = null;
        return;
      }
    }

    // 点击空白区域，退出抓取模式
    this.propMode = null;
    console.log('[DirectionGame] 退出抓取模式');
  }

  /**
   * 使用翻转道具
   */
  useFlipProp() {
    const databus = GameGlobal.databus;

    if (!databus.useItem('flip')) return;

    // 翻转所有方块
    databus.blocks.forEach(block => {
      if (!block.isRemoved) {
        block.flip();
      }
    });

    // 更新UI
    this.gameRenderer.updatePropCount('flip', databus.items.flip);

    // 检查死局
    this.checkDeadlock();

    console.log('[DirectionGame] 使用了翻转道具');
  }

  /**
   * 使用洗牌道具（位置）- 随机重排方块位置
   */
  useShufflePosProp() {
    const databus = GameGlobal.databus;

    if (!databus.useItem('shufflePos')) return;

    // 获取所有未消除方块的位置
    const activeBlocks = databus.blocks.filter(b => !b.isRemoved);
    const positions = activeBlocks.map(b => ({ x: b.x, y: b.y }));

    // Fisher-Yates 洗牌算法
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // 应用新位置
    activeBlocks.forEach((block, index) => {
      block.x = positions[index].x;
      block.y = positions[index].y;
      block.originalX = positions[index].x;
      block.originalY = positions[index].y;
    });

    // 更新UI
    this.gameRenderer.updatePropCount('shufflePos', databus.items.shufflePos);

    // 检查死局
    this.checkDeadlock();

    console.log('[DirectionGame] 使用了洗牌道具（位置）');
  }

  /**
   * 使用洗牌道具（方向）- 随机重排方块朝向
   */
  useShuffleDirProp() {
    const databus = GameGlobal.databus;

    if (!databus.useItem('shuffleDir')) return;

    const directions = [0, 1, 2, 3]; // UP, RIGHT, DOWN, LEFT

    // 随机设置每个方块的方向
    databus.blocks.forEach(block => {
      if (!block.isRemoved) {
        block.direction = directions[Math.floor(Math.random() * 4)];
      }
    });

    // 更新UI
    this.gameRenderer.updatePropCount('shuffleDir', databus.items.shuffleDir);

    // 检查死局
    this.checkDeadlock();

    console.log('[DirectionGame] 使用了洗牌道具（方向）');
  }

  /**
   * 处理方块点击
   */
  handleBlockClick(x, y) {
    const databus = GameGlobal.databus;

    if (!databus.isPlaying) return;

    // 从上层到下层检查
    for (let i = databus.blocks.length - 1; i >= 0; i--) {
      const block = databus.blocks[i];
      if (block.isRemoved) continue;

      if (this.isTouchInBlock(x, y, block)) {
        console.log(`[DirectionGame] 点击方块: (${block.x}, ${block.y}), direction=${block.direction}`);
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
   * 弹窗触摸处理
   */
  handleModalTouch(x, y) {
    const buttons = ['next', 'replay', 'useProp', 'retry'];

    for (const name of buttons) {
      const button = this.modalRenderer.getButton(name);
      if (button && button.isClicked(x, y)) {
        button.press();
        setTimeout(() => {
          button.release();
          this.handleModalButtonClick(name);
        }, 100);
        return;
      }
    }
  }

  /**
   * 处理弹窗按钮点击
   */
  handleModalButtonClick(buttonName) {
    const databus = GameGlobal.databus;

    switch (buttonName) {
      case 'next':
        // 下一关
        this.startLevel(databus.currentLevel + 1);
        this.modalRenderer.hide();
        break;

      case 'replay':
        // 重玩当前关卡
        this.startLevel(databus.currentLevel);
        this.modalRenderer.hide();
        break;

      case 'useProp':
        // 使用道具（失败弹窗中）
        // TODO: 显示道具选择界面
        console.log('[DirectionGame] 选择使用道具');
        break;

      case 'retry':
        // 重试
        this.startLevel(databus.currentLevel);
        this.modalRenderer.hide();
        break;
    }
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

    // 初始化道具按钮
    this.gameRenderer.initPropButtons(databus.items);

    // 重置道具模式
    this.propMode = null;

    // 隐藏弹窗
    this.modalRenderer.hide();

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
    this.modalRenderer.showVictory();

    console.log('[DirectionGame] 关卡完成！');
  }

  /**
   * 失败处理
   */
  onDefeat() {
    const databus = GameGlobal.databus;
    databus.isPlaying = false;
    this.state = 'defeat';
    this.modalRenderer.showDefeat();

    console.log('[DirectionGame] 死局！');
  }

  /**
   * 更新循环
   */
  update() {
    const databus = GameGlobal.databus;

    // 更新弹窗动画
    this.modalRenderer.update();

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

    const databus = GameGlobal.databus;

    if (this.state === 'menu') {
      // 绘制菜单界面
      this.menuRenderer.render(ctx);
    } else if (this.state === 'playing' || this.state === 'victory' || this.state === 'defeat') {
      // 绘制游戏界面
      this.gameRenderer.render(ctx, databus);

      // 绘制方块
      databus.blocks.forEach(block => {
        if (!block.isRemoved && block.visible) {
          // 使用新的方块渲染器
          BlockRenderer.render(ctx, block);
        }
      });

      // 绘制粒子
      databus.particles.forEach(particle => {
        particle.render(ctx);
      });

      // 绘制弹窗
      this.modalRenderer.render(ctx, databus);
    }
  }

  /**
   * 游戏主循环
   */
  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}

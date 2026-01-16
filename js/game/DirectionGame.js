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
import { BLOCK_SIZES } from '../ui/UIConstants';
import MenuRenderer from '../ui/MenuRenderer';
import GameRenderer from '../ui/GameRenderer';
import ModalRenderer from '../ui/ModalRenderer';
import BlockRenderer from '../ui/BlockRenderer';
import AudioManager from '../audio/AudioManager';

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

    // 音频管理器
    this.audioManager = new AudioManager();

    // 游戏状态
    this.state = 'menu'; // menu, playing, victory, defeat
    this.aniId = 0;

    // 道具使用模式
    this.propMode = null; // null, 'grab', 'flip', 'shuffle'

    // 预生成关卡缓存，减少切换卡顿
    this.preloadedLevels = new Map();
    this.preloadLevel(1, true);

    // 绑定触摸事件
    this.initTouchEvent();

    // 启动游戏循环
    this.aniId = requestAnimationFrame(this.loop.bind(this));

    // 播放主菜单背景音乐
    this.audioManager.playBGM('menu');

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
      // 播放按钮点击音效
      this.audioManager.playSFX('buttonClick');

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
        // 播放按钮点击音效
        this.audioManager.playSFX('buttonClick');
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
      this.modalRenderer.showToast('道具数量不足');
      return;
    }

    // 处理不同道具
    if (type === 'grab') {
      // 进入抓取模式
      this.propMode = 'grab';
      this.modalRenderer.showToast('点击要移除的方块', 2000);
      console.log('[DirectionGame] 进入抓取模式');
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

    // 播放道具使用音效
    this.audioManager.playSFX('propUse');

    // 翻转所有方块
    databus.blocks.forEach(block => {
      if (!block.isRemoved) {
        block.flip();
      }
    });

    // 更新UI
    this.gameRenderer.updatePropCount('flip', databus.items.flip);

    // 不立即检测死局，让玩家先操作
    // 死局检测只会在玩家点击方块后进行
    console.log('[DirectionGame] 使用了翻转道具');

    this.modalRenderer.showToast('已翻转所有方块');
  }

  /**
   * 使用洗牌道具（位置）- 随机重排方块位置
   */
  useShufflePosProp() {
    const databus = GameGlobal.databus;

    if (!databus.useItem('shufflePos')) return;

    // 播放道具使用音效
    this.audioManager.playSFX('propUse');

    // 获取所有未消除方块的“中心点位置”
    // 关键：不能交换 top-left（不同方向/尺寸会导致对齐崩坏），交换中心点才能保持排列感
    const activeBlocks = databus.blocks.filter(b => !b.isRemoved);
    const groups = new Map();
    activeBlocks.forEach(block => {
      const axis = block.axis || (block.direction === 0 || block.direction === 2 ? 'row' : 'col');
      if (!block.axis) block.axis = axis;
      if (!groups.has(axis)) groups.set(axis, []);
      groups.get(axis).push(block);
    });

    groups.forEach(group => {
      const slots = group.map(b => ({
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
        gridRow: b.gridRow,
        gridCol: b.gridCol
      }));

      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }

      group.forEach((block, index) => {
        const slot = slots[index];
        block.x = slot.cx - block.width / 2;
        block.y = slot.cy - block.height / 2;
        block.originalX = block.x;
        block.originalY = block.y;
        if (Number.isFinite(slot.gridRow) && Number.isFinite(slot.gridCol)) {
          block.gridRow = slot.gridRow;
          block.gridCol = slot.gridCol;
        }
      });
    });

    // 更新UI
    this.gameRenderer.updatePropCount('shufflePos', databus.items.shufflePos);

    // 不立即检测死局，让玩家先操作
    console.log('[DirectionGame] 使用了洗牌道具（位置）');

    this.modalRenderer.showToast('已重新排列方块');
  }

  /**
   * 使用洗牌道具（方向）- 随机重排方块朝向
   */
  useShuffleDirProp() {
    const databus = GameGlobal.databus;

    if (!databus.useItem('shuffleDir')) return;

    // 播放道具使用音效
    this.audioManager.playSFX('propUse');

    // 随机设置每个方块的方向（必须同步重算尺寸，且保持中心不变）
    // 直接改 block.direction 会导致“头尾旋转但身体不变/变形”
    const directions = [0, 1, 2, 3]; // UP, RIGHT, DOWN, LEFT
    databus.blocks.forEach(block => {
      if (!block.isRemoved) {
        const axis = block.axis || (block.direction === 0 || block.direction === 2 ? 'row' : 'col');
        const axisDirs = axis === 'row' ? [0, 2] : axis === 'col' ? [1, 3] : directions;
        const dir = axisDirs[Math.floor(Math.random() * axisDirs.length)];
        if (!block.axis && (axis === 'row' || axis === 'col')) block.axis = axis;
        if (typeof block.setDirection === 'function') {
          block.setDirection(dir);
        } else {
          // 兜底：保持旧逻辑（理论不会走到）
          block.direction = dir;
        }
      }
    });

    // 更新UI
    this.gameRenderer.updatePropCount('shuffleDir', databus.items.shuffleDir);

    // 不立即检测死局，让玩家先操作
    console.log('[DirectionGame] 使用了洗牌道具（方向）');

    this.modalRenderer.showToast('已重新排列方向');
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
      // 播放点击成功音效
      this.audioManager.playSFX('clickSuccess');

      block.remove();
      databus.removedBlocks++;

      // 播放飞出音效
      this.audioManager.playSFX('slideOut');

      // 检查胜利
      if (databus.removedBlocks >= databus.totalBlocks) {
        this.onVictory();
        return;
      }

      // 检查死局
      this.checkDeadlock();
    } else {
      // 播放点击失败音效
      this.audioManager.playSFX('clickFail');

      // 不可消除，向阻塞方向滑动到尽头
      if (!block.slideToBlocked(databus.blocks)) {
        block.shake();
      }
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
    const inset = BLOCK_SIZES.HITBOX_INSET || 0;
    const left = block.x + inset;
    const top = block.y + inset;
    const right = block.x + block.width - inset;
    const bottom = block.y + block.height - inset;
    if (right <= left || bottom <= top) return false;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  /**
   * 弹窗触摸处理
   */
  handleModalTouch(x, y) {
    const buttons = ['next', 'replay', 'useProp', 'retry', 'confirm', 'cancel'];

    for (const name of buttons) {
      const button = this.modalRenderer.getButton(name);
      if (button && button.isClicked(x, y)) {
        // 播放按钮点击音效
        this.audioManager.playSFX('buttonClick');

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

      case 'confirm':
        // 确认弹窗 - 执行回调
        const callback = this.modalRenderer.getConfirmCallback();
        this.modalRenderer.hide();
        if (callback) callback(true);
        break;

      case 'cancel':
        // 取消弹窗
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
    const cached = this.preloadedLevels.get(levelNumber);
    const levelData = cached || this.levelManager.generateLevel(levelNumber);
    if (cached) this.preloadedLevels.delete(levelNumber);

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

    // 切换到游戏进行BGM
    this.audioManager.playBGM('playing');

    // 预生成下一关，减少后续卡顿
    this.preloadLevel(levelNumber + 1);

    console.log(`关卡 ${levelNumber} 开始，方块数量: ${databus.totalBlocks}`);
  }

  preloadLevel(levelNumber, immediate = false) {
    if (levelNumber <= 0) return;
    if (this.preloadedLevels.has(levelNumber)) return;
    const build = () => {
      if (this.state !== 'menu' && this.state !== 'victory' && this.state !== 'defeat') {
        return;
      }
      const levelData = this.levelManager.generateLevel(levelNumber);
      this.preloadedLevels.set(levelNumber, levelData);
    };

    if (immediate) {
      build();
      return;
    }

    setTimeout(build, 0);
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

    // 播放胜利音效
    this.audioManager.playBGM('victory');

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

    // 播放失败音效
    this.audioManager.playBGM('defeat');

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
      // 绘制游戏界面（传递道具模式状态）
      this.gameRenderer.render(ctx, databus, this.propMode);

      // 绘制方块（包括正在滑出的方块）
      databus.blocks.forEach(block => {
        // 只要方块可见就渲染（让滑出动画完整播放）
        if (block.visible) {
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

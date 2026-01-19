# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

《乐消消·方向出走》是一款微信小游戏——基于方向阻挡机制的休闲益智游戏。玩家通过点击消除动物方块，但只有当方块的朝向路径未被阻挡时才能消除。

**平台**：微信小游戏（非 Node.js/Web）
**语言**：JavaScript ES6+
**渲染**：Canvas 2D API
**入口**：`game.js` → `js/main.js` → `js/game/DirectionGame.js`

## 开发命令

这是微信小游戏项目，而非传统的 Node.js 项目。没有 package.json，也没有 npm scripts。

**开发流程**：
1. 在 **微信开发者工具** 中打开项目
2. IDE 会自动将 ES6 转译为兼容的 JavaScript
3. 构建配置位于 `project.config.json`（已启用 ES6、代码压缩）
4. 通过微信小游戏模拟器和真机进行测试

**没有命令行构建流程** — 所有开发都在微信 IDE 中完成。

## 架构概览

代码库遵循分层架构，职责清晰分离：

```
UI 层 (js/ui/)
  ├── MenuRenderer, GameRenderer, ModalRenderer, BlockRenderer
  └── Button, PropButton, UIConstants
           ↓
游戏逻辑 (js/game/)
  ├── DirectionGame (主控制器, 698 行)
  ├── GameDataBus (单例全局状态)
  └── LevelManager
           ↓
核心系统 (js/game/algorithms/ + blocks/)
  ├── DirectionDetector (射线检测阻挡)
  ├── DeadlockDetector (游戏结束检测)
  ├── LevelGenerator (程序化关卡生成)
  └── Block (实体类)
           ↓
基础层 (js/base/)
  ├── Sprite (基类)
  ├── Pool (对象池)
  └── Particle (粒子效果)
```

### 关键设计模式

- **单例模式**：`GameDataBus` 通过 `GameGlobal.databus` 访问
- **事件驱动**：使用 `tinyemitter.js` 进行事件通信
- **对象池**：`Pool` 类复用 Block 实例以提升性能
- **渲染器模式**：每个 UI 部分都有独立的渲染器类

## 核心概念

### 游戏机制

- **方块有 4 个对角线方向**（45° 旋转：左上、右上、左下、右下）
- **消除规则**：只有当方块的朝向路径到屏幕边缘无阻挡时才能消除
- **5 种动物**：猪、羊、狗、狐狸、熊猫（每种都有独特的视觉特征）
- **4 种道具**：抓走、翻转、洗牌位置、洗牌方向
- **死局检测**：游戏检查是否存在可消除的方块；若无，游戏结束

### 方向检测算法

位于 `js/game/algorithms/DirectionDetector.js`（394 行）

使用 **射线投射** 检测阻挡：
1. 从方块中心沿朝向方向发射射线
2. 逐步检测（8px 步长）
3. 检测射线点是否进入其他方块的 AABB 碰撞盒
4. 到达屏幕边缘无阻挡 → 可消除

**性能**：网格优化模式 O(1)，回退射线投射 O(n × steps)

### 关卡生成

位于 `js/game/algorithms/LevelGenerator.js`（796 行）

**策略**：旋转网格 + 双格方块布局
1. 生成方形网格单元格
2. 整体旋转 45°（对角线朝向）
3. 每个动物占据 2 个相邻单元格
4. 从中心向外填充

**难度缩放**：
- 第 1-3 关：80-92 方块，大尺寸（18px）
- 第 4-10 关：102-138 方块，中尺寸（16px）
- 第 11-20 关：131-176 方块，小尺寸（14px）
- 第 20+ 关：155-220 方块，小尺寸（14px）

**可解性保证**：预生成多个布局（最多 6 次尝试），确保初始可消除方块 ≥20%，通过随机模拟验证路径可解性

### 方块渲染

位于 `js/ui/BlockRenderer.js`（1099 行）

**视觉风格**：胶囊状身体（3:1 比例），45° 对角线旋转
**绘制技术**：贝塞尔曲线绘制流线型形状，线性渐变实现深度，柔和阴影和高光
**动物特征**：5 种动物各有独特特征（耳朵、鼻子、尾巴等）

## 重要文件

### 核心游戏文件
- `game.js` - 入口文件（导入 main.js）
- `js/main.js` - 应用入口（创建 DirectionGame 实例）
- `js/render.js` - Canvas 设置和屏幕尺寸
- `js/game/DirectionGame.js` - 游戏主控制器（698 行）
- `js/game/GameDataBus.js` - 全局状态管理（单例）

### 算法文件
- `js/game/algorithms/DirectionDetector.js` - 射线投射方向阻挡检测
- `js/game/algorithms/DeadlockDetector.js` - 游戏结束检测
- `js/game/algorithms/LevelGenerator.js` - 程序化关卡生成

### 实体文件
- `js/game/blocks/Block.js` - 方块实体类（475 行）
- `js/game/LevelManager.js` - 关卡管理器

### UI 文件
- `js/ui/UIConstants.js` - 所有视觉配置（颜色、尺寸、位置）
- `js/ui/BlockRenderer.js` - 方块渲染（1099 行）
- `js/ui/GameRenderer.js` - 游戏界面渲染
- `js/ui/MenuRenderer.js` - 菜单渲染
- `js/ui/ModalRenderer.js` - 弹窗/对话框渲染

### 配置文件
- `project.config.json` - 微信项目配置（ES6、压缩设置）
- `game.json` - 游戏设置（竖屏方向）

## 使用微信 API

代码库使用微信小游戏 API（`wx.*`）：

- `wx.onTouchStart()` - 触摸事件处理
- `wx.setStorageSync()` / `wx.getStorageSync()` - 游戏进度本地存储
- `wx.createInnerAudioContext()` - 音频播放

当添加需要持久化或平台功能的新特性时，使用微信小游戏 API，而非 Web API。

## 游戏状态管理

`GameDataBus` 是单例全局状态管理器。通过 `GameGlobal.databus` 访问。

**关键属性**：
- `blocks: []` - 当前关卡的方块数组
- `particles: []` - 粒子效果数组
- `totalBlocks: 0` - 方块总数
- `removedBlocks: 0` - 已消除数量
- `currentLevel: 1` - 当前关卡号
- `unlockedLevels: 1` - 已解锁关卡数
- `items: {}` - 道具数量（grab, flip, shufflePos, shuffleDir）

**关键方法**：
- `saveProgress()` - 持久化到 `wx.setStorageSync('gameProgress')`
- `loadProgress()` - 从存储加载
- `useItem(itemType)` - 消耗道具
- `addItem(itemType, count)` - 增加道具
- `createExplosion(x, y, count, color)` - 创建粒子效果

## UI 自定义

所有视觉参数集中在 `js/ui/UIConstants.js`：

- `COLORS` - 配色方案（背景、动物、道具等）
- `BLOCK_SIZES` - 方块尺寸（3:1 比例胶囊）
- `BUTTON_STYLES` - 按钮样式
- 布局常量（位置、尺寸、间距）

要修改视觉外观，应修改 `UIConstants.js`，而非单独的渲染器文件。

## 音频系统

位于 `js/audio/`：
- `AudioManager.js` - 音频播放控制器
- `AudioConfig.js` - 音频文件映射

**背景音乐**：`playBGM('menu' | 'game')`
**音效**：`playSFX('buttonClick' | 'eliminate' | 'error' | 等)`

## 测试

没有正式的测试框架。通过以下方式进行手动测试：
1. 微信开发者工具模拟器
2. 微信 App 真机测试

进行修改时，先在模拟器中测试，然后在真机上验证触摸和性能。

## 代码风格说明

- ES6+ 模块，使用 `import`/`export`
- 基于类的架构
- 中文注释很常见（这是中文项目）
- 控制台日志用于调试
- 大多数类使用构造函数初始化，方法定义为类方法

## 常见修改模式

**添加新的动物类型**：
1. 在 `UIConstants.js` 中添加常量（颜色、特征）
2. 更新 `BlockRenderer.js` 绘制逻辑
3. 在 `Block.js` 类型枚举中添加

**添加新的道具**：
1. 在 `GameDataBus.items` 初始化中添加
2. 在 `GameRenderer.js` 中添加按钮
3. 在 `DirectionGame.js` 触摸事件中添加处理
4. 在 `AudioConfig.js` 中添加音频

**调整难度**：
1. 修改 `LevelGenerator.js` 难度参数
2. 调整方块数量、尺寸或可解性阈值

**更换视觉主题**：
1. 更新 `UIConstants.js` 中的颜色
2. 修改渲染器文件中的背景渐变
3. 更新 `Button.js` 中的按钮样式

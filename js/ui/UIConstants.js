/**
 * UI配置常量
 * 根据 PRD.md 第十三、十八章节定义
 */

// ==================== 颜色方案 ====================

/**
 * 主色调
 */
export const COLORS = {
  // 背景色：浅蓝渐变
  BACKGROUND_START: '#E3F2FD',
  BACKGROUND_END: '#BBDEFB',

  // 棋盘区域：白色半透明
  BOARD_BACKGROUND: 'rgba(255, 255, 255, 0.8)',

  // 进度条：橙色渐变
  PROGRESS_BAR_START: '#FF9800',
  PROGRESS_BAR_END: '#F57C00',

  // 道具按钮颜色
  PROP_GRAB: '#4FC3F7',      // 蓝色 - 抓走
  PROP_FLIP: '#FFD54F',      // 黄色 - 翻转
  PROP_SHUFFLE: '#BA68C8',   // 紫色 - 洗牌

  // 主按钮
  PRIMARY_BUTTON: '#FFEB3B', // 亮黄色

  // 文字颜色
  TEXT_PRIMARY: '#333333',
  TEXT_SECONDARY: '#666666',
  TEXT_WHITE: '#FFFFFF',

  // 棋盘木质背景
  WOOD_BACKGROUND: '#8D6E63',
  WOOD_BORDER: '#5D4037',

  // 动物方块配色（糖果色系）
  ANIMAL_CAT: '#FFB74D',        // 橙色系
  ANIMAL_DOG: '#A1887F',        // 棕色系
  ANIMAL_RABBIT: '#FFFFFF',     // 白色系
  ANIMAL_BEAR: '#D7CCC8',       // 浅棕色系
  ANIMAL_FOX: '#FF7043',        // 红色系
  ANIMAL_PANDA: '#333333',      // 黑白配色
  ANIMAL_KOALA: '#9E9E9E',      // 灰色系
  ANIMAL_LION: '#FFCA28',       // 黄色系

  // 被阻挡状态（点击抖动反馈）
  SHAKE_OPACITY: 1.0            // 保持完全不透明
};

// ==================== 尺寸规范 ====================

/**
 * 方块尺寸（优化版 - 修复溢出问题）
 */
export const BLOCK_SIZES = {
  // 胶囊长边：更贴近效果图（长度≈2×宽度+间距）
  // 当前 WIDTH=24, SPACING=4 => LENGTH≈52
  LENGTH: 52,
  WIDTH: 24,          // 宽度（纵向）- 缩小25%
  MIN_CLICK_AREA: 24, // 最小可点击区域
  SPACING: 4,         // 相邻方块间距
  CORNER_RADIUS: 10,  // 胶囊圆角

  // 网格单元计算（必须容纳最大尺寸）
  GRID_CELL_SIZE: 58,        // 单元格大小：约52px（长边）+ 6px间距
  GRID_SPACING: 6,           // 单元格之间间距
  SAFETY_MARGIN: 6,          // 防溢出安全边距
  CAPSULE_ASPECT_RATIO: 52 / 24  // 胶囊长宽比 2.17:1
};

/**
 * 按钮尺寸
 */
export const BUTTON_SIZES = {
  PROP: 75,           // 道具按钮（更大更醒目）
  SETTINGS: 44,       // 设置按钮
  PRIMARY: {          // 主按钮
    WIDTH: 180,
    HEIGHT: 70
  },
  SECONDARY: {        // 次按钮
    WIDTH: 110,
    HEIGHT: 55
  }
};

/**
 * 布局尺寸
 */
export const LAYOUT = {
  TOP_BAR_HEIGHT: 60,        // 顶部栏高度
  BOTTOM_BAR_HEIGHT: 110,    // 底部道具栏高度（增大以容纳更大按钮）
  PROGRESS_BAR_HEIGHT: 12,   // 进度条高度
  SIDE_PADDING: 16,          // 左右边距
  TOP_PADDING: 16,           // 顶部边距

  // 棋盘区域（关卡UI与关卡生成必须共用同一套参数）
  BOARD_TOP_OFFSET: 60,      // 顶部栏下方预留（进度/标题区域）
  BOARD_BOTTOM_MARGIN: 10    // 棋盘与底部道具栏之间的间距
};

// ==================== 字体规范 ====================

/**
 * 字号
 */
export const FONT_SIZES = {
  LEVEL_TITLE: 24,      // 关卡编号（粗体）
  PROGRESS: 32,         // 进度百分比（粗体）
  BUTTON: 16,           // 按钮文字
  HINT: 14,             // 提示文字
  TITLE: 32,            // 主标题（从48改为32）
  SUBTITLE: 20,         // 副标题（从24改为20）
  MODAL_TITLE: 28,      // 弹窗标题专用
  MODAL_SUBTITLE: 18,   // 弹窗副标题
  MODAL_HINT: 16        // 弹窗提示文字
};

/**
 * 字重
 */
export const FONT_WEIGHTS = {
  BOLD: 'bold',
  NORMAL: 'normal'
};

// ==================== 动画参数 ====================

/**
 * 方块滑动动画
 */
export const ANIMATION = {
  SLIDE_SPEED: 800,           // 滑动速度（dp/s）
  SHAKE_AMPLITUDE: 5,         // 抖动幅度（度）
  SHAKE_DURATION: 300,        // 抖动时长（ms）
  SHAKE_COUNT: 3,             // 抖动次数
  SLIDE_EASING: 'ease-in',    // 滑动缓动

  // 按钮点击反馈
  BUTTON_PRESS_SCALE: 0.9,  // 点击时缩小至90%

  // 滑动距离时长
  SLIDE_DURATION_SHORT: 250,   // 短距离（<200dp）
  SLIDE_DURATION_MEDIUM: 400,  // 中距离（200-400dp）
  SLIDE_DURATION_LONG: 600     // 长距离（>400dp）
};

// ==================== 动物类型定义 ====================

/**
 * 动物方块类型（PRD v1.3: 参考截图主要3种）
 */
export const ANIMAL_TYPES = {
  PIG: 'pig',       // 粉色猪（主要）
  SHEEP: 'sheep',   // 白色羊（主要）
  DOG: 'dog',       // 橙黄色狗/仓鼠（主要）
  // 保留其他类型供高级关卡使用
  CAT: 'cat',
  RABBIT: 'rabbit',
  BEAR: 'bear',
  FOX: 'fox',
  PANDA: 'panda'
};

/**
 * 主要动物类型（用于前期关卡）
 */
export const MAIN_ANIMAL_TYPES = [
  ANIMAL_TYPES.PIG,
  ANIMAL_TYPES.SHEEP,
  ANIMAL_TYPES.DOG
];

/**
 * 动物显示名称
 */
export const ANIMAL_NAMES = {
  pig: '小猪',
  sheep: '小羊',
  dog: '小狗',
  cat: '小猫',
  rabbit: '小兔',
  bear: '小熊',
  fox: '小狐',
  panda: '小熊猫'
};

/**
 * 动物颜色（PRD v1.3: 参考截图配色）
 */
export const ANIMAL_COLORS = {
  pig: '#FFB6C1',      // 粉红色
  sheep: '#FFFFFF',    // 白色
  dog: '#FFB347',      // 橙黄色
  cat: '#FFB74D',      // 橙色系
  rabbit: '#F5F5F5',   // 白色系
  bear: '#D7CCC8',     // 浅棕色系
  fox: '#FF7043',      // 红色系
  panda: '#333333'     // 黑白配色
};

/**
 * 获取动物颜色
 */
export function getAnimalColor(type) {
  return ANIMAL_COLORS[type] || ANIMAL_COLORS.pig;
}

// ==================== 道具类型 ====================

/**
 * 道具类型（PRD v1.3：4种道具）
 */
export const PROP_TYPES = {
  GRAB: 'grab',              // 抓走
  FLIP: 'flip',              // 翻转
  SHUFFLE_POS: 'shufflePos', // 洗牌（位置）
  SHUFFLE_DIR: 'shuffleDir'  // 洗牌（方向）
};

/**
 * 道具显示名称
 */
export const PROP_NAMES = {
  grab: '抓走',
  flip: '翻转',
  shufflePos: '洗牌',
  shuffleDir: '洗牌'
};

/**
 * 道具颜色（PRD v1.3：圆角矩形按钮）
 */
export const PROP_COLORS = {
  grab: '#2196F3',      // 蓝色
  flip: '#FFC107',      // 黄色
  shufflePos: '#9C27B0', // 紫色
  shuffleDir: '#E91E63'  // 粉紫色
};

/**
 * 获取道具颜色
 */
export function getPropColor(type) {
  return PROP_COLORS[type] || PROP_COLORS.grab;
}

// ==================== 辅助函数 ====================

/**
 * 绘制圆角矩形
 */
export function drawRoundRect(ctx, x, y, width, height, radius) {
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

/**
 * 绘制圆形
 */
export function drawCircle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * 绘制胶囊形（长条圆角矩形）
 */
export function drawCapsule(ctx, x, y, width, height) {
  const radius = Math.min(width, height) / 2;
  drawRoundRect(ctx, x, y, width, height, radius);
}

/**
 * 获取棋盘区域矩形（关卡UI与关卡生成共用）
 */
export function getBoardRect(screenWidth, screenHeight) {
  const x = LAYOUT.SIDE_PADDING;
  const y = LAYOUT.TOP_BAR_HEIGHT + LAYOUT.BOARD_TOP_OFFSET;
  const width = screenWidth - LAYOUT.SIDE_PADDING * 2;
  const bottomY = screenHeight - LAYOUT.BOTTOM_BAR_HEIGHT - LAYOUT.BOARD_BOTTOM_MARGIN;
  const height = Math.max(0, bottomY - y);

  return { x, y, width, height };
}

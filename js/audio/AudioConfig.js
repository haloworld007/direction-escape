/**
 * 音频配置常量
 * 根据 PRD 第十四章定义
 */

// 背景音乐配置
export const BGM_CONFIG = {
  menu: {
    src: 'audio/bgm/menu.mp3',
    volume: 0.3,
    loop: true
  },
  playing: {
    src: 'audio/bgm/playing.mp3',
    volume: 0.3,
    loop: true
  },
  victory: {
    src: 'audio/bgm/victory.mp3',
    volume: 0.4,
    loop: false
  },
  defeat: {
    src: 'audio/bgm/defeat.mp3',
    volume: 0.3,
    loop: false
  }
};

// 音效配置
export const SFX_CONFIG = {
  clickSuccess: {
    src: 'audio/sfx/click_success.mp3',
    volume: 0.7
  },
  clickFail: {
    src: 'audio/sfx/click_fail.mp3',
    volume: 0.5
  },
  slideOut: {
    src: 'audio/sfx/slide_out.mp3',
    volume: 0.6
  },
  disappear: {
    src: 'audio/sfx/disappear.mp3',
    volume: 0.5
  },
  propUse: {
    src: 'audio/sfx/prop_use.mp3',
    volume: 0.7
  },
  buttonClick: {
    src: 'audio/sfx/button_click.mp3',
    volume: 0.6
  }
};

// 默认音量设置
export const DEFAULT_VOLUMES = {
  bgm: 0.3,
  sfx: 0.7
};

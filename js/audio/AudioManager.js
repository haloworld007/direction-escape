/**
 * 音频管理器
 * 负责：
 * - 背景音乐播放和切换
 * - 音效播放
 * - 音量控制
 * - 开关控制
 */

import { BGM_CONFIG, SFX_CONFIG, DEFAULT_VOLUMES } from './AudioConfig';

export default class AudioManager {
  constructor() {
    // 音量设置
    this.bgmVolume = DEFAULT_VOLUMES.bgm;
    this.sfxVolume = DEFAULT_VOLUMES.sfx;

    // 开关状态
    this.bgmEnabled = true;
    this.sfxEnabled = true;

    // 当前播放的BGM
    this.currentBGM = null;
    this.currentBGMName = null;

    // 音效池（复用InnerAudioContext）
    this.sfxPool = {};

    // 从本地存储加载设置
    this.loadSettings();
  }

  /**
   * 加载音频设置
   */
  loadSettings() {
    try {
      const settings = wx.getStorageSync('audioSettings');
      if (settings) {
        this.bgmVolume = settings.bgmVolume ?? DEFAULT_VOLUMES.bgm;
        this.sfxVolume = settings.sfxVolume ?? DEFAULT_VOLUMES.sfx;
        this.bgmEnabled = settings.bgmEnabled ?? true;
        this.sfxEnabled = settings.sfxEnabled ?? true;
      }
    } catch (e) {
      console.warn('[AudioManager] 加载音频设置失败', e);
    }
  }

  /**
   * 保存音频设置
   */
  saveSettings() {
    try {
      wx.setStorageSync('audioSettings', {
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        bgmEnabled: this.bgmEnabled,
        sfxEnabled: this.sfxEnabled
      });
    } catch (e) {
      console.warn('[AudioManager] 保存音频设置失败', e);
    }
  }

  /**
   * 播放背景音乐
   * @param {string} name - BGM名称（menu/playing/victory/defeat）
   */
  playBGM(name) {
    if (!this.bgmEnabled) return;

    const config = BGM_CONFIG[name];
    if (!config) {
      console.warn(`[AudioManager] 未找到BGM配置: ${name}`);
      return;
    }

    // 如果正在播放同一个BGM，不做处理
    if (this.currentBGMName === name && this.currentBGM) {
      return;
    }

    // 停止当前BGM
    this.stopBGM();

    // 创建新的音频实例
    this.currentBGM = wx.createInnerAudioContext();
    this.currentBGM.src = config.src;
    this.currentBGM.volume = config.volume * this.bgmVolume;
    this.currentBGM.loop = config.loop;

    // 播放
    this.currentBGM.play();
    this.currentBGMName = name;

    console.log(`[AudioManager] 播放BGM: ${name}`);
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this.currentBGM) {
      this.currentBGM.stop();
      this.currentBGM.destroy();
      this.currentBGM = null;
      this.currentBGMName = null;
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (this.currentBGM) {
      this.currentBGM.pause();
    }
  }

  /**
   * 恢复背景音乐
   */
  resumeBGM() {
    if (this.currentBGM && this.bgmEnabled) {
      this.currentBGM.play();
    }
  }

  /**
   * 播放音效
   * @param {string} name - 音效名称
   */
  playSFX(name) {
    if (!this.sfxEnabled) return;

    const config = SFX_CONFIG[name];
    if (!config) {
      console.warn(`[AudioManager] 未找到音效配置: ${name}`);
      return;
    }

    // 获取或创建音效实例
    let sfx = this.sfxPool[name];
    if (!sfx) {
      sfx = wx.createInnerAudioContext();
      sfx.src = config.src;
      this.sfxPool[name] = sfx;
    }

    // 设置音量并播放
    sfx.volume = config.volume * this.sfxVolume;
    sfx.stop(); // 先停止再播放，避免重叠
    sfx.seek(0);
    sfx.play();
  }

  /**
   * 设置BGM音量
   * @param {number} volume - 音量（0-1）
   */
  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.currentBGM) {
      this.currentBGM.volume = this.bgmVolume;
    }
    this.saveSettings();
  }

  /**
   * 设置SFX音量
   * @param {number} volume - 音量（0-1）
   */
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * 切换BGM开关
   */
  toggleBGM() {
    this.bgmEnabled = !this.bgmEnabled;
    if (!this.bgmEnabled) {
      this.pauseBGM();
    } else {
      this.resumeBGM();
    }
    this.saveSettings();
    return this.bgmEnabled;
  }

  /**
   * 切换SFX开关
   */
  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    this.saveSettings();
    return this.sfxEnabled;
  }

  /**
   * 销毁所有音频资源
   */
  destroy() {
    this.stopBGM();
    Object.values(this.sfxPool).forEach(sfx => {
      sfx.destroy();
    });
    this.sfxPool = {};
  }
}

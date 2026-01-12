# 音频资源说明

本目录需要放置游戏的音频文件。所有音频文件均使用 MP3 格式。

## 目录结构

```
audio/
├── bgm/           # 背景音乐
│   ├── menu.mp3
│   ├── playing.mp3
│   ├── victory.mp3
│   └── defeat.mp3
└── sfx/           # 音效
    ├── click_success.mp3
    ├── click_fail.mp3
    ├── slide_out.mp3
    ├── disappear.mp3
    ├── prop_use.mp3
    └── button_click.mp3
```

## BGM（背景音乐）规格

| 文件名 | 用途 | 时长 | 风格 | 音量 |
|--------|------|------|------|------|
| menu.mp3 | 主菜单背景 | 45秒循环 | 轻快愉悦，120 BPM | 30% |
| playing.mp3 | 游戏进行 | 60秒循环 | 专注放松，90-100 BPM | 30% |
| victory.mp3 | 胜利音效 | 5秒 | 欢快成就感 | 40% |
| defeat.mp3 | 失败音效 | 3秒 | 遗憾但不沮丧 | 30% |

## SFX（音效）规格

| 文件名 | 用途 | 时长 | 描述 | 音量 |
|--------|------|------|------|------|
| click_success.mp3 | 点击成功 | 0.1秒 | 清脆的 "pop" 声 | 70% |
| click_fail.mp3 | 点击失败 | 0.1秒 | 低沉的 "thud" 声 | 50% |
| slide_out.mp3 | 飞出音效 | 0.3秒 | 快速的 "whoosh" 声 | 60% |
| disappear.mp3 | 消失音效 | 0.2秒 | 柔和的 "sparkle" 声 | 50% |
| prop_use.mp3 | 道具使用 | 0.3秒 | 魔法声 | 70% |
| button_click.mp3 | 按钮点击 | 0.1秒 | 清脆声 | 60% |

## 音频参数

- **格式**: MP3
- **采样率**: 44.1 kHz
- **比特率**: BGM 128 kbps，SFX 64 kbps

## 免费音频资源推荐

### BGM 来源
- [Incompetech](https://incompetech.com/music/) - Kevin MacLeod 的免费音乐
- [Bensound](https://www.bensound.com/) - 免费背景音乐
- [Freesound.org](https://freesound.org/) - 免费音效库

### 音效来源
- [Freesound.org](https://freesound.org/) - 免费音效库
- [Zapsplat](https://www.zapsplat.com/) - 免费音效库（需注册）

## 临时占位文件

在获取正式音频文件之前，可以使用以下方法生成临时占位音频：

1. 使用在线工具生成简单音效
2. 使用音频编辑软件（如 Audacity）创建简单音效
3. 从免费音效库下载类似音效作为占位

## 注意事项

- 所有音频文件必须是 MP3 格式
- 确保音频版权清晰，使用免费或购买的音频资源
- 音量配置已在 `js/audio/AudioConfig.js` 中定义

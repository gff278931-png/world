# 资源使用说明

## 依赖安装
需要安装以下工具来处理图片与音频：
```bash
brew install ffmpeg imagemagick webp
```

## 使用方法
1. 克隆仓库并切换到资源分支：
```bash
git checkout -b feat/assets
```

2. 运行资源获取脚本：
```bash
chmod +x scripts/fetch_assets.sh
./scripts/fetch_assets.sh
```

3. 启动开发服务器：
```bash
npm install
npm run dev
```

4. 访问页面：http://localhost:5173/#/play

## 资源来源与许可

### 图片资源
- Kenney UI Pack (https://kenney.nl/assets/ui-pack)
  - 许可：CC0 / Public Domain
  - 用途：按钮、面板等 UI 元素
  - 尺寸：44x44 (1x) 和 88x88 (2x)

- Kenney Game Icons (https://kenney.nl/assets/game-icons)
  - 许可：CC0 / Public Domain
  - 用途：24 种卡片牌面
  - 尺寸：40x40 (1x) 和 80x80 (2x)

### 音效资源
所有音效来自 Mixkit，使用 Mixkit Free License（允许商用，无需署名）：

- select.mp3: https://mixkit.co/free-sound-effects/notification/
- match.mp3: https://mixkit.co/free-sound-effects/game/
- win.mp3: https://mixkit.co/free-sound-effects/win/
- lose.mp3: https://mixkit.co/free-sound-effects/game-over/

音频规格：44.1kHz stereo MP3，128kbps，长度限制在 1.5s 内。

## 文件结构
```
public/
  assets/
    cards/
      card-01.webp      # 1x 牌面
      card-01@2x.webp   # 2x 牌面 (Retina)
      ...
    ui/
      undo.webp
      hint.webp
      shuffle.webp
      restart.webp
      pause.webp
      play.webp
      sound-on.webp
      sound-off.webp
      placeholder.webp
    manifest.json      # 资源清单
  audio/
    select.mp3
    match.mp3
    win.mp3
    lose.mp3
    silent.mp3
```

## 资源大小限制
- 单个图片文件：≤ 150KB
- 总资源体积（首屏）：≤ 2.5MB
- 音频文件：44.1kHz stereo MP3，128kbps
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Checking dependencies...${NC}"

# Check dependencies
command -v convert >/dev/null 2>&1 || { 
  echo -e "${RED}ImageMagick (convert) is required but not installed.${NC}"
  echo "Install with: brew install imagemagick"
  exit 1
}

command -v ffmpeg >/dev/null 2>&1 || {
  echo -e "${RED}ffmpeg is required but not installed.${NC}"
  echo "Install with: brew install ffmpeg"
  exit 1
}

command -v cwebp >/dev/null 2>&1 || {
  echo -e "${RED}webp tools are required but not installed.${NC}"
  echo "Install with: brew install webp"
  exit 1
}

# Create required directories
mkdir -p ./downloaded
mkdir -p ./public/assets/cards
mkdir -p ./public/assets/ui
mkdir -p ./public/assets/audio
mkdir -p ./temp

# 下载函数：如果文件不存在则下载
download() {
  local url="$1"
  local output="$2"
  if [ ! -f "$output" ]; then
    echo -e "${BLUE}Downloading $output...${NC}"
    curl -L "$url" -o "$output"
  else
    echo -e "${GREEN}$output already exists, skipping download${NC}"
  fi
}

# Kenney assets (UI Pack + Game Icons)
echo -e "${BLUE}Downloading Kenney assets...${NC}"
download "https://kenney.nl/content/3-assets/86-ui-pack/uipack_fixed.zip" "./downloaded/uipack.zip"
download "https://kenney.nl/content/3-assets/8-game-icons/gameicons.zip" "./downloaded/gameicons.zip"

# 解压 Kenney 资源
unzip -o -q ./downloaded/uipack.zip -d ./temp/ui
unzip -o -q ./downloaded/gameicons.zip -d ./temp/icons

# Mixkit audio assets
echo -e "${BLUE}Downloading Mixkit audio assets...${NC}"
download "https://assets.mixkit.co/sfx/download/mixkit-quick-win-video-game-notification-269.wav" "./downloaded/select.wav"
download "https://assets.mixkit.co/sfx/download/mixkit-game-ball-tap-2073.wav" "./downloaded/match.wav"
download "https://assets.mixkit.co/sfx/download/mixkit-winning-chimes-2015.wav" "./downloaded/win.wav"
download "https://assets.mixkit.co/sfx/download/mixkit-retro-arcade-game-over-470.wav" "./downloaded/lose.wav"

# 处理 UI 图标
echo -e "${BLUE}Processing UI icons...${NC}"
process_ui_icon() {
  local src="$1"
  local name="$2"
  # convert with adaptive quality to meet <=150KB size
  convert_with_target_size "$src" "./public/assets/ui/$name.webp" 44 44
  convert_with_target_size "$src" "./public/assets/ui/$name@2x.webp" 88 88
}

# UI 图标处理（从解压的 Kenney UI Pack 中选取合适的图标）
process_ui_icon "./temp/ui/PNG/blue_button00.png" "undo"
process_ui_icon "./temp/ui/PNG/blue_button01.png" "hint"
process_ui_icon "./temp/ui/PNG/blue_button02.png" "shuffle"
process_ui_icon "./temp/ui/PNG/blue_button03.png" "restart"
process_ui_icon "./temp/ui/PNG/blue_button04.png" "pause"
process_ui_icon "./temp/ui/PNG/blue_button05.png" "play"
process_ui_icon "./temp/ui/PNG/blue_boxCheckmark.png" "sound-on"
process_ui_icon "./temp/ui/PNG/blue_boxCross.png" "sound-off"

# Helper: convert image to webp with target max size (bytes)
convert_with_target_size() {
  local src="$1"
  local out="$2"
  local w="$3"
  local h="$4"
  local target_bytes=153600 # 150KB
  local quality=80
  local tmpout="${out}.tmp.webp"

  while true; do
    convert "$src" -resize ${w}x${h} -quality ${quality} -strip "$tmpout"
    if [ -f "$tmpout" ]; then
      size=$(stat -f%z "$tmpout" 2>/dev/null || stat -c%s "$tmpout" 2>/dev/null || echo 0)
      if [ "$size" -le "$target_bytes" ] || [ "$quality" -le 30 ]; then
        mv "$tmpout" "$out"
        break
      else
        quality=$((quality - 5))
        echo "Reducing quality to $quality for $out (size $size bytes)"
      fi
    else
      # fallback to convert without tmp
      convert "$src" -resize ${w}x${h} -quality $quality -strip "$out"
      break
    fi
  done
}

# 创建占位图
convert -size 44x44 xc:lightgray -quality 80 "./public/assets/ui/placeholder.webp"
convert -size 88x88 xc:lightgray -quality 80 "./public/assets/ui/placeholder@2x.webp"

# 处理卡片图标（从 Kenney Game Icons 中选取 24 个不同图标）
echo -e "${BLUE}Processing card icons...${NC}"
for i in {1..24}; do
  num=$(printf "%02d" $i)
  src="./temp/icons/PNG/White/2x/gamepad${i}.png"
  # 1x version (40x40)
  convert_with_target_size "$src" "./public/assets/cards/card-$num.webp" 40 40
  # 2x version (80x80)
  convert_with_target_size "$src" "./public/assets/cards/card-$num@2x.webp" 80 80
done

# 处理音频文件
echo -e "${BLUE}Processing audio files...${NC}"
process_audio() {
  local src="$1"
  local name="$2"
  # 转换为 44.1kHz stereo 128kbps MP3，限制长度在 1.5s 内
  ffmpeg -y -i "$src" -af "afade=t=out:st=1:d=0.5" -ar 44100 -ac 2 -b:a 128k -t 1.5 "./public/assets/audio/$name.mp3" 2>/dev/null
}

process_audio "./downloaded/select.wav" "select"
process_audio "./downloaded/match.wav" "match"
process_audio "./downloaded/win.wav" "win"
process_audio "./downloaded/lose.wav" "lose"

# 生成静音占位音频
ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 0.5 -q:a 9 "./public/assets/audio/silent.mp3" 2>/dev/null

# 生成资源清单 manifest.json
echo -e "${BLUE}Generating manifest.json...${NC}"

build_card_array() {
  local postfix="$1"
  local lines=()
  for i in {1..24}; do
    local num
    num=$(printf "%02d" "$i")
    local path="/assets/cards/card-${num}${postfix}.webp"
    if [ "$i" -lt 24 ]; then
      lines+=("    \"${path}\",")
    else
      lines+=("    \"${path}\"")
    fi
  done
  printf "%s\n" "${lines[@]}"
}

cards_1x=$(build_card_array "")
cards_2x=$(build_card_array "@2x")

cat > "./public/assets/manifest.json" << EOF
{
  "cards": [
$(printf "%s" "$cards_1x")
  ],
  "cards2x": [
$(printf "%s" "$cards_2x")
  ],
  "images": {
    "cards": [
$(printf "%s" "$cards_1x")
    ],
    "cards2x": [
$(printf "%s" "$cards_2x")
    ],
    "ui": {
      "undo": "/assets/ui/undo.webp",
      "hint": "/assets/ui/hint.webp",
      "shuffle": "/assets/ui/shuffle.webp",
      "restart": "/assets/ui/restart.webp",
      "pause": "/assets/ui/pause.webp",
      "play": "/assets/ui/play.webp",
      "soundOn": "/assets/ui/sound-on.webp",
      "soundOff": "/assets/ui/sound-off.webp",
      "placeholder": "/assets/ui/placeholder.webp"
    }
  },
  "audio": {
    "select": "/assets/audio/select.mp3",
    "match": "/assets/audio/match.mp3",
    "win": "/assets/audio/win.mp3",
    "lose": "/assets/audio/lose.mp3",
    "silent": "/assets/audio/silent.mp3"
  }
}
EOF

# 清理临时文件
echo -e "${BLUE}Cleaning up...${NC}"
rm -rf ./temp

# 检查文件大小
echo -e "${BLUE}Checking file sizes...${NC}"
find ./public/assets -type f -name "*.webp" -exec du -h {} \;
find ./public/assets/audio -type f -name "*.mp3" -exec du -h {} \;

# 计算总大小
total_size=$(du -ch ./public/assets/cards/*.webp ./public/assets/ui/*.webp ./public/assets/audio/*.mp3 | tail -n1 | cut -f1)
echo -e "${GREEN}Total assets size: $total_size${NC}"

if [ $(du -c ./public/assets/cards/*.webp ./public/assets/ui/*.webp ./public/assets/audio/*.mp3 | tail -n1 | cut -f1) -gt 2560 ]; then
  echo -e "${RED}Warning: Total size exceeds 2.5MB!${NC}"
  exit 1
else
  echo -e "${GREEN}Success! All assets are within size limits.${NC}"
fi

echo -e "${GREEN}Assets processing complete!${NC}"
echo "You can now run: npm run dev"

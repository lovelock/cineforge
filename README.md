# 影匠 Cineforge

> 影音格式工坊：把视频、音频和 DVD 规格转换交给本机 ffmpeg。

Linux 桌面音视频格式转换工具。调用**本机安装的 ffmpeg**，只做格式转换，不暴露码率、分辨率、GOP 等参数。重点支持把摄像机 MTS（AVCHD）转换成符合 DVD-Video 规格的 MPEG-2，也可处理常见视频/音频格式。

当前版本为 Electron 实现，Tauri 版本在规划中。

## 依赖

- Linux（X11 / Wayland）
- Node.js 20+（开发用）
- ffmpeg / ffprobe ≥ 6.0，需包含 `mpeg2video`、`ac3` 编码器；通用格式还需要 `libx264`、`aac`、`libmp3lame`、`libvpx-vp9`、`libopus`、`flac`

检查：

```bash
ffmpeg -version
ffmpeg -hide_banner -encoders | grep -E 'mpeg2video|ac3|libx264|aac'
```

## 开发

```bash
npm install
npm run dev
```

在容器 / 无 GPU / 受限沙箱环境中，Electron 默认沙箱可能无法启动；使用：

```bash
npm run dev:container
```

它会以 `--no-sandbox --disable-gpu` 启动，仅用于本地验证。

## 测试

```bash
npm test                # 单元测试 + 真实 ffmpeg 集成测试
npx tsc -p apps/electron/tsconfig.json
npx tsc -p apps/ui/tsconfig.json
```

## 构建安装包

```bash
npm run dist
```

产物在 `apps/electron/release/`：

- `*.AppImage`
- `*.deb`

`dist` 先用 electron-builder 生成 AppImage 与 `linux-unpacked`，再用 `scripts/build-deb.mjs` 以 tar/ar 组装 deb，规避 electron-builder 自带 fpm 在 Arch 系缺少 `libcrypt.so.1` 的问题。

一次构建全部 Linux 格式（AppImage、rpm、pacman，deb 由 `scripts/build-deb.mjs` 生成）：

```bash
npm -w apps/electron run dist:all
```

产物同样在 `apps/electron/release/`。

首次构建会下载 electron-builder 所需的工具；如果 Electron 二进制下载失败，可指定镜像后重跑：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## 发布

推送 `v*` 标签会触发 GitHub Actions（`.github/workflows/release.yml`），构建 AppImage、deb、rpm、pacman，并创建 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

标签需形如 `v1.2.3` 或 `v1.2.3-beta.1`；workflow 会把标签版本写入 `package.json` 后再打包。仓库的 Actions 需要具备写入 Release 的权限（workflow 已声明 `contents: write`）。

## 首次启动

应用依赖系统 ffmpeg。首次启动若未检测到可用的 ffmpeg，会弹出一次安装提示，按发行版给出安装命令（Arch/CachyOS、Debian/Ubuntu、Fedora、openSUSE），并提供“打开设置”入口。提示只出现一次；之后可通过主界面的红色横幅或“设置”继续处理。

## 支持的档案

| 档案 | 容器 / 扩展名 | 说明 |
|---|---|---|
| DVD-Video | MPEG-PS / `.mpg` | MPEG-2 + AC-3，PAL/NTSC 自动判定，可用于 DVD 刻录软件 |
| MP4 | `.mp4` | H.264 + AAC，faststart |
| MKV | `.mkv` | H.264 + AAC，兼容流直接复制 |
| MOV | `.mov` | H.264 + AAC |
| AVI | `.avi` | MPEG-4 + MP3 |
| WebM | `.webm` | VP9 + Opus |
| MP3 | `.mp3` | 仅音频 |
| M4A | `.m4a` | AAC |
| FLAC | `.flac` | 无损 |
| WAV | `.wav` | PCM 16-bit |

转换策略：**按流判断**。源编码被目标容器接受时直接复制（remux，快且无损）；不兼容的流单独重编码；转换后校验失败会自动回退为全部重编码（仅含复制流的计划）。

## DVD 输出说明

- 只生成**符合 DVD-Video 规格的 `.mpg` 文件**，不做菜单、VOB/IFO，也不直接刻盘。把 `.mpg` 交给 K3b、Brasero、dvdauthor 等工具即可。
- PAL：720×576、25fps；NTSC：720×480、29.97fps；视频 MPEG-2，音频 AC-3 48kHz。
- 按源帧率自动选择制式，也可手动覆盖；隔行素材禁止跨制式转换（v1 不做反交错）。
- 添加文件后会预检并显示“检测到 XX fps 素材 → PAL/NTSC DVD”；队列非空时目标格式与输出位置锁定，清空后可改。
- 支持移除选中、清空队列、重试失败/取消的任务。
- 23.976/24p 转 NTSC 使用 2:3 pulldown；50p/60p 转 25i/29.97i 保留运动。

## 中文文件名

全链路使用参数数组调用 ffmpeg，不经过 shell；输入输出使用绝对路径，不做 Unicode 规范化。中文、空格、全角括号、以 `-` 开头的文件名都能正常处理。

## 已知限制

- 只取第一条视频流和第一条音频流；不处理字幕、章节、多音轨。
- 不做反交错、裁剪、旋转、水印、调色。
- 不做硬件加速编码。
- 不内置 ffmpeg，需系统安装。
- 仅测试 Linux；Windows/macOS 未验证。
- Tauri 版尚未移植。

## 目录结构

```
apps/
  electron/        Electron 主进程、preload、核心转换逻辑与测试
  ui/              React + Vite 界面（后续 Tauri 复用）
packages/
  shared/          格式档案 JSON 与共享类型
docs/
  architecture.md   架构与转换流程
```

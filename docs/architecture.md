# 架构

## 总览

影匠（Cineforge）是一个 Linux 桌面音视频格式转换器，使用 Electron + React + TypeScript 实现。应用不内置 ffmpeg，而是调用系统安装的 `ffmpeg` / `ffprobe`。

```
React UI (apps/ui)
      │ 类型化 IPC
Electron main (apps/electron/src/main)
      │ spawn(argv[])
ffmpeg / ffprobe
```

转换核心位于 `apps/electron/src/core`，不依赖 Electron，便于单元测试和后续移植。

## 目录

| 路径 | 职责 |
|---|---|
| `apps/ui` | React + Vite 界面，后续可复用于其他桌面壳 |
| `apps/electron/src/main` | 窗口、IPC、对话框、队列生命周期 |
| `apps/electron/src/preload` | `contextBridge` 暴露的窄 API |
| `apps/electron/src/core` | 探测、计划、执行、校验、命名、队列 |
| `packages/shared` | 格式档案 JSON 与共享类型 |
| `scripts/build-deb.mjs` | 不依赖 fpm 的 deb 组装脚本 |

## 转换流水线

1. **预检**：`ffprobe -print_format json` 读取容器、时长、视频/音频流信息。
2. **按流计划**：源编码被目标容器接受时复制该流；不兼容的流单独重编码。
   - 全部复制：`remux`
   - 部分复制、部分重编码：`partial`
   - 全部重编码：`encode`
3. **执行**：通过参数数组调用 ffmpeg，写入同目录临时文件；`-progress pipe:1` 驱动进度。
4. **校验**：再次 ffprobe，检查流存在、编码、时长误差；DVD 额外检查分辨率、帧率、AC-3 48kHz。
5. **回退**：含复制流的计划校验失败时，自动改用全部重编码重试一次。

队列默认串行执行，单个文件失败不会阻塞后续文件。

## 格式档案

格式定义集中在 `packages/shared/profiles.json`，包含容器、扩展名、可复制的编码列表、默认编码器与参数。界面只暴露目标格式，不暴露码率、分辨率、GOP 等参数。

## DVD-Video

DVD 输出为 MPEG-PS 容器中的 MPEG-2 视频 + AC-3 音频。

| 项目 | PAL | NTSC |
|---|---|---|
| 分辨率 | 720×576 | 720×480 |
| 帧率 | 25 | 30000/1001 |
| GOP | 15 | 18 |
| 平均/最大码率 | 6000k / 9000k | 6000k / 9000k |

- 按源帧率自动选择制式，支持手动覆盖；隔行素材禁止跨制式转换。
- 场序通过 `setfield=tff|bff` 写入，配合 `-flags +ildct+ilme`。
- 23.976/24p → NTSC 使用 2:3 pulldown；50p/60p → 25i/29.97i 使用 `tinterlace`。
- 音频优先复制 48kHz AC-3；否则转 AC-3，5.1 用 448k、立体声用 384k。

## 健壮性与安全

- 所有子进程使用 argv 数组，不经过 shell；输入输出使用绝对路径。
- 文件名保持原始 Unicode，不做规范化；冲突时追加 ` (n)`，不覆盖已有文件。
- 输出先写临时文件，成功后以不覆盖方式落盘；失败或取消时删除临时文件。
- Electron 启用 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`，并拒绝窗口导航与新窗口。
- 转换队列运行中禁止修改队列和设置；退出前取消当前任务并等待清理。

## 打包与发布

- AppImage / rpm / pacman：electron-builder。
- deb：`scripts/build-deb.mjs` 使用 tar + ar 组装，避免依赖 fpm。
- CI：推送 `v*` 标签触发 GitHub Actions，构建四种包并创建 Release，附 `SHA256SUMS`。

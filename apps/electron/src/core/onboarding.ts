import type { Settings } from '@cineforge/shared';

export function shouldShowFirstRunPrompt(settings: Settings): boolean {
  return !settings.firstRunPromptShown;
}

export function buildInstallPrompt(missing: string[] = []): {
  title: string;
  message: string;
  detail: string;
} {
  const missingLine = missing.length > 0
    ? `\n\n当前缺少编码器：${missing.join('、')}。安装完整 ffmpeg 后重试。`
    : '';

  return {
    title: '需要安装 ffmpeg',
    message: '影匠调用本机 ffmpeg，当前没有检测到可用的 ffmpeg。',
    detail: [
      '请按你的发行版安装后重新启动应用：',
      '',
      'Arch / CachyOS:  sudo pacman -S ffmpeg',
      'Debian / Ubuntu:  sudo apt install ffmpeg',
      'Fedora:  sudo dnf install ffmpeg（需启用 RPM Fusion）',
      'openSUSE:  sudo zypper install ffmpeg',
      '',
      '需要 ffmpeg ≥ 6.0，并包含 mpeg2video、ac3 编码器。',
      '已安装但路径特殊？可在“设置”中指定 ffmpeg 路径。',
    ].join('\n') + missingLine,
  };
}

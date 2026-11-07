import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = join(repoRoot, 'apps/electron');
const release = join(appDir, 'release');
const unpacked = join(release, 'linux-unpacked');
const stage = join(release, 'deb-stage');

const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
const version = pkg.version;
const debName = `cineforge_${version}_amd64.deb`;
const debPath = join(release, debName);

try {
  await stat(join(unpacked, 'cineforge'));
} catch {
  console.error(`缺少 ${unpacked}/cineforge，请先运行 electron-builder --linux AppImage`);
  process.exit(1);
}

await rm(stage, { recursive: true, force: true });
await rm(debPath, { force: true });
await mkdir(join(stage, 'DEBIAN'), { recursive: true });
await mkdir(join(stage, 'opt'), { recursive: true });
await mkdir(join(stage, 'usr/share/applications'), { recursive: true });
await mkdir(join(stage, 'usr/share/icons/hicolor/512x512/apps'), { recursive: true });

await cp(unpacked, join(stage, 'opt/cineforge'), { recursive: true });
await cp(join(appDir, 'icon.png'), join(stage, 'usr/share/icons/hicolor/512x512/apps/cineforge.png'));

await writeFile(join(stage, 'usr/share/applications/cineforge.desktop'), `[Desktop Entry]
Name=影匠
Comment=影匠 Cineforge — 调用本机 ffmpeg 的音视频格式转换器
Exec=/opt/cineforge/cineforge %U
Icon=cineforge
Terminal=false
Type=Application
Categories=AudioVideo;
StartupWMClass=cineforge
`, 'utf8');

const sizeKb = Number(execFileSync('du', ['-sk', join(stage, 'opt/cineforge')], { encoding: 'utf8' }).split('\t')[0]);

await writeFile(join(stage, 'DEBIAN/control'), `Package: cineforge
Version: ${version}
Section: video
Priority: optional
Architecture: amd64
Maintainer: ${pkg.author}
Installed-Size: ${sizeKb}
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0, libgbm1, libasound2 | libasound2t64
Recommends: ffmpeg
Description: ${pkg.description}
`, 'utf8');

await chmod(join(stage, 'opt/cineforge/cineforge'), 0o755);
try {
  await chmod(join(stage, 'opt/cineforge/chrome-sandbox'), 0o4755);
} catch {
  // chrome-sandbox may be absent in some Electron builds
}

execFileSync('tar', ['-C', join(stage, 'DEBIAN'), '-cJf', join(release, 'control.tar.xz'), '.']);
execFileSync('tar', ['-C', stage, '--exclude=./DEBIAN', '-cJf', join(release, 'data.tar.xz'), '.']);
await writeFile(join(release, 'debian-binary'), '2.0\n', 'utf8');
execFileSync('ar', ['rc', debPath, 'debian-binary', 'control.tar.xz', 'data.tar.xz'], { cwd: release });

await rm(stage, { recursive: true, force: true });
await rm(join(release, 'control.tar.xz'), { force: true });
await rm(join(release, 'data.tar.xz'), { force: true });
await rm(join(release, 'debian-binary'), { force: true });

console.log(`built ${debPath}`);

// Рендерит баннеры бота из scripts/banners.html в assets/*.png через установленный Chrome (headless)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((p) => p && fs.existsSync(p));
if (!CHROME) throw new Error('Chrome не найден — укажи путь в переменной CHROME');

fs.mkdirSync('assets', { recursive: true });
const page = pathToFileURL(path.resolve('scripts/banners.html')).href;
for (const name of ['start', 'products', 'profile', 'ref', 'about']) {
  const out = path.resolve(`assets/${name}.png`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,600', `--screenshot=${out}`, `${page}?b=${name}`], { stdio: 'ignore' });
  console.log('✓', out);
}
// старые file_id от Telegram больше не актуальны
fs.rmSync('data/banners.json', { force: true });

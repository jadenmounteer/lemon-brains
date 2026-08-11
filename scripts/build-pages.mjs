import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'dist', 'site');
const hostOut = join(root, 'dist', 'apps', 'knowledge-quest', 'browser');
const lemonOut = join(root, 'dist', 'apps', 'lemon-brains', 'browser');
const ftkOut = join(root, 'dist', 'apps', 'fairy-tale-kingdom');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Building Knowledge Quest host...');
run('npm', [
  'run',
  'build',
  '--workspace=knowledge-quest',
  '--',
  '--configuration',
  'production',
  '--base-href',
  '/lemon-brains/',
]);

console.log('Building Lemon Brains game...');
run('npm', [
  'run',
  'build',
  '--workspace=lemon-brains',
  '--',
  '--configuration',
  'production',
  '--base-href',
  '/lemon-brains/games/lemon-brains/',
]);

console.log('Building Fairy Tale Kingdom...');
run('npm', ['run', 'build', '--workspace=fairy-tale-kingdom']);

if (!existsSync(hostOut) || !existsSync(lemonOut) || !existsSync(ftkOut)) {
  console.error('Expected build outputs were not found.');
  process.exit(1);
}

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });
cpSync(hostOut, siteDir, { recursive: true });
mkdirSync(join(siteDir, 'games', 'lemon-brains'), { recursive: true });
cpSync(lemonOut, join(siteDir, 'games', 'lemon-brains'), { recursive: true });
mkdirSync(join(siteDir, 'games', 'fairy-tale-kingdom'), { recursive: true });
cpSync(ftkOut, join(siteDir, 'games', 'fairy-tale-kingdom'), { recursive: true });

console.log(`Pages site assembled at ${siteDir}`);

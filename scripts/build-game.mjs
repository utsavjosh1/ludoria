import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'apps/web/public/game');
const output = join(root, 'out');
const walk = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]);
const files = walk(source);
for (const file of files) {
  if (file.endsWith('.js')) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    for (const match of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.') && !existsSync(resolve(dirname(file), match[1]))) throw new Error(`Missing module: ${match[1]}`);
    }
  }
}
const html = readFileSync(join(source, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) if (!existsSync(resolve(source, match[1]))) throw new Error(`Missing entry asset: ${match[1]}`);
for (const asset of ['town.png', 'dungeon.png', 'geist.woff', 'town-LICENSE.txt', 'dungeon-LICENSE.txt', 'geist-LICENSE.txt']) if (!existsSync(join(source, 'assets', asset))) throw new Error(`Missing asset or license: ${asset}`);
const bytes = files.reduce((total, file) => total + statSync(file).size, 0);
if (bytes > 250 * 1024) throw new Error(`Game exceeds the 250 KiB release budget: ${bytes} bytes`);
// out is generated output only. No source files are ever deleted by this build.
rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
console.log(`Ludoria: ${files.length} files, ${(bytes / 1024).toFixed(1)} KiB uncompressed. Ready in out/.`);

import { access, copyFile, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'sw.js', 'robots.txt', 'sitemap.xml']) {
  await copyFile(join(root, file), join(dist, file));
}
for (const dir of ['src', 'assets', 'vendor']) {
  await cp(join(root, dir), join(dist, dir), { recursive: true });
}

execFileSync(process.execPath, [join(root, 'tools/inject-code-sizes.mjs'), join(dist, 'index.html')], {
  cwd: root,
  stdio: 'inherit',
});

const serviceWorker = await readFile(join(root, 'sw.js'), 'utf8');
const precacheMatch = serviceWorker.match(/const FILES\s*=\s*(\[[\s\S]*?\]);/);
if (!precacheMatch) throw new Error('Could not find the service worker precache list.');
for (const file of JSON.parse(precacheMatch[1])) {
  if (file === './') continue;
  await access(join(dist, file));
}
console.log('Cloudflare Pages build ready in dist/.');

import { cp, mkdir, rm, stat } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'src', 'public', 'vendor']) await cp(file, `dist/${file}`, { recursive: true });
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(file, `dist/${file}`);
const { size } = await stat('dist/index.html');
if (!size) throw new Error('Empty build');
console.log('Built static game to dist/ (Three.js included locally; no runtime CDN or API).');

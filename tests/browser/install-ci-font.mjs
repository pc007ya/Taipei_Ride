// Runner-only screenshot font; never copied into the game or its dist output.
// Download the smaller Traditional Chinese face from the official Noto source,
// pin the source revision, and verify the exact Git blob hashes before use.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const revision = 'f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const base = `https://raw.githubusercontent.com/notofonts/noto-cjk/${revision}/Sans/`;
const directory = join(homedir(), '.local', 'share', 'fonts', 'taipei-ride-ci');
await mkdir(directory, { recursive: true });
for (const [source, filename, expected] of [
  ['OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf', 'NotoSansCJKtc-Regular.otf', 'f9376bae1d421520f73a3c6c9d50b22f89548301'],
  ['LICENSE', 'LICENSE.Noto.txt', 'd952d62c065f3f35fb83a173496e90b21525aef3'],
]) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(base + source, { signal: AbortSignal.timeout(90_000) });
      if (!response.ok) throw new Error(`Official font source returned ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (hash !== expected) throw new Error(`Pinned font integrity mismatch: ${filename}`);
      await writeFile(join(directory, filename), bytes);
      console.log(`Verified ${filename}: ${bytes.length} bytes, ${hash}`);
      failure = null;
      break;
    } catch (error) {
      failure = error;
      console.warn(`Font download attempt ${attempt}/3: ${error.message}`);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  if (failure) throw failure;
}
execFileSync('fc-cache', ['-f', directory], { stdio: 'inherit' });

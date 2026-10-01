import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
for(const name of ['three.module.js','three.core.js']) await copyFile(`node_modules/three/build/${name}`,`vendor/${name}`);
await copyFile('node_modules/three/LICENSE','vendor/LICENSE.three.txt');

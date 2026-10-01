import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
test('short desktop HUD overrides cannot apply to coarse landscape input',()=>{
 assert.ok(css.includes('@media(max-height:600px) and (min-width:651px) and (pointer:fine){'));
 assert.equal(css.includes('@media(max-height:600px) and (min-width:651px){'),false);
 const coarse=css.split('@media(max-height:600px) and (min-width:651px) and (pointer:coarse){')[1].split('\n}')[0];
 assert.match(coarse,/\.speed-panel\{[^}]*bottom:116px/);
 assert.match(coarse,/\.minimap-panel\{[^}]*bottom:116px/);
 assert.match(coarse,/\.touch-controls\{[^}]*bottom:18px/);
 assert.ok(116>18+81,'HUD bottom remains above the tallest touch control');
});

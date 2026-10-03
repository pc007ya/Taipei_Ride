import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/world.js';
import {createSampleStreet} from '../src/sample-street.js';
import {createSampleCharacter,createSampleScooter} from '../src/sample-characters.js';
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url))});
const data=JSON.parse(await readFile(new URL('../public/sample/walker.json',import.meta.url)));
const stats=g=>{let calls=0,triangles=0,vertices=0,bytes=0;const materials=new Set(),textures=new Set();g.traverseVisible(o=>{if(!o.isMesh)return;calls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;vertices+=o.geometry.attributes.position.count;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o.geometry.index)bytes+=o.geometry.index.array.byteLength;materials.add(o.material);for(const key of ['map','normalMap','roughnessMap','envMap'])if(o.material[key])textures.add(o.material[key]);});return {calls,triangles,vertices,geometryBytes:bytes,materials:materials.size,textures:textures.size};};
console.log(JSON.stringify({walker:stats(createSampleCharacter(data)),scooter:stats(await createSampleScooter()),street:stats(createSampleStreet(createWorld()))},null,2));

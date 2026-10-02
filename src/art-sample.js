import * as T from '../vendor/three.module.js';
import {createSampleStreet,isSampleStreetBuilding} from './sample-street.js';
import {createSampleScooter,createSampleWalker,animateSampleWalker} from './sample-characters.js';
export {isSampleStreetBuilding};
export function sampleEnabled(){return typeof location!=='undefined'&&new URLSearchParams(location.search).get('sample')==='refined';}
function studioEnvironment(renderer){
 const width=256,height=128,pixels=new Float32Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const t=y/(height-1),sky=t<.52,fade=Math.max(0,1-Math.abs(t-.48)*3),base=sky?[.43+.31*fade,.56+.24*fade,.68+.18*fade]:[.15,.17,.15],window=Math.abs(x/width-.22)<.065&&t>.22&&t<.47?1.7:Math.abs(x/width-.7)<.1&&t>.31&&t<.46?.7:0,i=(y*width+x)*4;pixels[i]=base[0]+window;pixels[i+1]=base[1]+window*.93;pixels[i+2]=base[2]+window*.82;pixels[i+3]=1;}
 const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;const generator=new T.PMREMGenerator(renderer),target=generator.fromEquirectangular(texture);generator.dispose();texture.dispose();return target;
}
export function installArtSample(renderer,world){
 const status={enabled:true,ready:false,error:null},cache=new Map();renderer.sample=status;const street=createSampleStreet(world);renderer.scene.add(street);
 renderer.renderer.shadowMap.enabled=true;renderer.renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.sun.castShadow=true;renderer.sun.shadow.mapSize.set(1024,1024);const camera=renderer.sun.shadow.camera;camera.left=camera.bottom=-145;camera.right=camera.top=145;camera.near=100;camera.far=1050;camera.updateProjectionMatrix();renderer.sun.shadow.bias=-.0003;renderer.sun.shadow.normalBias=.16;
 // Keep the exact production sun direction. Target and light translate together
 // so the small shadow map covers the sample instead of wasting an entire city.
 const baseSun=renderer.sun.position.clone(),target=new T.Vector3(800,0,515);renderer.sun.position.copy(baseSun).add(target);renderer.sun.target.position.copy(target);renderer.scene.add(renderer.sun.target);
 const environment=studioEnvironment(renderer.renderer);renderer.scene.environment=environment.texture;renderer.scene.environmentIntensity=.65;
 async function appearance(id){
  if(!cache.has(id))cache.set(id,Promise.all([createSampleScooter(id),createSampleWalker(id)]).then(([scooter,walker])=>({scooter,walker})));
  const models=await cache.get(id);if((renderer.appearance||'sunset')!==id)return;
  renderer.scene.remove(renderer.scooter);if(renderer.walker)renderer.scene.remove(renderer.walker);renderer.scooter=models.scooter;renderer.walker=models.walker;renderer.walker.visible=false;renderer.scene.add(renderer.scooter,renderer.walker);status.ready=true;
 }
 const controller={appearance,update(state,time){
  const daytime=!state.night&&typeof renderer.introProgress!=='number';renderer.light.intensity=daytime?.82:renderer.lastAtmosphere==='dusk'?.72:.55;renderer.sun.intensity=daytime?2.3:renderer.lastAtmosphere==='dusk'?1.5:.5;
  if(state.mode==='walking'&&renderer.walker?.userData.sample)animateSampleWalker(renderer.walker,time,state.player.actualSpeed??state.player.speed);
 },metrics(){const pose={};const walker=renderer.walker;if(walker?.userData.sample){walker.updateMatrixWorld(true);for(const side of ['l','r']){const bone=walker.userData.bones.find(b=>b.name===side+'-foot'),shoe=bone?.getObjectByName('sample-sneaker');pose[side]={foot:bone?.getWorldPosition(new T.Vector3()).toArray(),shoe:shoe?.getWorldPosition(new T.Vector3()).toArray(),localOffset:shoe?.position.toArray()};}}return {...status,pose};}};
 renderer.sampleReady=appearance(renderer.appearance||'sunset').catch(error=>{status.error=error.message;});return controller;
}

// Black-box public-game observation. Normal UI/keyboard only.
// The only page evaluation counts native requestAnimationFrame callbacks in a
// local closure. It neither reads game internals nor replaces/changes clocks,
// input state, physics, location, storage, rAF, or application code.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const scenario=process.env.SCENARIO || 'raf-tree';
const out=`test-results/original-${scenario}`;await mkdir(out,{recursive:true});
const result={scenario,url:'https://taipei-gta.vercel.app/',startedAt:new Date().toISOString(),events:[],actions:[],errors:[]};
const t0=Date.now();const log=s=>console.log(`[${Date.now()-t0}ms] ${s}`);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:640,height:426}});
await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(120000);
page.on('pageerror',e=>result.errors.push(e.message));
async function persist(){await writeFile(`${out}/report.json`,JSON.stringify(result,null,2));}
async function frames(n){
 return await page.evaluate(n=>new Promise(resolve=>{
  let count=0;const started=performance.now();
  const next=()=>{count++;if(count>=n)resolve({frames:count,elapsedMs:performance.now()-started});else requestAnimationFrame(next);};
  requestAnimationFrame(next);
 }),n);
}
async function hold(keys,n,label){
 const action={label,keys,requestedFrames:n,atMs:Date.now()-t0,status:'started'};result.actions.push(action);await persist();log(`Hold ${keys.join('+')||'(idle)'} for ${n} native rAF frames: ${label}`);
 try{for(const k of keys)await page.keyboard.down(k);Object.assign(action,await frames(n),{status:'completed'});}
 finally{for(const k of keys)await page.keyboard.up(k);await persist();}
 log(`Finished ${label}: ${action.frames} frames / ${Math.round(action.elapsedMs||0)}ms`);
}
async function snap(name){log(`Capture ${name}`);const e={name,atMs:Date.now()-t0,text:await page.locator('body').innerText(),buttons:await page.getByRole('button').allTextContents()};result.events.push(e);await persist();await page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:85});log(`Saved ${name}`);}
async function board(label){await page.keyboard.press('f');await hold([],8,`${label}-settle`);await snap(label);const txt=await page.locator('body').innerText();return /km\/?h|時速|公里\/小時|RPM|轉速|引擎|駕駛/i.test(txt);}
try{
 log('Navigate');await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:60000});await snap('00-loading');
 const start=page.getByRole('button',{name:/^開始遊戲\s*Start Game$|^開始遊戲$|^Start Game$/i});
 await start.waitFor({state:'visible'});await start.click({trial:true});
 await page.getByRole('button',{name:/^設定\s*Settings$|^設定$|^Settings$/i}).click();await page.getByRole('button',{name:'低',exact:true}).click();await snap('01-low-graphics');await page.keyboard.press('Escape');
 await start.click();log('Waiting for verified post-cinematic welcome dialogue');
 await page.getByText('歡迎回臺北！好幾年沒見了吧？以後在臺北，表哥罩你。',{exact:false}).filter({visible:true}).waitFor({state:'visible',timeout:300000});
 // Do not move/click the mouse: Start already gave keyboard control.
 await snap('02-ready-third-person');
 if(scenario==='raf-tree'){
  // The first tree is visibly left of the walking lane, beyond the scooter row.
  await hold(['a'],8,'align-left-toward-tree');await hold(['w'],60,'approach-tree');await snap('03-tree-approach');
  await hold(['w'],30,'toward-trunk');await snap('04-tree-forward');
  await hold(['d'],2,'small-right-alignment-at-known-90-frame-view');await snap('05-tree-aligned');
  for(let i=1;i<=4;i++){await hold(['w'],6,`tree-contact-step-${i}`);await snap(`06-tree-contact-${i}`);}
 }else if(scenario==='raf-light'){
  // The gray lamp and dark signal pole are separately visible near the curb.
  await hold(['a'],16,'align-curbside');await hold(['w'],40,'approach-gray-light');await snap('03-light-approach');
  await hold(['d'],6,'small-right-alignment-at-known-40-frame-view');await snap('04-light-aligned');
  for(let i=1;i<=3;i++){await hold(['w'],8,`light-contact-step-${i}`);await snap(`05-light-contact-${i}`);}
 }else if(scenario==='raf-board'){
  // Follow the visible Ming marker to his stated parked motorcycle using normal keys.
  await hold(['w'],55,'approach-ming');await snap('03-near-ming');
  await hold([],100,'allow-observed-tutorial-dialogue-and-walk');
  await hold(['w'],70,'follow-ming-to-bike');await snap('04-near-quest-bike');
  result.vehicleHudObserved=await board('05-first-F');
  if(!result.vehicleHudObserved){await hold(['a'],8,'small-step-toward-visible-bike-row');result.vehicleHudObserved=await board('06-second-F');}
  if(result.vehicleHudObserved){await hold(['w'],35,'normal-throttle');await snap('07-vehicle-moving');await page.keyboard.press('h');await page.keyboard.press('q');await snap('08-horn-radio-ui');}
 }
 result.status='captured-for-human-visual-review';
}catch(e){result.status='partial-or-blocked';result.error=e.message;log(e.message);await persist();}
finally{await persist();log('Closing');await context.close();await browser.close();log('Complete');}

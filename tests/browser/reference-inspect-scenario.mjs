// Public-game observation only. Uses rendered controls/normal keys, no game internals.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const scenario=process.env.SCENARIO || 'controls';
const out=`test-results/original-${scenario}`;await mkdir(out,{recursive:true});
const result={scenario,url:'https://taipei-gta.vercel.app/',startedAt:new Date().toISOString(),events:[],errors:[]};
const physical=['walk','drive','wanted'].includes(scenario);
const viewport=physical?{width:640,height:426}:{width:960,height:640};
const t0=Date.now();
const log=s=>console.log(`[${Date.now()-t0}ms] ${s}`);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport});
await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(120000);
page.on('pageerror',e=>result.errors.push(e.message));
async function persist(){await writeFile(`${out}/report.json`,JSON.stringify(result,null,2));}
async function pressMove(keys,ms){for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);}
async function snap(name){log(`Capture ${name}`);const e={name,atMs:Date.now()-t0,text:await page.locator('body').innerText(),buttons:await page.getByRole('button').allTextContents()};result.events.push(e);await persist();await page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:85});log(`Saved ${name}`);}
try{
 log('Navigate');await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:60000});await snap('00-loading');
 const start=page.getByRole('button',{name:/^開始遊戲\s*Start Game$|^開始遊戲$|^Start Game$/i});
 log('Wait for main menu');await start.waitFor({state:'visible'});await start.click({trial:true});await snap('01-ready');
 if(scenario==='settings'||scenario==='controls'){
  const re=scenario==='settings'?/^設定\s*Settings$|^設定$|^Settings$/i:/^操作說明\s*Controls$|^操作說明$|^Controls$/i;
  log(`Open ${scenario}`);await page.getByRole('button',{name:re}).click();await page.waitForTimeout(2000);await snap(`02-${scenario}`);
  // Read only rendered form labels/types/values to document the visible settings.
  result.visibleControls=await page.locator('input,select,button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none';}).map(e=>({tag:e.tagName,type:e.type,label:e.getAttribute('aria-label'),title:e.title,text:e.innerText,value:e.value,checked:e.checked,min:e.min,max:e.max})));
  await persist();
 }else{
  log('Select visible Low graphics for software-rendered observation');await page.getByRole('button',{name:/^設定\s*Settings$|^設定$|^Settings$/i}).click();await page.getByRole('button',{name:'低',exact:true}).click();await snap('01-low-graphics');await page.keyboard.press('Escape');
  log('Start game');await start.click();await page.waitForTimeout(10000);await snap('02-start');
  // The original explicitly requests a click to enable camera controls.
  if(physical){
   const skip=page.getByRole('button',{name:/^(跳過|略過|Skip)(動畫|劇情|Intro|Cutscene)?$/i});
   if(await skip.count()===1 && await skip.isVisible()){log('Use visible skip control');await skip.click();}
   log('Wait for tutorial cinematic to finish and following objective to appear');
   await page.getByText('跟著阿明走（頭上有「明」字的就是他）',{exact:true}).waitFor({state:'visible',timeout:300000});
   await page.mouse.click(viewport.width/2,viewport.height*.7);await snap('02-controllable-follow-objective');
  }else{await page.getByText('點擊畫面以控制視角',{exact:true}).waitFor({state:'visible',timeout:120000}).catch(()=>{});await page.mouse.click(480,450);await snap('02-focused');}
  if(scenario.startsWith('phone-')&&scenario!=='phone-map'){
   await page.keyboard.press('t');await page.waitForTimeout(800);await snap('03-phone-home');
   const label={'phone-missions':'任務','phone-mrt':'捷運','phone-help':'說明'}[scenario];
   log(`Open observed phone app ${label}`);await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(800);await snap('04-phone-app');
   await page.mouse.move(825,440);await page.mouse.wheel(0,560);await page.waitForTimeout(400);await snap('05-phone-app-scrolled');
  }

  if(scenario==='phone-map'){
   log('Open phone with documented T');await page.keyboard.press('t');await page.waitForTimeout(1000);await snap('03-phone');
   await page.keyboard.press('t');await page.waitForTimeout(500);
   log('Open map with documented M');await page.keyboard.press('m');await page.waitForTimeout(1000);await snap('04-map');
  }else if(scenario==='walk'){
   await pressMove(['w'],15000);await snap('03-walk-forward-15s');
   await pressMove(['w'],15000);await snap('04-walk-forward-30s');
   await pressMove(['s'],8000);await pressMove(['a'],4000);await pressMove(['w'],15000);await snap('05-walk-pole-attempt');
  }else if(scenario==='drive'){
   // Parked scooters are visibly ahead on the left of the starting sidewalk.
   for(let i=1;i<=3;i++){
    log(`Approach visible parked vehicles ${i}`);await pressMove(['w','Shift'],12000);if(i===1)await pressMove(['a'],3000);await page.keyboard.press('f');await page.waitForTimeout(500);await snap(`03-board-attempt-${i}`);
    const visible=await page.locator('body').innerText();if(/km\/h|kmh|時速|公里\/小時/i.test(visible)){result.vehicleHudObserved=true;break;}
   }
   await pressMove(['w'],10000);await snap('04-forward-vehicle-attempt');
   await pressMove(['w','d'],1500);await pressMove(['w'],10000);await snap('05-right-sidewalk-impact-attempt');
   await page.keyboard.press('h');await page.keyboard.press('q');await snap('06-horn-radio-ui');
  }else if(scenario==='wanted'){
   log('Normal left-button attacks near the visible sidewalk NPC group');
   for(let i=0;i<6;i++){await page.mouse.click(viewport.width/2,viewport.height*.55);await page.waitForTimeout(700);}
   await snap('03-after-attacks');await page.waitForTimeout(15000);await snap('04-after-wait');
   await page.keyboard.press('Escape');await snap('05-paused-after-attacks');
   const stats=page.getByRole('button',{name:/^統計\s*Stats$/i});if(await stats.isVisible()){await stats.click();await snap('06-stats-after-attacks');}
  }
 }
 result.status='captured';
}catch(e){result.status='partial-or-blocked';result.error=e.message;log(e.message);await persist();}
finally{await persist();log('Closing');await context.close();await browser.close();log('Complete');}

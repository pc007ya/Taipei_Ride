// Read-only, normal-input observation of the public original game.
// Does not read game internals, copy code/assets, log in, submit forms, or bypass blocks.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.OBSERVE_OUT || 'test-results/original-observation';
await mkdir(out, {recursive:true});
const report={url:'https://taipei-gta.vercel.app/',observedAt:new Date().toISOString(),events:[],errors:[]};
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:`${out}/video`,size:{width:960,height:640}}});
await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
const page=await context.newPage();
page.setDefaultTimeout(120000);
page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>report.errors.push(e.message));
const t0=Date.now();
async function snap(name){
 const text=await page.locator('body').innerText();
 const buttons=await page.getByRole('button').allTextContents();
 const event={name,atMs:Date.now()-t0,text,buttons,url:page.url()}; report.events.push(event);
 await page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:82});
 await writeFile(`${out}/${name}.txt`,JSON.stringify(event,null,2));
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 return event;
}
async function visibleButton(re){for(const b of await page.getByRole('button',{name:re}).all())if(await b.isVisible())return b;return null;}
async function clickIf(re){const b=await visibleButton(re);if(b){await b.click({timeout:120000});return true;}return false;}
async function backToMain(label){
 // Escape is the ordinary keyboard return; verify before needing a slow pointer click.
 await page.keyboard.press('Escape');await page.waitForTimeout(700);await snap(`${label}-escape`);
 const start=await visibleButton(/^開始遊戲\s*Start Game$|^Start Game$|^開始遊戲$/i);
 let ready=false;if(start){try{await start.click({trial:true,timeout:10000});ready=true;}catch{}}
 if(!ready){await clickIf(/返回|關閉|完成|\bBack\b|\bClose\b|回到選單|^[×✕]$/i);await page.waitForTimeout(700);await snap(`${label}-back`);}
}
async function hold(key,ms,label,step=500){
 for(let elapsed=0;elapsed<ms;elapsed+=step){
  await page.keyboard.down(key);await page.waitForTimeout(Math.min(step,ms-elapsed));await page.keyboard.up(key);
  await snap(`${label}-${String(elapsed+Math.min(step,ms-elapsed)).padStart(5,'0')}ms`);
 }
}
try{
 await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:60000});
 // Capture real startup, with video retaining intermediate frames.
 await snap('00-entry');
 for(const [name,delay] of [['01-loading',10000]]){await page.waitForTimeout(delay);await snap(name);}
 let body=await page.locator('body').innerText();
 if(/verify you are human|checking your browser|captcha|驗證.*人類|Error creating WebGL context/i.test(body))throw Error('Blocked or WebGL unavailable; no gameplay findings claimed');
 const start=page.getByRole('button',{name:/^開始遊戲\s*Start Game$|^開始遊戲$|^Start Game$/i});
 await start.waitFor({state:'visible',timeout:120000});
 // Actionability checks that the loader is no longer covering this control.
 await start.click({trial:true,timeout:120000});
 await snap('07-ready-main');
 for(const [name,re] of [['settings',/^設定\s*Settings$|^設定$|^Settings$/i],['controls',/^操作說明\s*Controls$|^操作說明$|^Controls$/i]]){
  if(await clickIf(re)){await page.waitForTimeout(700);await snap(`08-${name}`);await backToMain(`08-${name}`);}
 }
 // Menu cycling recorded without following external donation links.
 await snap('09-before-start');
 if(!await clickIf(/^開始遊戲\s*Start Game$|^開始遊戲$|^Start Game$/i))throw Error('Main menu not recovered; preserve captures for review');
 for(const [name,delay] of [['10-start-250ms',250],['11-start-1s',750],['12-start-3s',2000],['13-start-6s',3000],['14-start-10s',4000],['15-start-15s',5000]]){await page.waitForTimeout(delay);await snap(name);}
 await page.setViewportSize({width:960,height:640});
 await page.keyboard.press('Escape');await page.waitForTimeout(500);await snap('16-in-game-escape');
 if(!await clickIf(/^(繼續遊戲|繼續|返回遊戲|Resume|Continue)\s*(Resume|Continue|Game)?$/i))await page.keyboard.press('Escape');
 await page.waitForTimeout(500);await snap('17-resumed');
 // Attempt ordinary walking towards the visible row of sidewalk trees. Screenshots
 // and video are evidence for a human reviewer, never auto-labeled a collision.
 await hold('w',6000,'18-walk-forward-tree-attempt');
 await hold('s',2500,'19-back-away');
 await hold('a',900,'20-step-toward-streetlight',450);
 await hold('w',5000,'21-walk-forward-streetlight-attempt');
 await snap('22-walk-final');
 // Stop rather than guess unobserved driving controls or claim impact occurred.
 report.status='captured-opening-menus-and-walking-attempts';
}catch(e){report.status='partial-or-blocked';report.error=e.message;await snap('99-final').catch(()=>{});}
finally{await context.close();await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}

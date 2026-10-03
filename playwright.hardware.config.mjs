import {defineConfig} from '@playwright/test';
import sample from './playwright.sample.config.mjs';
// Uses the installed Mac browser, with its security sandbox enabled and no
// software-rendering switches. Each report records the actual WebGL renderer.
export default defineConfig({
 ...sample,
 ...(process.env.TAIPEI_PERF_STRESS==='1'?{projects:[{name:'desktop',use:{viewport:{width:1920,height:1210},deviceScaleFactor:2}}]}:{}),
 outputDir:'qa/hardware-results',
 reporter:[['list'],['html',{outputFolder:'qa/hardware-report',open:'never'}]],
 use:{...sample.use,channel:'chrome',launchOptions:{chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader']}},
});

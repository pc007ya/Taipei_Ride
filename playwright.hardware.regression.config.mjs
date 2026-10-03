import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({
 ...base,
 outputDir:'qa/hardware-regression-results',
 reporter:[['list'],['html',{outputFolder:'qa/hardware-regression-report',open:'never'}]],
 use:{...base.use,channel:'chrome',launchOptions:{chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader']}},
 projects:base.projects,
});

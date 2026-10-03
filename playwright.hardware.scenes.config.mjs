import {defineConfig} from '@playwright/test';
import hardware from './playwright.hardware.regression.config.mjs';
export default defineConfig({...hardware,testMatch:'**/scenes.spec.mjs',outputDir:'qa/xitun-final-results',reporter:[['list'],['html',{outputFolder:'qa/xitun-final-report',open:'never'}]]});

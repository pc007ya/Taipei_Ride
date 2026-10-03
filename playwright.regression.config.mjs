import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
// Paired sample tests require three baseline servers and run separately through
// playwright.sample.config.mjs; this suite runs the complete application tests.
export default defineConfig({...base,testIgnore:['**/sample.spec.mjs','**/sample-perf.spec.mjs']});

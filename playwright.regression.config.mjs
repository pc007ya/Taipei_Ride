import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
// Paired sample tests require three baseline servers and run separately through
// playwright.sample.config.mjs; this suite runs the complete application tests.
export default defineConfig({...base,timeout:process.env.CI?600_000:base.timeout,testIgnore:['**/sample.spec.mjs','**/sample-perf.spec.mjs']});

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {buildTrailerBridge,allowTrailerBridgeFrame} from './scripts/trailer-bridge-build.mjs';
export default defineConfig(({mode})=>({base:'./',experimental:mode==='tizen'?{renderBuiltUrl(filename,{hostType}){if(hostType==='js'&&/^assets\/(?:catalogueWorker|artworkCacheWorker)-/.test(filename))return {runtime:`new URL(${JSON.stringify(filename)}, document.baseURI).href`};}}:undefined,resolve:mode==='tizen'?{alias:{'hls.js':fileURLToPath(new URL('./src/tizenHls.js',import.meta.url))}}:{},plugins:[react(),{name:'richiflix-trailer-bridge-policy',transformIndexHtml(html){return mode==='tizen'?allowTrailerBridgeFrame(html,buildTrailerBridge(process.cwd())):html;}},
 // Android TV (android/): the page is laid out at 1920 CSS px like on Samsung; the WebView scales it to the screen.
 {name:'kingdom-android-viewport',transformIndexHtml(html){return mode==='android'?html.replace('content="width=device-width, initial-scale=1.0"','content="width=1920, user-scalable=no"'):html;}}],build:mode==='android'?{outDir:'dist-android',rollupOptions:{output:{manualChunks:{player:['hls.js'],react:['react','react-dom']}}}}:mode==='tizen'?{
 outDir:'dist-tizen',target:'chrome85',cssTarget:'chrome85',cssCodeSplit:false,modulePreload:false,
 rollupOptions:{output:{format:'iife',inlineDynamicImports:true,entryFileNames:'assets/richiflix.js'}},
}: {rollupOptions:{output:{manualChunks:{player:['hls.js'],react:['react','react-dom']}}}}}));

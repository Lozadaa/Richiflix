import test from 'node:test';
import assert from 'node:assert/strict';
import {imagePresentation,isVectorSource} from './imageQuality.js';

test('cover rejects small images, including tall images cropped to a wide screen',()=>{
 assert.equal(imagePresentation({width:1920,height:1080,naturalWidth:480,naturalHeight:360}).ready,false);
 assert.equal(imagePresentation({width:1920,height:1080,naturalWidth:1920,naturalHeight:800}).ready,false);
 assert.equal(imagePresentation({width:1920,height:1080,naturalWidth:3840,naturalHeight:2160,dpr:2}).ready,true);
 assert.equal(imagePresentation({width:1920,height:1080,naturalWidth:1920,naturalHeight:1080,dpr:2}).ready,false);
});
test('small channel logos retain native resolution and aspect ratio',()=>{
 assert.deepEqual(imagePresentation({width:400,height:220,naturalWidth:80,naturalHeight:40,fit:'contain'}),{ready:true,width:80,height:40,scale:.2});
 assert.deepEqual(imagePresentation({width:400,height:220,naturalWidth:80,naturalHeight:40,fit:'contain',dpr:2}),{ready:true,width:40,height:20,scale:.1});
});
test('vectors can scale, missing dimensions cannot reveal an image',()=>{
 assert.equal(imagePresentation({width:1920,height:1080,naturalWidth:256,naturalHeight:256,vector:true}).ready,true);
 assert.equal(imagePresentation({width:0,height:0,naturalWidth:1920,naturalHeight:1080}).ready,false);
 assert.equal(isVectorSource('https://cdn.example/logo.svg?v=1'),true);
 assert.equal(isVectorSource('https://cdn.example/logo.svg.png'),false);
});

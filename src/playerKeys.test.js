import test from 'node:test';
import assert from 'node:assert/strict';
import {playerKeyAction} from './playerKeys.js';

const video={focus:'video',seekable:true,chromeVisible:false},buttons={focus:'buttons',seekable:true};
test('video focus: Left/Right seek, Down/OK reach the buttons, Back closes',()=>{
 assert.deepEqual(playerKeyAction({...video,key:'ArrowLeft'}),{type:'seek',direction:-1,repeat:false});
 assert.deepEqual(playerKeyAction({...video,key:'ArrowRight',repeat:true}),{type:'seek',direction:1,repeat:true});
 assert.deepEqual(playerKeyAction({...video,key:'ArrowDown'}),{type:'focusButtons'});
 assert.deepEqual(playerKeyAction({...video,key:'Enter'}),{type:'focusButtons'});
 assert.deepEqual(playerKeyAction({...video,key:'Enter',chromeVisible:true}),{type:'focusButtons',togglePlay:true});
 assert.deepEqual(playerKeyAction({...video,key:'Escape'}),{type:'close'});
 assert.equal(playerKeyAction({...video,key:'ArrowUp'}),null);
});
test('live without DVR: Left/Right do nothing',()=>{
 assert.equal(playerKeyAction({...video,key:'ArrowLeft',live:true,seekable:false}),null);
 assert.equal(playerKeyAction({...video,key:'ArrowRight',live:true,seekable:false}),null);
 assert.equal(playerKeyAction({...video,key:'MediaFastForward',live:true,seekable:false}),null);
});
test('buttons focus: Left/Right walk the row, Up/Back return to the video, OK belongs to the button',()=>{
 assert.deepEqual(playerKeyAction({...buttons,key:'ArrowLeft'}),{type:'moveButton',direction:-1});
 assert.deepEqual(playerKeyAction({...buttons,key:'ArrowRight'}),{type:'moveButton',direction:1});
 assert.deepEqual(playerKeyAction({...buttons,key:'ArrowUp'}),{type:'focusVideo'});
 assert.deepEqual(playerKeyAction({...buttons,key:'Escape'}),{type:'focusVideo'});
 assert.equal(playerKeyAction({...buttons,key:'ArrowDown'}),null);
 assert.equal(playerKeyAction({...buttons,key:'Enter'}),null);
});
test('media seek keys accelerate from anywhere; anything else (the bar included) goes back to the video',()=>{
 assert.deepEqual(playerKeyAction({...buttons,key:'MediaRewind',repeat:true}),{type:'seek',direction:-1,repeat:true,now:true});
 assert.deepEqual(playerKeyAction({...video,key:'MediaFastForward'}),{type:'seek',direction:1,repeat:false,now:true});
 for(const key of ['ArrowLeft','ArrowUp','Enter'])assert.deepEqual(playerKeyAction({focus:'other',key,seekable:true}),{type:'focusVideo'});
 assert.equal(playerKeyAction({focus:'other',key:'Escape'}),null);
});

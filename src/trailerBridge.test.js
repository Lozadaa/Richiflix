import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrailerBridgeURL,bridgeFrameURL,BridgePlayer} from './trailerBridge.js';

const VIDEO_A='M7lc1UVf-VE',VIDEO_B='aqz-KE-bpKQ',VIDEO_C='dQw4w9WgXcQ';
function transport(videoId=VIDEO_A,events={}){
 const listeners=new Set(),posts=[],source={postMessage:(data,origin)=>posts.push({data,origin})};
 const parent={addEventListener:(type,listener)=>{assert.equal(type,'message');listeners.add(listener);},removeEventListener:(type,listener)=>listeners.delete(listener)};
 const frame={src:bridgeFrameURL('http://192.168.1.2:5050/trailer/',videoId),contentWindow:source,ownerDocument:{defaultView:parent},remove(){this.removed=true;}};
 const url=new URL(frame.src),session=new URLSearchParams(url.hash.slice(1)).get('session');
 const player=new BridgePlayer(frame,{videoId,events});
 const send=(data={},envelope={})=>{for(const listener of [...listeners])listener({source,origin:url.origin,data:{channel:'richiflix-trailer',version:1,session,...data},...envelope});};
 return {player,frame,posts,send,listeners,url,source,session};
}

test('bridge configuration permits HTTPS and local HTTP, without credentials or public plain HTTP',()=>{
 for(const raw of [undefined,null,'','  '])assert.equal(normalizeTrailerBridgeURL(raw),undefined);
 assert.equal(normalizeTrailerBridgeURL(' https://bridge.example/path '),'https://bridge.example/path');
 for(const host of ['localhost','tv.localhost','127.0.0.1','127.4.3.2','10.12.0.7','172.16.2.1','172.31.255.1','192.168.1.2','[::1]','[fd12:3456::1]','[fe80::1]'])assert.equal(new URL(normalizeTrailerBridgeURL(`http://${host}:5050/bridge`)).protocol,'http:');
 for(const raw of ['http://bridge.example','http://localhost.example','http://172.15.0.1','http://172.32.0.1','http://192.169.1.1','http://8.8.8.8','http://[2001:4860:4860::8888]','https://user:secret@bridge.example','http://user@localhost','https://@bridge.example','http://:@localhost','file:///bridge.html','javascript:alert(1)','not a URL',{}])assert.throws(()=>normalizeTrailerBridgeURL(raw),TypeError);
});

test('each frame has a cryptographic session and a strict video ID, confined to its hash',()=>{
 const first=new URL(bridgeFrameURL('https://bridge.example/trailer?q=one#old',VIDEO_A)),second=new URL(bridgeFrameURL('https://bridge.example/trailer?q=one',VIDEO_A));
 const hash=new URLSearchParams(first.hash.slice(1));
 assert.match(hash.get('session'),/^[a-f0-9]{64}$/);assert.equal(hash.get('video'),VIDEO_A);assert.notEqual(first.hash,second.hash);assert.equal(first.search,'?q=one');assert.equal(first.searchParams.has('session'),false);
 for(const id of ['','short',VIDEO_A+'x','a/bbbbbbbbb',null])assert.throws(()=>bridgeFrameURL('https://bridge.example',id),TypeError);
 assert.throws(()=>bridgeFrameURL('',VIDEO_A),TypeError);
});

test('handshake rejects wrong frame, origin, version and session, and fires ready once',()=>{
 const calls=[],t=transport(VIDEO_A,{onReady:event=>calls.push(event)});
 t.send({type:'ready'},{source:{}});t.send({type:'ready'},{origin:'https://other.example'});t.send({type:'ready',version:2});t.send({type:'ready',session:'0'.repeat(64)});t.send({type:'ready',channel:'other'});
 assert.equal(calls.length,0);t.send({type:'ready'});t.send({type:'ready'});assert.deepEqual(calls,[{target:t.player}]);
 assert.equal(t.player.getIframe(),t.frame);assert.deepEqual(t.player.getVideoData(),{video_id:VIDEO_A});t.player.destroy();
});

test('commands queue within a fixed budget and cue keeps only the latest video and transport intent',()=>{
 const t=transport();t.player.setVolume(20);t.player.unMute();t.player.playVideo();
 for(let index=0;index<500;index++){t.player.cueVideoById(index%2?VIDEO_B:VIDEO_C);t.player.playVideo();t.player.pauseVideo();t.player.setVolume(index);t.player.unMute();}
 t.player.cueVideoById(VIDEO_B);t.player.playVideo();assert.equal(t.posts.length,0);assert.equal(t.player._queue.length,4);
 t.send({type:'ready'});
 assert.deepEqual(t.posts.map(post=>post.data.type),['cue','volume','unmute','play']);
 for(const {data,origin} of t.posts){assert.equal(origin,t.url.origin);assert.equal(data.channel,'richiflix-trailer');assert.equal(data.version,1);assert.equal(data.session,t.session);assert.equal(data.videoId,VIDEO_B);assert.equal(data.intent,502);}
 assert.equal(t.posts[1].data.volume,100);assert.deepEqual(t.player.getVideoData(),{video_id:VIDEO_B});t.player.destroy();
});

test('states, errors and autoplay events only apply to the current video and exact cue intent',()=>{
 const calls=[],t=transport(VIDEO_A,{onStateChange:event=>calls.push(['state',event]),onError:event=>calls.push(['error',event]),onAutoplayBlocked:event=>calls.push(['blocked',event])});
 const event=(type,extra={},videoId=VIDEO_A,intent=1)=>t.send({type,videoId,intent,...extra});
 event('state',{state:1});assert.equal(calls.length,0);t.send({type:'ready'});event('state',{state:1});
 t.player.cueVideoById(VIDEO_B);event('state',{state:1});event('error',{code:150});event('autoplay-blocked');event('state',{state:1},VIDEO_B,1);event('error',{code:150},VIDEO_B,3);event('autoplay-blocked',{},VIDEO_B,'2');
 assert.equal(calls.length,1);event('state',{state:'1'},VIDEO_B,2);event('state',{state:99},VIDEO_B,2);event('error',{code:{}},VIDEO_B,2);assert.equal(calls.length,1);
 event('state',{state:3},VIDEO_B,2);event('error',{code:153},VIDEO_B,2);event('autoplay-blocked',{},VIDEO_B,2);
 assert.deepEqual(calls.map(([type,event])=>[type,event.data]),[['state',1],['state',3],['error',153],['blocked',undefined]]);assert.ok(calls.every(([,event])=>event.target===t.player));t.player.destroy();
});

test('ready commands carry current identity, clamp volume, and cue validates before changing identity',()=>{
 const t=transport();t.send({type:'ready'});t.player.pauseVideo();t.player.setVolume(-1);t.player.setVolume(40.5);t.player.unMute();t.player.cueVideoById(VIDEO_B);t.player.playVideo();
 assert.deepEqual(t.posts.map(post=>post.data.type),['pause','volume','volume','unmute','cue','play']);assert.equal(t.posts[1].data.volume,0);assert.equal(t.posts[2].data.volume,40.5);assert.equal(t.posts[4].data.intent,2);assert.equal(t.posts[5].data.videoId,VIDEO_B);
 assert.throws(()=>t.player.cueVideoById('invalid'),TypeError);assert.deepEqual(t.player.getVideoData(),{video_id:VIDEO_B});assert.throws(()=>t.player.setVolume(NaN),TypeError);assert.throws(()=>t.player.setVolume('50'),TypeError);t.player.destroy();
});

test('authenticated startup errors arrive before ready while stale errors and playback events remain rejected',()=>{
 const errors=[],states=[],blocked=[],t=transport(VIDEO_A,{onError:event=>errors.push(event),onStateChange:event=>states.push(event),onAutoplayBlocked:event=>blocked.push(event)});
 const failure={type:'error',videoId:VIDEO_A,intent:1,code:'api-unavailable'};
 t.send(failure,{source:{}});t.send(failure,{origin:'https://other.example'});t.send({...failure,session:'0'.repeat(64)});t.send({...failure,videoId:VIDEO_B});t.send({...failure,intent:0});
 assert.equal(errors.length,0);t.send(failure);t.send({...failure,code:153});
 t.send({type:'state',state:1,videoId:VIDEO_A,intent:1});t.send({type:'autoplay-blocked',videoId:VIDEO_A,intent:1});
 assert.deepEqual(errors.map(event=>event.data),['api-unavailable',153]);assert.equal(states.length,0);assert.equal(blocked.length,0);
 t.player.cueVideoById(VIDEO_B);t.send(failure);t.send({...failure,videoId:VIDEO_B,intent:1});t.send({...failure,videoId:VIDEO_B,intent:2,code:'embed-unavailable'});
 assert.deepEqual(errors.map(event=>event.data),['api-unavailable',153,'embed-unavailable']);assert.ok(errors.every(event=>event.target===t.player));t.player.destroy();
});

test('destroy clears pending controls and listener, removes iframe, and only sends teardown when ready',()=>{
 for(const ready of [false,true]){
  let callbacks=0;const t=transport(VIDEO_A,{onReady:()=>callbacks++,onStateChange:()=>callbacks++});t.player.playVideo();if(ready)t.send({type:'ready'});
  t.player.destroy();t.player.destroy();t.player.playVideo();t.player.cueVideoById(VIDEO_B);t.player.setVolume(30);t.player.unMute();t.send({type:'ready'});t.send({type:'state',state:1,videoId:VIDEO_A,intent:1});
  assert.equal(t.listeners.size,0);assert.equal(t.frame.removed,true);assert.equal(t.player._queue.length,0);assert.equal(callbacks,ready?1:0);assert.equal(t.posts.filter(post=>post.data.type==='destroy').length,ready?1:0);assert.deepEqual(t.posts.map(post=>post.data.type),ready?['play','destroy']:[]);
 }
});

test('constructor rejects mismatched frame identity and invalid session before registering listeners',()=>{
 const t=transport();t.player.destroy();assert.throws(()=>new BridgePlayer(t.frame,{videoId:VIDEO_B}),TypeError);assert.equal(t.listeners.size,0);
 t.frame.src='https://bridge.example/#session=short&video='+VIDEO_A;assert.throws(()=>new BridgePlayer(t.frame,{videoId:VIDEO_A}),TypeError);assert.equal(t.listeners.size,0);
});

test('teardown inside ready discards subsequent callbacks and keeps transport listener-free',()=>{
 let states=0;const t=transport(VIDEO_A,{onReady:event=>event.target.destroy(),onStateChange:()=>states++});
 t.player.playVideo();t.send({type:'ready'});t.send({type:'state',state:1,videoId:VIDEO_A,intent:1});
 assert.deepEqual(t.posts.map(post=>post.data.type),['play','destroy']);assert.equal(t.frame.removed,true);assert.equal(t.listeners.size,0);assert.equal(states,0);
});

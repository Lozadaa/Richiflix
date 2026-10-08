import test from 'node:test';
import assert from 'node:assert/strict';
import {trailerFrameURL,trailerErrorKind,readAutoTrailers,trailerGate} from './trailerApi.js';
test('official iframe navigation has a real web origin and no invented file origin',()=>{
 const web=new URL(trailerFrameURL('M7lc1UVf-VE',{protocol:'https:',origin:'https://example.test'})),widget=new URL(trailerFrameURL('M7lc1UVf-VE',{protocol:'file:',origin:'null'}));
 assert.equal(web.hostname,'www.youtube-nocookie.com');assert.equal(web.searchParams.get('origin'),'https://example.test');assert.equal(web.searchParams.get('enablejsapi'),'1');assert.equal(widget.searchParams.has('origin'),false);assert.equal(widget.searchParams.has('widget_referrer'),false);
});
test('trailer errors distinguish identity, availability, embedding and decoder failures',()=>{
 assert.equal(trailerErrorKind(153),'client-identification');assert.equal(trailerErrorKind(100),'video-unavailable');assert.equal(trailerErrorKind(150),'embed-disabled');assert.equal(trailerErrorKind(5),'html5-playback');
});
test('automatic trailers default off on Tizen, on elsewhere, and honour a saved choice',()=>{
 const storage=value=>({getItem:()=>value});
 assert.equal(readAutoTrailers(storage(null),true),false);assert.equal(readAutoTrailers(storage(null),false),true);
 assert.equal(readAutoTrailers(storage('true'),true),true);assert.equal(readAutoTrailers(storage('false'),false),false);
 assert.equal(readAutoTrailers(storage('{broken'),true),false);assert.equal(readAutoTrailers({getItem(){throw Error('blocked');}},false),true);
});
test('a delayed trailer gate opens only for the same wanted id and closes on any change',()=>{
 let gate=trailerGate({key:null,open:false},'a',1500);assert.deepEqual(gate,{key:'a',open:false});
 const opened={key:'a',open:true};assert.equal(trailerGate(opened,'a',1500),opened,'The same selection keeps an opened gate');
 assert.deepEqual(trailerGate(opened,'b',1500),{key:'b',open:false});assert.deepEqual(trailerGate(opened,null,1500),{key:null,open:false});
 assert.deepEqual(trailerGate({key:null,open:false},'a',0),{key:'a',open:true},'Without a delay (PC) the trailer starts at once');
});

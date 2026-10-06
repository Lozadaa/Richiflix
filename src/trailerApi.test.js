import test from 'node:test';
import assert from 'node:assert/strict';
import {trailerFrameURL,trailerErrorKind} from './trailerApi.js';
test('official iframe navigation has a real web origin and no invented file origin',()=>{
 const web=new URL(trailerFrameURL('M7lc1UVf-VE',{protocol:'https:',origin:'https://example.test'})),widget=new URL(trailerFrameURL('M7lc1UVf-VE',{protocol:'file:',origin:'null'}));
 assert.equal(web.hostname,'www.youtube-nocookie.com');assert.equal(web.searchParams.get('origin'),'https://example.test');assert.equal(web.searchParams.get('enablejsapi'),'1');assert.equal(widget.searchParams.has('origin'),false);assert.equal(widget.searchParams.has('widget_referrer'),false);
});
test('trailer errors distinguish identity, availability, embedding and decoder failures',()=>{
 assert.equal(trailerErrorKind(153),'client-identification');assert.equal(trailerErrorKind(100),'video-unavailable');assert.equal(trailerErrorKind(150),'embed-disabled');assert.equal(trailerErrorKind(5),'html5-playback');
});

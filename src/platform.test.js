import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteKeys,registerRemote} from './platform.js';

test('Samsung channel keys normalize like media keys and register only when listed',()=>{
 assert.equal(remoteKeys[427],'ChannelUp');assert.equal(remoteKeys[428],'ChannelDown');
 const registered=[],device=supported=>({getSupportedKeys:()=>supported.map(name=>({name})),registerKey:name=>registered.push(name)});
 registerRemote(device(['MediaPlay','ChannelUp']));assert.deepEqual(registered,['MediaPlay','ChannelUp']);
 registered.length=0;registerRemote(device(['MediaStop']));assert.deepEqual(registered,['MediaStop'],'ChannelDown is not registered when the firmware does not expose it');
});

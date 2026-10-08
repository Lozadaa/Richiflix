import test from 'node:test';
import assert from 'node:assert/strict';
import {trackName,trackNames} from './trackNames.js';

test('ISO codes become readable Spanish names',()=>{
 assert.equal(trackName({language:'spa'}),'Español');
 assert.equal(trackName({language:'es-419'}),'Español (Latinoamérica)');
 assert.equal(trackName({language:'eng'}),'Inglés');
 assert.equal(trackName({language:'en'}),'Inglés');
 assert.equal(trackName({language:'pt-BR'}),'Portugués (Brasil)');
 assert.equal(trackName({language:'ger'}),'Alemán');
});
test('without a language: the label, then «Pista N» / «Subtítulos N»',()=>{
 assert.equal(trackName({index:1,kind:'subtitle'}),'Subtítulos 2');
 assert.equal(trackName({index:0,kind:'audio'}),'Pista 1');
 assert.equal(trackName({language:'und',index:2}),'Pista 3');
 assert.equal(trackName({language:'qaa',label:'Director',index:0}),'Director');
 assert.equal(trackName({label:'Audio latino',index:0}),'Audio latino');
});
test('the short table answers when Intl.DisplayNames is missing',()=>{
 const original=Intl.DisplayNames;Intl.DisplayNames=undefined;
 try{assert.equal(trackName({language:'es-419'}),'Español (Latinoamérica)');assert.equal(trackName({language:'jpn'}),'Japonés');assert.equal(trackName({language:'fra'}),'Francés');}
 finally{Intl.DisplayNames=original;}
});
test('duplicates get the codec, otherwise a number',()=>{
 assert.deepEqual(trackNames([{language:'eng'},{language:'eng'}],'audio'),['Inglés','Inglés (2)']);
 assert.deepEqual(trackNames([{language:'eng',codec:'ac3'},{language:'eng',codec:'aac'},{language:'spa'}],'audio'),['Inglés (AC3)','Inglés (AAC)','Español']);
 assert.deepEqual(trackNames([{},{}],'subtitle'),['Subtítulos 1','Subtítulos 2']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {textInputAction,isTextField} from './tvTextInput.js';
test('Samsung IME Done and Cancel do not rely on ordinary OK or app Back',()=>{
 assert.equal(textInputAction({keyCode:65376,key:'Unidentified'}),'done');
 assert.equal(textInputAction({keyCode:65385,key:'Unidentified'}),'leave');
 assert.equal(textInputAction({keyCode:10009,key:'Unidentified'}),'leave');
 for(const event of [{keyCode:13,key:'Enter'},{keyCode:229,key:'Unidentified'},{key:'a'},{key:'Backspace'},{key:'ArrowLeft'},{keyCode:65376,isComposing:true}])assert.equal(textInputAction(event),null);
});
test('text entry excludes player sliders and native choice fields',()=>{
 for(const type of ['text','password','url','email','search','tel','number'])assert.equal(isTextField({tagName:'INPUT',type}),true);
 for(const type of ['range','checkbox','file'])assert.equal(isTextField({tagName:'INPUT',type}),false);
 assert.equal(isTextField({tagName:'TEXTAREA'}),true);assert.equal(isTextField({tagName:'SELECT'}),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {directionalTarget} from './virtualNavigation.js';

const box=(x,y,width=40,height=40)=>({x,y,width,height});
const candidate=(element,x,y)=>({element,rect:box(x,y)});

test('directional fallback respects the requested side and favors its control row',()=>{
 const current=box(200,200),candidates=[candidate('above',200,80),candidate('far right',500,200),candidate('diagonal',250,290),candidate('right',290,200),candidate('left',100,200),candidate('below',200,340)];
 assert.equal(directionalTarget(current,candidates,'ArrowRight'),'right');
 assert.equal(directionalTarget(current,candidates,'ArrowLeft'),'left');
 assert.equal(directionalTarget(current,candidates,'ArrowUp'),'above');
 assert.equal(directionalTarget(current,candidates,'ArrowDown'),'below');
});

test('directional fallback leaves focus at a boundary and keeps DOM order for ties',()=>{
 const current=box(100,100);
 assert.equal(directionalTarget(current,[candidate('near same center',105,100),candidate('behind',50,100)],'ArrowRight'),null);
 assert.equal(directionalTarget(current,[candidate('first',200,90),candidate('second',200,110)],'ArrowRight'),'first');
});

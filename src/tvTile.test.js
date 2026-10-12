import test from 'node:test';
import assert from 'node:assert/strict';
import {tileMetrics,tileStyle,cellTileStyle,setTileFocus,clearTileFocus,gridTileShift,TV_TILE_INFO} from './tvTile.js';

test('the TV tile is a 16:9 picture as tall as the poster, with the info under it',()=>{
 const rail=tileMetrics({posterHeight:315,width:210,gap:20});
 assert.deepEqual(rail,{tileWidth:560,extra:350,height:315+TV_TILE_INFO,below:315+TV_TILE_INFO+20,content:0});
 assert.equal(tileMetrics({posterHeight:0,width:210}),null);assert.equal(tileMetrics({posterHeight:315,width:0}),null);
});

test('in a grid the tile fits the columns, pushes the next row down and shifts the last columns left',()=>{
 const grid=tileMetrics({posterHeight:315,width:210,gap:20,rowHeight:380,columns:7});
 assert.equal(grid.content,7*230-20);assert.equal(grid.below,315+TV_TILE_INFO+20-380);
 assert.equal(gridTileShift(grid,0,210,20),0);assert.equal(gridTileShift(grid,4,210,20),0);
 assert.equal(gridTileShift(grid,6,210,20),6*230+560-grid.content);
 assert.equal(tileMetrics({posterHeight:315,width:210,gap:20,columns:2}).tileWidth,440);
 assert.equal(gridTileShift(null,3,210,20),0);
});

test('tile styles: sizes on the container, row and column on each cell, focus written outside React',()=>{
 assert.equal(tileStyle(null),undefined);
 assert.deepEqual(tileStyle({tileWidth:560,extra:350,height:465,below:105}),{'--tile-w':'560px','--tile-extra':'350px','--tile-h':'465px','--tile-below':'105px'});
 assert.deepEqual(cellTileStyle(2,5),{'--r':2,'--c':5});
 const props={},element={style:{setProperty:(name,value)=>{props[name]=value;}}};
 setTileFocus(element,1,3,40);assert.deepEqual(props,{'--tile-r':'1','--tile-c':'3','--tile-shift':'40px'});
 clearTileFocus(element);assert.deepEqual(props,{'--tile-r':'1000000','--tile-c':'1000000','--tile-shift':'0px'});
 assert.doesNotThrow(()=>setTileFocus(null,0,0));
});

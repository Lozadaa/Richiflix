import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedBanner} from './bannerRecommendations.js';
import {TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';
const title=(id,mediaType='movie',extra={})=>({id,mediaType,image:`/${id}.jpg`,...extra});
const group=(name,type,items)=>({name,type,items});
test('continue first, then best/recent picks alternating movie and series, without duplicates',()=>{
 const collections=[group(TMDB_BEST,'movie',[title('m1'),title('m2'),title('m3')]),group(TMDB_BEST,'series',[title('s1','series'),title('s2','series')]),group(TMDB_RECENT,'movie',[title('m2'),title('r1')]),group(TMDB_RECENT,'series',[title('rs1','series')]),group('Lo mejor de Drama · TMDB','movie',[title('x')])];
 const ids=recommendedBanner({continuing:[title('live','live'),title('c1')],collections,featured:[title('f1')]}).map(item=>item.id);
 assert.deepEqual(ids,['c1','m1','s1','m2','rs1','s2','r1','m3']);
});
test('limit, artwork and media type filters apply to recommendations',()=>{
 const items=Array.from({length:12},(_,index)=>title('m'+index,'movie',index===1?{image:undefined}:{}));
 const ids=recommendedBanner({collections:[group(TMDB_BEST,'movie',items)],limit:5}).map(item=>item.id);
 assert.deepEqual(ids,['m0','m2','m3','m4','m5']);
 assert.deepEqual(recommendedBanner({collections:[group(TMDB_BEST,'movie',[title('b',undefined,{image:undefined,backdropImage:'/b.jpg'})])]}).map(item=>item.id),['b']);
});
test('without TMDB selections (Kids, still loading) the featured titles remain',()=>{
 assert.deepEqual(recommendedBanner({featured:[title('f1'),title('ch','live',{image:undefined})]}).map(item=>item.id),['f1','ch']);
 assert.deepEqual(recommendedBanner({continuing:[title('f1')],featured:[title('f1'),title('f2')]}).map(item=>item.id),['f1','f2']);
 assert.deepEqual(recommendedBanner(),[]);
});

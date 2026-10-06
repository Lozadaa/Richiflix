import test from 'node:test';
import assert from 'node:assert/strict';
import {responsivePosterArtwork} from './responsiveArtwork.js';
const poster='https://image.tmdb.org/t/p/w780/example.jpg';
test('poster density and the focused size choose a verified TMDB width',()=>{
 assert.match(responsivePosterArtwork(poster,210,1).src,/\/w342\//);
 assert.match(responsivePosterArtwork(poster,210,2).src,/\/w500\//);
 assert.match(responsivePosterArtwork(poster,600,1).src,/\/w780\//);
 assert.match(responsivePosterArtwork(poster,600,2).src,/\/original\//);
 assert.equal(responsivePosterArtwork(poster,0).pending,true);
});
test('large backdrops, official vectors and provider logos retain their own URL',()=>{
 for(const src of ['https://image.tmdb.org/t/p/original/art.jpg','https://image.tmdb.org/t/p/w780/team.svg','https://provider.test/logo.png'])assert.equal(responsivePosterArtwork(src,200,1),null);
});

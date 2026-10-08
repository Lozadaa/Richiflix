import test from 'node:test';
import assert from 'node:assert/strict';
import {isScreenBackdrop,posterVariant,responsivePosterArtwork,tvPanelPoster} from './responsiveArtwork.js';
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
test('R4.1: TV backdrops are w1280 and never re-sized as posters; PC keeps original',async()=>{
 const {artworkURL}=await import('./artwork.js');
 const tv=artworkURL('https://image.tmdb.org/t/p/original/art.jpg',true,true);
 assert.equal(tv,'https://image.tmdb.org/t/p/w1280/art.jpg');
 assert.equal(artworkURL('https://image.tmdb.org/t/p/w780/art.jpg',true,true),tv);
 assert.equal(artworkURL('https://image.tmdb.org/t/p/original/art.jpg',true,false),'https://image.tmdb.org/t/p/original/art.jpg');
 assert.equal(artworkURL('https://image.tmdb.org/t/p/original/poster.jpg',false,true),'https://image.tmdb.org/t/p/w780/poster.jpg');
 assert.equal(artworkURL('https://provider.test/art.jpg',true,true),'https://provider.test/art.jpg');
 assert.equal(responsivePosterArtwork(tv,1920,1),null,'a 1920 px banner must not climb back to original');
 assert.equal(isScreenBackdrop(tv),true);assert.equal(isScreenBackdrop(poster),false);
 assert.equal(posterVariant(poster,'w342'),'https://image.tmdb.org/t/p/w342/example.jpg');
});
test('R4.4: the TV panel opens on the card poster (w342), never on a backdrop or provider image',()=>{
 assert.equal(tvPanelPoster(poster,poster),'https://image.tmdb.org/t/p/w342/example.jpg');
 assert.equal(tvPanelPoster('https://image.tmdb.org/t/p/w1280/art.jpg',undefined),null);
 assert.equal(tvPanelPoster('https://provider.test/p.jpg','https://provider.test/p.jpg'),null);
 assert.equal(tvPanelPoster(undefined,undefined),null);
});

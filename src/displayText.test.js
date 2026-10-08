import test from 'node:test';
import assert from 'node:assert/strict';
import {displayText} from './displayText.js';
import {displayTitle,titleFacts} from './artwork.js';

test('provider emoji, flags, skin tones, joined families and keycaps are removed from presentation',()=>{
 assert.equal(displayText('\u26BE\uFE0F MLB EVENTS \u{1F525}'),'MLB EVENTS');
 assert.equal(displayText('\u{1F1FA}\u{1F1F8} Español \u{1F44D}\u{1F3FD}'),'Español');
 assert.equal(displayText('Familia \u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'),'Familia');
 assert.equal(displayText('Canal 1\uFE0F\u20E3 HD'),'Canal HD');
});
test('ordinary numbers, Spanish text, source metadata and playback identities stay intact',()=>{
 assert.equal(displayText('MLB 2026 · 19:00 · 4K / LAT-ENG'),'MLB 2026 · 19:00 · 4K / LAT-ENG');
 assert.equal(displayText('Acción, animación y béisbol'),'Acción, animación y béisbol');
 assert.equal(displayText(null),'');
 const item={id:'stream-original',url:'xtream://original/live/123.m3u8',title:'\u{1F3AC} Película (LAT/ENG) (2026)',duration:'95 min \u23F1\uFE0F'};
 assert.equal(displayTitle(item),'Película');assert.equal(titleFacts(item),'2026 · LAT/ENG · 95 min');
 assert.ok(item.title.startsWith('\u{1F3AC}'));assert.equal(item.url,'xtream://original/live/123.m3u8');assert.equal(item.id,'stream-original');
});

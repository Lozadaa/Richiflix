import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';

// Kingdom is the visible name; richiflix survives only as technical names users' data depends on.
const technical=[/(?:window|globalThis)\.richiflix\b/g,/__richiflix[A-Z]\w*/g,/\brichiflix[A-Z]\w*/g,/\brichiflix-[a-z-]+/g,/\brichiflix:/g,/\brichiflix\.local\b/g];
test('src and index.html only keep technical richiflix names',()=>{
 const files=[...readdirSync('src').filter(name=>/\.(jsx?|css)$/.test(name)&&!name.endsWith('.test.js')).map(name=>`src/${name}`),'index.html'];
 const left=files.flatMap(file=>{const text=technical.reduce((text,pattern)=>text.replace(pattern,''),readFileSync(file,'utf8'));return [...text.matchAll(/.{0,30}richiflix.{0,30}/gi)].map(match=>`${file}: ${match[0]}`);});
 assert.deepEqual(left,[]);
});
test('KingdomLoader existe, usa el glifo y sólo anima transform/opacity',()=>{
 const brand=readFileSync(new URL('./Brand.jsx',import.meta.url),'utf8'),css=readFileSync(new URL('./style.css',import.meta.url),'utf8');
 assert.match(brand,/export function KingdomLoader/);
 assert.match(brand,/kingdom-loader-shadow/);
 const bounce=css.match(/@keyframes kingdom-bounce\{.*?\}\}/s)?.[0]||'';
 assert.ok(bounce,'falta @keyframes kingdom-bounce');
 assert.doesNotMatch(bounce,/\b(top|left|width|height|margin|padding|box-shadow):/);
 assert.match(css,/prefers-reduced-motion:reduce\)\{[^}]*kingdom-glyph\{animation:kingdom-pulse/);
});

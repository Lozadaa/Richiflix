import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchLoaderLabel} from './loaderPhrases.js';

test('la búsqueda en curso usa KingdomLoader, no el texto «Buscando…» del contador',()=>{
 const app=readFileSync(new URL('./App.jsx',import.meta.url),'utf8'),css=readFileSync(new URL('./style.css',import.meta.url),'utf8');
 assert.doesNotMatch(app,/'Buscando…'/);
 assert.match(app,/<KingdomLoader className="is-search" label=\{searchLoaderLabel\(query\)\} phrase=\{searchPhrase\}\/>/);
 assert.doesNotMatch(app,/className="catalog-count" role=/);
 const rules=[...css.matchAll(/\.kingdom-loader\.is-search[^{]*\{([^}]*)\}/g)].map(match=>match[1]).join(';');
 assert.ok(rules,'falta .kingdom-loader.is-search');
 assert.doesNotMatch(rules,/animation|transition|backdrop-filter|blur|\binset:/);
});
test('searchLoaderLabel limpia la consulta y la corta a 40 caracteres',()=>{
 assert.equal(searchLoaderLabel(' Matrix '),'Buscando «Matrix»');
 assert.equal(searchLoaderLabel('🎬 Dune'),'Buscando «Dune»');
 const long=searchLoaderLabel('a'.repeat(60)),inner=long.slice('Buscando «'.length,-1);
 assert.equal(Array.from(inner).length,40);
 assert.match(inner,/…$/);
 assert.equal(searchLoaderLabel('b'.repeat(40)),`Buscando «${'b'.repeat(40)}»`);
});

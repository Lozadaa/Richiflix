import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

// Render the vector at each native size; no raster enlargement or image editor.
const directory=resolve(import.meta.dirname,'../public/brand');
const svg=await readFile(join(directory,'richiflix.svg'),'utf8');
const browser=await chromium.launch({headless:true});
const sizes=[16,24,32,48,64,128,256],frames=[];
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const size of [...sizes,117,512,1024]){
  await page.setViewportSize({width:size,height:size});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
  const png=await page.screenshot({omitBackground:true});
  await writeFile(join(directory,`richiflix-${size}.png`),png);
  if(sizes.includes(size))frames.push({size,png});
 }
}finally{await browser.close();}
const header=Buffer.alloc(6+frames.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
for(const [index,{size,png}] of frames.entries()){
 const at=6+index*16;header[at]=header[at+1]=size===256?0:size;
 header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length;
}
await writeFile(join(directory,'richiflix.ico'),Buffer.concat([header,...frames.map(frame=>frame.png)]));
console.log('Richiflix: vector, Windows ICO (16–256), Tizen PNG 117 y PNG 512/1024.');

const {_electron:electron,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {addTestSource}=require('./test-source.cjs');

(async()=>{
 const root=path.resolve(__dirname,'..'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-images-'));let app;
 try{
  const original=await fs.readFile(path.join(root,'public/brand/kingdom-1024.png'));
  const tiny=await fs.readFile(path.join(root,'public/brand/kingdom-16.png'));
  const ico=await fs.readFile(path.join(root,'public/brand/kingdom.ico'));
  assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),7);
  for(let i=0;i<7;i++){const at=6+i*16,offset=ico.readUInt32LE(at+12);assert.equal(ico.readUInt16LE(at+6),32);assert.equal(ico.subarray(offset,offset+8).toString('hex'),'89504e470d0a1a0a');}
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:userData}});
  const page=await app.firstWindow(),errors=[];let mode='original';page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:900,height:700});
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url==='https://richiflix-images.test/logo.png')await route.fulfill({contentType:'image/png',body:tiny});
   else if(url.endsWith('/cover.png')){
    if(mode==='error')await route.abort();else await route.fulfill({contentType:'image/png',body:mode==='tiny'?tiny:original});
   }else if(url.startsWith('file:'))await route.continue();else await route.abort();
  });
  await page.addInitScript(()=>{localStorage.setItem('rf-tv-mode','false');
   let hold=true;const pending=[],decode=HTMLImageElement.prototype.decode;
   window.__heldImages=0;
   HTMLImageElement.prototype.decode=async function(){
    if(hold&&this.src.includes('cover.png')){window.__heldImages++;await new Promise(resolve=>pending.push(resolve));}
    return decode.call(this);
   };
   window.__releaseImages=()=>{hold=false;pending.splice(0).forEach(resolve=>resolve());};
  });
  await page.reload();await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await addTestSource(page,{name:'Imagen de prueba',url:'https://richiflix-images.test/movie.mp4',image:'https://richiflix-images.test/cover.png'});
  await addTestSource(page,{name:'Otra imagen',url:'https://richiflix-images.test/other.mp4',image:'https://richiflix-images.test/other.png'});
  const hero=page.locator('.hero-art'),image=hero.locator('img').last();
  await page.waitForFunction(()=>window.__heldImages>0&&document.querySelector('.hero-art>img')?.naturalWidth===1024);
  assert.equal(await hero.getAttribute('data-image-state'),'loading');assert.equal(await image.evaluate(img=>getComputedStyle(img).opacity),'0');
  await page.evaluate(()=>window.__releaseImages());await expect(hero).toHaveAttribute('data-image-state','ready');await expect.poll(()=>image.evaluate(img=>getComputedStyle(img).opacity)).toBe('1');await expect(hero.locator('.richiflix-art')).toHaveCount(0);
  await page.getByRole('button',{name:'Imagen de prueba',exact:true}).click();
  await expect(page.locator('.detail-image')).toHaveAttribute('data-image-state','ready');await expect(page.locator('.detail-image .richiflix-art')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:2560,height:1440});await expect(hero).toHaveAttribute('data-image-state','low-resolution');await expect.poll(()=>image.evaluate(img=>getComputedStyle(img).opacity)).toBe('0');
  await page.setViewportSize({width:900,height:700});await expect(hero).toHaveAttribute('data-image-state','ready');
  await page.evaluate(async()=>{window.scrollTo({top:0,behavior:'instant'});await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  await page.screenshot({path:path.join(root,'branding-preview.png')});
  mode='tiny';await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.hero-art>img')?.naturalWidth===16);await page.evaluate(()=>window.__releaseImages());
  await expect(hero).toHaveAttribute('data-image-state','low-resolution');assert.equal(await image.evaluate(img=>getComputedStyle(img).opacity),'0');
  await page.getByRole('button',{name:'Imagen de prueba',exact:true}).click();await expect(page.locator('.detail-image')).toHaveAttribute('data-image-state','low-resolution');
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  await page.screenshot({path:path.join(root,'image-fallback-preview.png')});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  // Switch featured titles while decode is pending; late art must stay detached.
  mode='original';await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await page.waitForFunction(()=>window.__heldImages>0);await page.getByRole('button',{name:'Destacado: Otra imagen',exact:true}).click();
  await page.evaluate(()=>window.__releaseImages());assert.ok(!(await hero.locator('img').last().getAttribute('src')).includes('cover.png'));
  mode='error';await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();await expect(hero).toHaveAttribute('data-image-state','unavailable');assert.equal(await image.evaluate(img=>getComputedStyle(img).opacity),'0');
  await addTestSource(page,{name:'Logo de prueba',url:'https://richiflix-images.test/live.m3u8',image:'https://richiflix-images.test/logo.png',live:true});
  await page.getByRole('button',{name:'TV en vivo',exact:true}).click();
  const logo=page.getByRole('button',{name:'Logo de prueba',exact:true}).locator('.quality-logo');
  await expect(logo).toHaveAttribute('data-image-state','low-resolution');
  const dimensions=await logo.locator('img').last().evaluate(img=>({width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,dpr:devicePixelRatio}));
  assert.ok(dimensions.width*dimensions.dpr<=16.01&&dimensions.height*dimensions.dpr<=16.01,'Un logo diminuto nunca se amplía');
  assert.equal(await logo.locator('.channel-identity').count(),1);assert.equal(await logo.locator('img').last().evaluate(img=>getComputedStyle(img).opacity),'0');assert.equal(await page.locator('img[src*="unsplash"]').count(),0);assert.deepEqual(errors,[]);
  console.log('Imágenes OK: ocultas hasta decode, resolución validada en hero y detalle, resize sin pixelado, logos sin ampliar, error y cambio rápido seguros. ICO Windows con 7 tamaños.');
 }finally{
  await app?.close();const target=path.resolve(userData);
  assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('richiflix-images-'));
  await fs.rm(target,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

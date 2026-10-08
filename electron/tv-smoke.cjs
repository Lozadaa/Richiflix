const {_electron:electron,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {addTestSource}=require('./test-source.cjs');

(async()=>{
 const userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-tv-smoke-'));let app;
 try{
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:userData}});
  const page=await app.firstWindow();await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await addTestSource(page,{name:'Prueba de reproduccion',url:'https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4'});
  await page.evaluate(()=>localStorage.setItem('rf-player-volume','0.35'));
  await page.locator('.hero .primary').click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1,{},{timeout:30000});
  assert.equal(await page.locator('.tv-player').count(),1);
  assert.equal(await page.locator('.player-volume,.player-resume,.playback-options').count(),0);
  assert.equal(await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).count(),0);
  assert.equal(await page.locator('video').evaluate(video=>video.volume),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rf-player-volume')),'0.35');
  await page.getByRole('button',{name:'Pausar vídeo',exact:true}).focus();
  await expect.poll(()=>page.locator('.player-dialog').evaluate(dialog=>dialog.classList.contains('chrome-hidden')),{timeout:8000}).toBe(true);
  await page.keyboard.press('ArrowDown');await expect.poll(()=>page.evaluate(()=>document.activeElement.classList.contains('playback-toggle'))).toBe(true);
  await page.keyboard.press('Enter');await expect.poll(()=>page.locator('video').evaluate(video=>video.paused)).toBe(true);
  assert.equal(await page.locator('.player-resume').count(),0);
  await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>document.activeElement.getAttribute('aria-label'))).toBe('Adelantar 10 segundos');
  await page.keyboard.press('ArrowLeft');await expect.poll(()=>page.evaluate(()=>document.activeElement.classList.contains('playback-toggle'))).toBe(true);
  await page.keyboard.press('ArrowLeft');await expect.poll(()=>page.evaluate(()=>document.activeElement.getAttribute('aria-label'))).toBe('Retroceder 10 segundos');
  await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>document.activeElement.classList.contains('playback-toggle'))).toBe(true);
  await page.screenshot({path:path.join(__dirname,'../player-tv-preview.png')});
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Modo TV',exact:true}).click();await page.locator('.hero .primary').click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1,{},{timeout:30000});
  assert.equal(await page.locator('.tv-player').count(),0);
  assert.equal(await page.locator('.player-volume').count(),1);
  assert.equal(await page.locator('video').evaluate(video=>video.volume),0.35);
  assert.equal(await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).count(),1);
  await page.getByRole('button',{name:'Opciones de reproducción',exact:true}).click();assert.equal(await page.getByLabel('Velocidad de reproducción').count(),1);
  console.log('TV/desktop OK: volumen del mando, preferencia de escritorio conservada, controles útiles, un Play, autoocultado con foco y restauración del player de escritorio.');
 }finally{
  await app?.close();const resolved=path.resolve(userData);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('richiflix-tv-smoke-'));
  await fs.rm(resolved,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

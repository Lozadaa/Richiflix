const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-event-regions-'));let app;
 try{
  // Reuse the owner's encrypted connection and cached labels in isolated data.
  // No login is entered, no stream is opened, and originals are never modified.
  const saved=path.join(process.env.APPDATA,'richiflix');
  for(const file of ['Local State','xtream-account.enc','xtream-sources.enc','metadata-token.enc','xtream-catalogue.json'])try{await fs.copyFile(path.join(saved,file),path.join(temp,file));}catch(error){if(error.code!=='ENOENT')throw error;}
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_USER_DATA:temp}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false)));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('rf-profiles',JSON.stringify([{id:'regions',name:'Adulto',kind:'adult'}]));Date.now=()=>Date.parse('2026-10-05T15:00:00Z');});
  await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await page.getByLabel('Buscar títulos y canales').fill('New York Yankees vs. Tampa Bay Rays');
  const yankees=page.locator('.card').filter({has:page.locator('.live-label.is-event')}).first();await expect(yankees.locator('.live-label')).toHaveText('Hoy 21:00',{timeout:15000});await expect(page.locator('main .card[data-content-id^="event:mlb:"]'),'ES/EN signals of one game are one card').toHaveCount(1);
  await yankees.locator('.card-open').focus();await expect(page.locator('.focus-eyebrow')).toContainText('HOY 21:00 · Empieza en 9 h');assert.doesNotMatch(await page.locator('.focus-eyebrow').innerText(),/Santiago/);assert.ok(!(await page.locator('.focus-stage h1').innerText()).includes('19:00'));
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('rf-mlb-schedule-v1'))?.games.some(game=>game.date==='2026-10-05'&&game.teams.includes(147)&&game.teams.includes(139));}catch{return false;}},null,{timeout:15000});
  await page.screenshot({path:path.join(__dirname,'../events-santiago-preview.png')});
  await page.getByLabel('Buscar títulos y canales').fill('Cerro Porteño vs');const cerro=page.locator('.card').filter({has:page.locator('.live-label.is-event')}).first();await expect(cerro.locator('.live-label')).toHaveText('Hoy 19:15');
  await cerro.locator('.card-open').focus();await expect(page.locator('.focus-eyebrow')).toContainText('HOY 19:15');assert.equal(await page.locator('.focus-stage h1').innerText(),'Cerro Porteño vs 2 de Mayo');assert.deepEqual(errors,[]);
  await page.getByLabel('Buscar títulos y canales').fill('Atlanta Falcons vs. New Orleans Saints');await expect(page.locator('.live-label.is-event').first()).toHaveText('Hoy 21:15');
  await page.getByLabel('Buscar títulos y canales').fill('Francia vs. Bélgica');await expect(page.locator('.live-label.is-event').first()).toHaveText('Hoy 15:45');
  console.log('Horarios reales OK: eterboxtv convertido en ambos formatos, MLB oficial accesible desde Electron, Yankees 21:00, Cerro 19:15, NFL 21:15 y Francia 15:45 de Santiago, sin reloj extranjero en banner.');
 }finally{await app?.close();assert.ok(temp.startsWith(os.tmpdir()+path.sep)&&path.basename(temp).startsWith('richiflix-event-regions-'));await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error.name+' '+error.message.replace(/https?:\/\/\S+/g,'[address]'));process.exitCode=1;});

// Local Xtream panel redirects (302); no provider or TV is contacted.
const {_electron:electron}=require('@playwright/test');
const {createLiveFixture,instrumentPlayer,openLive,snapshot,waitForAdvancement}=require('./live-buffering-smoke.cjs');
const {addTestSource}=require('./test-source.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),directory=await fs.mkdtemp(path.join(os.tmpdir(),'kingdom-live-stall-'));
 let app,fixture;
 try{
  fixture=await createLiveFixture(directory);
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:path.join(directory,'profile')}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.webContents.setBackgroundThrottling(false)));
  const page=await app.firstWindow();await instrumentPlayer(page,root);
  await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await addTestSource(page,{name:'Directo local',url:fixture.host+'/master.m3u8',live:true});await openLive(page,'Directo local');
  const id=await page.evaluate(()=>window.__liveBuffering.latest());await waitForAdvancement(page,id,0);
  fixture.freeze();await page.waitForTimeout(20000);fixture.thaw();await waitForAdvancement(page,id,(await snapshot(page,id)).currentTime,20000);
  fixture.failSegments(8);fixture.cut();await page.waitForTimeout(5000);await fixture.release();await waitForAdvancement(page,id,(await snapshot(page,id)).currentTime,20000);
  // Only a new request for the master renews this expired session.
  const masters=fixture.stats.master;fixture.expire();
  await page.waitForFunction(()=>document.querySelector('.player-loading')?.textContent.includes('Reconectando'),null,{timeout:25000});
  await page.waitForFunction(()=>window.__liveBuffering.snapshot(window.__liveBuffering.latest()).loadSource>1,null,{timeout:35000});
  assert.ok(fixture.stats.master>masters,'Expired session must reload the entry URL through Xtream');
  await waitForAdvancement(page,id,(await snapshot(page,id)).currentTime,20000);
  assert.equal((await snapshot(page,id)).terminal,0);
  console.log('Live stall OK: frozen playlist 20s, repeated 404, transport cut/return, 302 and expired session recover.');
 }finally{await app?.close();await fixture?.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('kingdom-live-stall-'));await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[address]'));process.exitCode=1;});

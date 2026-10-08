const {_electron:electron}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-real-'));let app;
 try{
  const configured=path.join(process.env.APPDATA,'richiflix');
  for(const file of ['Local State','xtream-account.enc','xtream-catalogue.json'])await fs.copyFile(path.join(configured,file),path.join(userData,file));
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_USER_DATA:userData}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false)));
  const page=await app.firstWindow();await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('rf-profiles',JSON.stringify([{id:'test-adult',name:'Adulto',kind:'adult'}])));await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).focus();await page.keyboard.press('Enter');console.log('Real-provider profile selected.');
  await page.locator('.hero .primary').waitFor({timeout:20000}).catch(async()=>{console.log(JSON.stringify({status:await page.getByRole('status').allTextContents(),alerts:await page.getByRole('alert').allTextContents()}));throw Error('Catalogue UI unavailable');});
  const result=await page.evaluate(async()=>{const data=await window.richiflix.xtreamCatalogue(false);return {channels:data.channels.length,movies:data.movies.length,series:data.shows.length};});console.log(JSON.stringify({catalogue:result}));
  const secretFree=await app.evaluate(async({app,safeStorage})=>{const fs=process.mainModule.require('node:fs/promises'),path=process.mainModule.require('node:path'),directory=app.getPath('userData');const decoded=await safeStorage.decryptStringAsync(await fs.readFile(path.join(directory,'xtream-account.enc'))),account=JSON.parse(decoded.result),cache=await fs.readFile(path.join(directory,'xtream-catalogue.json')),encrypted=await fs.readFile(path.join(directory,'xtream-sources.enc'));return !cache.includes(Buffer.from(account.username))&&!cache.includes(Buffer.from(account.password))&&!encrypted.includes(Buffer.from(account.password));});assert.equal(secretFree,true);console.log('Catalogue excludes credentials and saved connections are encrypted; personal bundles include the authorized default login.');
  await page.locator('.hero .primary').click();await page.locator('.player-dialog').waitFor();
  let moviePlaying=true;try{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1,null,{timeout:25000});}catch{moviePlaying=false;}
  console.log(JSON.stringify({realMoviePlaying:moviePlaying}));await page.keyboard.press('Escape');await page.locator('.player-dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:'Series',exact:true}).click();await page.locator('.catalog-grid .card-open').first().click();await page.locator('.episode-button').first().waitFor({timeout:50000});
  await page.locator('.episode-button').first().click();await page.locator('.player-dialog').waitFor();
  let episodePlaying=true;try{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1,null,{timeout:25000});}catch{episodePlaying=false;}
  console.log(JSON.stringify({realEpisodePlaying:episodePlaying}));await page.keyboard.press('Escape');await page.locator('.player-dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:'TV en vivo',exact:true}).click();
  await page.getByLabel('Buscar títulos y canales').fill('ESPN |US');await page.locator('.catalog-grid .card-open').first().click();await page.getByRole('button',{name:'Reproducir',exact:true}).click();await page.locator('.player-dialog').waitFor();
  let livePlaying=true;try{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>1,null,{timeout:25000});}catch{livePlaying=false;}
  console.log(JSON.stringify({realLivePlaying:livePlaying}));
 }finally{await app?.close();const target=path.resolve(userData);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('richiflix-real-'));await fs.rm(target,{recursive:true,force:true});}
})().catch(error=>{console.error('Real-provider check stopped: '+error.name+' '+error.message.replace(/https?:\/\/\S+/g,'[address]'));process.exitCode=1;});

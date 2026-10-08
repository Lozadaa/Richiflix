const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{createServer}=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-smoke-'));let app;
 const {fixtureResponse}=await import('../scripts/xtream-fixture.mjs');
 const server=createServer((request,response)=>{if(request.url.startsWith('/player_api.php')){response.setHeader('Content-Type','application/json');response.end(JSON.stringify(fixtureResponse('http://localhost'+request.url)));}else{response.writeHead(404);response.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const host=`http://127.0.0.1:${server.address().port}`;
 try{
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:userData}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false)));
  const page=await app.firstWindow(),errors=[];await page.emulateMedia({reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Crear perfil',exact:true}).click();
  await page.getByRole('button',{name:'Añadir perfil',exact:true}).click();await page.getByRole('button',{name:'Kids',exact:true}).click();await page.getByRole('button',{name:'Crear perfil',exact:true}).click();
  await page.getByRole('button',{name:'Adulto',exact:true}).click();await page.getByRole('button',{name:'Ajustes',exact:true}).click();
  await page.getByLabel('Servidor Xtream').fill(host);await page.getByLabel('Usuario Xtream').fill('fixture-user');await page.getByLabel('Contraseña Xtream').fill('fixture-password');
  await page.getByRole('button',{name:'Conectar',exact:true}).click();await page.getByText('1 canales · 1 películas · 1 series',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Contraseña Xtream').count(),0);assert.equal((await page.locator('body').innerText()).includes('fixture-password'),false);
  const encrypted=await fs.readFile(path.join(userData,'xtream-account.enc'));assert.ok(!encrypted.includes(Buffer.from('fixture-password')));
  const cache=await fs.readFile(path.join(userData,'xtream-catalogue.json'),'utf8');assert.ok(!cache.includes('fixture-user')&&!cache.includes('fixture-password'));
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  await expect(page.getByRole('button',{name:'Series',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Series',exact:true}).click();await page.locator('.catalog-grid .card-open').first().click();
  await page.getByRole('button',{name:'Reproducir Fixture Episode 2',exact:true}).click();await page.locator('.player-dialog').waitFor();
  assert.ok((await page.locator('video').getAttribute('src')).endsWith('/series/fixture-user/fixture-password/90.mp4'));
  await page.keyboard.press('Escape');await page.locator('.player-dialog').waitFor({state:'detached'});
  await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();await page.getByRole('heading',{name:'Películas',exact:true}).waitFor();
  await page.getByRole('button',{name:'MLB',exact:true}).click();await expect(page.locator('.catalog-grid .card')).toHaveCount(1);
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();await page.getByRole('button',{name:'Kids',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'No hay títulos verificados para Kids'})).toBeVisible();assert.equal(await page.locator('.card').count(),0);
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();assert.equal(await page.getByLabel('Usuario Xtream').count(),0);assert.equal(await page.locator('.xtream-settings').count(),0);
  assert.deepEqual(errors,[]);console.log('Electron Xtream OK: login, encrypted Windows storage, secret-free metadata, catalogue, seasons/episode URL, restart, MLB, strict Kids.');
 }finally{await app?.close();await new Promise(resolve=>server.close(resolve));const target=path.resolve(userData);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('richiflix-smoke-'));await fs.rm(target,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

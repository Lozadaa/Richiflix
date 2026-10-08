// Read-only visual capture with isolated profiles and the selected catalogue.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-capture-'));let app;
 try{
  for(const file of ['Local State','xtream-account.enc','xtream-catalogue.json'])await fs.copyFile(path.join(process.env.APPDATA,'richiflix',file),path.join(userData,file));
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:userData}});
  const page=await app.firstWindow();
  const settled=()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const capture=async filename=>{await settled();await page.screenshot({path:path.join(root,filename)});};
  await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Añadir perfil',exact:true}).click();await page.getByRole('button',{name:'Kids',exact:true}).click();await page.getByRole('button',{name:'Crear perfil',exact:true}).click();
  await capture('profiles-preview.png');await page.getByRole('button',{name:'Adulto',exact:true}).click();await page.getByRole('heading',{name:'En vivo',exact:true}).waitFor();await capture('preview.png');
  await page.setViewportSize({width:390,height:844});await capture('mobile-preview.png');await page.setViewportSize({width:1480,height:900});
  await page.getByRole('button',{name:'TV en vivo',exact:true}).click();await capture('sources-selection-preview.png');
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();await capture('settings-preview.png');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'TV en vivo',exact:true}).click();await page.locator('.card-open').first().click();await capture('detail-preview.png');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();await page.getByRole('button',{name:'Kids',exact:true}).click();await capture('kids-preview.png');
  console.log('Capturas OK: perfiles, eterboxtv, móvil, catálogo Xtream, ajustes, detalle y Kids vacío.');
 }finally{await app?.close();const target=path.resolve(userData);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('richiflix-capture-'));await fs.rm(target,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

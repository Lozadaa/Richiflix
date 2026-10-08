const {_electron:electron}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-metadata-'));let app;try{
 for(const name of ['Local State','xtream-account.enc','xtream-catalogue.json'])await fs.copyFile(path.join(process.env.APPDATA,'richiflix',name),path.join(temp,name));
 app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_USER_DATA:temp}});
 console.log(JSON.stringify(await app.evaluate(async({app,safeStorage,net})=>{
  const fs=process.mainModule.require('node:fs/promises'),path=process.mainModule.require('node:path');
  const account=JSON.parse((await safeStorage.decryptStringAsync(await fs.readFile(path.join(app.getPath('userData'),'xtream-account.enc')))).result);
  const catalogue=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'xtream-catalogue.json'),'utf8'));const out=[];
  for(const item of catalogue.movies.slice(0,5)){
   const url=new URL(account.host+'/player_api.php');for(const [key,value] of Object.entries({username:account.username,password:account.password,action:'get_vod_info',vod_id:item.streamId,language:'es-ES'}))url.searchParams.set(key,value);
   const info=(await (await net.fetch(url.href)).json()).info||{};
   out.push({title:item.title,fields:Object.keys(info),tmdb:info.tmdb_id,trailer:info.youtube_trailer,plot:String(info.plot||'').slice(0,220)});
  }return out;
 })));
}finally{await app?.close();assert.ok(temp.startsWith(os.tmpdir()+path.sep)&&path.basename(temp).startsWith('richiflix-metadata-'));await fs.rm(temp,{recursive:true,force:true});}})().catch(()=>{console.error('Metadata audit unavailable');process.exitCode=1;});

// Reads the user-authorised account on stdin; never prints credentials.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.setName('richiflix');app.setPath('userData',process.env.RICHIFLIX_USER_DATA||path.join(app.getPath('appData'),'richiflix'));
app.whenReady().then(async()=>{
 try{
  const input=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));
  const store=require('./xtream-store.cjs').createXtreamStore(app.getPath('userData'));
  await store.save(input);const data=await store.catalogue(true);
  console.log(JSON.stringify({configured:true,name:data.connection.name,channels:data.channels.length,movies:data.movies.length,series:data.shows.length}));
 }catch(error){console.error('No se pudo configurar la fuente Xtream: '+error.message);process.exitCode=1;}
 finally{app.quit();}
});

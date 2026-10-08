import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Temporary LAN receiver for the opt-in measurement build, no remote commands,
// source URLs, profile names, stream identifiers or credentials are accepted.
const root=resolve(import.meta.dirname,'..'),samples=[],port=59337;
const numberFields=['at','focusSamples','focusMoved','keyToFrameP95','keyToFrameMax','frameP95','frameOver32ms','longTaskCount','longTaskMax','mountedCards','mountedImages','bootMs'];
const stringFields=['measurement','workerMode','bannerState','trailerState','trailerErrorKind'];
await mkdir(resolve(root,'artifacts'),{recursive:true});
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
 if(req.method!=='POST'||req.url!=='/metrics'){res.statusCode=404;res.end();return;}
 if(!['192.168.1.12','127.0.0.1','::ffff:192.168.1.12','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.statusCode=403;res.end();return;}
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)throw Error('Too large');}
  const data=JSON.parse(body),sample={receivedAt:new Date().toISOString()};
  for(const field of numberFields)if(Number.isFinite(data[field]))sample[field]=data[field];
  for(const field of stringFields)if(typeof data[field]==='string'&&/^[a-zA-Z0-9 ;,.:×>\-]{1,180}$/.test(data[field]))sample[field]=data[field];
  samples.push(sample);if(samples.length>120)samples.shift();
  await writeFile(resolve(root,'artifacts/tv-performance-samples.json'),JSON.stringify({device:'Samsung UN65M70HAGXZS, Tizen 10.0',measurement:'Actual TV keydown-to-second-RAF aggregates; not measured GPU paint',samples},null,2)+'\n');
  console.log(JSON.stringify(sample));res.statusCode=204;res.end();
 }catch{res.statusCode=400;res.end();}
});
await new Promise(resolve=>server.listen(port,'0.0.0.0',resolve));console.log('Temporary aggregate TV receiver ready on port '+port);
const close=()=>server.close(()=>process.exit());process.on('SIGINT',close);process.on('SIGTERM',close);setTimeout(close,20*60000).unref();

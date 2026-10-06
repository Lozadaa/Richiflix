import {readFile,writeFile,readdir,copyFile,mkdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {zipSync} from 'fflate';
import {buildTrailerBridge,allowTrailerBridgeFrame} from './trailer-bridge-build.mjs';

const root=resolve(import.meta.dirname,'..'),directory=join(root,'dist-tizen');
const bridge=buildTrailerBridge(root);
let manifest=allowTrailerBridgeFrame(await readFile(join(root,'tizen/config.xml'),'utf8'),bridge);
if(bridge)manifest=manifest.replace('</tizen:allow-navigation>',` ${new URL(bridge).origin}</tizen:allow-navigation>`);
await writeFile(join(directory,'config.xml'),manifest);
let html=await readFile(join(directory,'index.html'),'utf8');
// Classic bundle avoids the partially supported module loader on older TV engines.
html=html.replace('width=device-width, initial-scale=1.0','width=1920, user-scalable=no');
html=html.replace('type="module"','defer').replace(/ crossorigin/g,'');
html=html.replace("script-src 'self'","script-src 'self' file:");
html=allowTrailerBridgeFrame(html,bridge);
html=html.replace('</head>','<script src="$WEBAPIS/webapis/webapis.js"></script></head>');
await writeFile(join(directory,'index.html'),html);

// The TV launcher uses the same master mark as Windows and the interface.
await copyFile(join(root,'public/brand/richiflix-117.png'),join(directory,'icon.png'));

const files={};async function collect(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);if(entry.isDirectory())await collect(path);else files[relative(directory,path).replaceAll('\\','/')]=new Uint8Array(await readFile(path));}}
await collect(directory);await mkdir(join(root,'artifacts'),{recursive:true});
const output=join(root,'artifacts/Richiflix-Tizen-unsigned.wgt');
await writeFile(output,zipSync(files,{level:6}));
console.log(`Tizen 6.5+ preparado: ${Object.keys(files).length} archivos.\n${output}\nSIN FIRMA: requiere certificado Samsung con DUID del TV antes de instalar.`);

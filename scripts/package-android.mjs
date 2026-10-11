import {cp,mkdir,rm,writeFile,copyFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';

// Android TV / Google TV package: dist-android (vite --mode android) → android/app/src/main/assets/www → APK.
// Tools: ANDROID_HOME and JAVA_HOME, or the portable kit in %LOCALAPPDATA%\KingdomAndroid (sdk, jdk).
const root=resolve(import.meta.dirname,'..'),android=join(root,'android'),kit=join(process.env.LOCALAPPDATA||'','KingdomAndroid');
const exists=path=>access(path).then(()=>true,()=>false);
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||join(kit,'sdk'),java=process.env.JAVA_HOME||join(kit,'jdk');
if(!await exists(sdk))throw Error(`Android SDK not found (${sdk}). Set ANDROID_HOME.`);
if(!await exists(java))throw Error(`JDK 17 not found (${java}). Set JAVA_HOME.`);
const www=join(android,'app/src/main/assets/www');
await rm(www,{recursive:true,force:true});await mkdir(www,{recursive:true});await cp(join(root,'dist-android'),www,{recursive:true});
// Forward slashes: valid on Windows and no escaping in a .properties file.
await writeFile(join(android,'local.properties'),`sdk.dir=${sdk.split(String.fromCharCode(92)).join('/')}\n`);
const gradlew=join(android,process.platform==='win32'?'gradlew.bat':'gradlew');
const result=spawnSync(gradlew,['assembleRelease','--console=plain','-q'],{cwd:android,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,JAVA_HOME:java,ANDROID_HOME:sdk}});
if(result.status!==0)process.exit(result.status||1);
await mkdir(join(root,'artifacts'),{recursive:true});
const apk=join(root,'artifacts','Kingdom-AndroidTV.apk');
await copyFile(join(android,'app/build/outputs/apk/release/app-release.apk'),apk);
console.log(`Android TV listo: ${apk}`);

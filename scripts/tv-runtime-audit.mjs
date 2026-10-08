import {connectTV} from './tv-cdp.mjs';
import {writeFile} from 'node:fs/promises';
const tv=await connectTV();
try{
 console.log(JSON.stringify(await tv.evaluate(()=>({headings:[...document.querySelectorAll('h1,h2')].map(el=>el.textContent),profiles:JSON.parse(localStorage.getItem('rf-profiles')||'[]').map(profile=>({name:profile.name,kind:profile.kind})),cards:document.querySelectorAll('.card').length,alerts:[...document.querySelectorAll('[role=alert],[role=status]')].map(el=>el.textContent),trailer:{...document.querySelector('.trailer-preview')?.dataset},iframe:document.querySelector('.trailer-preview iframe')?.src,preference:typeof tizen.preference,fonts:document.fonts.status,heap:performance.memory?.usedJSHeapSize}))));
}finally{tv.close();}

// Public builds begin without a provider login. The personal preset lives in .env.local
// (ignored by git) as VITE_DEFAULT_SOURCE='{"name":"…","host":"http://…","username":"…","password":"…"}'.
export const PRIMARY_SOURCE_ID='eterboxtv';
function readPreset(){try{const raw=import.meta.env?.VITE_DEFAULT_SOURCE;if(!raw)return null;const source=JSON.parse(raw);return source&&source.host&&source.username&&source.password?{name:source.name||PRIMARY_SOURCE_ID,host:source.host,username:source.username,password:source.password}:null;}catch{return null;}}
export const defaultSource=readPreset();

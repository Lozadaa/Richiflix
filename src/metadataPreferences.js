import {defaultMetadataToken} from './metadataDefaults.js';
import {validateMetadataToken} from './metadata.js';

export function createMetadataPreferences({readToken,writeToken,checkToken,preset=defaultMetadataToken}){
 let pending;
 const token=()=>pending??=(async()=>{
  const stored=await readToken();
  // An encrypted empty string represents an explicit disconnection.
  if(stored!==null&&stored!==undefined)return validateMetadataToken(stored);
  const initial=validateMetadataToken(preset);await writeToken(initial);return initial;
 })().catch(error=>{pending=null;throw error;});
 const status=async()=>{const value=await token();return {configured:Boolean(value),isDefault:Boolean(value)&&value===preset};};
 return {token,status,save:async input=>{const value=validateMetadataToken(input);await checkToken(value);await writeToken(value);pending=Promise.resolve(value);return status();}};
}

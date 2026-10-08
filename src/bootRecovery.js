import {loadProfiles} from './profileStorage.js';

export function recoverBootProfiles({read=loadProfiles}={}){
 // The gate can create profiles, so even an existing local list must wait
 // for the canonical backup. Resource deadlines do not apply to recovery.
 return Promise.resolve().then(read);
}

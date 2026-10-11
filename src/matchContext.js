import {createContext} from 'react';
// «Detalle del partido»: App owns the dialog; the league panel and a football event's card panel open it with
// openMatch({slug,id,round,fallback}). `events` are the football IPTV events, for «Ver en vivo».
export const MatchDetailContext=createContext({openMatch:null,events:[]});

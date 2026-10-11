import {mlbMatchup} from './mlbArtwork.js';
import {footballMatchup} from './footballArtwork.js';
import {scoreLabel as mlbScoreLabel} from './mlbSchedule.js';
import {footballScoreLabel} from './footballSchedule.js';

// Crests for an IPTV channel or event: MLB first (its aliases are checked against baseball context), then European football.
export const matchupFor=item=>mlbMatchup(item)||footballMatchup(item);
export const scoreLabelFor=(score,firstId)=>score?.sport==='futbol'?footballScoreLabel(score,firstId):mlbScoreLabel(score,firstId);
// Card, panel and banner find the official game from `data-content-id`: `event:mlb:<gamePk>` or `event:futbol:<espnId>`.
export function officialGameId(contentId){
 const match=/^event:(?:mlb:(\d+)|(futbol:\d+))$/.exec(contentId||'');
 return match?match[1]?Number(match[1]):match[2]:null;
}

import teams from '../public/artwork/futbol/teams.json' with {type:'json'};
import {CLUB_ALIASES,NATION_NAMES} from './footballNames.js';

// Competitions of the «Fútbol» page, in chip order. `sources` are the ESPN slugs behind a chip (Selecciones gathers
// several); `table:false` has no single standings table. Domestic leagues come before cups: a club's «home» league.
export const FOOTBALL_COMPETITIONS=[
 {key:'conmebol.libertadores',label:'Libertadores',cup:true},{key:'conmebol.sudamericana',label:'Sudamericana',cup:true},
 {key:'chi.1',label:'Chile'},{key:'arg.1',label:'Argentina'},{key:'mex.1',label:'Liga MX'},{key:'bra.1',label:'Brasileirão'},{key:'col.1',label:'Colombia'},{key:'per.1',label:'Perú'},{key:'ecu.1',label:'Ecuador'},
 {key:'eng.1',label:'Premier League'},{key:'esp.1',label:'LaLiga'},{key:'ita.1',label:'Serie A'},{key:'ger.1',label:'Bundesliga'},{key:'fra.1',label:'Ligue 1'},
 {key:'uefa.champions',label:'Champions League',cup:true},{key:'uefa.europa',label:'Europa League',cup:true},{key:'usa.1',label:'MLS'},
 {key:'selecciones',label:'Selecciones',national:true,table:false,sources:['fifa.friendly','uefa.nations','concacaf.nations.league','fifa.worldq.conmebol','fifa.world']},
];
// Every ESPN slug → its chip label; national competitions all map to «Selecciones».
const leagueLabel=new Map(FOOTBALL_COMPETITIONS.flatMap(entry=>entry.sources?entry.sources.map(slug=>[slug,entry.label]):[[entry.key,entry.label]]));
export const FOOTBALL_LEAGUES=[...leagueLabel];
export const FOOTBALL_LEAGUE_LABELS=FOOTBALL_COMPETITIONS.map(entry=>entry.label);
export const competitionByLabel=label=>FOOTBALL_COMPETITIONS.find(entry=>entry.label===label)||null;
export const competitionLabel=slug=>leagueLabel.get(slug)||null;
const DOMESTIC=new Set(FOOTBALL_COMPETITIONS.filter(entry=>!entry.cup&&!entry.national).map(entry=>entry.key));

// Common words, cities or names shared with other clubs: they only identify a side that is exactly that name.
const EXACT=new Set(['como','nice','lens','brest','angers','racing','sporting','athletic','atletico','deportivo','union','paris','inter','roma','rayo','america','santos','nacional','libertad','central','cerro','alianza','junior','leon','atlas','galo','defensa','estudiantes','gimnasia','independiente','cristal','santa fe','medellin','tigres','pumas','chivas','cai','dim','idv','ldu','cabj','carp','casla','galaxy','udec','la u','universitario','internacional']);
const normalized=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const channel=value=>parseInt(value,16);
// ESPN colours include white and black kits; the duel background needs a hue that reads on the night blue.
function teamColor({color,alternateColor}){
 for(const value of [color,alternateColor]){
  if(!/^[0-9a-f]{6}$/i.test(value||''))continue;
  const [r,g,b]=[0,2,4].map(at=>channel(value.slice(at,at+2))/255),light=.2126*r+.7152*g+.0722*b;
  if(light>.08&&light<.82)return `#${value.toLowerCase()}`;
 }
 return '#5a6b85';
}
// «estados unidos» → «Estados Unidos», restoring the Spanish accents the aliases drop.
const ACCENTS={espana:'España',belgica:'Bélgica',mexico:'México',peru:'Perú',canada:'Canadá',panama:'Panamá',haiti:'Haití',japon:'Japón',iran:'Irán',tunez:'Túnez',sudafrica:'Sudáfrica',hungria:'Hungría',turquia:'Turquía',azerbaiyan:'Azerbaiyán',kazajistan:'Kazajistán',uzbekistan:'Uzbekistán',republica:'República',paises:'Países',rd:'RD',del:'del',de:'de',y:'y'};
const spanish=name=>name.split(' ').map(word=>ACCENTS[word]||word[0].toUpperCase()+word.slice(1)).join(' ');
const nationAliases=new Map(Object.entries(NATION_NAMES));
export const footballTeams=teams.filter(team=>!/^TBD\b/.test(team.name)).map(team=>{
 const nation=team.national?nationAliases.get(team.name)||[]:[];
 const home=team.national?null:team.leagues.find(league=>DOMESTIC.has(league))||team.leagues[0];
 const names=[team.name,team.shortName,team.abbreviation,...nation,...(CLUB_ALIASES[team.id]||[])].map(normalized).filter(Boolean);
 return {id:`futbol:${team.id}`,espnId:team.id,sport:'futbol',national:Boolean(team.national),name:team.name,teamName:nation[0]?spanish(nation[0]):team.shortName.trim(),abbreviation:team.abbreviation,
  location:team.national?'Selección':leagueLabel.get(home),leagues:team.leagues,color:teamColor(team),logo:team.logo?`artwork/futbol/${team.id}.png`:null,aliases:[...new Set(names)]};
});
const byId=new Map(footballTeams.map(team=>[team.id,team]));
export const footballTeam=id=>byId.get(id)||null;

const NOISE=/\b(?:soccer|futbol|football|premier league|laliga|la liga|serie a|bundesliga|ligue 1|champions league|europa league|uefa|libertadores|sudamericana|conmebol|copa|liga mx|mls|amistoso|amistosos|friendly|international friendly|eliminatorias|qualifying|nations league|mundial|world cup|primera division|major league soccer|liga profesional|brasileirao|betplay|dimayor|ligapro|spanish|english|espanol|lat|eng|es|en|hd|fhd|uhd|sd|hevc|4k)\b/g;
// Every club or national team a side can be. «Inter Milan» also contains «milan»: an alias inside a longer matched
// alias is part of that name, not a second team. Several teams with the same name all stay candidates.
function candidates(value){
 const words=` ${normalized(value)} `,clean=normalized(String(value).replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ').replace(/\b\d{1,2}[:.]\d{2}(?:\s*[ap]\.?m\.?(?![a-z]))?/gi,' ')).replace(NOISE,' ').replace(/\s+/g,' ').trim();
 const found=footballTeams.flatMap(team=>team.aliases.filter(alias=>alias.length>=4&&!EXACT.has(alias)?words.includes(` ${alias} `):clean===alias).map(alias=>({team,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
 const kept=[];for(const match of found)if(!kept.some(longer=>longer.alias!==match.alias&&longer.alias.includes(match.alias)))kept.push(match);
 return [...new Map(kept.map(match=>[match.team.id,match.team])).values()];
}
const shares=(first,second)=>first.leagues.some(league=>second.leagues.includes(league));
// Two sides: one candidate each, or the only pair that plays in the same competition.
function pair(first,second){
 // A club never plays a national team: «Peñarol vs. Progreso ◘ Primera Uruguay» is not Peñarol against Uruguay.
 if(first.length===1&&second.length===1)return first[0].id!==second[0].id&&first[0].national===second[0].national?[first[0],second[0]]:null;
 const pairs=first.flatMap(a=>second.filter(b=>a.id!==b.id&&shares(a,b)).map(b=>[a,b]));
 return pairs.length===1?pairs[0]:null;
}
export const FOOTBALL=/soccer|f[uú]tbol|futbol|premier league|la ?liga|serie a|bundesliga|ligue 1|champions|europa league|uefa|libertadores|sudamericana|liga mx|brasileir|mls\b|primera divisi[oó]n|liga profesional|betplay|ligapro|amistoso|eliminatorias|nations league|selecci[oó]n/i;
const OTHER_SPORTS=/\b(?:nba|wnba|nfl|nhl|mlb|ncaa[bf]?|basketball|baloncesto|basquet|hockey|b[eé]isbol|baseball|tenis|tennis|ufc|boxeo|boxing|wwe|nascar|f1|golf|rugby|volleyball|voleibol)\b/i;
const cache=new WeakMap(),VERSUS=/\s+(?:vs\.?|v\.?|versus|contra|@|x)\s+/i;
// Same contract as mlbMatchup: two identified sides, or one team when the channel is clearly football.
export function footballMatchup(item){
 if(item?.kind!=='iptv')return null;
 if(cache.has(item))return cache.get(item);
 // Other sports share city names with football clubs («Minnesota Timberwolves vs. Miami Heat ◘ NBA»).
 const text=`${item.title||''} ${item.genre||''}`;if(OTHER_SPORTS.test(text)&&!/soccer|f[uú]tbol/i.test(text)){cache.set(item,null);return null;}
 // «21:30 ◘ A vs. B ◘ Liga ◘» or «Liga MX | 19:00 | A vs. B»: the duel is the segment holding the «vs».
 const raw=String(item.title||''),title=raw.split(/\s*[◘|•]+\s*/).find(segment=>VERSUS.test(segment))||raw,versus=title.split(VERSUS),sides=versus.length===1?title.split(/\s+[-–]\s+/):versus;let result=null;
 if(sides.length===2){const teams=pair(candidates(sides[0]),candidates(sides[1]));result=teams?{sport:'futbol',teams}:null;}
 // «Premier League - Arsenal» is a channel, not a duel; an unmatched «A vs B» never falls back to one team.
 if(!result&&versus.length===1&&FOOTBALL.test(`${title} ${item.genre||''} ${item.category||''}`)){const found=candidates(title);result=found.length===1?{sport:'futbol',teams:found}:null;}
 cache.set(item,result);return result;
}
// Competition names as providers write them. Whole words only: «USL Championship» and «CONCACAF Champions Cup» are not
// the Champions League, «Serie A Ecuador» is Ecuador, «Brasileirão Serie B» and «Canadian Premier League» are none.
const NAMED=[
 ['conmebol.libertadores',/\blibertadores\b/,/\b(?:femenina|women|sub ?20|u20)\b/],['conmebol.sudamericana',/\bsudamericana\b/,/\b(?:femenina|women|sub ?20|u20)\b/],
 ['ecu.1',/\b(?:ligapro|serie a ecuador|liga pro ecuador)\b/,null],['bra.1',/\b(?:brasileirao|brasileiro|brazilian serie a|serie a brasil)\b/,/\bserie b\b/],
 ['chi.1',/\b(?:primera division de chile|campeonato nacional|chilean primera|futbol chileno)\b/,null],['arg.1',/\b(?:liga profesional|superliga argentina|lpf|futbol argentino|argentine)\b/,null],
 ['mex.1',/\b(?:liga mx|liga bbva mx|liga mexicana)\b/,/\b(?:expansion|femenil)\b/],['col.1',/\b(?:betplay|dimayor|liga colombiana)\b/,null],['per.1',/\bliga 1\b.*\bperu\b|\bfutbol peruano\b/,null],
 ['usa.1',/\b(?:mls|major league soccer)\b/,/\b(?:next pro|nwsl)\b/],
 ['eng.1',/\b(?:english premier league|premier league)\b/,/\b(?:canadian|egyptian|ukrainian|russian|bangladesh|nepal|ghana|kenya|trinidad|welsh|scottish)\s+premier league\b/],
 ['esp.1',/\b(?:laliga|la liga)\b(?! (?:mx|expansion|2|hypermotion|smartbank|f\b))/,null],['ita.1',/\bserie a\b/,/\bserie a\b (?:ecuador|brasil|brazil|b\b)|\b(?:ligapro|brasileirao|ecuador|brasil)\b/],
 ['ger.1',/\bbundesliga\b(?! 2)/,/\b(?:2 bundesliga|austrian|osterreich|frauen)\b/],['fra.1',/\bligue 1\b/,/\bligue 1\b (?:cameroun|tunisie|algerie|senegal)/],
 ['uefa.champions',/\b(?:uefa champions league|champions league|liga de campeones|ucl)\b/,/\b(?:concacaf|afc|caf|women|femenina)\b/],['uefa.europa',/\b(?:uefa europa league|europa league)\b/,/\bconference\b/],
 ['fifa.friendly',/\b(?:amistoso internacional|international friendly|amistosos internacionales|selecciones)\b/,null],['uefa.nations',/\b(?:uefa nations league|nations league)\b/,/\bconcacaf\b/],
 ['fifa.worldq.conmebol',/\beliminatorias\b/,null],['fifa.world',/\b(?:copa del mundo|world cup|mundial 20\d\d)\b/,/\b(?:club|clubes|sub|u\d\d|women|femenin)\b/],
];
const named=value=>{const words=normalized(value);return NAMED.find(([,test,not])=>test.test(words)&&!not?.test(words))?.[0]||null;};
// Chip label of a channel or event: official (ESPN), the competition both teams share, or named in the title or category.
// A duel of unknown teams («A vs B») never takes a league from its name: other leagues reuse those words.
export function footballLeague(item){
 if(item?.eventLeague)return item.eventLeague;
 const matchup=footballMatchup(item),title=named(item?.title);
 if(matchup?.teams.length===2){
  const [first,second]=matchup.teams;
  if(first.national&&second.national)return 'Selecciones';
  const shared=first.leagues.filter(league=>second.leagues.includes(league));
  if(title&&shared.includes(title))return competitionLabel(title);
  const domestic=shared.find(league=>DOMESTIC.has(league));
  return competitionLabel(domestic||(shared.length===1?shared[0]:''));
 }
 if(VERSUS.test(String(item?.title||'')))return null;
 return competitionLabel(title||named(item?.genre));
}

import teams from '../public/artwork/futbol/teams.json' with {type:'json'};

// ESPN slug → label shown in chips, cards and the hub. Domestic leagues first: a club's «home» league.
export const FOOTBALL_LEAGUES=[['eng.1','Premier League'],['esp.1','LaLiga'],['ita.1','Serie A'],['ger.1','Bundesliga'],['fra.1','Ligue 1'],['uefa.champions','Champions League'],['uefa.europa','Europa League']];
const leagueLabel=new Map(FOOTBALL_LEAGUES);
export const FOOTBALL_LEAGUE_LABELS=FOOTBALL_LEAGUES.map(([,label])=>label);
// Spanish and colloquial names used by IPTV providers, by ESPN id.
const aliases={
 83:['barca','fc barcelona'],86:['real madrid cf'],1068:['atletico madrid','atletico de madrid','atleti'],93:['athletic bilbao','athletic club bilbao'],
 244:['betis'],101:['rayo'],85:['celta','celta de vigo'],90:['deportivo la coruna','depor'],87:['racing de santander'],
 103:['ac milan'],110:['inter','inter de milan','inter milan','inter milano'],111:['juve'],104:['roma'],114:['ssc napoli','napoles'],3263:['genova'],
 132:['bayern munchen','bayern de munich','fc bayern'],124:['bvb'],131:['leverkusen','bayer 04'],268:['monchengladbach','borussia monchengladbach'],
 122:['colonia','koln','fc koln'],125:['eintracht'],127:['hamburgo','hamburger sv'],126:['friburgo'],137:['bremen'],11420:['leipzig'],
 160:['paris saint germain','paris sg'],176:['marsella','olympique de marsella','olympique marseille'],167:['olympique lyon','olympique de lyon','olympique lyonnais'],169:['rennes'],
 360:['manchester united','man utd'],382:['manchester city'],367:['tottenham'],393:['nottingham forest'],
 1929:['sl benfica'],437:['porto','oporto'],2250:['sporting lisboa','sporting de lisboa'],433:['sparta praga'],494:['slavia praga'],435:['olympiakos'],
 2790:['salzburg','red bull salzburg'],5807:['union saint gilloise','union st gilloise'],3236:['le havre'],
};
// Common words, cities or names shared with other clubs: they only identify a side that is exactly that name.
const EXACT=new Set(['como','nice','lens','brest','angers','racing','sporting','athletic','atletico','deportivo','union','paris','inter','roma','rayo']);
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
export const footballTeams=teams.map(team=>{
 const home=team.leagues.find(league=>!league.startsWith('uefa.'))||team.leagues[0];
 const names=[team.name,team.shortName,team.abbreviation,...(aliases[team.id]||[])].map(normalized);
 return {id:`futbol:${team.id}`,espnId:team.id,sport:'futbol',name:team.name,teamName:team.shortName.trim(),abbreviation:team.abbreviation,location:leagueLabel.get(home),leagues:team.leagues,
  color:teamColor(team),logo:team.logo?`artwork/futbol/${team.id}.png`:null,aliases:[...new Set(names)]};
});
const byId=new Map(footballTeams.map(team=>[team.id,team]));
export const footballTeam=id=>byId.get(id)||null;

const NOISE=/\b(?:soccer|futbol|football|premier league|laliga|la liga|serie a|bundesliga|ligue 1|champions league|europa league|uefa|spanish|english|espanol|lat|eng|es|en|hd|fhd|uhd|sd|hevc|4k)\b/g;
function identify(value){
 const words=` ${normalized(value)} `,clean=normalized(String(value).replace(/^\d{1,2}[:.]\d{2}\s*(?:[ap]m)?\s*/i,'')).replace(NOISE,' ').replace(/\s+/g,' ').trim();
 const found=footballTeams.flatMap(team=>team.aliases.filter(alias=>alias.length>=4&&!EXACT.has(alias)?words.includes(` ${alias} `):clean===alias).map(alias=>({team,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
 // «Inter Milan» also contains «milan»: an alias inside a longer matched alias is part of that name, not a second club.
 const kept=[];for(const match of found)if(!kept.some(longer=>longer.alias.includes(match.alias)))kept.push(match);
 if(!kept.length||new Set(kept.map(match=>match.team.id)).size!==1)return null;
 return kept[0].team;
}
export const FOOTBALL=/soccer|f[uú]tbol|futbol|premier league|la ?liga|serie a|bundesliga|ligue 1|champions|europa league|uefa/i;
const cache=new WeakMap(),VERSUS=/\s+(?:vs\.?|v\.?|versus|contra|@|x)\s+/i;
// Same contract as mlbMatchup: two identified sides, or one club when the channel is clearly football.
export function footballMatchup(item){
 if(item?.kind!=='iptv')return null;
 if(cache.has(item))return cache.get(item);
 const title=String(item.title||''),versus=title.split(VERSUS),sides=versus.length===1?title.split(/\s+[-–]\s+/):versus;let result=null;
 if(sides.length===2){const first=identify(sides[0]),second=identify(sides[1]);result=first&&second&&first.id!==second.id?{sport:'futbol',teams:[first,second]}:null;}
 // «Premier League - Arsenal» is a channel, not a duel; an unmatched «A vs B» never falls back to one club.
 if(!result&&versus.length===1&&FOOTBALL.test(`${title} ${item.genre||''} ${item.category||''}`)){const team=identify(title);result=team?{sport:'futbol',teams:[team]}:null;}
 cache.set(item,result);return result;
}
// League names as providers write them. Whole words only: «USL Championship» and «CONCACAF Champions Cup» are not
// the Champions League, «Serie A Ecuador» and «Canadian Premier League» are not the European ones.
const NAMED=[['eng.1',/\b(?:english premier league|premier league)\b/,/\b(?:canadian|egyptian|ukrainian|russian|bangladesh|nepal|ghana|kenya|trinidad|welsh|scottish)\s+premier league\b/],['esp.1',/\b(?:laliga|la liga)\b(?! (?:mx|expansion|2|hypermotion|smartbank|f\b))/,null],['ita.1',/\bserie a\b/,/\bserie a\b (?:ecuador|brasil|brazil|b\b)|\b(?:ligapro|brasileirao|ecuador|brasil)\b/],['ger.1',/\bbundesliga\b(?! 2)/,/\b(?:2\.? bundesliga|austrian|osterreich|frauen)\b/],['fra.1',/\bligue 1\b/,/\bligue 1\b (?:cameroun|tunisie|algerie|senegal)/],['uefa.champions',/\b(?:uefa champions league|champions league|liga de campeones|ucl)\b/,/\b(?:concacaf|afc|caf|women|femenina)\b/],['uefa.europa',/\b(?:uefa europa league|europa league)\b/,/\bconference\b/]];
const named=value=>{const words=normalized(value);return NAMED.find(([,test,not])=>test.test(words)&&!not?.test(words))?.[0]||null;};
// League of a channel or event: official (ESPN), the clubs' shared league, or named in the title or category.
// A duel of unknown clubs («A vs B») never takes a league from its name: other leagues reuse those words.
export function footballLeague(item){
 if(item?.eventLeague)return item.eventLeague;
 const matchup=footballMatchup(item),title=named(item?.title);
 if(matchup?.teams.length===2){
  const [first,second]=matchup.teams,shared=first.leagues.filter(league=>second.leagues.includes(league));
  if(title&&shared.includes(title))return leagueLabel.get(title);
  const domestic=shared.find(league=>!league.startsWith('uefa.'));
  return leagueLabel.get(domestic||(shared.length===1?shared[0]:''))||null;
 }
 if(VERSUS.test(String(item?.title||'')))return null;
 return leagueLabel.get(title||named(item?.genre))||null;
}

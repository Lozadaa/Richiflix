import teams from '../public/artwork/mlb/teams.json' with {type:'json'};

const colors={108:'#ba263d',109:'#aa344b',110:'#db693c',111:'#bd3c4c',112:'#3569b8',113:'#c73547',114:'#c64251',115:'#8064b3',116:'#d3793d',117:'#e17d42',118:'#4d91cf',119:'#4386d7',120:'#c64151',121:'#d67a40',133:'#609d79',134:'#d6b657',135:'#bda16b',136:'#53a5a0',137:'#e48e52',138:'#c95460',139:'#639ace',140:'#5182c3',141:'#537fce',142:'#bd5362',143:'#d15163',144:'#bf5965',145:'#b7beca',146:'#4bb7c8',147:'#9baeca',158:'#d1bc7d'};
const aliases={
 109:['diamondbacks','d backs','dbacks'],114:['cleveland indians','indians'],
 133:['oakland athletics','sacramento athletics','oakland a s','athletics','oak'],
 138:['st louis cardinals','saint louis cardinals'],143:['philiadelphia phillies'],
 145:['chw','chi white sox'],112:['chi cubs'],119:['la dodgers'],108:['la angels'],
 147:['ny yankees'],121:['ny mets'],120:['was','wsh'],
};
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const mlbTeams=teams.map(team=>({...team,color:colors[team.id],aliases:[team.name,team.teamName,team.abbreviation,...(aliases[team.id]||[])].map(normalized)}));

function identify(value){
 const words=` ${normalized(value)} `;
 const clean=normalized(String(value).replace(/^\d{1,2}:\d{2}\s*/,'')).replace(/\b(?:mlb|spanish|english|espanol|lat|eng|hd|fhd|uhd|hevc|4k)\b/g,'').replace(/\s+/g,' ').trim();
 const matches=mlbTeams.flatMap(team=>team.aliases.filter(alias=>alias.length>=4?words.includes(` ${alias} `):clean===alias).map(alias=>({team,length:alias.length}))).sort((a,b)=>b.length-a.length);
 if(!matches.length)return null;
 // Cities shared by two teams are never aliases, and two teams on one side
 // are deliberately ambiguous rather than producing the wrong duel.
 if(new Set(matches.map(match=>match.team.id)).size!==1)return null;
 return matches[0].team;
}
export function mlbMatchup(item){
 if(item.kind!=='iptv')return null;
 const title=String(item.title||'');
 const sides=title.split(/\s+(?:vs\.?|v\.?|versus|contra|at|@|x)\s+/i);
 const isBaseball=/\bmlb\b|baseball|b[eé]isbol/i.test(`${title} ${item.genre||''} ${item.category||''}`);
 if(sides.length===2){const first=identify(sides[0]),second=identify(sides[1]);return first&&second&&first.id!==second.id?{teams:[first,second]}:null;}
 if(sides.length>2||!isBaseball)return null;
 const team=identify(title);return team?{teams:[team]}:null;
}

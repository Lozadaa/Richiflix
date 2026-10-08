const genericTitle=/^(episodio|episode|cap[ií]tulo|ep\.?)\s*\d+$/i;
const text=value=>typeof value==='string'?value.trim():'';

// Provider numbering is absolute when it starts past 1 and runs beyond the
// season (season 2 starting at 13); those episodes are matched by their
// position from the first one. Specials (season 0) only take TMDB season 0.
export function mergeSeasonEpisodes(providerEpisodes,tmdbEpisodes,{season}){
 const tmdb=new Map((tmdbEpisodes||[]).filter(entry=>entry&&(Number(season)===0?Number(entry.season_number)===0:entry.season_number==null||Number(entry.season_number)===Number(season))).map(entry=>[Number(entry.episode_number),entry]));
 const numbers=providerEpisodes.map(episode=>Number(episode.episodeNumber)||0),first=Math.min(...numbers);
 const absolute=tmdb.size>0&&first>1&&Math.max(...numbers)>Math.max(...tmdb.keys());
 return providerEpisodes.map((episode,index)=>{
  const match=tmdb.get(absolute?numbers[index]-first+1:numbers[index]);if(!match)return episode;
  const name=text(match.name),overview=text(match.overview),english=match.overviewLanguage==='en';
  const description=overview&&!english?{description:overview,descriptionLanguage:'es'}:!text(episode.description)&&overview?{description:overview,descriptionLanguage:'en'}:{};
  return {...episode,...(name&&!genericTitle.test(name)?{title:name}:{}),...description,...(match.air_date?{airDate:match.air_date}:{}),...(match.runtime>0?{runtime:match.runtime}:{}),...(match.still_path?{stillPath:match.still_path}:{})};
 });
}

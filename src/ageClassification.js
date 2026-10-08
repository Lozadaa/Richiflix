// Preserve the actual regional certificate; PG and TV labels are not ages.
export function tmdbAgeClassification(data,type,tmdbId){
 const series=type==='series',results=series?data.content_ratings?.results:data.release_dates?.results;
 if(!Array.isArray(results))return null;
 const clean=value=>typeof value==='string'&&/^[\p{L}\p{N}+ -]{1,16}$/u.test(value.trim())&&!/^(NR|N\/A|Unrated|Not Rated)$/i.test(value.trim())?value.trim():null;
 for(const country of ['CL','ES','US']){
  const matches=results.filter(result=>result?.iso_3166_1===country);
  const entries=series?matches:matches.flatMap(result=>Array.isArray(result.release_dates)?result.release_dates:[]).sort((a,b)=>Number(b.type===3)-Number(a.type===3));
  for(const entry of entries){const label=clean(series?entry.rating:entry.certification);if(label)return {label,country,source:'TMDB',tmdbId:String(tmdbId)};}
 }
 return null;
}

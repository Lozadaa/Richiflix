import React from 'react';
import {displayTitle} from './artwork.js';
import {QualityImage} from './QualityImage.jsx';
import {artworkCategory} from './categoryArtwork.js';
import {mlbMatchup} from './mlbArtwork.js';
import {MatchupArtwork} from './MatchupArtwork.jsx';
import {displayText} from './displayText.js';

const palettes=[['#b4a3e3','#29324e'],['#ffa88f','#423142'],['#99d4cd','#203841'],['#ebcb83','#3a3541'],['#9fbfe7','#23314c'],['#e5abc7','#3d2f48']];
export function identityStyle(item){let hash=0;for(const letter of displayTitle(item))hash=(Math.imul(hash,31)+letter.charCodeAt(0))>>>0;const [accent,ink]=palettes[hash%palettes.length];return {'--identity-accent':accent,'--identity-ink':ink};}
export function channelTitle(item){
 return displayText(item.displayTitle??item.eventDisplayTitle??item.title);
}
export function CategoryArtwork({item,wide=false}){
 const category=artworkCategory(item);
 return <QualityImage className={`category-illustration ${wide?'wide-illustration':''}`} src={`${import.meta.env.BASE_URL}artwork/categories/${category.key}.png`} fit={wide?'contain':'cover'} eager fallback={false}/>;
}
// G5b: artwork=false skips the category PNG (627×941 decode): the TV veil over a loading poster is gradient + glyph only.
export function ContentIdentity({item,channel=false,wide=false,artwork=true}){
 const matchup=mlbMatchup(item);
 if(matchup)return <MatchupArtwork matchup={matchup} wide={wide}/>;
 const title=channel?channelTitle(item):displayTitle(item),words=title.replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean);
 const letters=words[0]?.length<=4?words[0]:words.slice(0,2).map(word=>word[0]).join('');
 const category=artworkCategory(item);
 return <div className={`content-identity ${channel?'channel-identity':'poster-identity'} ${wide?'wide-identity':''}`} style={identityStyle(item)}>
  <svg className="identity-shapes" viewBox="0 0 200 200" aria-hidden="true"><circle cx="177" cy="29" r="75"/><circle cx="11" cy="181" r="92"/><path d="M110 -30L230 100M90 -10L210 120"/></svg>
  {!channel&&<>{artwork&&<CategoryArtwork item={item} wide={wide}/>}<span className="identity-category">{category.label}</span></>}
  {(!channel||category.key!=='baseball')&&<span className="identity-glyph">{letters?.toLocaleUpperCase('es')||'TV'}</span>}
  {!channel&&!wide&&<span className="identity-title">{displayTitle(item)}</span>}
 </div>;
}

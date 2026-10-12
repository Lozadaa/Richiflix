// TV, films and series: the Netflix-style tile. The focused card shows a 16:9 picture as tall as its poster with the
// facts and synopsis under it, drawn inside its own cell from the first frame (ExpandedCard). Rails and grids make
// room in CSS (expandedCard.css): every cell knows its row and column (--r, --c) and the container the focused ones
// (--tile-r, --tile-c), so the cells after the tile slide right and the rows under it move down in the same style
// recalculation as the focus, with no measuring and no animation.
export const TV_TILE_INFO=150;
const NONE=1000000;
export function tileMetrics({posterHeight,width,gap=0,rowHeight=0,columns=0}){
 if(!(posterHeight>0)||!(width>0))return null;
 const tileWidth=Math.round(posterHeight*16/9),height=Math.round(posterHeight)+TV_TILE_INFO;
 // A grid keeps the tile inside its columns: a tile that would pass the right edge shifts its whole row left.
 const content=columns>0?columns*(width+gap)-gap:0;
 return {tileWidth:content?Math.min(tileWidth,content):tileWidth,extra:Math.max(0,tileWidth-width),height,below:Math.max(0,height+gap-rowHeight),content};
}
// Container style (React): sizes only. The focus vars are written by setTileFocus, outside React.
export const tileStyle=metrics=>metrics?{'--tile-w':`${metrics.tileWidth}px`,'--tile-extra':`${metrics.extra}px`,'--tile-h':`${metrics.height}px`,'--tile-below':`${metrics.below}px`}:undefined;
export const cellTileStyle=(row,column)=>({'--r':row,'--c':column});
export function setTileFocus(element,row,column,shift=0){
 if(!element)return;element.style.setProperty('--tile-r',String(row));element.style.setProperty('--tile-c',String(column));element.style.setProperty('--tile-shift',`${shift}px`);
}
export const clearTileFocus=element=>setTileFocus(element,NONE,NONE,0);
// Grid: how far the focused row moves left so a tile in the last columns still fits.
export const gridTileShift=(metrics,column,width,gap)=>metrics?.content?Math.max(0,column*(width+gap)+metrics.tileWidth-metrics.content):0;

// The DOM budget depends on the viewport, never on catalogue length.
export function rowWindow({count,columns,rowHeight,offset=0,viewport=0,overscan=2,focusedIndex=-1}){
 const totalRows=Math.ceil(count/columns),first=Math.max(0,Math.min(totalRows-1,Math.floor(Math.max(0,offset)/rowHeight)));
 const last=Math.min(totalRows,Math.max(first+1,Math.ceil((Math.max(0,offset)+viewport)/rowHeight)));
 const start=Math.max(0,first-overscan),end=Math.min(totalRows,last+overscan),indices=[];
 for(let index=start*columns;index<Math.min(count,end*columns);index++)indices.push(index);
 if(focusedIndex>=0&&focusedIndex<count&&!indices.includes(focusedIndex))indices.push(focusedIndex);
 return {start,end,indices,totalRows};
}
export function railWindow({count,itemWidth,gap=0,offset=0,viewport=0,overscan=3,focusedIndex=-1}){
 const stride=itemWidth+gap,start=Math.max(0,Math.floor(Math.max(0,offset)/stride)-overscan),end=Math.min(count,Math.ceil((Math.max(0,offset)+viewport)/stride)+overscan),indices=[];
 for(let index=start;index<end;index++)indices.push(index);
 if(focusedIndex>=0&&focusedIndex<count&&!indices.includes(focusedIndex))indices.push(focusedIndex);
 return {start,end,indices};
}
export function nextGridIndex(index,key,columns,count){
 if(index<0||index>=count)return null;
 const column=index%columns;
 if(key==='ArrowLeft')return column>0?index-1:null;
 if(key==='ArrowRight')return column<columns-1&&index+1<count?index+1:null;
 if(key==='ArrowUp')return index-columns>=0?index-columns:null;
 if(key==='ArrowDown')return index+columns<count?index+columns:Math.floor(index/columns)<Math.floor((count-1)/columns)?count-1:null;
 return null;
}
export function nextRailIndex(index,key,count){
 if(!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count||!['ArrowLeft','ArrowRight'].includes(key))return null;
 return (index+(key==='ArrowRight'?1:-1)+count)%count;
}
// A queued scroll window may commit after the next remote key. Keep the focus
// that exists at commit time, rather than recycling its just-focused button.
export function pinWindowFocus(indices,index,count){
 return Number.isInteger(index)&&index>=0&&index<count&&!indices.includes(index)?[...indices,index]:indices;
}
export const sameIndices=(previous,next)=>previous.length===next.length&&previous.every((index,position)=>index===next[position]);

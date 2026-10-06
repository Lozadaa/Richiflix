export function nearbyPreviewItems({items,index,key='ArrowRight',columns=1,kind='rail',count=2,loop=false}){
 const vertical=kind==='grid'&&['ArrowUp','ArrowDown'].includes(key),stride=vertical?columns:1,sign=['ArrowLeft','ArrowUp'].includes(key)?-1:1,result=[];
 if(!Number.isInteger(index)||index<0||index>=items.length)return result;
 for(let distance=1;distance<=count;distance++){
  let next=index+sign*stride*distance;if(loop&&kind==='rail')next=(next+items.length)%items.length;if(next<0||next>=items.length||next===index)break;
  if(kind==='grid'&&!vertical&&Math.floor(next/columns)!==Math.floor(index/columns))break;
  result.push(items[next]);
 }
 return result;
}

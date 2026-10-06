const boxes=new Map();let observer,density;
function resized(){if(density===window.devicePixelRatio)return;density=window.devicePixelRatio;for(const measure of boxes.values())measure();}
export function observeImageBox(box,measure){
 if(!observer){density=window.devicePixelRatio;observer=new ResizeObserver(entries=>{for(const entry of entries)boxes.get(entry.target)?.();});window.addEventListener('resize',resized);}
 boxes.set(box,measure);observer.observe(box);
 return()=>{boxes.delete(box);observer.unobserve(box);if(!boxes.size){observer.disconnect();observer=null;window.removeEventListener('resize',resized);}};
}

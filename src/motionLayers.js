// Layer hints are leases, never a permanent GPU texture for every poster.
// Renewing a lease retains the original inline value and invalidates its timer.
const leases=new WeakMap();
export function leaseTransformLayers(elements,{duration=600,schedule=setTimeout}={}){
 const token={},entries=[];
 for(const element of elements){
  const previous=leases.get(element),original=previous?.original??element.style.willChange;
  leases.set(element,{token,original});element.style.willChange='transform';entries.push(element);
 }
 const release=()=>{for(const element of entries){const lease=leases.get(element);if(lease?.token!==token)continue;element.style.willChange=lease.original;leases.delete(element);}};
 schedule(release,duration);return release;
}

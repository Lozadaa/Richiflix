import React,{useEffect,useRef} from 'react';
import './emptyState.css';

// Bloque B: every empty screen says what happened and offers one or two remote-reachable actions.
// The first action takes focus on mount in TV only when focus was lost (it never leaves the search box or a chip).
export function EmptyState({art='cinema',title,text,actions=[],tv,alert,children}){
 const root=useRef();
 useEffect(()=>{if(tv&&(!document.activeElement||document.activeElement===document.body))root.current?.querySelector('.empty-state-actions button')?.focus({preventScroll:true});},[]);
 return <section className="empty-state" ref={root} role={alert?'alert':undefined}>
  <div className="empty-state-main">
   <img className="empty-state-art" src={`${import.meta.env.BASE_URL}artwork/categories/${art}.png`} alt="" decoding="async"/>
   <div className="empty-state-copy"><h2>{title}</h2>{text&&<p>{text}</p>}{actions.length>0&&<div className="empty-state-actions">{actions.map(action=><button key={action.label} className={action.primary?'primary':'secondary'} onClick={action.onClick}>{action.label}</button>)}</div>}</div>
  </div>
  {children}
 </section>;
}

import React from 'react';
import {Plus,ChevronRight} from 'lucide-react';
import {Dialog} from './Dialog.jsx';
import {Player} from './Player.jsx';
function PageTitle({title,action}){return <div className="page-title"><h1>{title}</h1>{action}</div>;}
function Empty({icon:Icon,title,text,action,label}){return <div className="empty"><Icon size={42}/><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>{label} <Plus size={18}/></button></div>;}
function MLBBanner({onClick,official}){return <section className="baseball-banner"><div className="baseball-copy"><h2>MLB</h2><p>Nos vemos en el diamante.</p><button className="secondary" onClick={onClick}>{official?'Ver en MLB.com':'Explorar'} <ChevronRight size={20}/></button></div><svg className="baseball-graphic" viewBox="0 0 300 300" aria-hidden="true"><path className="field" d="M150 15 285 150 150 285 15 150Z"/><circle cx="150" cy="150" r="78" fill="#f5e6d2"/><path className="seam" d="M95 95q70 55 0 110M205 95q-70 55 0 110"/><path className="stitches" d="m102 107-15 8m28 7-15 7m24 9-15 4m17 13-15-1m10 17-15-4m7 19-14-7m99-82 15 8m-28 7 15 7m-24 9 15 4m-17 13 15-1m-10 17 15-4m-7 19 14-7"/></svg></section>;}

export {PageTitle,Empty,MLBBanner,Dialog,Player};

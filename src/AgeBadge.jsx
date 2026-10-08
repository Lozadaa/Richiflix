import React from 'react';
import {ageBadgeTone} from './ageBadgeStyle.js';
import './ageBadge.css';
function CertificateMark({tone}){
 return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 20 6v6c0 4.4-3.7 7.8-8 9.5C7.7 19.8 4 16.4 4 12V6l8-3.5Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>{tone==='mature'?<><rect x="8.5" y="10.5" width="7" height="6" rx="1.6" fill="currentColor"/><path d="M10 10.5V9a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.7"/></>:tone==='guidance'?<><path d="M12 7.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="15.5" r="1" fill="currentColor"/></>:tone==='neutral'?<><circle cx="12" cy="8" r="1" fill="currentColor"/><path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>:<path d="m8.5 12 2.4 2.4 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}</svg>;
}
export function AgeBadge({item}){
 const rating=item.ageClassification;
 if(item.kind==='iptv'||!rating?.label||!rating.country)return null;
 const tone=ageBadgeTone(rating);
 return <span className="age-badge" data-age-tone={tone} data-age-long={rating.label.length>3?'true':undefined} title={`Clasificación ${rating.country}: ${rating.label}`} aria-label={`Clasificación por edades: ${rating.label}, ${rating.country}`}><span className="age-badge-mark"><CertificateMark tone={tone}/></span><b>{rating.label}</b>{rating.country!=='CL'&&<small>{rating.country}</small>}</span>;
}

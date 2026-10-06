import React from 'react';
import './ageBadge.css';
export function AgeBadge({item}){
 const rating=item.ageClassification;
 if(item.kind==='iptv'||!rating?.label||!rating.country)return null;
 return <span className="age-badge" title={`Clasificación ${rating.country}: ${rating.label}`} aria-label={`Clasificación por edades: ${rating.label}, ${rating.country}`}><b>{rating.label}</b>{rating.country!=='CL'&&<small>{rating.country}</small>}</span>;
}

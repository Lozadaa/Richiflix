import React from 'react';

export function BrandMark({className=''}){
 return <img className={`kingdom-mark ${className}`} src={`${import.meta.env.BASE_URL}brand/kingdom.svg`} alt="" aria-hidden="true" draggable="false"/>;
}
export function BrandGlyph(){
 return <img className="kingdom-glyph" src={`${import.meta.env.BASE_URL}brand/kingdom-glyph.svg`} alt="" aria-hidden="true" draggable="false"/>;
}

export function Brand(){
 return <><BrandMark/><span>Kingdom</span></>;
}
// Loader de la marca: la corona salta (CSS, sólo transform/opacity), estado real debajo y una frase del reino.
export function KingdomLoader({phrase,label,className=''}){
 return <div className={`kingdom-loader ${className}`} role="status" aria-label={label||'Cargando'}>
  <div className="kingdom-loader-stage"><BrandGlyph/><i className="kingdom-loader-shadow" aria-hidden="true"/></div>
  {label&&<p className="kingdom-loader-label">{label}</p>}
  {phrase&&<small className="kingdom-loader-phrase" key={phrase}>{phrase}</small>}
 </div>;
}

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

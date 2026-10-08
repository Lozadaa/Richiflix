import React from 'react';

export function BrandMark({className=''}){
 return <img className={`richiflix-mark ${className}`} src={`${import.meta.env.BASE_URL}brand/richiflix.svg`} alt="" aria-hidden="true" draggable="false"/>;
}
export function BrandGlyph(){
 return <img className="richiflix-glyph" src={`${import.meta.env.BASE_URL}brand/richiflix-glyph.svg`} alt="" aria-hidden="true" draggable="false"/>;
}

export function Brand(){
 return <><BrandMark/><span>richiflix</span></>;
}

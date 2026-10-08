import React from 'react';
import {artworkCategory} from './categoryArtwork.js';

// Original vector marks match the palette and objects in our category artwork.
const marks={
 baseball:<><circle cx="16" cy="16" r="11" fill="var(--focus)" fillOpacity=".15"/><path d="M10 7q8 9 0 18M22 7q-8 9 0 18"/><path d="m10 10-3 1m6 3-3 1m3 3-3-1m0 5-3-1m15-11 3 1m-6 3 3 1m-3 3 3-1m0 5 3-1" stroke="var(--accent)"/></>,
 cinema:<><path d="M5 13h22v13H5z" fill="var(--accent)" fillOpacity=".15"/><path d="m5 13-1-6 21-4 1 6-21 4zm2-7 5 5m2-6 5 4m2-5 4 3"/><path d="m14 17 6 3-6 3z" fill="var(--focus)" stroke="none"/></>,
 series:<><rect x="7" y="10" width="21" height="16" rx="4" fill="var(--text-2)" fillOpacity=".18"/><path d="M22 6H8a4 4 0 0 0-4 4v12m9-7h9v6h-9m12-6h.01M25 20h.01"/></>,
 animation:<><circle cx="15" cy="17" r="8" fill="var(--text-2)" fillOpacity=".2"/><ellipse cx="15" cy="17" rx="14" ry="4" transform="rotate(-28 15 17)"/><path d="m25 3 .8 2.2L28 6l-2.2.8L25 9l-.8-2.2L22 6l2.2-.8z" fill="var(--focus)" stroke="none"/></>,
 horror:<><path d="M7 26V14a9 9 0 0 1 18 0v12l-4-3-5 3-5-3-4 3z" fill="var(--text-2)" fillOpacity=".18"/><path d="M12 14v3m8-3v3m-6 4q2 2 4 0"/></>,
 documentary:<><circle cx="16" cy="16" r="12" fill="#99d4cd" fillOpacity=".15"/><path d="M4 16h24M16 4q12 12 0 24M16 4q-12 12 0 24M7 8q9 6 18 0M7 24q9-6 18 0"/></>,
 action:<><path d="m18 3-12 15h9l-2 11 13-17h-9z" fill="var(--accent)" fillOpacity=".3"/><path d="M5 5 3 3m24 24 2 2" stroke="var(--focus)"/></>,
 live:<><rect x="4" y="9" width="24" height="18" rx="5" fill="#99d4cd" fillOpacity=".15"/><path d="m11 3 5 6 5-6"/><path d="m13 14 7 4-7 4z" fill="var(--accent)" stroke="none"/></>,
};
export function CategoryMark({item,className=''}){
 const key=artworkCategory(item).key;
 return <svg className={`category-mark ${className}`} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-category-mark={key}>{marks[key]}</svg>;
}

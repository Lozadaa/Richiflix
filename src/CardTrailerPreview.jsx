import React from 'react';
import {createPortal} from 'react-dom';
import {useCardTrailer} from './cardTrailerStore.js';
import {TrailerPreview} from './TrailerPreview.jsx';

// Keep the iframe in one DOM parent across card changes. Reparenting an iframe
// reloads its browsing context on TV browsers, so only its viewport moves.
export function CardTrailerPreview(){
 const owner=useCardTrailer(),position=owner?.position;
 return createPortal(<div className={`card-trailer-deck ${owner?.banner?'card-trailer-banner':''}`} style={position?{left:position.left,top:position.top,width:position.width,height:position.height,'--trailer-height':`${position.width*9/16}px`}: {display:'none'}} aria-hidden="true"><TrailerPreview id={owner?.id} active={Boolean(owner?.id)} card/></div>,document.body);
}

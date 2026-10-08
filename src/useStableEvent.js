import {useCallback,useRef} from 'react';
// Keep card handlers stable while reading the latest profile and playback state.
export function useStableEvent(handler){const ref=useRef(handler);ref.current=handler;return useCallback((...args)=>ref.current(...args),[]);}

// Presentation only: IDs, provider metadata, URLs and credentials stay intact.
// Digits and ordinary punctuation are not emoji unless part of a keycap.
const pictographs=/(?:[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u{E0020}-\u{E007F}])/gu;
export function displayText(value){
 return String(value??'').replace(pictographs,'').replace(/[ \t]{2,}/g,' ').trim();
}

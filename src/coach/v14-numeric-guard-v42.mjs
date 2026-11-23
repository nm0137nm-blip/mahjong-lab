// P2a-v4.2: explicit quantities must be anchored to public FactIDs.
// Unlike the frozen v4 detector, ordinary Japanese lexical items such as
// 一致, 一方, 一盃口 and 三色 do not count as quantitative claims.
// This is conservative, token-level contract screening, not a universal
// Japanese semantic parser. Arithmetic and false qualitative claims must
// still be judged independently.
export const V42_NUMERIC_GUARD_VERSION='p2a-v42-contextual-numeral-and-identity-guard-1';

const arabicOrFullwidth=/[0-9０-９]/u;
const kanjiNumerals=/[〇零一二三四五六七八九十百千万壱弐参拾佰仟萬]+/gu;
const domainUnit=/^(?:\s|　)*(?:点(?:差)?|枚|巡(?:目)?|着|位|本場|局|翻|符|倍|％|%|円|向聴|シャンテン|供託|本(?:分)?|回)/u;
const spelledTile=/^[一二三四五六七八九][萬筒索]/u;
const explicitCompoundAmount=/^(?:[〇零一二三四五六七八九壱弐参])?(?:十|百|千|万)[〇零一二三四五六七八九十百千万壱弐参拾佰仟萬]*/u;
// LLM-generated prose is not expected to contain raw tile labels either;
// plain Japanese yaku names like 一盃口 and 三色 are not raw tile labels.
export function findV42UnanchoredQuantity(text){
 if(typeof text!=='string')throw new TypeError('v41 numeric guard expects text');
 // A named model identifier is metadata, not a mahjong quantity.
 // Its claim is not independently authenticated and is never used for scoring.
 // Only a one-digit major model ID (and at most two version digits) can be
 // elided; arbitrary point-like numbers (GPT-3900点) remain forbidden.
 const visible=text.replace(/(?:GPT|gpt)-[1-9](?:\\.[0-9]{1,2})?(?![0-9])/gu,'');
 const digit=visible.match(arabicOrFullwidth);
 if(digit)return {type:'arabic_or_fullwidth_digit',match:digit[0],index:digit.index};
 for(const m of visible.matchAll(kanjiNumerals)){
  const tail=visible.slice(m.index+m[0].length);
  if(domainUnit.test(tail))return {type:'kanji_explicit_unit',match:m[0],index:m.index};
  if(spelledTile.test(m[0]+tail))return {type:'unanchored_kanji_tile',match:m[0],index:m.index};
  if(m[0].length>1&&explicitCompoundAmount.test(m[0])&&
     !/[萬]$/.test(m[0]))
   return {type:'unanchored_compound_kanji_amount',match:m[0],index:m.index};
 }
 return null;
}
export function containsV42UnanchoredQuantity(text){
 return findV42UnanchoredQuantity(text)!==null;
}

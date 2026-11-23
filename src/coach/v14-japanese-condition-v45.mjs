// P2a-v4.5 prospective grammar-only research. Does NOT amend v4.3/v4.4
// receipts or make any past failed GPT-6 answer count as PASS.
// Specific Japanese conditional choice inflections previously missed by
// a verb-dictionary-form-only heuristic. Not a semantic strategy judge.
import {hasV43ConditionalReversal} from './v14-japanese-condition-v43.mjs';
export const V45_CONDITION_VERSION='p2a-v45-japanese-choice-inflection-1';
const conditional=/(?:なければ|なれば|なら(?:ば)?|であれば|でなければ|(?:すれ|あれ|けれ)ば|れば|たら|とき(?:には|は)?|場合(?:には|は|に)?|際(?:には|は)?|限り|と仮定(?:すれば|したら)?|に応じて|につれて|次第で)/u;
const choiceShift=/(?:選びやす|選びにく|選びづら|選び直|選び替|選びた|選び方を変え|選び方が変わ)/u;
export function hasV45ConditionalReversal(text){
 if(typeof text!=='string'||text.length<12||text.length>1900)return false;
 // Preserve every v4.3 PASS; only add a narrow inflection family in v4.5.
 return hasV43ConditionalReversal(text)||
   (conditional.test(text)&&choiceShift.test(text));
}

// P2a-v4.3: Japanese conditional trigger recognition for a source-cited
// opponent-specific tactical reversal. A syntax gate, NOT a model of mahjong
// expertise. Numeric/public facts are still checked independently.
export const V43_CONDITION_VERSION='p2a-v43-japanese-conditional-trigger-1';
const ending=/(?:なければ|なれば|なら(?:ば)?|であれば|でなければ|(?:すれ|あれ|けれ)ば|れば|たら|とき(?:には|は)?|場合(?:には|は|に)?|際(?:には|は)?|限り|と仮定(?:すれば|したら)?|に応じて|につれて|次第で)/u;
// A guard against merely mentioning a conditional tense in an otherwise
// irrelevant sentence. Genuine tactical quality remains an independent L4 task.
const decision=/(?:見直|変え|変わ|逆転|撤退|押し|引き|降り|守備|攻撃|再考|比較|評価|優先|重視|検討|選択|採用|維持|避け|狙う|選ぶ|控え)/u;
export function hasV43ConditionalReversal(text){
 if(typeof text!=='string'||text.length<12||text.length>1900)return false;
 return ending.test(text)&&decision.test(text);
}

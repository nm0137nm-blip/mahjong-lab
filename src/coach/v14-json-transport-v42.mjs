// P2a-v4.2 narrowly scoped transport adaptation for manually pasted responses.
// Preserve raw bytes and disclose each transformation. Never change action
// choices, factual tokens, source hashes, values or tactical prose semantics.
// No broad typo repair, no extraction of an arbitrary JSON-like substring.
export const V42_JSON_TRANSPORT_VERSION='p2a-v42-manual-copy-format-only-1';

export function parseV42ManualJSON(raw){
 if(typeof raw!=='string'||raw.length>100000)
  throw Error('v42-transport: raw response must be bounded string');
 try{return {value:JSON.parse(raw),methods:[],rawPreserved:raw,parseMode:'strict_json'};}
 catch(firstError){
  let candidate=raw,methods=[];
  const fenced=candidate.match(/^\s*\x60{3}(?:json|JSON)?\s*\n([\s\S]*?)\n\x60{3}\s*$/u);
  if(fenced){candidate=fenced[1];methods.push('complete_json_code_fence_removed');}
  if(/[“”]/u.test(candidate)){
   candidate=candidate.replace(/[“”]/gu,'"');
   methods.push('curly_quotes_to_ascii_json_quotation_marks');
  }
  // Some mobile clipboard / Markdown rendering pipelines escape raw square
  // brackets in source fact anchors into \[\[factId\]\]. Applied only after
  // strict JSON.parse failed. Unknown escapes still fail.
  if(/\\[\[\]]/u.test(candidate)){
   candidate=candidate.replace(/\\([\[\]])/gu,'$1');
   methods.push('escaped_fact_bracket_transport_only');
  }
  if(!methods.length)throw Error('v42-transport: invalid unmodified JSON: '+String(firstError));
  try{
   const value=JSON.parse(candidate);
   if(!value||Array.isArray(value)||typeof value!=='object')
    throw Error('not an object');
   return {value,methods,rawPreserved:raw,parseMode:'logged_copy_only_normalization'};
  }catch(error){
   throw Error('v42-transport: JSON still invalid after limited documented copy-only normalization: '+String(error));
  }
 }
}

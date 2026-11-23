// P2a-v4.5 prospective, public-source-only, before any v45 GPT6 answer.
// Exclude ALL 13 previously GPT-exposed v3-v43 scenes and ENTIRE v44 frozen
// eight (even three never answered). Do not inspect S42 Q values or any answers.
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=s=>{throw Error('v45-selection: '+s);};
export const V45_SALT='p2a-v45-new-eight-source-only-20261124|';
export const V45_EXCLUDED=Object.freeze([
 'pilot-48','pilot-42','pilot-50','pilot-52','pilot-47','pilot-59',
 'pilot-43','pilot-49','pilot-57','pilot-62','pilot-63','pilot-71','pilot-70',
 'pilot-46','pilot-51','pilot-56','pilot-64','pilot-53','pilot-69','pilot-65','pilot-74'
]);
export const V45_EIGHT=Object.freeze([
 'pilot-41','pilot-45','pilot-54','pilot-55','pilot-60',
 'pilot-66','pilot-73','pilot-76'
]);
export const V45_SOURCE_SHA='271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a';
const number=id=>Number(id.replace('pilot-',''));
const publicBoard=x=>x.request.input.evidence.find(y=>y.id==='board')?.value;
const order=xs=>xs.slice().sort((a,b)=>
 hash(V45_SALT+a.id).localeCompare(hash(V45_SALT+b.id)));
export function selectV45ProspectiveSmoke(original){
 if(!Array.isArray(original)||original.length!==36||
    hash(JSON.stringify(original))!==V45_SOURCE_SHA)
  fail('original immutable 36 cases differ');
 const ids=original.map(x=>x?.request?.input?.id);
 if(new Set(ids).size!==36)fail('duplicate source cases');
 const exclude=new Set(V45_EXCLUDED);
 if(exclude.size!==21)fail('wrong prior exposure count');
 const rest=original.filter(x=>!exclude.has(x.request.input.id))
  .map(source=>({source,id:source.request.input.id,board:publicBoard(source)}));
 if(rest.length!==15||rest.some(x=>!x.board))fail('wrong unexposed source pool');
 const reach=order(rest.filter(x=>number(x.id)>=41&&number(x.id)<=52));
 const calls=order(rest.filter(x=>number(x.id)>=53&&number(x.id)<=64));
 const discard=order(rest.filter(x=>number(x.id)>=65&&number(x.id)<=76));
 if(reach.length!==3||calls.length!==5||discard.length!==7)
  fail('source strata changed');
 // All decisions are public-only; honba/kyotaku + salted SHA rankings.
 // Require broad reach/call/discard cases and both honba/kyotaku contrast.
 const r=[...reach.filter(x=>x.board.kyotaku>0).slice(0,1),
          ...reach.filter(x=>x.board.kyotaku===0).slice(0,1)];
 const c=[...calls.filter(x=>x.board.honba>0).slice(0,2),
          ...calls.filter(x=>x.board.honba===0).slice(0,1)];
 const d=[...discard.filter(x=>x.board.kyotaku>0).slice(0,2),
          ...discard.filter(x=>x.board.kyotaku===0).slice(0,1)];
 const selected=[...r,...c,...d];
 if(selected.length!==8||new Set(selected.map(x=>x.id)).size!==8||
    JSON.stringify(selected.map(x=>x.id))!==JSON.stringify(V45_EIGHT)||
    selected.some(x=>exclude.has(x.id)))fail('source-only selection drift');
 if(r.some(x=>!x.source.request.input.actions.some(a=>a.group===37))||
    c.some(x=>!x.source.request.input.actions.some(a=>[39,40,41].includes(a.group)))||
    d.some(x=>!x.source.request.input.actions.some(a=>a.group<=36)))
  fail('selected category not supported by action mask');
 return {version:'p2a-v45-8-unseen-source-only-prospective-1',
  originalSourceSHA256:V45_SOURCE_SHA,selectionSalt:V45_SALT,
  excludedPreviouslyFrozenOrGPTAnswered:V45_EXCLUDED,
  candidateUnusedPool:rest.map(x=>x.id).sort(),
  selectedIds:selected.map(x=>x.id),
  categoryCounts:{reach:2,call:3,discard:3},
  selectedPublicOnly:selected.map(x=>({
    caseId:x.id,sourceRequestHash:x.source.requestHash,
    honba:x.board.honba,kyotaku:x.board.kyotaku,remaining:x.board.remaining
  })),
  preAnswer:true,sourceOnly:true,noMortalLabels:true,
  method:'public source SHA, category, honba and kyotaku strata; SHA salt within strata; 21 prior-exposed/frozen scenes excluded',
  gpt6ResponsesOnTheseEightAtFreeze:0
 };
}

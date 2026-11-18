// Development-only conditional evidence bank; no model weights or individual reference cases.
export const EVIDENCE_VERSION='S42-conditional-20261118-pilot1';
const BANK=[
 {id:'UKEIRE',condition:'他家立直なし・最小同向聴・保持ドラ同数・受け入れ差5枚以上',train:[3398,80,86.55],validation:[925,20,84.65,12.86,2.49,81.49,87.56],compare:(a,b,m,t)=>t===0&&a.sh===m&&b.sh===m&&a.d===b.d&&a.u-b.u>=5,lesson:'受け入れの差を確認。ただし有効牌の質・打点経路・他家の副露を別に評価。'},
 {id:'DORA_TIE',condition:'他家立直なし・最小同向聴・受け入れ差2枚以内・保持ドラ1翻差',train:[1761,80,78.53],validation:[583,20,78.04,17.15,4.80,73.26,82.87],compare:(a,b,m,t)=>t===0&&a.sh===m&&b.sh===m&&Math.abs(a.u-b.u)<=2&&a.d-b.d===1,lesson:'受け入れが僅差なら保持ドラの価値を比較。役が成立する経路と和了時の点数を確認。'},
 {id:'CONNECTED',condition:'他家立直なし・最小同向聴・受け入れ差2枚以内・保持ドラ同数・孤立数牌と2枚以上の近接牌を持つ単独数牌の比較',train:[901,79,86.13],validation:[323,20,83.28,13.00,3.72,77.88,88.58],compare:(a,b,m,t)=>t===0&&a.sh===m&&b.sh===m&&Math.abs(a.u-b.u)<=2&&a.d===b.d&&a.suited&&b.suited&&a.count===1&&b.count===1&&a.near===0&&b.near>=2,lesson:'孤立数牌の整理と近接形の維持を比較。実際にできる順子・複合ターツ・二次変化は牌姿から示す。近接牌は同色±2の手牌枚数で、相手の無筋ではない。'},
 {id:'SAFE_TIE',condition:'他家立直1人・最小同向聴・受け入れ差2枚以内・保持ドラ同数・当該立直者の現物と非現物',train:[621,76,91.95],validation:[162,19,93.83,3.70,2.47,89.66,97.30],compare:(a,b,m,t)=>t===1&&a.sh===m&&b.sh===m&&Math.abs(a.u-b.u)<=2&&a.d===b.d&&a.safe===1&&b.safe===0,lesson:'速度・保持ドラがほぼ同じ場合は当該立直者の現物を比較。他の相手に対する安全、打点・待ちを別途考慮。非現物は危険確定ではない。'},
 {id:'SHANTEN',condition:'他家立直なし・保持ドラ同数・最小向聴と1向聴戻し',train:[5591,80,88.39],validation:[1716,20,89.10,9.15,1.75,87.78,90.54],compare:(a,b,m,t)=>t===0&&a.sh===m&&b.sh===m+1&&a.d===b.d,lesson:'向聴を進める利点と、向聴戻しで得られる形・役・打点を比較。向聴数だけで決めない。'}
];
const norm=p=>p[0]+(p[1]==='0'?'5':p[1]);
const valid=p=>typeof p==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(p);
const action=p=>{if(!valid(p))return null;const n=Number(p[1]);return p[0]==='z'?26+n:n===0?34+'mps'.indexOf(p[0]):'mps'.indexOf(p[0])*9+n-1;};
const tile=a=>a<27?'mps'[Math.floor(a/9)]+(a%9+1):a<34?'z'+(a-26):'mps'[a-34]+'0';
export function comparePublicCandidates(scene,facts,ids,a,b){
 if(!scene||scene.snapshotVersion!==2||!Array.isArray(scene.hand)||!scene.hand.every(valid)||!Array.isArray(scene.rivers)||scene.rivers.length!==4||!Number.isInteger(scene.ownSeat)||scene.ownSeat<0||scene.ownSeat>3||!Array.isArray(facts?.候補別牌姿)||!Array.isArray(ids)||ids.some(i=>!Number.isInteger(i)||i<0||i>36)||new Set(ids).size!==ids.length||a===b||!ids.includes(a)||!ids.includes(b))return [];
 const threats=scene.rivers.map((r,i)=>r.riichi&&i!==scene.ownSeat?i:null).filter(i=>i!==null),counts={};
 for(const p of scene.hand)counts[norm(p)]=(counts[norm(p)]||0)+1;
 const lookup=new Map();
 // Duplicate tsumogiri/tedashi of the exact same tile is identical for these features.
 for(const x of facts.候補別牌姿){const t=x.打牌?.slice(0,2),id=action(t);if(id===null)continue;const safe=threats.filter(i=>x.相手別現物?.some(y=>y.席===i&&y.現物===true)).length;
  if(![x.向聴,x.受け入れ,x.保持ドラ翻].every(Number.isFinite)||!Array.isArray(x.相手別現物)||threats.some(i=>!x.相手別現物.some(y=>y.席===i&&typeof y.現物==='boolean')))continue;
  const nt=norm(t),n=Number(nt[1]),suited=nt[0]!=='z';let near=0;if(suited)for(let k=Math.max(1,n-2);k<=Math.min(9,n+2);k++)if(k!==n)near+=counts[nt[0]+k]||0;
  const row={tile:t,sh:x.向聴,u:x.受け入れ,d:x.保持ドラ翻,safe,suited,count:counts[nt]||0,near};
  if(lookup.has(id)&&JSON.stringify(lookup.get(id))!==JSON.stringify(row))return [];
  lookup.set(id,row);
 }
 if(!ids.every(i=>lookup.has(i)))return [];
 const m=Math.min(...ids.map(i=>lookup.get(i).sh)),A=lookup.get(a),B=lookup.get(b),out=[];
 for(const rule of BANK){
  const ab=rule.compare(A,B,m,threats.length),ba=rule.compare(B,A,m,threats.length);if(ab===ba)continue;
  const [nt,mt,pt]=rule.train,[nv,mv,pv,reverse,tie,lo,hi]=rule.validation;
  out.push({ID:rule.id,適用条件:rule.condition,経験則が支持する候補:ab?tile(a):tile(b),比較候補:ab?tile(b):tile(a),この局面の比較:{候補A:A,候補B:B,立直者席:threats,最小向聴:m},
   学習標本:{判断局面:nt,半荘:mt,支持割合_pct:pt},別対局照合:{判断局面:nv,半荘:mv,支持割合_pct:pv,逆方向_pct:reverse,僅差_pct:tie,支持割合95pct区間:[lo,hi]},解説で確認:rule.lesson});
 }
 return out;
}
export function selectTacticalEvidence(entry,facts){
 const op=entry?.mortalOpinion,choices=entry?.legalChoices;
 if(entry?.type!=='discard'||choices?.phase!=='turn'||choices.riichiDiscards?.length||choices.kan?.length||choices.tsumo||choices.nine||op?.source!=='Mortal-S42'||!Number.isInteger(op.id)||op.id!==entry.mortalDecision||!Array.isArray(op?.qLegal)||op.qLegal.length!==46||!Number.isInteger(op.best)||!Array.isArray(choices.discards))return [];
 const ids=op.qLegal.flatMap((q,i)=>Number.isFinite(q)?[i]:[]), legal=[...new Set(choices.discards.map(t=>action(t?.slice(0,2))))].sort((a,b)=>a-b);
 if(ids.length<2||ids.some(i=>i>36)||JSON.stringify(ids)!==JSON.stringify(legal)||!ids.includes(op.best)||op.qLegal[op.best]!==Math.max(...ids.map(i=>op.qLegal[i])))return [];
 const user=action(entry.discard?.slice(0,2));
 if(!ids.includes(user))return [];
 const alternative=user!==op.best?user:ids.filter(i=>i!==op.best).sort((a,b)=>op.qLegal[b]-op.qLegal[a]||a-b)[0];
 return comparePublicCandidates(entry.scene,facts,ids,op.best,alternative);
}
export const EVIDENCE_NOTE='自前生成のS42評価データで、学習80半荘中の打牌局面と別の調整20半荘を比較した試験的な経験則。各条件に該当する1対の合法打牌を局面ID由来ハッシュでQを見ずに抽出。支持はQ差が同一局面の合法Q幅の2%を超える場合、逆方向は-2%未満、残りは僅差。区間は半荘単位のブートストラップによる探索的95%区間（多重比較未調整）。この局面の支持確率・勝率・放銃率・S42内部の因果理由ではない。現在の候補を特定のQ順位で選んだので標本と選択方法が異なる。局面事実・役・打点・押し引き・着順および例外を別に評価し、矛盾する場合は経験則を棄却する。最終試験・実戦解説の改善は未確認。';

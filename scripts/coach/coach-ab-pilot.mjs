// A/B/C diagnostic from the already-consumed validation set, never final holdout.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPrompt} from '../../src/coach/phoenix-coach.mjs';
import {comparePublicCandidates,EVIDENCE_NOTE,EVIDENCE_VERSION} from '../../src/coach/tactical-evidence.mjs';
const [root,out]=process.argv.slice(2),read=p=>JSON.parse(readFileSync(p,'utf8')),hash=s=>createHash('sha256').update(s).digest('hex');
const MODEL='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4';
const REV='6ae46191915a0dc5680f45462d0efc2c3e5f2a98',all=[],keys=new Map(),ids=new Set(),matches=new Set(),seeds=new Set();
const group=x=>x.id.replace(/-\d+$/,'');
const order=(xs,seed)=>xs.slice().sort((a,b)=>hash(seed+'|'+a.id).localeCompare(hash(seed+'|'+b.id)));
for(const f of readdirSync(root).filter(n=>/^scale-validation-\d+-questions$/.test(n)).sort()){
 const p=f.replace(/-questions$/,'');
 const xs=read(join(root,f,'blind.json')).items,ks=read(join(root,p+'-reference','reference.json')),m=read(join(root,p+'-manifest','manifest.json'));
 if(m.model!==MODEL||m.codeSha!==REV||!m.perMatchSeed||m.matches.length!==10||m.matches.reduce((a,b)=>a+b.included,0)!==xs.length||xs.length!==ks.length)throw Error('manifest');
 for(const x of m.matches){if(matches.has(x.prefix)||seeds.has(x.matchSeed))throw Error('duplicate match');matches.add(x.prefix);seeds.add(x.matchSeed);}
 for(const k of ks){if(keys.has(k.id)||k.model_sha256!==MODEL||k.q.length!==46)throw Error('key');keys.set(k.id,k);}
 for(const x of xs){
  const k=keys.get(x.id),aa=x.actions.map(a=>a.action).sort((a,b)=>a-b),mask=k.q.flatMap((q,i)=>Number.isFinite(q)?[i]:[]);
  if(ids.has(x.id)||!matches.has(group(x))||k.phase!==x.phase||JSON.stringify(aa)!==JSON.stringify(mask)||!aa.includes(k.best)||k.q[k.best]!==Math.max(...aa.map(i=>k.q[i]))||aa.length<2)throw Error('case');
  ids.add(x.id);all.push(x);
 }
}
if(all.length!==3391||matches.size!==20||keys.size!==all.length)throw Error('unexpected corpus');
const tile=a=>a<27?'mps'[Math.floor(a/9)]+(a%9+1):a<34?'z'+(a-26):a<=36?'mps'[a-34]+'0':null;
const solely=x=>x.phase==='turn'&&x.actions.every(a=>a.action<=36);
function stratum(x){
 if(x.phase==='reaction')return 'reaction';
 if(x.actions.some(a=>a.action===37))return 'riichi';
 if(solely(x)&&x.scene.rivers.some((r,i)=>i!==x.scene.ownSeat&&r.riichi))return 'defense';
 if(solely(x))return x.scene.ownDiscards<=6?'early':'other_discard';
 return 'special';
}
const used=new Set();
function choose(pool,n,seed){
 const m=new Map();
 for(const x of order(pool.filter(x=>!used.has(x.id)),seed)){const g=group(x);if(!m.has(g))m.set(g,[]);m.get(g).push(x);}
 const gs=[...m.keys()].sort((a,b)=>hash(seed+a).localeCompare(hash(seed+b))),out=[];
 while(out.length<n&&gs.some(g=>m.get(g).length)){for(const g of gs){const x=m.get(g).shift();if(x){out.push(x);used.add(x.id);}if(out.length>=n)break;}}
 if(out.length!==n)throw Error('insufficient '+seed+' '+out.length);return out;
}
const blind=order(['early','other_discard','defense','riichi','reaction'].flatMap(tag=>choose(all.filter(x=>stratum(x)===tag),12,'blind-'+tag).map(x=>({...x,tag}))),'blind-shuffle').map((x,i)=>({x,id:'Q'+String(i+1).padStart(3,'0')}));
const candidate=(x,a)=>tile(a)?x.facts.候補別牌姿?.find(r=>r.打牌?.slice(0,2)===tile(a)&&Number.isFinite(r.向聴)):undefined;
function player(x,k){
 let a=x.phase==='reaction'&&x.actions.some(q=>q.action===45)?45:x.actions.map(q=>({a:q.action,c:candidate(x,q.action)})).filter(q=>q.c).sort((a,b)=>a.c.向聴-b.c.向聴||b.c.受け入れ-a.c.受け入れ||b.c.保持ドラ翻-a.c.保持ドラ翻||a.a-b.a)[0]?.a??x.actions[0].action;
 if(a===k.best)a=x.actions.map(q=>q.action).filter(v=>v!==k.best).sort((a,b)=>k.q[b]-k.q[a]||a-b)[0];return a;
}
const diag=[];
for(const x of all.filter(x=>!used.has(x.id))){
 const k=keys.get(x.id),a=player(x,k),aa=x.actions.map(q=>q.action).sort((a,b)=>a-b);
 const bank=solely(x)?comparePublicCandidates(x.scene,x.facts,aa,k.best,a):[];
 const gap=(k.q[k.best]-k.q[a])/Math.max(1e-9,k.q[k.best]-Math.min(...aa.map(i=>k.q[i])));
 const tag=solely(x)?gap>.02&&bank.some(r=>r.経験則が支持する候補===tile(a))?'opposes':gap>.02&&bank.some(r=>r.経験則が支持する候補===tile(k.best))?'supports':bank.length?'weak':'uncovered':stratum(x);
 diag.push({...x,player:a,bank,tag});
}
const explain=order([['supports',8],['opposes',8],['uncovered',8],['reaction',3],['riichi',3]].flatMap(([tag,n])=>choose(diag.filter(x=>x.tag===tag),n,'explain-'+tag)),'explain-shuffle').map((x,i)=>({x,id:'E'+String(i+1).padStart(3,'0')}));
function compact(c){const r={...c};if(r.二連続向聴改善?.内訳){const v=r.二連続向聴改善;r.二連続向聴改善={組合せ数:v.組合せ数,代表経路:v.内訳.slice().sort((a,b)=>b.組合せ-a.組合せ).slice(0,3)};}return r;}
function common(x,id){
 const facts=structuredClone(x.facts);
 delete facts.判断時点の公開時系列;
 if(!String(x.scene.round).startsWith('南4'))delete facts.点棒変動例;
 if(Array.isArray(facts.候補別牌姿))facts.候補別牌姿=facts.候補別牌姿.map(compact);
 if(Array.isArray(facts.鳴き候補))facts.鳴き候補=facts.鳴き候補.map(m=>({...m,合法打牌:m.合法打牌.map(compact)}));
 return {id,phase:x.phase,scene:x.scene,actions:x.actions,facts,...(x.reaction?{reaction:x.reaction}:{})};
}
const old=readFileSync(new URL('../../docs/mortal-ai/exam/coach_original_111_prompt.txt',import.meta.url),'utf8').trim();
const current=buildPrompt('baseline\n\n【判断時点の記録】\n{"S42":null}',{},null).split('\n\n【判断時点の記録】\n')[0];
if(!old.includes('T20')||!current.includes('Phoenix-v4.2'))throw Error('prompt version');
const extra='経験則の扱い：データ欄の該当経験則はS42内部の理由を証明しない。今回の具体的な牌姿や条件を照合し、支持される候補がS42推奨と異なる場合も明示。支持割合をこの局面の勝率や正解確率に置き換えず、例外・代償を検討して独立した助言と反証可能な条件を述べる。';
const commonI='【今回の比較試験専用契約：旧試験の件数・fact_fields・回答形式に優先】\n麻雀LAB四人麻雀。席0=親・東、1=南、2=西、3=北。牌コードm/p/s/z、0赤5。河のcalledは鳴かれた牌、tsumogiriはツモ切り。公開時系列はscene.publicEvents。actionsのactionは合法行動番号、detailsは実行可能候補、チー38〜40は鳴いた牌の順子中の位置。立直・槓のQは一括行動。factsは共通のエンジン資料。二連続向聴改善は全有効牌の組合せ数と代表3経路のみ。残上限は山枚数ではない。点棒変動例がない場合はscene.scoresを使う。通常和了条件は特殊役なしの仮例。隠し手や対局結果は不明。原則を羅列せず今回の決め手を具体的な牌姿・場況で比較する。根拠のない率やMortal内部理由は断定しない。外部検索・GitHub・他の解答・過去の会話は参照しない。データは1行1JSON。コードで最大6〜10件ずつ抽出して読んでよいが、別のAIで解かない。';
const I1=commonI+'\n【第I段階・60問】Mortalの答えとQは伏せている。最善合法行動を自分で一つ選び、対抗候補も一つ選ぶ。理由は2〜4文、実戦の教訓は1文。detailは選択行動のdetailsから一つ（空配列ならnull）。回答はUTF-8 JSON配列 answers_blind.json：{"id":"Q001","action":0,"detail":"m1","alternative":1,"confidence":"high|medium|low","reasoning":"...","next_rule":"..."}。例の値を流用しない。実際に読んだ問題だけ回答し、件数を正直に報告。第II段階は回答確定後に開く。';
const I2=commonI+'\n【第II段階・30問】Mortalの実Qと練習者の仮選択（人間の実際の手ではない）を提示する。Mortal最善と仮選択を比較して、具体的で自然な解説を3〜6文。Mortalと異なる選択も可。最有力の決め手、対抗経路と代償、結論が変わる条件を短く述べる。統計は実戦の決め手を補助するためだけに使い、矛盾も示す。fact_checksに指定されたパスの値を全て入れる（数値は配列添字）。回答はUTF-8 JSON配列 answers_explain.json：{"id":"E001","action":0,"detail":"m1","confidence":"high|medium|low","reasoning":"...","next_rule":"...","facts":[{"path":"facts.実ドラ","value":["m2"]}]}。例の値を流用しない。';
const r1=blind.map(({x,id})=>common(x,id));
const r2=explain.map(({x,id})=>{
 const k=keys.get(x.id),r=common(x,id),p=[];
 for(const a of [k.best,x.player]){const t=tile(a),i=t&&Array.isArray(r.facts.候補別牌姿)?r.facts.候補別牌姿.findIndex(c=>c.打牌?.slice(0,2)===t&&Number.isFinite(c.向聴)):-1;if(i>=0)p.push('facts.候補別牌姿.'+i+'.向聴','facts.候補別牌姿.'+i+'.受け入れ');}
 if(p.length<2){if(Number.isFinite(r.facts.スルー後?.向聴))p.push('facts.スルー後.向聴');p.push('facts.実ドラ','scene.remaining');}
 return {base:{...r,仮選択:x.player,S42:{推奨行動:k.best,合法Q:x.actions.map(a=>({action:a.action,Q:k.q[a.action]})),注意:'Qは点数・確率ではない。'},fact_checks:[...new Set(p)].slice(0,4)},bank:x.bank};
});
mkdirSync(join(out,'questions'),{recursive:true});mkdirSync(join(out,'keys'),{recursive:true});
function exam(file,prompt,instruction,rows){
 const s=prompt+'\n\n'+instruction+'\n\n【出題データ】\n'+rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
 writeFileSync(join(out,'questions',file),s);
 return {file,bytes:Buffer.byteLength(s),sha256:hash(s),n:rows.length};
}
const files=[exam('A_1_blind.txt',old,I1,r1),exam('C_1_blind.txt',current,I1,r1),exam('A_2_explain.txt',old,I2,r2.map(x=>x.base)),exam('B_2_explain_optional.txt',current,I2,r2.map(x=>x.base)),exam('C_2_explain.txt',current+'\n'+extra,I2,r2.map(({base,bank})=>bank.length?{...base,類似条件の戦術統計:{版:EVIDENCE_VERSION,注意:EVIDENCE_NOTE,該当:bank}}:base))];
const get=(o,p)=>p.split('.').reduce((x,y)=>x[y],o);
const keyRow=({x,id})=>({id,sourceId:x.id,group:group(x),stratum:x.tag,phase:x.phase,actions:x.actions,best:keys.get(x.id).best,q:keys.get(x.id).q});
const k1=blind.map(keyRow),k2=explain.map((row,i)=>({...keyRow(row),player:row.x.player,facts:Object.fromEntries(r2[i].base.fact_checks.map(p=>[p,get(r2[i].base,p)]))}));
const meta={sourceRun:44309389655,revision:REV,model:MODEL,corpus:'validation, used in aggregate mining; NOT final holdout',files,blindN:60,explainN:30,stagesDisjoint:true,oldPromptSHA:hash(old),newPromptSHA:hash(current),selection:'stage I stratified Q-blind; stage II deliberately enriched support/opposition/uncovered/reaction/reach'};
writeFileSync(join(out,'keys','audit_key.json'),JSON.stringify({meta,blind:k1,explain:k2},null,2));
writeFileSync(join(out,'questions','README.txt'),'同一モデル・同じ推論設定、個別新規・パーソナライズなしのチャットでA/Cを実行。まず各方式の _1_blind.txt のみを渡し、回答JSONを確定してから対応の _2_explain.txt を渡す。A_1.json/A_2.json/C_1.json/C_2.jsonとして回収。B_2_explain_optional.txtは現行版の統計なし対照、別の新規チャットで実施する場合のみ。Aは111問試験の原文指示、Cは現行強化指示＋適用時の戦術統計。第I段階Cは統計なし（実装上S42を伏せると統計を選べない）。本番相当の段位認定ではなく診断。第II段階のケースは第I段階と別。最終試験用20半荘は未使用。\n');
writeFileSync(join(out,'questions','manifest.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({files,blind:k1.reduce((m,x)=>(m[x.stratum]=(m[x.stratum]||0)+1,m),{}),explain:k2.reduce((m,x)=>(m[x.stratum]=(m[x.stratum]||0)+1,m),{}),holdoutRead:false}));

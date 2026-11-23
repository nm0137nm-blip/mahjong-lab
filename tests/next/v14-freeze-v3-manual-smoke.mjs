// Stable public-input-only ChatGPT manual smoke pack. NO MODEL CALLS.
// Registered before responses in project-handoff
// handoff/p2a-v3-chatgpt-36-blind-scoring-prereg-20261123.md
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {renderV3PublicScene} from '../../src/coach/v14-human-public-preview-v3.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const h=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('v3-manual-freeze: '+s);};
export const MANUAL_PACK_VERSION='p2a-v3-chatgpt-8x3-manual-smoke-2';
const selected={
 reach:['pilot-48','pilot-52','pilot-49'],
 reaction:['pilot-54','pilot-60','pilot-63'],
 discard:['pilot-66','pilot-69']
};
const selectedIds=Object.values(selected).flat();
const scoreKey=id=>h('p2a-v3-smoke-20261123|'+id);
export function buildV3ManualSmokePack(frozen){
 if(!Array.isArray(frozen)||frozen.length!==36)fail('expected exact new36 frozen public-only inputs');
 const ids=frozen.map(x=>x.request?.input?.id);
 if(new Set(ids).size!==36||ids.some((x,i)=>x!=='pilot-'+String(41+i).padStart(2,'0')))
  fail('new36 frozen IDs/order differ');
 for(const [idx,cat] of ['reach','reaction','discard'].entries()){
  const list=frozen.slice(idx*12,idx*12+12);
  for(const e of list){
   if(e.request.stage!=='independent'||sha(e.request)!==e.requestHash)
    fail('public source hash or stage mismatch');
   const groups=new Set(e.request.input.actions.map(a=>a.group));
   if(cat==='reach'&&!groups.has(37)||cat==='reaction'&&!groups.has(45)||
      cat==='discard'&&([...groups].some(g=>g>=37)||groups.size<2))
    fail('wrong preregistered category');
  }
  const sorted=list.map(e=>e.request.input.id).sort((a,b)=>scoreKey(a).localeCompare(scoreKey(b)));
  const expected=cat==='reaction'?[...sorted.filter(id=>id!=='pilot-63').slice(0,2),'pilot-63']:
    sorted.slice(0,cat==='reach'?3:2);
  if(sha(expected)!==sha(selected[cat]))fail('frozen deterministic sample ID mismatch, do not change after seeing answers');
 }
 const output=[];
 for(const id of selectedIds){
  const e=frozen.find(x=>x.request.input.id===id),p=createV3IndependentDevelopmentRequest(e);
  const keys=new Set(p.request.input.evidence.map(x=>x.id));
  if(keys.has('modelReference')||keys.has('mortalQ')||keys.has('verifierLineage'))fail('forbidden verifier-only data');
  output.push({caseId:id,sourcePublicHash:e.requestHash,
   sourcePayloadHash:p.request.sourcePublicInputHash,
   packetHash:p.requestHash,packet:p});
 }
 const sessions=[];
 for(let repetition=1;repetition<=3;repetition++){
  for(const item of output){
   sessions.push({caseId:item.caseId,repetition,
    sessionKey:item.caseId+'--independent-'+repetition,
    packetHash:item.packetHash,
    inputFile:'questions/'+item.caseId+'.json',
    userResponseFile:'answers/'+item.caseId+'--independent-'+repetition+'.json',
    status:'NOT_RUN',modelId:null,modelVersion:null,startedAt:null,endedAt:null,
    sourceAssertion:'user_reported_not_provider_authenticated'});
  }
 }
 return {manifest:{
  version:MANUAL_PACK_VERSION,phase:'P2a-v3-development-only',source:'frozen new36 public requests',
  sourceBundleHash:sha(frozen),selectionAlgorithm:'SHA256("p2a-v3-smoke-20261123|"+caseId) with fixed ron pilot-63',
  selected:structuredClone(selected),selectedIds:structuredClone(selectedIds),
  responsePackets:output.map(({caseId,sourcePublicHash,sourcePayloadHash,packetHash})=>
   ({caseId,sourcePublicHash,sourcePayloadHash,packetHash})),
  independentSessionsScheduled:24,sessionsPerCase:3,
  genuineChatGPTCalls:0,actualResponses:0,paidCalls:0,
  instructions:'Each session is a new independent temporary ChatGPT chat; never paste prior responses or teacher Q; record only actually seen model/version, never invent parameters or provider authentication; model answers are NOT included.',
  limitations:['No tactical correctness is inferred','This is ChatGPT, not Gemini','The request input is public-only, no future or private other-player hands',
   'The eight selected cases were frozen before actual model responses']},
  questions:output,sessions};
}
export function validateV3ManualSmokePack(frozen,got){
 const expected=buildV3ManualSmokePack(frozen);
 if(sha(expected)!==sha(got))fail('package mutated or not from frozen source');
 return {publicCases:8,independentSessions:24,realModelCalls:0,ability:'not_measured'};
}
export function writeV3ManualSmokePack(frozen,out){
 const pack=buildV3ManualSmokePack(frozen);
 fs.mkdirSync(path.join(out,'questions'),{recursive:true});
 fs.mkdirSync(path.join(out,'answers'),{recursive:true});
 const put=(name,object)=>fs.writeFileSync(path.join(out,name),JSON.stringify(object,null,2)+'\n');
 for(const item of pack.questions){
  put('questions/'+item.caseId+'.json',item.packet);
  fs.writeFileSync(path.join(out,'questions',item.caseId+'-日本語の局面説明.md'),renderV3PublicScene(item.packet));
 }
 put('MANIFEST.json',pack.manifest);
 put('SESSION_PLAN.json',pack.sessions);
 fs.writeFileSync(path.join(out,'READ_ME_FIRST_JP.txt'),[
  '麻雀LAB / P2a-v3 / ChatGPT独立試験のための8問×3回パック',
  'このZIPの作成ではAIに一問も解かせていません。結果も入っていません。',
  '人が局面を見るときはquestions/pilot-48-日本語の局面説明.mdを開く。67KBのJSON原本をiPhoneで直接読む必要はない。',
  'AIに解いてもらうときは数字を省略したメモだけではなく、questions/pilot-48.jsonの原本を添付する。',
  '開始時は1問だけ添付し、新しい一時ChatGPTチャットで解答する。',
  '例：questions/pilot-48.json を添付し、下の依頼文を送る。',
  '「添付のJSONのrequestに書かれた公開情報のみを使い、request.systemに従って、responseShapeと同じ項目構成のJSON回答を1件だけ返してください。<...>の型見本をコピーせず、現実の候補・seat・点数で埋めてください。立直とダマの得点は立直側hypotheticalRiichiRon／ダマ側ronで別々に照合し、同じ相手の複数事実は同じ判断区分で記録してください。重要度はpotentially_relevantかnot_establishedだけです。JSONの値に無いことは不明としてください。」',
  '重要：別問題や直前のChatGPT回答を同じ会話に入れない。毎回新しい一時チャット。',
  'SESSION_PLAN.jsonのrepetition=1の8問を最初に実行し、回答を別々のJSONファイルで回収。',
  'その後repetition=2,3でまったく同じ問題を、毎回新しい別チャットで繰返す。',
  '原本のJSONは変更しない。回答の出典/モデル表示名/時刻が不明ならnullで記録。',
  '8問の初回に重大な作り話・数値誤り・合法でない推薦があれば拡大せず停止し報告。',
  'Mortalの推奨や評価点、Claude/Geminiの採点などを解答するChatGPTに与えない。',
  'これは開発実測、実行後もプロバイダ認証済みのモデル試験ではない。',
  '有料APIやクラウド実行は承認されていない。使わない。'
 ].join('\n')+'\n');
 return pack.manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [source,out]=process.argv.slice(2);
 if(!source||!out)fail('usage: node tests/next/v14-freeze-v3-manual-smoke.mjs frozen36.json output-dir');
 const manifest=writeV3ManualSmokePack(JSON.parse(fs.readFileSync(source,'utf8')),out);
 console.log(JSON.stringify({version:manifest.version,selected:manifest.selected,
  sessions:manifest.independentSessionsScheduled,modelCalls:0,sourceHash:manifest.sourceBundleHash},null,2));
}

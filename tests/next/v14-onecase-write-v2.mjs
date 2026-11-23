// Execute only for frozen PUBLIC regression requests. This creates model
// input packets, it does NOT invoke a model or certify an expert-level coach.
import fs from 'node:fs';
import path from 'node:path';
import {makeOneCaseExport,verifyOneCaseExport} from './v14-onecase-export-v2.mjs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('usage: node v14-onecase-write-v2.mjs frozen-stage1.json output-directory');
const frozen=JSON.parse(fs.readFileSync(source,'utf8'));
if(frozen.length!==30)throw Error('this CI demonstration must reuse exactly 30 frozen dev cases only');
const payload=makeOneCaseExport(frozen);
verifyOneCaseExport(frozen,payload);
fs.mkdirSync(destination,{recursive:true});
for(const m of payload.messages){
 const name=m.caseId+'.json';
 fs.writeFileSync(path.join(destination,name),JSON.stringify(m,null,2)+'\n');
}
fs.writeFileSync(path.join(destination,'MANIFEST.json'),JSON.stringify(payload.manifest,null,2)+'\n');
fs.writeFileSync(path.join(destination,'README.txt'),[
 '麻雀LAB P2a-v2 開発用1問1リクエスト集',
 'これは公開投影のみから作成した旧30問の回帰・入出力試験用ファイルです。',
 'ファイル作成時にLLM推論は実行していません。',
 '本番推論、戦術能力の認定、未見の正式試験では使用しないでください。',
 '実モデルへの実行時は1問ずつ新規セッション、モデル名・設定・時刻・入出力の記録が必要です。',
 'Mortal参照/Q、隠し牌、相手手牌、答え合わせ、対照ペアラベルは含みません。',
 'READMEと30件の個別JSON以外は不要です。'
].join('\n')+'\n');
console.log(JSON.stringify({status:'public_development_regression_bundle_no_model_calls',
 n:payload.manifest.n,sourceBundleHash:payload.manifest.sourceBundleHash,
 filenames:payload.messages.map(m=>m.caseId+'.json')},null,2));

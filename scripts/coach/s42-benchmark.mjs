import {readFileSync,writeFileSync} from 'node:fs';
import {gradeBlind,gradeClaims,gradeContrast,revealCase,revealInstruction} from '../../src/coach/s42-benchmark.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const [cmd,...args]=process.argv.slice(2);
if(cmd==='grade'){
 const [key,answers,out]=args;if(!out)throw Error('grade reference.json answers.json report.json');
 write(out,gradeBlind(read(key),read(answers)));
}else if(cmd==='reveal'){
 const [blind,key,answers,out]=args;if(!out)throw Error('reveal blind.json reference.json answers.json stage2.json');
 const items=read(blind).items,ks=read(key),as=read(answers);
 if(!gradeBlind(ks,as).comparable)throw Error('all blind answers must be valid first');
 const keyMap=new Map(ks.map(k=>[k.id,k])),answerMap=new Map(as.map(a=>[a.id,a]));
 if(items.length!==ks.length||new Set(items.map(i=>i.id)).size!==items.length)throw Error('dataset mismatch');
 write(out,{instruction:revealInstruction,items:items.map(i=>revealCase(i,keyMap.get(i.id),answerMap.get(i.id)))});
}else if(cmd==='contrast'){
 const [key,answers,out]=args;if(!out)throw Error('contrast contrast-reference.json predictions.json report.json');
 write(out,gradeContrast(read(key),read(answers)));
}else if(cmd==='claims'){
 const [blind,answers,out]=args;if(!out)throw Error('claims blind.json explanations.json report.json');
 const items=read(blind).items,as=read(answers),m=new Map(as.map(a=>[a.id,a]));
 if(m.size!==as.length||as.some(a=>!items.some(i=>i.id===a.id)))throw Error('duplicate or unknown explanation ID');
 const rows=items.map(i=>({id:i.id,...gradeClaims(i,m.get(i.id)?.claims)}));
 write(out,{n:rows.length,complete:rows.filter(r=>r.complete).length,checked:rows.reduce((n,r)=>n+r.checked,0),correct:rows.reduce((n,r)=>n+r.correct,0),manualReviewRequired:true,rows});
}else throw Error('commands: grade | reveal | contrast | claims');

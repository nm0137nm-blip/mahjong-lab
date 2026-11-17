const fs=require('fs');
const path='/tmp/lab/index.html',s=fs.readFileSync(path,'utf8');
const tags=[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
if(tags.length<1)throw Error('Expected at least one embedded game script');
const last=tags.at(-1)[1];
fs.writeFileSync('/tmp/check-lab-app.js',last);
const {spawnSync}=require('child_process');
for(const file of ['/tmp/check-lab-app.js','/tmp/lab/src/mortal/mortal-client.mjs','/tmp/lab/src/mortal/mortal-worker.mjs','/tmp/lab/src/mortal/mjai-bridge.mjs','/tmp/lab/src/mortal/s42-analytics.mjs']){
 const r=spawnSync('node',['--check',file],{encoding:'utf8'});
 if(r.status!==0)throw Error(file+' syntax failure: '+r.stderr);
}
const needed=['s42ReviewOverlay','s42ReviewBody','s42EndSummary','s42ReviewBtn','s42ReviewPrev','s42ReviewNext','s42ReviewClose','mortalStatus','mortalModelFile'];
for(const id of needed)if(!s.includes('id="'+id+'"'))throw Error('Missing UI node '+id);
for(const fn of ['renderS42End','renderS42Replay','renderS42QDetails','renderS42EfficiencyChoices','renderInlineCoach'])if(!last.includes('function '+fn+'('))throw Error('Missing '+fn);
const visibleCoach=last.slice(last.indexOf('function renderInlineCoach()'),last.indexOf('function renderCoach()'))+last.slice(last.indexOf('function openCoachDetails()'),last.indexOf('function resultPaymentLabel('));
if(/CPUなら|CPU参考判断はこの局面|現行CPUの参考判断（強さ未検証）|CPU参考/.test(visibleCoach))throw Error('Legacy CPU advice still shown in coach UI');
console.log('PASS PHASE25 static syntax and element checks',tags.length);

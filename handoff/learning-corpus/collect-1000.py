import os, sys, json, hashlib, shutil, subprocess, time, zipfile, collections
from pathlib import Path
import importlib.util
def load_module(name,file):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).parent/file)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
profile=load_module('tenhou_profile','tenhou-profile.py')
boundary=load_module('tenhou_boundary','tenhou-boundary-audit.py')
ROOT=Path.cwd()
D=ROOT/'handoff/learning-corpus'
plan=json.loads((D/'plan-1000.json').read_text())
cert=D/'corpus-recipient.pem'
assert hashlib.sha256(cert.read_bytes()).hexdigest()==plan['certSha256']
def seed(s): return int.from_bytes(hashlib.sha256(s.encode()).digest()[:4],'little') or 1
used={seed('coach-v11-20261120:p1-v2-development-v1:'+str(i)) for i in range(1,97)}
used.update(seed('mahjong-lab:learning-corpus-pilot:20261125:v1:'+str(i)) for i in range(1,9))
used.update(seed('mahjong-lab:learning-corpus-1000:20261125:v1:'+str(i)) for i in range(1,1001))
outer=json.loads(Path('/tmp/prior-outer/outer-seeds.json').read_text()); assert outer['status']=='locked_before_outer_acquisition' and len(outer['entries'])==160
used.update(e['seed'] for e in outer['entries'])
used.update(seed('mahjong-lab:tenhou-corpus-1000:20261125:v1:'+str(i)) for i in range(1,1001))
entries=[]
reserved=set(used)
for i in range(1,plan['count']+1):
 attempt=0
 while True:
  value=seed(plan['seedNamespace']+':'+str(i)+(f':collision:{attempt}' if attempt else ''))
  if value not in reserved:break
  attempt+=1
 reserved.add(value)
 entries.append(dict(shard=i,seed=value,family='s42',policy='s42',dealer=(i-1)%4))
assert len({e['seed'] for e in entries})==plan['count'] and not used.intersection(e['seed'] for e in entries)
lab=Path('/tmp/lab'); runner=lab/'tests/next/run-p1-v2-dev.cjs'
s=runner.read_text()
def patch(a,b):
 global s
 assert s.count(a)==1
 s=s.replace(a,b)
patch('shard>96','shard>'+str(plan['count']))
patch('for(let i=0;i<4;i++){\n const child=spawn(', 'for(let i=0;i<0;i++){\n const child=spawn(')
patch("console.log('ARENA_MATCH='+JSON.stringify(rows.at(-1)));","console.log('S42 synthetic match finished');")
patch("fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));","fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));\n   fs.writeFileSync('/tmp/development/wallOrder.json',JSON.stringify(outcome.walls));")
patch('return {rank:game._paipu.rank,score:game._paipu.defen,qijia:game._paipu.qijia,log:game._paipu.log};','return {rank:game._paipu.rank,score:game._paipu.defen,qijia:game._paipu.qijia,log:game._paipu.log,rule:game._rule,point:game._paipu.point};')
runner.write_text(s)
subprocess.run(['node','--check',str(runner)],check=True)
Path('/tmp/v2-dev-seeds.json').write_text(json.dumps(dict(status='locked_v2_development_only',codeSha=os.environ['GITHUB_SHA'],entries=entries)))
html=lab/'index.html'; coach=lab/'src/coach/phoenix-coach.mjs'
profile.apply(html)
originals={p:p.read_bytes() for p in (html,coach)}
first,last=map(int,sys.argv[1:3]); assert 1<=first<=last<=plan['count'] and last-first<plan['batchSize']
out=ROOT/'corpus-output'; out.mkdir(exist_ok=True)
stage=Path('/tmp/corpus-stage'); stage.mkdir(exist_ok=True)
summaries=[]; failure=None; start=time.monotonic()
def sha(b):return hashlib.sha256(b).hexdigest()
def js(x):return json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()
try:
 for i in range(first,last+1):
  for p,b in originals.items():p.write_bytes(b)
  base=Path('/tmp/development'); shutil.rmtree(base,ignore_errors=True)
  t=time.monotonic()
  with open('/tmp/corpus-run.log','wb') as log:
   proc=subprocess.run(['node',str(runner)],env={**os.environ,'COACH_ARENA_QA':'1','ARENA_PAIR':str(i)},stdout=log,stderr=log,timeout=300)
  if proc.returncode!=0:
   logtext=Path('/tmp/corpus-run.log').read_text(errors='replace')
   categories=['legal_mask_mismatch','private qipai contract','private draw contract','focal native encoder not ready','reference mask mismatch','decision progression mismatch','CPU arena failure','arena stall','invalid arena result','development coverage audit','teacher turn owner','oracle own hand alignment','unstable opponent hand','honba score regression','legal ron without positive payment','visible tile overflow','TimeoutError','page.evaluate','out of memory']
   print('diagnostic categories:',json.dumps([v for v in categories if v.lower() in logtext.lower()]),flush=True)
   assert False,'runner exit (classified diagnostic only)'
  m=json.loads((base/'manifest.json').read_text()); r,=m['rows']; p=json.loads((base/'paipu.json').read_text()); walls=json.loads((base/'wallOrder.json').read_text())
  a=r['cpuAudit']
  assert m['seed']==entries[i-1]['seed'] and m['shard']==i and p['qijia']==r['dealer']==entries[i-1]['dealer']
  assert r['opponentFamily']==r['policy']=='s42'
  assert a['fallbacks']==0 and a['sharedWorker'] and a['activeSeats']==3 and a['model']+a['forced']==a['decisions'] and a['decisions']>0
  assert p['rank']==r['allRanks'] and p['score']==r['allScores'] and sum(p['score'])==100000 and sorted(p['rank'])==[1,2,3,4]
  assert len(p['log'])==r['hands']==len(walls)==len(r['wallHashes'])>0
  for w,h in zip(walls,r['wallHashes']):
   ts=w.split(','); assert len(ts)==136 and sha(js(w))==h
   normalized=collections.Counter(t.replace('0','5') for t in ts)
   assert len(normalized)==34 and set(normalized.values())=={4}
   assert all(ts.count(s+'0')==1 for s in 'mps')
  assert sha(js(p['log']))==r['logHash']
  assert len(json.loads((base/'public.json').read_text()))==r['publicDecisions'] and len(json.loads((base/'oracle.json').read_text()))==r['teacherTurns']
  assert p['rule']==profile.RULE, 'wrong actual rule'
  ba=boundary.audit(p)
  expected_points=[p['score'][k]-30000+([40000,10000,-10000,-20000][p['rank'][k]-1]) for k in range(4)]
  from decimal import Decimal
  assert [int(Decimal(v)*1000) for v in p['point']]==expected_points, 'uma/oka/rounding mismatch'
  m.update(corpusNamespace=plan['seedNamespace'],ruleProfile=profile.PROFILE_ID,ruleSource=plan['ruleSource'],actualRule=p['rule'],boundaryAudit=ba,patchedEngineSha256=sha(originals[html]),collectorSha256=sha(Path(__file__).read_bytes()))
  (base/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
  target=stage/str(i);shutil.copytree(base,target)
  rows={f.name:sha(f.read_bytes()) for f in target.glob('*.json')}
  info=dict(shard=i,seed=m['seed'],hands=r['hands'],ruleProfile=profile.PROFILE_ID,westEntered=ba['westEntered'],terminalReason=ba['terminalReason'],lastRound=ba['lastRound'],seconds=round(time.monotonic()-t,3),focalDecisions=r['decisions'],opponentDecisions=a['decisions'],fallbacks=0,files=rows,paipuBytes=(target/'paipu.json').stat().st_size,rawBytes=sum(f.stat().st_size for f in target.glob('*.json')),logHash=r['logHash'])
  summaries.append(info)
  print('completed',i,'hands',r['hands'],'seconds',info['seconds'],flush=True)
except Exception as e:
 failure=type(e).__name__+': '+str(e)[:150] if isinstance(e,(AssertionError,subprocess.TimeoutExpired)) else type(e).__name__
 # Avoid printing raw replay or traceback.
 print('batch stopped:',failure,flush=True)
finally:
 if summaries:
  archive=Path('/tmp/corpus-batch.zip')
  with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for row in summaries:
    for f in sorted((stage/str(row['shard'])).glob('*.json')):z.write(f,f.relative_to(stage))
  dest=out/f'corpus-{first:04d}-{last:04d}.zip.cms'
  subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-gcm','-in',str(archive),'-out',str(dest),'-outform','DER',str(cert)],check=True)
  encryptedSha=sha(dest.read_bytes())
 else:encryptedSha=None
 result=dict(first=first,last=last,planned=last-first+1,completed=len(summaries),failed=failure,seconds=round(time.monotonic()-start,3),encryptedSha256=encryptedSha,rows=summaries,scope='Tenhou-targeted research profile; audited recorded-payment boundaries; not full server certification; oracle labels provisional; encrypted full walls/paipu',ruleProfile=profile.PROFILE_ID)
 (out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
if failure or len(summaries)!=last-first+1:sys.exit(1)

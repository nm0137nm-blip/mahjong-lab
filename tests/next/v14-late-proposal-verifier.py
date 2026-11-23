"""Read-only verifier, after proposal results frozen; aggregate only."""
import json,sys,re,collections,hashlib
from pathlib import Path
from mahjong.shanten import Shanten
root=Path(sys.argv[1]);source=Path(sys.argv[2]);out=Path(sys.argv[3]);raw=source.read_bytes();data=json.loads(raw);sh=Shanten()
T=[s+str(n) for s in 'mpsz' for n in range(1,8 if s=='z' else 10)]
totals=collections.defaultdict(lambda:collections.Counter())
for row in data['cases']:
 d=root/('p1-v2-dev-data-'+str(row['shard']));m=json.loads((d/'manifest.json').read_text())
 assert m['split']=='development-only' and m['seed']==row['seed']
 pub=[x for x in json.loads((d/'public.json').read_text()) if x['id']==row['decision']]
 truth=[x for x in json.loads((d/'oracle.json').read_text()) if x['id']==row['decision']]
 assert len(pub)==len(truth)==1
 for opp in truth[0]['opponents']:
  i=opp['seat'];hand=opp['privateHand'];assert ',' not in hand
  c=[0]*34
  for a,ds in re.findall(r'([mpsz])([0-9]+)',hand):
   for t in ds:c[T.index(a+('5' if t=='0' else t))]+=1
  assert sum(c)==13
  st=sh.calculate_shanten(c)
  waits={t for k,t in enumerate(T) if st==0 and c[k]<4 and sh.calculate_shanten(c[:k]+[c[k]+1]+c[k+1:])==-1}
  group='riichi' if pub[0]['scene']['rivers'][i]['riichi'] else 'non_riichi'
  for mode,v in row['proposals'].items():
   p=v['seats'][str(i)];assert v['accepted']==32 and p['riichi']==(group=='riichi')
   for key in (group,'all'):
    g=totals[mode+'/'+key];g['n']+=1;g['trueReady']+=bool(waits);g['estimatedReady']+=p['ready'];g['weightedReady']+=p['weightedReady'];g['trueShanten']+=st;g['estimatedShanten']+=p['shanten']
    g['readyBrier']+=(p['ready']-bool(waits))**2;g['weightedBrier']+=(p['weightedReady']-bool(waits))**2
    g['waitBrier']+=sum((p['waits'][t]-(t in waits))**2 for t in T)/34
for g in totals.values():
 for k in ['estimatedReady','weightedReady','trueShanten','estimatedShanten','readyBrier','weightedBrier','waitBrier']:g[k]/=g['n']
result={'status':'aggregate_late_proposal_diagnostic_only','inputSHA256':hashlib.sha256(raw).hexdigest(),'cases':len(data['cases']),'aggregates':dict(totals),'limitations':['eight selected closed no-call cases','single observed hidden state per case','no posterior calibration, no product estimates','no data used to change proposals before this comparison']}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

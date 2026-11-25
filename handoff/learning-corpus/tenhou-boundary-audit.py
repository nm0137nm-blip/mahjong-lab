"""Independent recorded-payment audit of Tenhou end/continuation conditions.
Not a second independent scoring engine. Accepts only Majiang-format full synthetic logs.
"""
def audit(p):
 initial=p['qijia']; previous=None; extended=False; terminal=None
 for index,events in enumerate(p['log']):
  q=events[0]['qipai']; cur=4*q['zhuangfeng']+q['jushu']; d=(initial+q['jushu'])%4
  points=[q['defen'][(i-d)%4] for i in range(4)]; sticks=q['lizhibang']
  assert sum(points)+sticks*1000==100000 and 0<=cur<=11 and min(points)>=0
  if previous is None: assert cur==0 and q['changbang']==0 and sticks==0 and points==[25000]*4
  else: assert (cur,q['changbang'],sticks,points)==previous, 'boundary mismatch'
  extended|=cur>=8
  for i,event in enumerate(events):
   v=event.get('dapai')
   if v and v['p'].endswith('*'):
    following=next((e for e in events[i+1:] if 'kaigang' not in e),{})
    if 'hule' not in following and following.get('pingju',{}).get('name')!='三家和':
     points[(d+v['l'])%4]-=1000;sticks+=1
  results=[(k,e[k]) for e in events for k in ('hule','pingju') if k in e]; assert results
  for k,e in results:
   for l,v in enumerate(e['fenpei']):points[(d+l)%4]+=v
  rem=100000-sum(points);assert rem>=0 and rem%1000==0
  sticks=rem//1000
  win=results[0][0]=='hule'
  if win:
   assert len(results)<=2 and all(k=='hule' for k,e in results) and sticks==0
   repeat=any(e['l']==0 for k,e in results);abort=False
  else:
   assert len(results)==1
   e=results[0][1];abort=e['name'] not in ('荒牌平局','流し満貫')
   repeat=abort or bool(e['shoupai'][0])
  rank=sorted(range(4),key=lambda i:(-points[i],(i-initial)%4))
  # At or beyond scheduled all-last, nonabortive dealer repeats stop only if dealer tops >=30k.
  # On dealer change, 30k reached ends; no round after W4. Abortive draws repeat.
  if min(points)<0: terminal='tobi'
  elif cur>=7 and repeat and not abort and rank[0]==d and points[d]>=30000:terminal='dealer_stop'
  elif not repeat and cur>=11:terminal='west_cap'
  elif not repeat and cur>=7 and max(points)>=30000:terminal='sudden_death'
  else:terminal=None
  final=index+1==len(p['log'])
  assert bool(terminal)==final, 'end/continue mismatch'
  if final:
   points[rank[0]]+=sticks*1000
   assert points==p['score'] and [rank.index(i)+1 for i in range(4)]==p['rank']
  else:
   previous=(cur+int(not repeat),q['changbang']+1 if repeat or not win else 0,sticks,points)
 return {'westEntered':extended,'terminalReason':terminal,'lastRound':cur}

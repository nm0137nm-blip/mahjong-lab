"""P2a-v4 verifier-only pinned S42 replay for new 34-unused-source-shard candidate pairs.
The model gets own hand, public history, OTHER players' concealed hands REDACTED.
Do not return any reference Q or pair labels in Stage1 ChatGPT inputs.
NO calibrated EV or causal Mahjong truth is produced.
"""
import hashlib,json,sys,time
from pathlib import Path
import numpy as np
import onnxruntime as ort
root,model,out=map(Path,sys.argv[1:4])
expected_sha='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'
sha=hashlib.sha256(model.read_bytes()).hexdigest()
if sha!=expected_sha:raise ValueError('Mortal graph hash mismatch')
d=json.loads((root/'manifest.json').read_text())
expanded=d.get('version')=='p2a-v4-l35-original-shard-S42-verifier-prelabel-encoded-1'
if not d.get('selectionFrozenPreLabel'):raise ValueError('unfrozen prelabel selection')
if not expanded or not 8<=len(d['rows'])<=120:
 raise ValueError('unexpected preregistered pair count')
if len(set(r['sourceCluster'] for r in d['rows']))!=d['sourceClusterCount']:
 raise ValueError('source cluster count mismatch')
options=ort.SessionOptions()
options.intra_op_num_threads=1;options.inter_op_num_threads=1
options.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
sess=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
assert [x.name for x in sess.get_inputs()]==['obs','mask']
assert [x.name for x in sess.get_outputs()]==['q']
rows=[];ambiguous=0;changed=0;clear_changed=0;clear_maintained=0
PREDECLARED_MIN_MARGIN=0.001 # internal Mortal output scale; not EV
for row in d['rows']:
 result={'pair':row['pair'],'sourceCaseId':row['sourceCaseId'],
         'sourceCluster':row['sourceCluster'],'pairCaseId':row['pairCaseId'],
         'kind':row['kind'],'changedSeat':row['changedSeat'],
         'baselineRequestHash':row['baselineRequestHash'],
         'variantRequestHash':row['variantRequestHash'],'variants':{}}
 for key in ('a','b'):
  v=row['variants'][key];buf=(root/v['file']).read_bytes()
  if hashlib.sha256(buf).hexdigest()!=v['obsHash']:raise ValueError('encoded obs corrupted')
  obs=np.frombuffer(buf,dtype='<f4').reshape(1,1012,34)
  mask=np.array(v['mask'],dtype=bool).reshape(1,46)
  ids=np.flatnonzero(mask[0]).tolist()
  if ids!=row['expected']:raise ValueError('action mask changed after re-encoding')
  q=sess.run(['q'],{'obs':obs,'mask':mask})[0].reshape(-1)
  q2=sess.run(['q'],{'obs':obs,'mask':mask})[0].reshape(-1)
  if not np.array_equal(q[mask[0]],q2[mask[0]]):raise ValueError('Mortal not repeatable on identical observations')
  if not np.isfinite(q[mask[0]]).all():raise ValueError('illegal or nonfinite S42 Q')
  order=sorted(ids,key=lambda i:(-float(q[i]),i));best=order[0]
  margin=float(q[order[0]]-q[order[1]]) if len(order)>1 else None
  result['variants'][key]={'best':best,'rankedGroups':order,
   'marginToNextQ':margin,'repeatExact':True,
   'q':[float(q[j]) if j in ids else None for j in range(46)],
   'opaqueReferenceNoEV':True}
  if key=='a':
   diff=max(abs(float(q[j])-row['archiveQ'][j]) for j in ids)
   result['archiveBaselineMaxQDifference']=diff
   result['archiveBaselineTopMatched']=best==row['archiveBest']
   result['archiveAnchorVerified']=diff<=.001 and best==row['archiveBest']
   if not result['archiveAnchorVerified']:
    raise ValueError('archive baseline model reference failed anchor check')
 a=result['variants']['a'];b=result['variants']['b']
 result['referenceChanged']=a['best']!=b['best']
 result['bothGapsAbovePredeclaredFloor']=all(
  v['marginToNextQ'] is not None and v['marginToNextQ']>=PREDECLARED_MIN_MARGIN
  for v in (a,b))
 result['classification']=(
   'changed_clear_internal_ranking' if result['referenceChanged'] and result['bothGapsAbovePredeclaredFloor']
   else 'maintained_clear_internal_ranking' if not result['referenceChanged'] and result['bothGapsAbovePredeclaredFloor']
   else 'ambiguous_close_or_single_group')
 changed+=int(result['referenceChanged'])
 clear_changed+=int(result['classification']=='changed_clear_internal_ranking')
 clear_maintained+=int(result['classification']=='maintained_clear_internal_ranking')
 ambiguous+=int(result['classification']=='ambiguous_close_or_single_group')
 rows.append(result)
output={
 'status':'S42_V4_new_original_shard_reference_only_not_EV_or_causal_truth',
 'selectionInputHash':d['pairPoolFrozenHash'],
 'modelSHA256':sha,'onnxruntime':ort.__version__,
 'predeclaredMinGroupMarginInternalQ':PREDECLARED_MIN_MARGIN,
 'batch':'v4_source_disjoint_new_prelabel_pool',
 'sourceClusterCount':d['sourceClusterCount'],
 'prelabelPoolProposed':d['originalProposed'],
 'physicalEncoderPassPairs':d['encoded'],
 'physicalEncoderFailedPairs':len(d['failures']),
 'changedSourceClusters':len({r['sourceCluster'] for r in rows if r['referenceChanged']}),
 'maintainedSourceClusters':len({r['sourceCluster'] for r in rows if not r['referenceChanged']}),
 'n':len(rows),'rawTopChanged':changed,'rawTopMaintained':len(rows)-changed,
 'clearChanged':clear_changed,'clearMaintained':clear_maintained,'ambiguous':ambiguous,
 'rows':rows,
 'limitations':['Not an expert tactical gold label','Full original physical replay and action legality require separate verification',
  'Score changed as alternative prior-round public points; no true opponent hidden hand inference',
  'Mortal Q is an internal ordinal response, NOT points EV or calibrated confidence',
  'All pairs selected by public-source deterministic rules before any labels for this batch; repeats from one source not independent',
  'No genuine ChatGPT contrast answer is evaluated here']
}
# The deterministic class-balanced selection algorithm is declared in source
# BEFORE labels are read. It counts each original shard at most once.
def preference(x):
 return hashlib.sha256(('p2a-v4-fixed-class-balanced-20261123|'+x['pairCaseId']).encode()).hexdigest()
change=sorted((x for x in rows if x['classification']=='changed_clear_internal_ranking'),key=preference)
maintain=sorted((x for x in rows if x['classification']=='maintained_clear_internal_ranking'),key=preference)
selected=[];seen_clusters=set()
for candidates in (change,maintain):
 count=0
 for x in candidates:
  if x['sourceCluster'] in seen_clusters:continue
  selected.append(x);seen_clusters.add(x['sourceCluster']);count+=1
  if count==4:break
 if count!=4:break
eligible=(len(selected)==8 and
 sum(x['classification']=='changed_clear_internal_ranking' for x in selected)==4 and
 sum(x['classification']=='maintained_clear_internal_ranking' for x in selected)==4)
output['predeclaredClassBalancedSelection']={
 'method':'sha256 first distinct source clusters of clear changed 4, then clear maintained 4; never adapt after labels',
 'strictEligible':eligible,
 'selectedSourceClusters':[x['sourceCluster'] for x in selected] if eligible else [],
 'selectedPairCaseIds':[x['pairCaseId'] for x in selected] if eligible else [],
 'changedAvailablePairs':len(change),'maintainedAvailablePairs':len(maintain),
 'changedAvailableSourceClusters':len(set(x['sourceCluster'] for x in change)),
 'maintainedAvailableSourceClusters':len(set(x['sourceCluster'] for x in maintain)),
 'noSourceClusterReused':len(seen_clusters)==len(selected),
 'status':'VERIFIER_ONLY_NO_CHATGPT_RESPONSE',
 'failurePolicy':'Do not amend pool after S42 labels; if fewer than 4 per class, L3.5 formal pair gate NO-GO'
}
output['limitations']+=['Original-source-disjoint pair pool after v3 pilot and exploratory-58; selection was public-only',
 'Selected 8 balanced pairs are deliberately stratified on reference change, not a natural prevalence estimate',
 'Changing scores at the public focal scene is a hypothetical alternative prior-round score distribution, not the actual archived prior-match history',
 'Original archived same-hand observable history and focal legal mask checked, no new user model responses',
 'A clear S42 group change does not prove a tactical explanation is expert-level']
out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in output.items() if k!='rows'},ensure_ascii=False))

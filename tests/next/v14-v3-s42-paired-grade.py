"""P2a-v3 verifier-only pinned S42 replay for 8 newly prepared public pairs.
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
if len(d['rows'])!=8:raise ValueError('expected 8 preregistered pairs')
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
 'status':'S42_development_reference_only_not_EV_not_causal_truth',
 'selectionInputHash':d['selectionFrozenSourceHash'],
 'modelSHA256':sha,'onnxruntime':ort.__version__,
 'predeclaredMinGroupMarginInternalQ':PREDECLARED_MIN_MARGIN,
 'n':len(rows),'rawTopChanged':changed,'rawTopMaintained':len(rows)-changed,
 'clearChanged':clear_changed,'clearMaintained':clear_maintained,'ambiguous':ambiguous,
 'rows':rows,
 'limitations':['Not an expert tactical gold label','Full original physical replay and action legality require separate verification',
  'Score changed as alternative prior-round public points; no true opponent hidden hand inference',
  'Mortal Q is an internal ordinal response, NOT points EV or calibrated confidence',
  'Only 8 preregistered public contrast pairs, label selection not tailored after observing Q',
  'No genuine ChatGPT contrast answer is evaluated here']
}
out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in output.items() if k!='rows'},ensure_ascii=False))

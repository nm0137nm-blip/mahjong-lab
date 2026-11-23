"""Paired ONNX reference diagnostic only, no gold label or product estimate."""
import hashlib,json,sys,time
from pathlib import Path
import numpy as np,onnxruntime as ort
root=Path(sys.argv[1]);model=Path(sys.argv[2]);out=Path(sys.argv[3])
sha=hashlib.sha256(model.read_bytes()).hexdigest();assert sha=='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'
opt=ort.SessionOptions();opt.intra_op_num_threads=1;opt.inter_op_num_threads=1;opt.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
ses=ort.InferenceSession(str(model),sess_options=opt,providers=['CPUExecutionProvider']);assert [x.name for x in ses.get_inputs()]==['obs','mask'] and [x.name for x in ses.get_outputs()]==['q']
rows=[]
for pair in json.loads((root/'manifest.json').read_text()):
 r={'pair':pair['pair'],'variants':{}}
 for v,d in pair['variants'].items():
  raw=(root/d['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==d['obsHash']
  obs=np.frombuffer(raw,dtype='<f4').reshape(1,1012,34);mask=np.array(d['mask'],dtype=bool).reshape(1,46)
  assert np.flatnonzero(mask[0]).tolist()==pair['expected'];start=time.perf_counter()
  q=ses.run(['q'],{'obs':obs,'mask':mask})[0].reshape(-1);assert len(q)==46 and np.isfinite(q[mask[0]]).all()
  q2=ses.run(['q'],{'obs':obs,'mask':mask})[0].reshape(-1);assert np.array_equal(q[mask[0]],q2[mask[0]])
  legal=pair['expected'];best=max(legal,key=lambda x:q[x])
  r['variants'][v]={'q':[float(q[j]) if j in legal else None for j in range(46)],'best':best,'seconds':time.perf_counter()-start}
 a=r['variants']['a'];r['archiveMaxAbsQDifference']=max(abs(a['q'][j]-pair['archiveQ'][j]) for j in pair['expected'])
 r['archiveBestAgreement']=pair['archiveBest']==a['best']
 r['archiveAnchorMatched']=r['archiveMaxAbsQDifference']<=.001 and r['archiveBestAgreement']
 r['referenceChange']=a['best']!=r['variants']['b']['best'] if r['archiveAnchorMatched'] else None
 rows.append(r)
result={'status':'paired_reference_diagnostic_not_gold_label','modelSHA256':sha,'onnxruntime':ort.__version__,'anchorTolerance':.001,'matched':sum(r['archiveAnchorMatched'] for r in rows),'n':len(rows),'rows':rows,'limitations':['archived original group reference must match before comparison','no tactical equivalence threshold or rollout label fixed','no formal evaluation; verifier only']}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='rows'}));print(json.dumps([{k:v for k,v in r.items() if k!='variants'} for r in rows]))

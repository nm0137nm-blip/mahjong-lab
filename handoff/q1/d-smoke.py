"""Expose pre-DQN feature of pinned S42 ONNX in an ephemeral copy, no training."""
import base64,json,time,hashlib,resource
import numpy as np,onnx,onnxruntime as ort
from onnx import helper,TensorProto
from pathlib import Path
orig=Path('/tmp/s42.onnx');assert hashlib.sha256(orig.read_bytes()).hexdigest()=='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'
model=onnx.load(orig);init={x.name:tuple(x.dims) for x in model.graph.initializer}
nodes=[n for n in model.graph.node if n.op_type in ('Gemm','MatMul') and any(init.get(i) in ((47,1024),(1024,47)) for i in n.input)]
assert len(nodes)==1,[(n.name,list(n.input)) for n in nodes]
head=nodes[0]; feature=[i for i in head.input if i not in init];assert len(feature)==1
name=feature[0];model.graph.output.append(helper.make_tensor_value_info(name,TensorProto.FLOAT,[1,1024]));onnx.checker.check_model(model);onnx.save(model,'/tmp/s42-feature.onnx')
opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
a=ort.InferenceSession(str(orig),sess_options=opts,providers=['CPUExecutionProvider']);b=ort.InferenceSession('/tmp/s42-feature.onnx',sess_options=opts,providers=['CPUExecutionProvider'])
scenes={c['name']:c for c in json.loads(Path('/tmp/s42-scenes.json').read_text())}
rows=[]; pairs=[]
for key in ('round-0-0-seat-0','round-0-2-seat-2','round-1-3-seat-1','round-1-1-seat-3'):
 feats=[]
 for scores in ('25000-25000-25000-25000','42000-12000-26000-20000'):
  case=scenes[key+'-scores-'+scores];event=case['decisions'][-1];raw=base64.b64decode(event['raw']);obs=np.frombuffer(raw[:1012*34*4],dtype='<f4').reshape(1,1012,34);mask=np.frombuffer(raw[1012*34*4:],dtype=np.uint8).astype(bool).reshape(1,46)
  assert obs.shape==(1,1012,34) and mask.any() and np.isfinite(obs).all()
  assert all(e['type']!='tsumo' or e['actor']==case['seat'] or e['pai']=='?' for e in case['events'])
  assert all(all(all(t=='?' for t in h) for i,h in enumerate(e['tehais']) if i!=case['seat']) for e in case['events'] if e['type']=='start_kyoku')
  inputs={'obs':obs,'mask':mask};q=a.run(['q'],inputs)[0];t=time.monotonic();q2,f=b.run(['q',name],inputs);seconds=time.monotonic()-t
  q3,f2=b.run(['q',name],inputs)
  assert f.shape==(1,1024) and np.isfinite(f).all() and np.array_equal(f,f2)
  diff=float(np.max(np.abs(q[mask]-q2[mask])));assert diff<=1e-4 and q.argmax()==q2.argmax() and np.isneginf(q2[~mask]).all() and np.array_equal(q2,q3)
  feats.append(f);rows.append({'case':key,'scoresVariant':scores,'featureShape':list(f.shape),'qMaxDiff':diff,'deterministic':True,'seconds':seconds})
 pairs.append({'case':key,'scoreOnlyFeatureL2':float(np.linalg.norm(feats[0]-feats[1])),'distinct':not np.array_equal(*feats)})
result={'scope':'8 fictional visible observations; frozen ONNX pre-head, no model training or probability validity','headNode':head.name,'featureTensor':name,'rows':rows,'scorePairs':pairs,'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
Path('q1-d-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

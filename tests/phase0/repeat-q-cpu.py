import json,sys,base64
from pathlib import Path
import numpy as np
import onnxruntime as ort
ref=json.loads(Path(sys.argv[1]).read_text())
out=[]
for n in (1,2):
 for rep in range(3):
  opt=ort.SessionOptions();opt.intra_op_num_threads=n;opt.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
  s=ort.InferenceSession(sys.argv[2],sess_options=opt,providers=['CPUExecutionProvider'])
  rows=[]
  for r in ref:
   raw=base64.b64decode(r['raw']);obs=np.frombuffer(raw[:1012*34*4],dtype='<f4').reshape(1,1012,34);mask=np.frombuffer(raw[1012*34*4:],dtype=np.uint8).astype(bool)
   assert mask.tolist()==[v is not None for v in r['q']]
   q=s.run(['q'],{'obs':obs,'mask':mask[None]})[0][0]
   assert np.isfinite(q[mask]).all()
   rows.append({'name':r['name'],'eventIndex':r['eventIndex'],'q':[float(x) if ok else None for x,ok in zip(q,mask)]})
  out.append({'engine':f'onnx-cpu-{n}-{rep}','rows':rows})
Path(sys.argv[3]).write_text(json.dumps(out))

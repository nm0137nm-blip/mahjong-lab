"""Compare published browser observations with native upstream libriichi and original S42.
Synthetic fixtures only. Run with pinned public upstream source and verified weights."""
import base64
import json
import os
from pathlib import Path
import sys
import numpy as np
import torch
import onnxruntime as ort
from libriichi.state import PlayerState

sys.path.insert(0, os.environ['MORTAL_SOURCE'] + '/mortal')
from model import Brain, DQN

torch.set_num_threads(2)
brain=Brain(conv_channels=192,num_blocks=40,is_oracle=False,version=4)
dqn=DQN(version=4)
checkpoint=torch.load(os.environ['S42_PTH'],map_location='cpu',weights_only=True)
# Public checkpoint may package the encoder under "brain" or "mortal".
def load_exact(module, candidates):
    for name in candidates:
        state=checkpoint.get(name)
        if isinstance(state,dict) and set(state)==set(module.state_dict()):
            module.load_state_dict(state,strict=True)
            return
    # Match an exact state dictionary nested one level, never infer from incompatible tensors.
    for name,state in checkpoint.items():
        if isinstance(state,dict) and set(state)==set(module.state_dict()):
            module.load_state_dict(state,strict=True)
            return
    raise RuntimeError('No exact published state dictionary for '+str(candidates)+'; available keys '+str(list(checkpoint)[:20]))
load_exact(brain,['brain','mortal'])
load_exact(dqn,['dqn'])
brain.eval();dqn.eval()
opts=ort.SessionOptions()
opts.intra_op_num_threads=2
opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
session=ort.InferenceSession(os.environ['S42_ONNX'],sess_options=opts,providers=['CPUExecutionProvider'])
scenes=[case for p in sorted(Path(sys.argv[1]).rglob('live-*.json')) for case in json.loads(p.read_text()) if case['decisions']]
assert len(scenes)>0
for i,case in enumerate(scenes):case['name']=f'live-{i}'
refs=[]
max_obs_error=0.0
obs_mismatches=0
q_count=0
max_q_error=0.0
for case in scenes:
    st=PlayerState(case['seat'])
    native_count=0
    expected={d['eventIndex']:d for d in case['decisions']}
    for i,event in enumerate(case['events']):
        action=st.update(json.dumps(event))
        if i not in expected:continue
        assert bool(action.can_act),(case['name'],i,'eligibility')
        native_count+=1
        obs,mask=st.encode_obs(4,False)
        obs=np.asarray(obs,dtype=np.float32);mask=np.asarray(mask,dtype=bool)
        raw=base64.b64decode(expected[i]['raw'])
        browser_obs=np.frombuffer(raw[:1012*34*4],dtype='<f4').reshape(1012,34)
        browser_mask=np.frombuffer(raw[1012*34*4:],dtype=np.uint8).astype(bool)
        assert np.array_equal(mask,browser_mask),(case['name'],i,'mask')
        assert np.isfinite(obs).all() and np.isfinite(browser_obs).all()
        err=float(np.abs(obs-browser_obs).max())
        max_obs_error=max(max_obs_error,err)
        obs_mismatches+=int(not np.array_equal(obs,browser_obs))
        # Do not mask or silently tolerate a feature mismatch.
        assert err<=1e-6,(case['name'],i,'observation mismatch',err)
        with torch.inference_mode():
            q=dqn(brain(torch.from_numpy(obs.copy())[None]),torch.from_numpy(mask.copy())[None]).numpy()[0]
        oq=session.run(['q'],{'obs':browser_obs[None],'mask':browser_mask[None]})[0][0]
        assert np.isfinite(q[mask]).all() and np.isfinite(oq[mask]).all()
        assert np.isneginf(q[~mask]).all() and np.isneginf(oq[~mask]).all()
        err=float(np.abs(q[mask]-oq[mask]).max())
        max_q_error=max(max_q_error,err)
        q_count+=int(mask.sum())
        assert err<=1e-4,(case['name'],i,'Q mismatch',err)
        assert q.argmax()==oq.argmax()==expected[i]['best'],(case['name'],i,'best action')
        actual=np.array([v if v is not None else -np.inf for v in expected[i]['q']])
        assert np.array_equal(np.isfinite(actual),mask)
        assert np.max(np.abs(q[mask]-actual[mask]))<=1e-4,(case['name'],i,'actual browser Q')
        refs.append({'name':case['name'],'eventIndex':i,'raw':expected[i]['raw'],'q':[float(x) if ok else None for x,ok in zip(q,mask)]})
    assert native_count==len(expected)
Path(sys.argv[2]).write_text(json.dumps(refs))
print(json.dumps({'status':'PASS_LIVE_SAMPLED_NATIVE_ENCODER_AND_BROWSER_Q_PARITY','scenes':len(scenes),'decisions':len(refs),'legal_q_values':q_count,'max_obs_error':max_obs_error,'non_bit_exact_observations':obs_mismatches,'max_q_error':max_q_error},indent=2))

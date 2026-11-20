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

from collections import Counter
from libriichi.mjai import Bot
from engine import MortalEngine
engine_off=MortalEngine(brain,dqn,False,4,enable_quick_eval=False,enable_rule_based_agari_guard=False,name='S42-original-greedy')
engine_on=MortalEngine(brain,dqn,False,4,enable_quick_eval=False,enable_rule_based_agari_guard=True,name='S42-original-guarded')
honors='ESWNPFC'
def tile(p):
    s,n=p[:2]
    if s=='z':return honors[int(n)-1]
    return '5'+s+'r' if n=='0' else n+s
def tile_id(t):
    if t in honors:return 27+honors.index(t)
    if t.endswith('r'):return 34+'mps'.index(t[1])
    return 9*'mps'.index(t[1])+int(t[0])-1
def group(e):
    k=e['type']
    if k=='dahai':return tile_id(e['pai'])
    if k=='chi':
        ranks=[int(t[0]) for t in e['consumed']]
        return 38 if int(e['pai'][0])<min(ranks) else 40 if int(e['pai'][0])>max(ranks) else 39
    return {'reach':37,'pon':41,'ankan':42,'kakan':42,'daiminkan':42,'hora':43,'ryukyoku':44,'none':45}[k]
def meld_tiles(m):
    return [(tile(m[0]+n),i+1<len(m) and m[i+1] in '+-=') for i,n in enumerate(m) if i and n.isdigit()]
def compare_detail(e,p):
    k=e['type']
    if k=='dahai':return tile(p['dapai'])==e['pai'] and ('_' in p['dapai'])==e['tsumogiri']
    if k in ('chi','pon','daiminkan'):
        ts=meld_tiles(p['fulou'])
        return sorted(t for t,c in ts if not c)==sorted(e['consumed']) and [t for t,c in ts if c]==[e['pai']]
    if k=='ankan':return sorted(t for t,c in meld_tiles(p['gang']))==sorted(e['consumed'])
    if k=='kakan':return tile(p['gang'][0]+p['gang'][-1])==e['pai']
    return k in ('hora','ryukyoku','none')
def react(b,e,can): 
    out=b.react(json.dumps(e),can_act=can)
    return json.loads(out) if out is not None else None
def make_bot(es,seat,last,engine):
    b=Bot(engine,seat)
    for ev in es[:last]:react(b,ev,False)
    return b
scenes=[case for p in sorted(Path(sys.argv[1]).rglob('live-*.json')) for case in json.loads(p.read_text()) if case['decisions']]
assert len(scenes)>0
counts=Counter(); differences=[];coverage=Counter();max_q_err=0.
for case_no,case in enumerate(scenes):
    es=case['events'];seat=case['seat']
    a=Bot(engine_off,seat);b=Bot(engine_on,seat)
    wanted={d['eventIndex']:d for d in case['decisions']}
    assert len(wanted)==len(case['decisions'])
    for i,event in enumerate(es):
        d=wanted.get(i); eo=react(a,event,d is not None); eg=react(b,event,d is not None)
        if d is None:continue
        assert 'choice' in d and 'options' in d and eo is not None and eg is not None,(case_no,i)
        g=group(eo);guard=group(eg);chosen=d['choice']['action'];p=d['choice']['payload']
        counts['sampled']+=1;coverage[str(g)]+=1
        # Group mismatch is a hard failure; all action detail differences are measured and retained.
        assert g==d['best']==chosen,(case_no,i,g,d['best'],chosen)
        counts['raw_group_match']+=1
        if guard!=g:
            counts['guard_changed_group']+=1
            differences.append({'case':case_no,'event':i,'kind':'guard','raw':g,'guard':guard})
        if g==37:
            counts['reach']+=1
            bot=make_bot(es,seat,i+1,engine_off)
            hypothetical=react(bot,{'type':'reach','actor':seat},True)
            # No fabricated success: record if upstream does not return second-stage action.
            match=bool(hypothetical and hypothetical['type']=='dahai' and compare_detail(hypothetical,p))
            counts['reach_second_stage_checked']+=int(bool(hypothetical and hypothetical['type']=='dahai'))
        else:match=compare_detail(eo,p)
        if match:counts['detail_match']+=1
        else:
            counts['detail_mismatch']+=1
            differences.append({'case':case_no,'event':i,'kind':'payload','group':g,'native':{k:v for k,v in eo.items() if k!='meta'},'adapter':p})
        counts['grouped_adapter']+=int(d['choice']['grouped'])
        if g==42 and eo.get('meta',{}).get('kan_select') is not None:counts['native_extra_kan_head']+=1
        # Native metadata is not a physical expected-score label.
        meta=eo.get('meta') or {}
        if 'mask_bits' in meta and 'q_values' in meta:
            mask=[bool(meta['mask_bits']>>j&1) for j in range(46)]
            assert mask==[v is not None for v in d['q']]
            err=max(abs(x-y) for x,y in zip(meta['q_values'],[v for v in d['q'] if v is not None]))
            assert err<=1e-4
            max_q_err=max(max_q_err,err)
assert counts['sampled']>0 and counts['sampled']==counts['detail_match']+counts['detail_mismatch']
out={'status':'group_audit_complete_detail_not_assumed','sampled_matches':2,'seat_hands':len(scenes),'counts':dict(counts),'group_coverage':dict(coverage),'max_q_error':max_q_err,'differences':differences,'scope':'original MJAI Bot on sampled actual CPU states, guard off/on; not native full-game engine parity; unsampled categories remain unverified'}
Path(sys.argv[2]).write_text(json.dumps(out,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='differences'},indent=2))

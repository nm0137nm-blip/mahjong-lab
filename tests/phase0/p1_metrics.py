"""P1 metric primitives. No model training or outer evaluation; unit-test targets only."""
from collections import defaultdict
import math

def _pairs(y,p):
    if not y or len(y)!=len(p):raise ValueError('empty or unequal')
    if any(v not in (0,1) for v in y):raise ValueError('nonbinary')
    if any(not math.isfinite(v) or not 0<=v<=1 for v in p):raise ValueError('invalid probability')
    return list(zip(y,p))

def binary_metrics(y,p):
    a=_pairs(y,p); n=len(a); eps=1e-12
    brier=sum((v-t)**2 for t,v in a)/n
    ll=-sum(t*math.log(max(eps,v))+(1-t)*math.log(max(eps,1-v)) for t,v in a)/n
    # Average precision: ties processed as a single score threshold.
    total=sum(y); tp=fp=0; ap=0.; by=defaultdict(list)
    for t,v in a:by[v].append(t)
    for v in sorted(by,reverse=True):
        add=sum(by[v]);tp+=add;fp+=len(by[v])-add
        if total:ap+=add/total*tp/(tp+fp)
    return {'n':n,'positives':total,'brier':brier,'log_loss':ll,'auprc_ap':ap if total and total<n else None}

def reliability(y,p,match):
    a=_pairs(y,p)
    if len(match)!=len(a):raise ValueError('match alignment')
    bins=defaultdict(list)
    for (t,v),m in zip(a,match):bins[min(9,int(10*v))].append((t,v,m))
    result=[]
    for i in range(10):
        rows=bins[i];n=len(rows);m=len({r[2] for r in rows})
        result.append({'bin':i,'n':n,'matches':m,'observed':sum(r[0] for r in rows)/n if n else None,'predicted':sum(r[1] for r in rows)/n if n else None,'supported':n>=200 and m>=30})
    return result

def within_decision_auc(y,p,keys):
    a=_pairs(y,p)
    if len(keys)!=len(a):raise ValueError('group alignment')
    d=defaultdict(list)
    for (t,v),k in zip(a,keys):d[k].append((t,v))
    vals=[]
    for rows in d.values():
        pos=[v for t,v in rows if t];neg=[v for t,v in rows if not t]
        if pos and neg:vals.append(sum((float(a>b)+0.5*float(a==b)) for a in pos for b in neg)/(len(pos)*len(neg)))
    return {'mixed_sets':len(vals),'all_sets':len(d),'macro_auc':sum(vals)/len(vals) if vals else None}

def payment_metrics(legal,prob,truth_cond,pred_cond):
    a=_pairs(legal,prob)
    if len(a)!=len(truth_cond) or len(a)!=len(pred_cond):raise ValueError('point alignment')
    errors=[]; exposures=[]
    for (t,p),actual,pred in zip(a,truth_cond,pred_cond):
        if not math.isfinite(pred) or pred<0:raise ValueError('point invalid')
        if t:
            if actual is None or not math.isfinite(actual) or actual<=0:raise ValueError('legal ron missing payment')
            errors.append(pred-actual)
        elif actual is not None:raise ValueError('illegal ron has conditional payment label')
        # Per-opponent legal-opportunity exposure, not actual settlement EV.
        exposures.append(p*pred-(actual if t else 0))
    return {'n':len(a),'positives':len(errors),'conditional_mae':sum(abs(e) for e in errors)/len(errors) if errors else None,'conditional_rmse':math.sqrt(sum(e*e for e in errors)/len(errors)) if errors else None,'exposure_rmse':math.sqrt(sum(e*e for e in exposures)/len(exposures))}

def validate_probability_contract(tenpai,ron,known_t=None,known_r=None):
    if not (math.isfinite(tenpai) and math.isfinite(ron) and 0<=ron<=tenpai<=1):raise ValueError('probability consistency')
    if known_t is not None and tenpai!=known_t:raise ValueError('known tenpai violated')
    if known_r is not None and ron!=known_r:raise ValueError('known ron violated')

"""Read-only metadata audit. No download/decryption, no token or per-match data in logs."""
import json,os,urllib.request,collections,re,importlib.util
base="https://api.github.com/repos/nm0137nm-blip/mahjong-lab/actions/runs/45530376491"
spec=importlib.util.spec_from_file_location("split","handoff/learning-extension-split.py")
split=importlib.util.module_from_spec(spec);spec.loader.exec_module(split);parts=split.split()
def get(url):
 assert url.startswith(base+"/") or url==base
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"})
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
def all_pages(endpoint,key):
 out=[];page=1
 while True:
  data=get(base+"/"+endpoint+("?filter=latest&" if key=="jobs" else "?")+"per_page=100&page="+str(page))
  batch=data[key];out.extend(batch)
  if len(batch)<100:break
  page+=1;assert page<=10
 assert len({x["id"] for x in out})==len(out)
 # Counts may change while a run is active; refuse inconsistent snapshot.
 assert len(out)==data["total_count"]
 return out
jobs=all_pages("jobs","jobs");arts=all_pages("artifacts","artifacts")
ranges=[(n,n+1) for n in range(1,11,2)]+[(n,min(n+63,9030)) for n in range(11,9031,64)]
expected={f'{"pilot" if a<=10 else "bulk"} ({a}, {b})':(a,b) for a,b in ranges}
assert len(expected)==146
byname={}
for j in jobs:
 assert j["name"] not in byname
 byname[j["name"]]=j
assert set(byname)<=set(expected)|{"rule_qa"}
artifact_names=collections.defaultdict(list)
for a in arts:
 if not a["expired"] and a["size_in_bytes"]>0:artifact_names[a["name"]].append(a)
confirmed=set();missing=[];unmatched=[];nominal=set()
for name,(a,b) in expected.items():
 an=f"tenhou-corpus-extension-{a}-{b}"
 ok=artifact_names.get(an,[])
 assert len(ok)<=1
 if ok:nominal.update(range(a,b+1))
 if byname.get(name,{}).get("conclusion")=="success":
  if ok:confirmed.update(range(a,b+1))
  else:missing.append(name)
 elif ok:unmatched.append(an)
assert set(artifact_names)<=set(f"tenhou-corpus-extension-{a}-{b}" for a,b in ranges)
assert len(jobs)==147
import hashlib
split_hash=hashlib.sha256(json.dumps(parts,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")).hexdigest()
assert split_hash=="04d92496cfec64cbc02fe971ab4cdebff2c81859716b1ad2e865da05f5bd6d06"
status=collections.Counter((j.get("conclusion") or j["status"]) for j in jobs)
print("EXTENSION_FULL_METADATA="+json.dumps({"split_hash":split_hash,"expected_jobs":147,"returned_jobs":len(jobs),"job_status":status,"active_artifacts":sum(map(len,artifact_names.values())),"confirmed_extension_range":len(confirmed),"cumulative_saved_lower":970+len(confirmed),"nominal_range":970+len(nominal),"missing_success_artifact":missing,"artifact_without_success":unmatched,"partition_saved":{k:len(confirmed.intersection(parts[k])) for k in ("qa","development","confirmation")},"scope":"metadata only; initial 970 fully audited; extension not decrypted or independently audited"},ensure_ascii=False,sort_keys=True))

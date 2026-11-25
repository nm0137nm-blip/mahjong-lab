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
# Artifact creation may cross a pagination boundary. Require an identical artifact snapshot twice, or fail closed.
jobs=all_pages("jobs","jobs");arts=all_pages("artifacts","artifacts")
arts_check=all_pages("artifacts","artifacts")
assert sorted((a["id"],a["name"],a["expired"],a.get("digest")) for a in arts)==sorted((a["id"],a["name"],a["expired"],a.get("digest")) for a in arts_check)
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
print("EXTENSION_FULL_METADATA="+json.dumps({"split_hash":split_hash,"expected_jobs":147,"returned_jobs":len(jobs),"job_status":status,"failed_jobs":[{"id":j["id"],"name":j["name"],"conclusion":j.get("conclusion")} for j in jobs if j.get("conclusion") in ("failure","cancelled","timed_out","action_required")],"active_artifacts":sum(map(len,artifact_names.values())),"confirmed_extension_range":len(confirmed),"cumulative_saved_lower":970+len(confirmed),"nominal_range":970+len(nominal),"missing_success_artifact":missing,"artifact_without_success":unmatched,"partition_saved":{k:len(confirmed.intersection(parts[k])) for k in ("qa","development","confirmation")},"scope":"metadata only; local content intake is tracked separately"},ensure_ascii=False,sort_keys=True))

# Final immutable archive audit: read encrypted transport + summaries, never decrypt.
import io,zipfile,concurrent.futures,urllib.error
root="https://api.github.com/repos/nm0137nm-blip/mahjong-lab"
assert status=={"success":146,"failure":1}, dict(status)
assert [j["id"] for j in jobs if j["conclusion"]=="failure"]==[138925873673]
assert not missing and unmatched==["tenhou-corpus-extension-2763-2826"]
assert len(arts)==146 and len(nominal)==9030
def api(url):
 assert url.startswith(root+"/")
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"})
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
repair=api(root+"/actions/runs/45571397958/artifacts")["artifacts"]
assert len(repair)==1 and repair[0]["id"]==15003311615 and repair[0]["name"]=="tenhou-corpus-extension-repair-2818-2826"
assert api(root+"/actions/runs/45571397958")["conclusion"]=="success"
assert api(root+"/actions/runs/45530376491")["status"]=="completed"
initial=api(root+"/actions/runs/45502831152/artifacts?per_page=100")["artifacts"]
initial+=api(root+"/actions/runs/45519978000/artifacts?per_page=100")["artifacts"]
initial_ids={14971366545,14971399453,14971649913,14971951565,14972624707,14972715804,14972775190,14973544851,14973736153,14973742025,14974245227,14974368683,14974429594,14974549341,14974792896,14974948260,14975010585,14975253194,14975256115,14975556946,14976101238,14976103514,14976479124,14976569071,14976858806,14977378284,14977491525,14977530021,14977637945,14977854742,14977909336,14977935465,14978990467,14979273901,14979394486,14979396507}
initial=[a for a in initial if a["id"] in initial_ids]
assert len(initial)==36 and {a["id"] for a in initial}==initial_ids
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
def download(a):
 assert not a["expired"] and a["digest"].startswith("sha256:") and a["size_in_bytes"]>0
 url=root+"/actions/artifacts/"+str(a["id"])+"/zip"
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json"})
 try:
  with urllib.request.build_opener(NoRedirect).open(req,timeout=60) as r:b=r.read()
 except urllib.error.HTTPError as e:
  assert e.code in (301,302,303,307,308)
  loc=e.headers["Location"];assert loc.startswith("https://")
  with urllib.request.urlopen(urllib.request.Request(loc),timeout=90) as r:b=r.read()
 assert len(b)==a["size_in_bytes"] and hashlib.sha256(b).hexdigest()==a["digest"][7:]
 with zipfile.ZipFile(io.BytesIO(b)) as z:
  assert z.testzip() is None and len(z.namelist())==2
  cms,=[n for n in z.namelist() if n.endswith(".cms")]
  s=json.loads(z.read("summary.json"))
  assert hashlib.sha256(z.read(cms)).hexdigest()==s["encryptedSha256"]
  rows=s["rows"];assert len(rows)==s["completed"] and rows
  for r in rows:
   assert r["fallbacks"]==0 and r["ruleProfile"]=="tenhou-ranked-4p-red-hanchan-v1"
   assert set(r["files"])=={"public.json","paipu.json","oracle.json","wallOrder.json","reference.json","manifest.json"}
   assert all(re.fullmatch("[0-9a-f]{64}",h) for h in r["files"].values())
   assert re.fullmatch("[0-9a-f]{64}",r["logHash"])
  actual=[r["shard"] for r in rows]
  assert actual==list(range(s["first"],s["first"]+s["completed"])) and s["planned"]==s["last"]-s["first"]+1
  if a["id"] in (14975010585,15000888076):
   assert s["failed"] and s["completed"]==(1 if a["id"]==14975010585 else 55)
  else:assert s["failed"] is None and s["completed"]==s["planned"]
  return [(r["shard"],r["seed"],r["logHash"]) for r in rows],len(b)
all_arts=initial+arts+repair
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 res=list(pool.map(download,all_arts))
old=[r for rs,_ in res[:len(initial)] for r in rs]
new=[r for rs,_ in res[len(initial):] for r in rs]
assert sorted(r[0] for r in old)==[i for i in range(1,1001) if not 427<=i<=456]
assert sorted(r[0] for r in new)==list(range(1,9031))
both=old+new
assert len(both)==10000 and len({r[1] for r in both})==10000 and len({r[2] for r in both})==10000
print("FULL_ENCRYPTED_ARCHIVE_AUDIT="+json.dumps({"status":"PASS","matches":10000,"initial":len(old),"extension":len(new),"archives":len(all_arts),"archive_bytes":sum(n for _,n in res),"archive_sha_crc_cms_hash_mismatch":0,"seed_duplicates":0,"loghash_duplicates":0,"missing_shards":0,"recorded_files":60000,"split":{k:len(parts[k])+(970 if k=="development" else 0) for k in ("qa","development","confirmation")},"scope":"outer archives and summary metadata only; no decryption, independent content validation not performed"},sort_keys=True))

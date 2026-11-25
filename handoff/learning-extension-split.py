import hashlib,json
SALT="mahjong-lab:learning-holdout-s42-extension:20261125:v1"
def order_key(n):
 return hashlib.sha256(f"{SALT}:{n}".encode("utf-8")).hexdigest(),n
def split():
 ids=sorted(range(11,9031),key=order_key)
 holdout=set(ids[:3000])
 result={"schema":"learning-extension-split-v1","namespace":"mahjong-lab:tenhou-corpus-extension-9030:20261125:v1","salt":SALT,"qa":list(range(1,11)),"development":sorted(set(ids)-holdout),"confirmation":sorted(holdout)}
 assert len(result["development"])==6020 and len(result["confirmation"])==3000
 assert sorted(result["qa"]+result["development"]+result["confirmation"])==list(range(1,9031))
 return result
if __name__=="__main__":
 data=split()
 raw=json.dumps(data,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")
 print(json.dumps({"qa":len(data["qa"]),"development":len(data["development"]),"confirmation":len(data["confirmation"]),"canonical_sha256":hashlib.sha256(raw).hexdigest()}))

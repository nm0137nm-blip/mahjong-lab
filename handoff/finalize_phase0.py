"""Finalize controlled Phase 0 ONLY if all frozen technical gates passed.
Archive public synthetic fixtures/traces and final margin evidence. Never publish executable bytes."""
import os,json,hashlib,io,zipfile,sys,urllib.request,urllib.error,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
state_path=ROOT/'handoff/state.json'; state=json.loads(state_path.read_text())
assert state['active_task']['status']=='phase0_margin_gate_running'
assert state['active_task']['run_id']==44680960295
assert state['archive_policy']['public_only'] and not state['archive_policy']['raw_private_data']
assert json.loads((ROOT/'archive/versions/s42-corrected-encoder-v1/rebuild.json').read_text())['status']=='PASS_EXACT_LOCKED_REBUILD'
prev=json.loads((ROOT/'archive/results/phase0-corrected-20261120.json').read_text())
assert prev['regression']['counts']['detail_match']==prev['regression']['counts']['sampled']==317
assert prev['fresh']['counts']['detail_match']==prev['fresh']['counts']['sampled']==445
assert prev['duplicate']['n_matches']==20 and all(b['repeat_exact'] for b in prev['duplicate']['blocks'])
assert prev['variance']['n_matches']==96
api='https://api.github.com/repos/'+state['repository']
headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'}
def read_api(path):
 with urllib.request.urlopen(urllib.request.Request(api+path,headers=headers),timeout=60) as r:return json.load(r)
for rid in (44673093075,44673238225,44677641101,44680960295):
 run=read_api('/actions/runs/'+str(rid))
 assert run['status']=='completed' and run['conclusion']=='success',(rid,run['status'],run['conclusion'])
assert read_api('/actions/runs/44680960295')['head_sha']=='68e4b50f2cc2876a14d4f35ccc0663b3dd082f07'
def sha(b):return hashlib.sha256(b).hexdigest()
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):return None
def get_zip(i,digest):
 req=urllib.request.Request(api+'/actions/artifacts/'+str(i)+'/zip',headers=headers)
 try:
  with urllib.request.build_opener(NoRedirect).open(req,timeout=60) as r:b=r.read()
 except urllib.error.HTTPError as e:
  assert e.code in (301,302,303,307,308) and e.headers['Location'].startswith('https://')
  with urllib.request.urlopen(e.headers['Location'],timeout=120) as r:b=r.read()
 assert sha(b)==digest
 return b
def store(path,b):
 path=ROOT/path;path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():assert path.read_bytes()==b
 else:path.write_bytes(b)
manifest={}
for label,i,dig in [
 ('synthetic-reference',14599480112,'5a5aaee14dfbd43d0b76dd304f665956a5085a6b8116c0005085994115175ea6'),
 ('corrected-live-1',14601221248,'9d459ae2fdd6f520d1647877b786cb06095b4c9d2618837f83475787ea8dd2a7'),
 ('corrected-live-2',14601685274,'17ce27bac8068502cd52ffe117902e5221c565331e47ddc594a42e29d85360a6'),
 ('original-live-1',14599768000,'b1bd7729843a7826f80541b2fc79b07ff6f877c3e0aada0976968376d9480924'),
 ('original-live-2',14600087223,'053cc696c06b8b7cfcd6339ad647e8401515821960219ad99d751ddbe13492bd')]:
 b=get_zip(i,dig);store(pathlib.Path('archive/phase0-synthetic')/(label+'.zip'),b);manifest[label]={'id':i,'sha256':dig}
arts=read_api('/actions/runs/44680960295/artifacts?per_page=100')['artifacts']
for name in ('phase0-margin-final','margin-frozen-threshold','margin-cpu-calibration',*(f'margin-browser-{engine}-{rep}-calibration' for engine in ('chromium','webkit') for rep in (1,2,3))):
 a=[x for x in arts if x['name']==name];assert len(a)==1 and not a[0]['expired']
 a=a[0];digest=a['digest'].removeprefix('sha256:');assert len(digest)==64
 b=get_zip(a['id'],digest);store(pathlib.Path('archive/phase0-synthetic')/(name+'.zip'),b);manifest[name]={'id':a['id'],'sha256':digest}
 if name=='phase0-margin-final':
  with zipfile.ZipFile(io.BytesIO(b)) as z:
   assert z.namelist()==['margin-final.json']
   final=json.loads(z.read('margin-final.json'))
s=final['margin_strata'];cal=final['margin_calibration'];assert cal['calibration_decisions']==100 and cal['executions_per_state']==13 and len(cal['startup_attempts'])==6
assert cal['startup_failures']==sum(x['startup_failures'] for x in cal['startup_attempts'])
assert cal['margin_threshold']==max(1e-7,10*cal['max_pairwise_drift']) and cal['max_pairwise_drift']<=1e-4
assert final['counts']['sampled']==final['counts']['detail_match']==445 and sum(x['n'] for x in s.values())==445
assert s['high']['n']>0 and all(x['n']==x['action_match'] for x in s.values())
assert not final['differences']
out={'status':'phase0_controlled_internal_complete','source_rebuild_run':44677641101,'margin_run':44680960295,'corrected_comparator_commit':'43c99fb1df4e140b35f06f16d4b77247fdc71045','margin_gate':final,'artifact_manifest':manifest,'scope':'local/controlled internal research and development; public release blocked; no native full engine identity or GPU parity claim; only observed action coverage','formal_blocks':160,'formal_matches':1280}
def write_json(path,o): (ROOT/path).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
write_json('archive/results/phase0-final-20261120.json',out)
protocol_path=ROOT/'handoff/formal-protocol-v1.json';protocol=json.loads(protocol_path.read_text());protocol['status']='Phase0 controlled internal complete; public release gate remains blocked';protocol['margin_gate']={'run':44680960295,'max_drift':cal['max_pairwise_drift'],'threshold':cal['margin_threshold'],'strata':s,'scope':final['margin_definition']};write_json('handoff/formal-protocol-v1.json',protocol)
state['completed_tasks']=[*state.get('completed_tasks',[]),{**state['active_task'],'status':'phase0_controlled_internal_complete','results_path':'archive/results/phase0-final-20261120.json'}]
state['active_task']={'status':'phase0_controlled_internal_complete','phase':'0','result_path':'archive/results/phase0-final-20261120.json','next':'Product P1 and research R1 after Phase0 report. Freeze specific data manifests and candidate protocol before new evaluation; public release remains blocked. User requested phase-boundary status and copy/paste or manually typable short external reviewer report.','margin_run':44680960295,'source_archive_run':44677641101};write_json('handoff/state.json',state)
text=f"""\n## Phase 0 内部開発・研究ゲート完了（2026-11-20）
Run 44677641101: Rust固定ソースからJS/WASMのSHA完全一致。Run 44680960295: 合成100局面、13実行参照（既存native CPU参照+6 browser+6 native ONNX CPU）でQ値drift最大 {cal['max_pairwise_drift']:.10g}、閾値 {cal['margin_threshold']:.10g}、高マージン {s['high']['action_match']}/{s['high']['n']}、僅差 {s['near']['action_match']}/{s['near']['n']}、単一候補 {s['forced']['action_match']}/{s['forced']['n']}。別の既存445実戦判断で再集計、独立skill holdoutではない。旧317判断・新規445判断・20 duplicate・96 variance全て合格。正式160ブロック1280半荘維持。利用条件の判断記録を保存し、内部のローカル/管理研究のみ進める。一般公開・再配布は依存ライセンス・NOTICE・旧実行物の対応ソース等の確認完了まで保留。native全ルール同一性・未観測行動・GPUは保証外。WebKit初期化障害の既往あり、今回6反復の起動失敗回数 {cal['startup_failures']}。数値一致は起動可用性の証明ではなく、公開時の別途課題。本番main変更なし。完全な公開適合性を主張しない。
結果: archive/results/phase0-final-20261120.json。次工程P1とR1。\n"""
with (ROOT/'HANDOFF.md').open('a') as f:f.write(text)
print(text)

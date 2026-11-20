import unittest
from formal_v11 import decide,evaluate,KEYS
from seed_manifest_v11 import make
class T(unittest.TestCase):
 def test_interim(self):
  self.assertEqual(decide([20]*160,'interim')['decision'],'continue_same_candidate')
  self.assertEqual(decide([0]*160,'interim')['decision'],'freeze_futility')
 def test_final(self):
  self.assertEqual(decide([15]*320,'final')['decision'],'promote_research')
  self.assertEqual(decide([0]*320,'final')['decision'],'freeze_futility')
  self.assertEqual(decide([0]*160+[28]*160,'final')['decision'],'freeze_inconclusive')
 def test_seed(self):
  m=make({'training_seeds':[],'arena_seeds':[]});a=[s for k,v in m.items() if isinstance(v,dict) for s in v['seeds']]
  self.assertEqual(len(a),808);self.assertEqual(len(set(a)),808)
 def test_identity_and_full_gate(self):
  m=make({'training_seeds':[],'arena_seeds':[]})
  def run(k):
   return {'identity':{x:'a'*64 for x in KEYS},'split':'formal_primary','condition':'s42x3','phase':k,'seed_manifest_sha256':m[k]['sha256'],'blocks':[{'seed':s,'rows':[{'arm':a,'seat':t,'valid':True,'fallbacks':0,'rank':2 if a=='candidate' else 3,'initial_wall_hash':'b'*64,'replay_hash':'c'*64} for a in ('candidate','baseline') for t in range(4)]} for s in m[k]['seeds']]}
  a,b=run('primary_interim'),run('primary_second')
  self.assertEqual(evaluate(a,m,b)['final']['decision'],'promote_research')
  b['identity']['runtime_hash']='b'*64
  with self.assertRaises(AssertionError):evaluate(a,m,b)
  a['blocks'][0]['rows'][0]['fallbacks']=1
  with self.assertRaises(AssertionError):evaluate(a,m)
if __name__=='__main__':unittest.main()

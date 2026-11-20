import unittest,numpy as np
from p1_outer_metrics import paired,prob_eval,rank_eval,payment_eval
class T(unittest.TestCase):
 def test_paired(self):
  x=paired([2]*40,[3]*40,list(range(40)),['s42']*40,draws=100)
  self.assertEqual(x['estimate'],-1);self.assertEqual(x['ci95'],[-1,-1])
 def test_insufficient(self):
  x=[dict(y=i%2,p=.5,baseline=.5,seed=1,family='s42') for i in range(200)]
  self.assertFalse(prob_eval(x)['supported']);self.assertFalse(prob_eval(x)['pass'])
 def test_calibrated(self):
  x=[dict(y=i%2,p=.5,baseline=.6,seed=i//10,family='s42') for i in range(400)]
  self.assertTrue(prob_eval(x)['pass'])
  for r in x:r['p']=.8
  self.assertFalse(prob_eval(x)['pass'])
 def test_rank(self):
  x=[dict(y=i,p=i,baseline=.5,seed=s,family='s42',id=str(j),seat=1) for s in range(40) for j in range(3) for i in (0,1)]
  self.assertTrue(rank_eval(x)['pass'])
 def test_payment(self):
  x=[dict(loss=8000,p=.2,baseline=.1,mean=8000,lo=7000,hi=9000,seed=s,family='s42') for s in range(40) for i in range(4)]
  self.assertTrue(payment_eval(x,dict(payment_median=4000,payment_mean=5000,legal_ron_frequency=.01))['pass'])
if __name__=='__main__':unittest.main()

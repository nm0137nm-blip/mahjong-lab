import unittest,math
from p1_metrics import *

class Metrics(unittest.TestCase):
    def test_perfect(self):
        m=binary_metrics([0,1],[0.,1.]);self.assertEqual(m['brier'],0);self.assertEqual(m['log_loss'],0);self.assertEqual(m['auprc_ap'],1)
    def test_tie(self):
        self.assertEqual(binary_metrics([0,1],[.5,.5])['auprc_ap'],.5)
        self.assertEqual(within_decision_auc([1,0],[.5,.5],['a','a'])['macro_auc'],.5)
    def test_rank(self):
        r=within_decision_auc([0,1,0,0],[.1,.9,.2,.3],['a','a','b','b'])
        self.assertEqual(r,{'mixed_sets':1,'all_sets':2,'macro_auc':1.})
    def test_bins(self):
        r=reliability([0,1],[0,1],['a','b']);self.assertEqual((r[0]['n'],r[9]['n']),(1,1));self.assertFalse(r[9]['supported'])
    def test_loss(self):
        r=payment_metrics([1,0],[.5,.25],[8000,None],[8000,4000]);self.assertEqual(r['conditional_mae'],0);self.assertAlmostEqual(r['exposure_rmse'],math.sqrt(8500000))
    def test_contract(self):
        validate_probability_contract(1,0,1,0)
        for a,b in [(.1,.2),(math.nan,0),(.5,-.1)]:
            with self.assertRaises(ValueError):validate_probability_contract(a,b)
        with self.assertRaises(ValueError):validate_probability_contract(.9,0,1,0)
    def test_bad_input(self):
        with self.assertRaises(ValueError):binary_metrics([1],[math.inf])
        with self.assertRaises(ValueError):payment_metrics([0],[.1],[8000],[8000])
        with self.assertRaises(ValueError):payment_metrics([1],[.1],[None],[8000])
if __name__=='__main__':unittest.main()

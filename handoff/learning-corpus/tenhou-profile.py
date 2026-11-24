"""Research-only Tenhou four-player red hanchan profile, applied to disposable engine copy.
Source: https://tenhou.net/man/#RULE, rules/4-player ranked.
No production HTML mutation. The upstream implementation is not a Tenhou server.
"""
import json
from pathlib import Path
PROFILE_ID='tenhou-ranked-4p-red-hanchan-v1'
RULE={'配給原点':25000,'順位点':['20.0','10.0','-10.0','-20.0'],'連風牌は2符':False,'赤牌':{'m':1,'p':1,'s':1},'クイタンあり':True,'喰い替え許可レベル':0,'場数':2,'途中流局あり':True,'流し満貫あり':True,'ノーテン宣言あり':False,'ノーテン罰あり':True,'最大同時和了数':2,'連荘方式':2,'トビ終了あり':True,'オーラス止めあり':True,'オーラス単独トップ止め':False,'延長戦方式':2,'一発あり':True,'裏ドラあり':True,'カンドラあり':True,'カン裏あり':True,'カンドラ後乗せ':True,'ツモ番なしリーチあり':False,'リーチ後暗槓許可レベル':2,'役満の複合あり':True,'ダブル役満あり':False,'数え役満あり':True,'役満パオあり':True,'切り上げ満貫あり':False,'Tenhou研究ルール':True}
def apply(path):
 p=Path(path);s=p.read_text()
 def replace(a,b):
  nonlocal s
  assert s.count(a)==1, 'patch anchor changed: '+a[:100]
  s=s.replace(a,b)
 replace("selectedRule = M.rule({'配給原点':25000,'赤牌':{m:1,p:1,s:1},'場数':Number(mode),'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true,'順位点':['0.0','0.0','0.0','0.0']});", 'selectedRule = M.rule('+json.dumps(RULE,ensure_ascii=False,separators=(',',':'))+');')
 # Match the engine's start-seat tiebreak in the result overlay.
 replace("for(let i=0;i<4;i++)if(projected[i]>topScore){top=i;topScore=projected[i];}","for(let k=0;k<4;k++){let i=(model.qijia+k)%4;if(projected[i]>topScore){top=i;topScore=projected[i];}}")
 # Pao covers all combined yakuman and honba in Tenhou.
 replace("base2   = 8000 * Math.min(h.fanshu.length, damanguan);","base2   = param.rule['Tenhou研究ルール'] ? base : 8000 * Math.min(h.fanshu.length, damanguan);")
 replace("fenpei[baojia]  -= defen + chang * 300;","""fenpei[baojia]  -= defen;
        fenpei[param.rule['Tenhou研究ルール'] && baojia2 != null ? baojia2 : baojia] -= chang * 300;""")
 # For consecutive open kan -> kakan, don't expose the prior delayed indicator during chankan response.
 # If no ron is accepted, expose that prior indicator immediately before the new rinshan draw.
 replace("        if (this._gang) this.kaigang();\n\n        this._gang = gang;","""        this._tenhouPriorKan = !!(this._rule['Tenhou研究ルール'] && this._gang && !gang.match(/^[mpsz]\\d{4}$/));
        if (this._gang && !this._tenhouPriorKan) this.kaigang();

        this._gang = gang;""")
 replace("        this._gang  = null;\n\n        this._lizhi", "        this._gang  = null;\n        this._tenhouPriorKan = false;\n\n        this._lizhi")
 replace("""        if (this._hule.length) {
            return this.delay(()=>this.hule());
        }

        this.delay(()=>this.gangzimo(), 0);""","""        if (this._rule['Tenhou研究ルール'] && this._hule.length == 3 && this._rule['最大同時和了数'] == 2) {
            let shoupai = ['','','',''];
            for (let l of this._hule) shoupai[l] = model.shoupai[l].toString();
            return this.delay(()=>this.pingju('三家和', shoupai));
        }
        if (this._hule.length) {
            return this.delay(()=>this.hule());
        }

        if (this._tenhouPriorKan) {
            let current = this._gang;
            this.kaigang();
            this._gang = current;
            this._tenhouPriorKan = false;
        }
        this.delay(()=>this.gangzimo(), 0);""")
 p.write_text(s)
if __name__=='__main__':
 import sys
 apply(sys.argv[1])
 Path(sys.argv[2]).write_text(json.dumps(RULE,ensure_ascii=False,indent=2)+'\n')

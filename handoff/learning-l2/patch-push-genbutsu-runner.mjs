// Research-only patch; apply to the pinned corpus runner before its normal collector patches.
// The caller runs baseline/alternative in separate fresh processes with the same seed/dealer.
// No private receipt is exported before match completion. Actual live S42 replay still required.
export function chooseIntervention(plan,index,choice,forced,opts,request,M){
 if(index!==plan.decisionIndex)return null;
 if(forced||!['baseline','alternative'].includes(plan.mode))throw Error('L2 push invalid intervention');
 const s=request.scene;
 if(request.phase!=='turn'||!s||s.pendingReach||s.rivers[s.ownSeat].riichi||s.selfMelds.length||s.hand.length!==14||!s.drawn)throw Error('L2 push scope');
 const threats=s.rivers.filter(r=>r.riichi);if(threats.length!==1)throw Error('L2 push threat count');
 const turn=s.ownDiscards+1,band=turn<=6?'early':turn<=12?'mid':'late';if(band!==plan.band)throw Error('L2 push band');
 const norm=p=>p.slice(0,2).replace('0','5'),safe=new Set(threats[0].discards.map(d=>norm(d.tile)));
 if([...opts.keys()].some(a=>!Number.isInteger(a)||a<0||a>=37))throw Error('L2 push special action');
 const legal=[...opts].flatMap(([action,rows])=>rows.filter(p=>Object.keys(p).length===1&&/^(?:[mps][0-9]|z[1-7])_?$/.test(p.dapai)).map(payload=>({action,payload,grouped:rows.length>1})));
 // Concrete payload is authoritative.
 const concrete=legal.filter(x=>x.payload.dapai===choice.payload.dapai);
 if(concrete.length!==1||safe.has(norm(choice.payload.dapai)))throw Error('L2 push source action');
 const cards=s.hand.slice(),at=cards.lastIndexOf(s.drawn);if(at<0)throw Error('L2 push draw missing');cards.splice(at,1);
 const h=new M.Shoupai(cards);h.zimo(s.drawn);const discards=h.get_dapai();
 const sh=p=>{if(!discards.includes(p))throw Error('L2 push illegal discard');const t=h.clone();t.dapai(p);return M.Util.xiangting(t);};
 if(sh(choice.payload.dapai)!==1)throw Error('L2 push source shanten');
 const alts=legal.filter(x=>safe.has(norm(x.payload.dapai))).map(x=>({...x,shanten:sh(x.payload.dapai)})).sort((a,b)=>a.shanten-b.shanten||(a.payload.dapai<b.payload.dapai?-1:a.payload.dapai>b.payload.dapai?1:0));
 if(!alts.length||alts[0].shanten<=1)throw Error('L2 push no strict hand break');
 const selected=plan.mode==='baseline'?concrete[0]:alts[0];
 return {action:selected.action,payload:selected.payload,grouped:selected.grouped};
}
export function patchPinnedRunner(source) {
 const line=source.split('\n').find(v=>v.startsWith('const patch='));
 if(!line||!line.endsWith(';'))throw Error('L2 pinned runner patch not found');
 let inner=JSON.parse(line.slice('const patch='.length,-1));
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('L2 anchor mismatch');return s.replace(a,b)};
 const inject=`
  let l2Plan=null,l2Receipt=null;
  window.__l2Configure=plan=>{
    if(l2Plan||!game||gameEnded||arenaCount!==0||!Number.isSafeInteger(plan?.decisionIndex)||plan.decisionIndex<1)throw Error('L2 configuration');
    l2Plan=JSON.parse(JSON.stringify(plan));l2Receipt=null;
  };
  window.__l2Receipt=()=>{
    if(!gameEnded||!l2Plan||!l2Receipt)throw Error('L2 receipt before successful completion');
    return JSON.parse(JSON.stringify(l2Receipt));
  };
  `+chooseIntervention.toString()+`
`;
 inner=once(inner,'  async function arenaExecute(choice,forced,prior=null,publicInput=null){\n',inject+'  async function arenaExecute(choice,forced,prior=null,publicInput=null){\n');
 inner=once(inner,'    const p=choice.payload,index=decisionLog.length+1;\n',`    const index=decisionLog.length+1;
    if(l2Plan&&index===l2Plan.decisionIndex){
      if(l2Receipt)throw Error('L2 intervention repeated');
      const c=captureCoachChoices(pending),opts=arenaOptions(c);
      if(c.phase!=='turn')throw Error('L2 non-turn intervention');
      const scene=captureS42Scene();
      const request=arenaBlind({scene,legalChoices:c,candidates:candidateInfo},M,'d-'+index);
      const selected=chooseIntervention(l2Plan,index,choice,forced,opts,request,M);
      if(!selected)throw Error('L2 missing choice');
      const b=game.model;
      // Audit-only data, inaccessible to any policy request and not returned until completion.
      l2Receipt=JSON.parse(JSON.stringify({decisionIndex:index,actorSeat:ownSeat(),mode:l2Plan.mode,
        policyOriginal:choice.payload,applied:selected.payload,publicRequest:request,
        legalPayloads:[...opts.values()].flat(),
        prefix:game._paipu.log,rule:game._rule,
        state:{hands:b.shoupai.map(h=>h.toString()),rivers:b.he.map(h=>h._pai),scores:b.defen,playerIds:b.player_id,
          round:[b.zhuangfeng,b.jushu,b.changbang,b.lizhibang,b.lunban],
          wall:b.shan._pai,dora:b.shan.baopai,remaining:b.shan.paishu,
          riichi:game._lizhi,ippatsu:game._yifa,ron:game._neng_rong,kans:game._n_gang,firstDraw:game._diyizimo}}));
      publicInput=request;choice=selected;
    }
    const p=choice.payload;
`);
 let out=once(source,line,'const patch='+JSON.stringify(inner)+';');
 out=once(out,'   let last=\'\',lastAt=Date.now();','   const l2Plan=JSON.parse(fs.readFileSync(process.env.L2_PLAN_FILE,"utf8"));\n   await page.evaluate(p=>window.__l2Configure(p),l2Plan);\n   let last=\'\',lastAt=Date.now();');
 out=once(out,"   fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));","   fs.writeFileSync('/tmp/development/l2-receipt.json',JSON.stringify(await page.evaluate(()=>window.__l2Receipt())));\n   fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));");
 return out;
}

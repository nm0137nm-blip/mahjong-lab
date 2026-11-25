// Research-only patch; apply to the pinned corpus runner before its normal collector patches.
// The caller runs baseline/alternative in separate fresh processes with the same seed/dealer.
// No private receipt is exported before match completion. Actual live S42 replay still required.
export function chooseIntervention(plan, index, choice, forced, opts) {
 if(index!==plan.decisionIndex)return null;
 if(forced||!choice.payload?.dapai||choice.payload.dapai!==plan.originalAction.dapai)throw Error("L2 source action did not reproduce");
 const original=plan.originalAction.dapai;
 if(!/^(?:[mps][0-9]|z[1-7])_?\*$/.test(original)||plan.alternativeAction.dapai!==original.slice(0,-1)||!['baseline','alternative'].includes(plan.mode))throw Error("L2 invalid paired plan");
 const desired=plan.mode==='baseline'?original:plan.alternativeAction.dapai;
 const candidates=[...opts].flatMap(([action,rows])=>rows.filter(p=>Object.keys(p).length===1&&p.dapai===desired).map(payload=>({action,payload,grouped:rows.length>1})));
 if(candidates.length!==1||((candidates[0].action===37)!==(plan.mode==='baseline')))throw Error("L2 target not uniquely legal");
 return candidates[0];
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
      if(scene.rivers.some(r=>r.riichi)||scene.pendingReach)throw Error('L2 not first riichi');
      const request=arenaBlind({scene,legalChoices:c,candidates:candidateInfo},M,'d-'+index);
      // CI plan contains commitments only; derive concrete actions in private runtime.
      if(!l2Plan.originalAction){const p=choice.payload?.dapai;if(!p?.endsWith('*'))throw Error('L2 original was not riichi');l2Plan.originalAction={dapai:p};l2Plan.alternativeAction={dapai:p.slice(0,-1)};}
      const selected=chooseIntervention(l2Plan,index,choice,forced,opts);
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

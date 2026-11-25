// Empirical selected-action conditional prototype. Never call this a causal estimate.
const K=['和了','放銃','被ツモ','横移動','流局'];
const norm=p=>p.slice(0,2).replace('0','5');
const LEVELS=[[0,1,2,3,4,5,6,7,8,9,10],[0,1,2,3,4,5,6,7,8,9],[0,1,2,3,4,5,6,7,9],[0,1,2,4,5,7,9],[0,1,2,4,7,9],[0,1,2,7,9],[0,1,2,9]];
const names=['向聴','巡目帯','他家立直数','親子','門前/副露','受け入れ帯','保持ドラ','現物性','牌種','立直宣言','他家最大副露数'];
export function candidateFeatures(s,a,reach){
 const own=s.ownSeat,r=s.rivers,t=norm(a.打牌),sh=Math.min(3,a.向聴),u=a.受け入れ;
 if(!Number.isInteger(sh)||sh<0||!Number.isInteger(u)||u<0||!Number.isInteger(a.保持ドラ翻)||!a.形と和了条件)throw Error('候補特徴不足');
 const th=[0,1,2,3].filter(i=>i!==own&&r[i].riichi),safe=th.filter(i=>r[i].discards.some(d=>norm(d.tile)===t)).length;
 const ub=Number(u>(sh===0?4:12))+Number(u>(sh===0?8:24));
 return [sh,Math.min(2,Math.floor(s.ownDiscards/6)),Math.min(2,th.length),Number(own===0),Number(!a.形と和了条件.門前),ub,Math.min(3,a.保持ドラ翻),!th.length?'none':safe===th.length?'safe':safe?'partial':'unsafe',t[0]==='z'?'honor':('19'.includes(t[1])?'edge':'middle'),Number(reach),Math.min(2,Math.max(...r.filter((_,i)=>i!==own).map(x=>x.melds.length)))];
}
export function makeRoundEVQuery(p){
 if(p?.schema!=='round-ev-prototype-v1'||JSON.stringify(p.levels)!==JSON.stringify(LEVELS)||p.cells?.length!==7||p.rows!==11788||p.matches!==100)throw Error('データ形式が違います');
 for(const g of p.cells)for(const a of Object.values(g)){
  if(!Array.isArray(a)||a.length!==4||!Number.isInteger(a[0])||a[0]<50||!Number.isInteger(a[3])||a[3]<20||a[3]>100||a[3]>a[0]||a[1]?.length!==5||a[2]?.length!==5||a[1].some(x=>!Number.isInteger(x)||x<0)||a[1].reduce((x,y)=>x+y,0)!==a[0]||a[2].some((x,i)=>!Number.isSafeInteger(x)||(!a[1][i]&&x)))throw Error('集計データ不整合');
 }
 return f=>{
  if(!Array.isArray(f)||f.length!==11)return null;
  for(let j=0;j<LEVELS.length;j++){
   const l=LEVELS[j],k=l.map(i=>f[i]).join('|'),a=p.cells[j][k];if(!a)continue;
   const rows=K.map((label,i)=>({label,count:a[1][i],prob:a[1][i]/a[0],mean:a[1][i]?a[2][i]/a[1][i]:null,contribution:a[2][i]/a[0]}));
   return {n:a[0],matches:a[3],level:j,conditions:l.map(i=>names[i]),rows,ev:a[2].reduce((x,y)=>x+y,0)/a[0]};
  }return null;
 };
}
export function showRoundEV({scene,candidates,legalChoices,pack,query,root,tileName}){
 root.replaceChildren();
 const el=(tag,t)=>{const x=document.createElement(tag);x.textContent=t;return x;};
 root.append(el('p','試作：1068局・11,788回の実打牌を条件別に集計した参考値。未選択打牌の因果効果・人間卓の確率は未検証。'));
 if(!scene||scene.mode!=='半荘'||scene.pendingReach||scene.rivers[scene.ownSeat].riichi){root.append(el('p','半荘・自家未立直の通常打牌が対象です。'));return;}
 const byTile=new Map(candidates.map(a=>[a.打牌,a]));
 const entries=(legalChoices.discards||[]).flatMap(p=>[{p,reach:false},...((legalChoices.riichiDiscards||[]).includes(p)?[{p,reach:true}]:[])]);
 const select=el('select','');select.style.maxWidth='100%';
 const results=entries.map(({p,reach})=>{let q=null;const a=byTile.get(p);try{if(a)q=query(candidateFeatures(scene,a,reach));}catch{}return {p,reach,q};});
 for(const [i,x] of results.entries()){const o=el('option',tileName(x.p)+(x.reach?' 立直':'')+(x.q?'　参考 '+Math.round(x.q.ev)+'点':'　標本不足'));o.value=String(i);select.append(o);}
 if(!results.length){root.append(el('p','対象候補なし'));return;}
 root.append(select);const detail=el('div','');root.append(detail);
 const draw=()=>{detail.replaceChildren();const x=results[Number(select.value)],q=x?.q;if(!q){detail.append(el('p','参考値を計算できる標本がありません。'));return;}
  detail.append(el('p','類似実打牌 '+q.n+'件 / '+q.matches+'半荘。集計条件：'+q.conditions.join('・')+(q.level?'（一部の条件を緩和）':''));
  const table=el('table','');table.style.cssText='width:100%;border-collapse:collapse;font-size:14px';
  const row=values=>{const tr=el('tr','');for(const v of values){const td=el('td',v);td.style.cssText='padding:5px;border-bottom:1px solid #8885';tr.append(td);}table.append(tr);};
  row(['結果','観測割合','平均得失点','寄与']);
  const pt=v=>v===null?'未観測':(v>=0?'+':'')+Math.round(v).toLocaleString('ja-JP');
  for(const r of q.rows)row([r.label,(100*r.prob).toFixed(1)+'% ('+r.count+')',pt(r.mean),pt(r.contribution)]);
  detail.append(table,el('h3','参考局収支 '+pt(q.ev)+'点'),el('p','供託を含む判断時点から局清算までの点棒増減。0件の条件付き平均は未定義。標本不足や候補間の小差から優劣を断定しないでください。'));
 };
 select.addEventListener('change',draw);draw();
}

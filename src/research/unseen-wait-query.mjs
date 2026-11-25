import {classifyStructuralWaits} from './classify-waits.mjs';
const check=(v,m='invalid public wait input')=>{if(!v)throw Error(m)};
const tile=p=>typeof p==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(p);
const ix=p=>'mpsz'.indexOf(p[0])*9+(+p[1]||5)-1;
const blank=()=>Array(34).fill(0);
function add(a,p){check(tile(p));a[ix(p)]++}
function counts(s){const a=blank();for(const m of s.matchAll(/[mpsz]\d+/g))for(const n of m[0].slice(1))add(a,m[0][0]+n);return a}
export function publicUnseenWaits(M,scene,candidate){
 check(Array.isArray(scene.hand)&&scene.hand.every(tile)&&tile(scene.drawn));
 check(Array.isArray(scene.rivers)&&scene.rivers.length===4&&Number.isInteger(scene.ownSeat)&&scene.ownSeat>=0&&scene.ownSeat<4);
 check(/^(?:[mps][0-9]|z[1-7])_?$/.test(candidate));
 const pub=blank();
 // Own pre-discard hand + previous public tiles = own remaining hand + public tiles after candidate discard.
 for(const p of scene.hand)add(pub,p);
 for(const r of scene.rivers){
  check(Array.isArray(r.discards)&&Array.isArray(r.melds));
  for(const d of r.discards)add(pub,d.tile); // called tile is still counted here.
  for(const m of r.melds){
   check(typeof m==='string'&&M.Shoupai.valid_mianzi(m)===m);
   const tiles=[...m.matchAll(/\d/g)].map(x=>m[0]+x[0]);
   if(/[+=-]/.test(m)){
    const c=m.match(/(\d)[+=-]/);check(c);const j=tiles.indexOf(m[0]+c[1]);check(j>=0);tiles.splice(j,1);
   }
   for(const p of tiles)add(pub,p);
  }
 }
 check(Array.isArray(scene.dora)&&scene.dora.length>=1&&scene.dora.length<=5);
 for(const p of scene.dora)add(pub,p);
 check(pub.every(v=>v>=0&&v<=4),'physical public count');
 check(Array.isArray(scene.selfMelds)&&JSON.stringify(scene.selfMelds)===JSON.stringify(scene.rivers[scene.ownSeat].melds));
 check(scene.selfMelds.every(m=>/^[mpsz]\d{4}$/.test(m))&&scene.hand.length+3*scene.selfMelds.length===14);
 const own=scene.hand.slice(),j=own.lastIndexOf(scene.drawn);check(j>=0);own.splice(j,1);
 const h=new M.Shoupai(own);h._fulou=scene.selfMelds.slice();h.zimo(scene.drawn);
 check(h.get_dapai().includes(candidate),'illegal candidate');h.dapai(candidate);
 const parts=h.toString().split(','),r=classifyStructuralWaits(counts(parts[0]),counts(parts.slice(1).join(',')),parts.length-1);check(r.waits.length>0,'not tenpai');
 const unseen=r.waits.reduce((n,w)=>n+4-pub[w.tile],0);
 return Object.freeze({unseen,unseenBand:unseen<=2?'0–2':unseen<=4?'3–4':unseen<=6?'5–6':'7+',shape:r.ryanmenOnly?'ryanmen_only':r.anyRyanmen?'mixed':'no_ryanmen'});
}
const shapes=['ryanmen_only','mixed','no_ryanmen',null],bands=['early','mid','late',null],unseenBands=['0–2','3–4','5–6','7+'];
const key=(role,unseenBand,shape,band)=>JSON.stringify([role,unseenBand,shape,band]);
export function makeUnseenQuery(data){
 check(data?.schema==='l1-v6-visible-unseen-waits-v1'&&data.meta?.matches===970&&data.meta?.rows===7711&&data.bootstrap===2000,'aggregate version');
 check(Array.isArray(data.cells)&&data.cells.length===54,'aggregate cells');
 const idx=new Map();
 for(const c of data.cells){
  check(['first','chase'].includes(c.role)&&unseenBands.includes(c.unseenBand)&&shapes.includes(c.shape)&&bands.includes(c.band)&&!(c.shape!==null&&c.band!==null),'invalid stratum');
  check([c.n,c.matches,c.hands].every(Number.isSafeInteger)&&c.n>=c.hands&&c.hands>=c.matches&&c.matches>0&&c.matches<=970,'invalid counts');
  const k=key(c.role,c.unseenBand,c.shape,c.band);check(!idx.has(k),'duplicate stratum');
  const out={};
  for(const m of ['win','deal','tsumo']){
   const x=c.metrics[m];check(x&&Number.isSafeInteger(x.numerator)&&x.numerator>=0&&x.numerator<=c.n&&x.denominator===c.n&&Math.abs(x.value-100*x.numerator/c.n)<=.000051,'invalid ratio');
   check(Array.isArray(x.ci95)&&x.ci95.length===2&&x.ci95.every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&x.ci95[0]<=x.ci95[1]&&typeof x.supported==='boolean','invalid CI');
   const ok=x.supported&&c.matches>=100&&c.hands>=200&&x.numerator>=10&&c.n-x.numerator>=10&&x.ci95[1]-x.ci95[0]<=10;
   out[m]=Object.freeze(ok?{status:'supported',pct:x.value,ci95:Object.freeze([...x.ci95])}:{status:'insufficient_support'});
  }
  idx.set(k,Object.freeze({n:c.n,matches:c.matches,hands:c.hands,metrics:Object.freeze(out)}));
 }
 for(const role of ['first','chase']){
  let n=0;for(const u of unseenBands){const a=idx.get(key(role,u,null,null));check(a,'missing marginal');n+=a.n;
   for(const axis of ['shape','band']){const levels=axis==='shape'?shapes.slice(0,-1):bands.slice(0,-1);check(levels.reduce((sum,v)=>sum+(idx.get(key(role,u,axis==='shape'?v:null,axis==='band'?v:null))?.n??0),0)===a.n,'partition count mismatch')}
  }check(n===(role==='first'?6147:1564),'role total mismatch');
 }
 return (f,mode,timing)=>{
  check(['coach','self','assessment'].includes(mode)&&['during','after'].includes(timing),'invalid timing');
  if(mode==='assessment'&&timing==='during')return {status:'disabled'};
  check(f&&Object.keys(f).sort().join('|')==='band|role|shape|unseenBand'&&['first','chase'].includes(f.role)&&unseenBands.includes(f.unseenBand)&&shapes.includes(f.shape)&&bands.includes(f.band)&&!(f.shape!==null&&f.band!==null),'invalid query');
  const c=idx.get(key(f.role,f.unseenBand,f.shape,f.band));
  return c?{status:'descriptive_only',...c}:{status:'no_exact_cell'};
 };
}

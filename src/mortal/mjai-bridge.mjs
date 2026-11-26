/* Mortal MJAI adapter for Majiang readable event packets, no wall/game.model access.
 * Intentional fail-closed boundaries: any unsupported meld aborts S42 scoring, not play.
 * Copyright 2026 Mahjong LAB contributors. Upstream Rust library is AGPL-3.0-or-later.
 */
const WINDS=['E','S','W','N','P','F','C'];
const suit=s=>s==='m'?'m':s==='p'?'p':s==='s'?'s':s==='z'?'z':null;
export function toMjai(p){
  if(p==='?'||p===''||p==null)return '?';
  const s=suit(p[0]),n=p[1];
  if(!s||!n)throw Error('Invalid tile '+String(p));
  if(s==='z'){
    if(!/^[1-7]$/.test(n))throw Error('Invalid honor');
    return WINDS[Number(n)-1];
  }
  if(!/^[0-9]$/.test(n))throw Error('Invalid numeric tile');
  return n==='0'?'5'+s+'r':n+s;
}
export function handToMjai(hand){
  if(typeof hand!=='string')throw Error('Hand must be a string');
  const arr=[],re=/([mpsz])([0-9]+)/g;let m;
  while((m=re.exec(hand)))for(const n of m[2])arr.push(toMjai(m[1]+n));
  if(arr.length!==13)throw Error('Expected 13 concealed tiles; got '+arr.length);
  return arr;
}
export function splitMeld(m){
  if(!/^[mpsz]/.test(m))throw Error('Invalid meld');
  const a=[];const s=m[0];
  for(let i=1;i<m.length;i++){
    if(/[0-9]/.test(m[i])){
      const called=/[+\-=]/.test(m[i+1]||'');
      a.push({tile:toMjai(s+m[i]),called});
    }else if(!/[+\-=]/.test(m[i]))throw Error('Unsupported meld character');
  }
  if(a.length<3||a.length>4)throw Error('Unsupported meld length');
  if(a.filter(x=>x.called).length>1)throw Error('Multiple claimed tiles');
  return a;
}
export class MortalMjaiBridge {
  constructor(){this.seat=null;this.oya=0;this.lastDiscard=null;this.pendingReach=null;this.round=false;}
  // Majiang messages are in CURRENT wind order; MJAI IDs must remain fixed
  // from East 1, including tie-breaking rank priority.
  actor(l){if(!Number.isInteger(l)||l<0||l>3)throw Error('Invalid wind seat');return (l+this.oya)%4;}
  rotateScores(values){if(!Array.isArray(values))return undefined;const out=Array(4);for(let i=0;i<4;i++)out[this.actor(i)]=values[i];return out;}
  receive(packet){
    if(!packet||typeof packet!=='object')throw Error('Invalid packet');
    const events=[];
    if(packet.kaiju){this.seat=null;this.round=false;this.lastDiscard=null;return {events,reset:false};}
    if(packet.qipai){
      const q=packet.qipai;
      const l=q.shoupai.findIndex(x=>typeof x==='string'&&x.length>0);
      if(l<0||l>3)throw Error('Cannot determine private seat');
      if(!Number.isInteger(q.jushu)||q.jushu<0||q.jushu>3)throw Error('Invalid round');
      this.oya=q.jushu;this.seat=this.actor(l);this.round=true;this.lastDiscard=null;this.pendingReach=null;
      const hands=Array.from({length:4},()=>Array(13).fill('?'));
      hands[this.seat]=handToMjai(q.shoupai[l]);
      const scores=Array(4);for(let i=0;i<4;i++)scores[this.actor(i)]=q.defen[i];
      events.push({type:'start_game',names:['Player 0','Player 1','Player 2','Player 3']});
      events.push({type:'start_kyoku',bakaze:WINDS[q.zhuangfeng],dora_marker:toMjai(q.baopai),
         kyoku:q.jushu+1,honba:q.changbang,kyotaku:q.lizhibang,oya:this.oya,scores,tehais:hands});
      return {events,reset:true,seat:this.seat};
    }
    if(!this.round||this.seat===null)return {events,reset:false};
    const item=packet.zimo||packet.gangzimo;
    const type=packet.zimo?'zimo':packet.gangzimo?'gangzimo':null;
    if(this.pendingReach!==null && (type||packet.fulou||packet.gang)) {
      events.push({type:'reach_accepted',actor:this.pendingReach});this.pendingReach=null;
    }
    if(item) {
      events.push({type:'tsumo',actor:this.actor(item.l),pai:toMjai(item.p)});
      this.lastDiscard=null;
    } else if(packet.dapai){
      const d=packet.dapai;
      if(d.p.includes('*'))events.push({type:'reach',actor:this.actor(d.l)});
      const event={type:'dahai',actor:this.actor(d.l),pai:toMjai(d.p),tsumogiri:d.p.includes('_')};
      events.push(event);this.lastDiscard={actor:event.actor,pai:event.pai};
      if(d.p.includes('*'))this.pendingReach=event.actor;
    } else if(packet.fulou){
      const f=packet.fulou,tiles=splitMeld(f.m),claimed=tiles.find(t=>t.called);
      if(!claimed||!this.lastDiscard)throw Error('Cannot map open meld');
      const consumed=tiles.filter(t=>!t.called).map(t=>t.tile);
      let kind;
      if(tiles.length===4)kind='daiminkan';
      else if(new Set(tiles.map(t=>t.tile.replace('r',''))).size===1)kind='pon';
      else kind='chi';
      if(claimed.tile.replace('r','')!==this.lastDiscard.pai.replace('r',''))throw Error('Claimed tile mismatch');
      events.push({type:kind,actor:this.actor(f.l),target:this.lastDiscard.actor,pai:claimed.tile,consumed});
      this.lastDiscard=null;
    } else if(packet.gang){
      const g=packet.gang,tiles=splitMeld(g.m);
      const kind=tiles.some(x=>x.called)?'kakan':'ankan';
      const all=tiles.map(x=>x.tile);
      if(all.length!==4)throw Error('Kan requires 4 tiles');
      events.push(kind==='ankan'?{type:kind,actor:this.actor(g.l),consumed:all}:{type:kind,actor:this.actor(g.l),pai:all[3],consumed:all.slice(0,3)});
      this.lastDiscard=null;
    } else if(packet.kaigang){
      events.push({type:'dora',dora_marker:toMjai(packet.kaigang.baopai)});
    } else if(packet.hule){
      const h=packet.hule;
      events.push({type:'hora',actor:this.actor(h.l),target:this.actor(h.baojia==null?h.l:h.baojia),deltas:this.rotateScores(h.fenpei)});
      events.push({type:'end_kyoku'});this.round=false;this.pendingReach=null;
    } else if(packet.pingju){
      events.push({type:'ryukyoku',deltas:this.rotateScores(packet.pingju.fenpei)});
      events.push({type:'end_kyoku'});this.round=false;this.pendingReach=null;
    } else if(packet.jieju){
      events.push({type:'end_game'});this.round=false;
    }
    return {events,reset:false,seat:this.seat};
  }
}

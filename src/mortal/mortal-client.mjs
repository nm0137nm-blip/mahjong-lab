/* Device-local Mortal-S42 bridge.
 * Reads ONLY the human's visible Majiang game messages.
 * Does not transmit hands, rounds, scores, ONNX weights, or private identifiers.
 */
import {MortalMjaiBridge,toMjai} from './mjai-bridge.mjs';
import initEncoder from '../../assets/mortal/encoder.js';

const EXPECTED_HASH='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4';
const EXPECTED_SIZE=43673425;
// User-initiated, one-time download from the published ONNX model repository.
// The SHA-256 check below is mandatory, even if the hosting URL changes.
export const MODEL_URL='https://huggingface.co/xzhe121/Mortal-S42-onnx/resolve/main/model.onnx?download=true';
const STORAGE='mahjong-lab-s42-local-weights';
const VERIFIED_MODEL_URL='https://huggingface.co/xzhe121/Mortal-S42-onnx/resolve/main/model.onnx?download=true';
const ACTIONS=['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','4p','5p','6p','7p','8p','9p',
 '1s','2s','3s','4s','5s','6s','7s','8s','9s','E','S','W','N','P','F','C','5mr','5pr','5sr'];
const HONORS={E:'東',S:'南',W:'西',N:'北',P:'白',F:'發',C:'中'};
export function labelAction(index){
  if(index>=0&&index<37){
    const tile=ACTIONS[index];
    if(!tile)return null;
    const red=tile.endsWith('r');
    const base=tile[1];
    return '打 '+(HONORS[tile]||tile[0]+({m:'萬',p:'筒',s:'索'}[base]||''))+(red?'（赤）':'');
  }
  return ({37:'リーチ',38:'チー（下）',39:'チー（中）',40:'チー（上）',41:'ポン',42:'カン',43:'和了',44:'九種九牌',45:'スルー'})[index]||null;
}
export function actionToMajiangTile(index){
  if(index<0||index>=37)return null;
  const tile=ACTIONS[index];
  const honor={E:'z1',S:'z2',W:'z3',N:'z4',P:'z5',F:'z6',C:'z7'};
  return honor[tile]||(tile[1]+' '+(tile.endsWith('r')?'0':tile[0])).replace(' ','');
}
function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(STORAGE,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('files');
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>resolve(req.result);
  });
}
async function getStored(){
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readonly'),req=tx.objectStore('files').get('s42');
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
async function putStored(file){
  const db=await openDB();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');
    tx.objectStore('files').put(file,'s42');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export class MortalClient {
  constructor({onStatus=()=>{},onOpinion=()=>{}}={}){
    this.onStatus=onStatus;this.onOpinion=onOpinion;
    this.bridge=new MortalMjaiBridge();this.wasm=null;this.state=0;
    this.worker=null;this.workerReady=false;this.pending=new Map();
    this.serial=0;this.decision=0;this.current=null;this.currentPhase=null;this.lastEligiblePhase=null;
    this.eventQueue=[];this.broken=false;this.encoderPromise=null;
  }
  status(msg){this.onStatus(msg);}
  async loadEncoder(){
    if(this.encoderPromise)return this.encoderPromise;
    this.encoderPromise=(async()=>{
      this.wasm=await initEncoder(new URL('../../assets/mortal/encoder_bg.wasm',import.meta.url));
      const queue=this.eventQueue.splice(0);
      for(const p of queue)this._feed(p);
      this.status(this.workerReady?'Mortal-S42 準備完了':'局面変換器の準備完了');
    })().catch(e=>{this.broken=true;this.status('局面変換器の起動に失敗: '+String(e.message||e));throw e;});
    return this.encoderPromise;
  }
  _feed(packet){
    if(this.broken)return;
    try{
      const {events,reset,seat}=this.bridge.receive(packet);
      if(reset){
        if(this.state)this.wasm.drop_state(this.state);
        this.state=this.wasm.new_state(seat);
        if(!this.state)throw Error('局面初期化に失敗');
      }
      if(!this.state)return;
      for(const ev of events){
        const bytes=new TextEncoder().encode(JSON.stringify(ev)),p=this.wasm.alloc_bytes(bytes.length);
        if(!p)throw Error('局面データの確保に失敗');
        try{
          new Uint8Array(this.wasm.memory.buffer,p,bytes.length).set(bytes);
          const res=this.wasm.apply_event(this.state,p,bytes.length);
          if(res<0)throw Error('非対応の局面通知 '+ev.type+' ('+res+')');
          if(res===1){
            const phase=ev.type==='dahai'?'reaction':
              ['tsumo','chi','pon','daiminkan','ankan','kakan'].includes(ev.type)?'turn':null;
            this.lastEligiblePhase=phase;
            if(this.workerReady)this.evaluate(phase);
          }
        }finally{this.wasm.free_bytes(p,bytes.length);}
      }
    }catch(e){
      this.broken=true;this.status('S42解析停止：対局は従来どおり続行できます');
      console.warn('Mortal局面変換を安全停止:',e.message||e);
    }
  }
  ingest(packet){
    if(this.broken)return;
    if(!this.wasm){
      if(this.eventQueue.length>800){this.broken=true;this.status('S42初期化が間に合いませんでした');return;}
      this.eventQueue.push(JSON.parse(JSON.stringify(packet)));
    }else this._feed(packet);
  }
  async verifyFile(file){
    if(!file||file.size!==EXPECTED_SIZE)throw Error('正しいMortal-S42モデルを選択してください（43.7MB）');
    if(!crypto?.subtle)throw Error('安全な通信環境（HTTPS）が必要です');
    const bytes=await file.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hex!==EXPECTED_HASH)throw Error('モデルのSHA-256が公開値と一致しません');
    return bytes;
  }
  async importModel(file){
    this.status('モデルを検証中...');
    try{
      const bytes=await this.verifyFile(file);
      await putStored(file);
      await this.initWorker(bytes);
    }catch(e){this.status('S42モデルの読込失敗: '+String(e.message||e));throw e;}
  }
  async downloadModel(){
    this.status('S42モデルを取得中（約43.7MB）…');
    try{
      const response=await fetch(MODEL_URL,{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const total=Number(response.headers.get('content-length'))||EXPECTED_SIZE;
      if(total>50_000_000)throw Error('配布ファイルが大きすぎます');
      let bytes;
      if(response.body?.getReader){
        const reader=response.body.getReader(),chunks=[];
        let received=0;
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          received+=value.byteLength;
          if(received>50_000_000)throw Error('配布ファイルが大きすぎます');
          chunks.push(value);
          this.status('S42モデルを取得中 '+Math.min(100,Math.floor(received/total*100))+'%（43.7MB）');
        }
        bytes=new Blob(chunks,{type:'application/octet-stream'});
      }else bytes=await response.blob();
      const file=new File([bytes],'model.onnx',{type:'application/octet-stream'});
      await this.importModel(file);
    }catch(e){
      this.status('自動取得に失敗しました。モデルファイルを手動選択してください：'+String(e.message||e));
      throw e;
    }
  }
  async downloadModel(){
    if(this.downloading)throw Error('モデルを取得中です');
    this.downloading=true;
    this.status('公開済みS42モデルを取得中（約44MB）...');
    try{
      const res=await fetch(VERIFIED_MODEL_URL,{mode:'cors'});
      if(!res.ok||res.type==='opaque')throw Error('配布元に接続できません（HTTP '+res.status+'）');
      const length=Number(res.headers.get('content-length'));
      if(length>0&&length!==EXPECTED_SIZE)throw Error('公開モデルのサイズが検証値と異なります');
      let bytes;
      if(res.body?.getReader){
        const reader=res.body.getReader(),chunks=[];let loaded=0,lastPercent=-10;
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          loaded+=value.byteLength;
          if(loaded>EXPECTED_SIZE)throw Error('モデルが想定サイズを超えました');
          chunks.push(value);
          const percent=Math.floor(loaded/EXPECTED_SIZE*100);
          if(percent-lastPercent>=10){lastPercent=percent;this.status('S42モデル取得中 '+Math.min(percent,100)+'%');}
        }
        if(loaded!==EXPECTED_SIZE)throw Error('取得サイズが不一致です');
        bytes=new Uint8Array(loaded);
        let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
      }else{
        bytes=new Uint8Array(await res.arrayBuffer());
      }
      if(bytes.byteLength!==EXPECTED_SIZE)throw Error('S42ファイルのサイズが不正です');
      const file=new File([bytes],'model.onnx',{type:'application/octet-stream'});
      await this.importModel(file);
      return true;
    }catch(e){this.status('S42取得失敗：モデルファイルの手動選択をお試しください（'+String(e.message||e)+'）');throw e;}
    finally{this.downloading=false;}
  }
  async restoreModel(){
    try{
      const file=await getStored();
      if(file){this.status('保存済みモデルを再確認中...');const bytes=await this.verifyFile(file);await this.initWorker(bytes);return true;}
      this.status('S42未設定：モデルファイルを読み込んでください');return false;
    }catch(e){this.status('保存モデルの再読込失敗。モデルを再選択してください');return false;}
  }
  initWorker(bytes){
    if(this.worker)this.worker.terminate();
    this.workerReady=false;
    this.worker=new Worker(new URL('./mortal-worker.mjs',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{
      if(data?.type==='ready'){
        this.workerReady=true;this.status('Mortal-S42 準備完了（端末内推論）');
        // A model loaded mid-turn must evaluate the CURRENT legal actions too.
        this.evaluate(this.lastEligiblePhase);
        return;
      }
      if(data?.type==='error'){
        this.status('S42推論エラー：'+String(data.reason||'内部エラー').slice(0,120));
        this.pending.delete(data.id);return;
      }
      if(data?.type==='result'){
        const info=this.pending.get(data.id);this.pending.delete(data.id);
        if(!info)return;
        const {best,q,legal,elapsed}=data;
        if(!legal[best])return;
        const opinion={id:info.decision,best,label:labelAction(best),tile:actionToMajiangTile(best),
          qBest:Number(q[best]),elapsed,source:'Mortal-S42',
          qLegal:q.map((v,i)=>legal[i]&&Number.isFinite(Number(v))?Number(v):null)};
        this.current=opinion;this.onOpinion(opinion);
      }
    };
    this.worker.onerror=e=>{this.workerReady=false;this.status('S42推論ワーカーの起動に失敗');console.warn('S42 worker',e);};
    const id=++this.serial;
    this.worker.postMessage({type:'init',id,model:bytes},[bytes]);
    this.status('Mortal-S42 モデルを読み込み中...');
  }
  activeDecision(phase){
    return this.workerReady&&this.currentPhase===phase?this.decision:null;
  }
  evaluate(phase=null){
    if(!this.state||!this.workerReady||this.broken)return null;
    const obs=this.wasm.alloc_bytes(1012*34*4),mask=this.wasm.alloc_bytes(46);
    if(!obs||!mask)return null;
    try{
      if(this.wasm.encode_state(this.state,obs,mask)!==0)return null;
      const data=new Float32Array(new Float32Array(this.wasm.memory.buffer,obs,1012*34).slice());
      const legal=new Uint8Array(new Uint8Array(this.wasm.memory.buffer,mask,46).slice());
      if(!legal.some(x=>x))return null;
      const id=++this.serial,decision=++this.decision;
      this.currentPhase=phase;
      this.current=null;
      this.pending.set(id,{decision});
      if(this.pending.size>10){this.pending.clear();this.status('S42推論が追いつきません。通常コーチを継続します');return null;}
      this.worker.postMessage({type:'eval',id,obs:data,mask:legal},[data.buffer,legal.buffer]);
      return decision;
    }catch(e){this.status('S42局面評価に失敗しました');return null;}
    finally{this.wasm.free_bytes(obs,1012*34*4);this.wasm.free_bytes(mask,46);}
  }
}

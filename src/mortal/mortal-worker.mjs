/* Device-local S42 inference worker.
 * No analytics, remote endpoints, external game state transmission or billing.
 * Requires explicit user-provided model.onnx; no automatic model download.
 */
import * as ort from '../../assets/ort/ort.min.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths=new URL('../../assets/ort/',import.meta.url).href;
let session=null,working=false;
const MAX_BYTES=45_000_000;
function fail(reason,id){
  self.postMessage({type:'error',id,reason:String(reason).slice(0,230)});
}
self.addEventListener('message',async ({data})=>{
  if(!data||typeof data!=='object')return;
  const id=data.id;
  if(data.type==='init'){
    if(working)return fail('モデルの読込処理中',id);
    working=true;
    try{
      if(!(data.model instanceof ArrayBuffer)||data.model.byteLength<40_000_000||data.model.byteLength>MAX_BYTES)
        throw Error('モデルファイルのサイズが不正です');
      const opt={executionProviders:['wasm'],graphOptimizationLevel:'all',enableCpuMemArena:true};
      if(session)await session.release();
      session=await ort.InferenceSession.create(new Uint8Array(data.model),opt);
      if(session.inputNames.join(',')!=='obs,mask'||session.outputNames.join(',')!=='q')throw Error('予期しないモデルの入出力');
      self.postMessage({type:'ready',id});
    }catch(e){session=null;fail(e.message||e,id);}
    finally{working=false;}
  }else if(data.type==='eval'){
    if(!session)return fail('モデルが読み込まれていません',id);
    if(working)return fail('処理中',id);
    working=true;
    try{
      const obs=data.obs, mask=data.mask;
      if(!(obs instanceof Float32Array)||obs.length!==1012*34||
         !(mask instanceof Uint8Array)||mask.length!==46)throw Error('局面情報の形式が不正です');
      const start=performance.now();
      const inputs={obs:new ort.Tensor('float32',obs,[1,1012,34]),mask:new ort.Tensor('bool',mask,[1,46])};
      const out=await session.run(inputs);
      const q=out.q.data;
      if(!q||q.length!==46)throw Error('出力数が一致しません');
      let best=-1,max=-Infinity;
      for(let i=0;i<46;i++){if(!mask[i])continue;const v=Number(q[i]);if(v>max){max=v;best=i;}}
      if(best<0||!Number.isFinite(max))throw Error('有効な合法手がありません');
      self.postMessage({type:'result',id,best,elapsed:Math.round(performance.now()-start),q:Array.from(q,Number),legal:Array.from(mask,Number)});
    }catch(e){fail(e.message||e,id);}
    finally{working=false;}
  }
});

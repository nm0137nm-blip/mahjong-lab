/*
 * Tiny incremental SHA-256 implementation (FIPS 180-4).
 * Fallback for Safari/WebKit when WebCrypto rejects a large model digest.
 * Operates locally; no model bytes are transmitted or logged.
 */
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
export class SHA256 {
  constructor(){
    this.h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.block=new Uint8Array(64);this.words=new Uint32Array(64);
    this.used=0;this.length=0;this.finished=false;
  }
  compress(){
    const w=this.words,b=this.block,h=this.h;
    for(let i=0;i<16;i++){
      const j=i*4;w[i]=((b[j]<<24)|(b[j+1]<<16)|(b[j+2]<<8)|b[j+3])>>>0;
    }
    for(let i=16;i<64;i++){
      const a=w[i-15],z=w[i-2];
      const s0=rotr(a,7)^rotr(a,18)^(a>>>3);
      const s1=rotr(z,17)^rotr(z,19)^(z>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b0,c,d,e,f,g,h0]=h;
    for(let i=0;i<64;i++){
      const s1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h0+s1+ch+K[i]+w[i])>>>0;
      const s0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=(a&b0)^(a&c)^(b0&c);
      const t2=(s0+maj)>>>0;
      h0=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b0;b0=a;a=(t1+t2)>>>0;
    }
    const v=[a,b0,c,d,e,f,g,h0];
    for(let i=0;i<8;i++)h[i]=(h[i]+v[i])>>>0;
  }
  update(bytes){
    if(this.finished)throw Error('SHA256 already finished');
    if(!(bytes instanceof Uint8Array))throw TypeError('SHA256 needs Uint8Array');
    this.length+=bytes.length;
    for(let pos=0;pos<bytes.length;){
      const n=Math.min(64-this.used,bytes.length-pos);
      this.block.set(bytes.subarray(pos,pos+n),this.used);
      this.used+=n;pos+=n;
      if(this.used===64){this.compress();this.used=0;}
    }
    return this;
  }
  hex(){
    if(this.finished)throw Error('SHA256 already finished');
    const bits=BigInt(this.length)*8n;
    this.block[this.used++]=128;
    if(this.used>56){
      this.block.fill(0,this.used);
      this.compress();this.used=0;
    }
    this.block.fill(0,this.used,56);
    const view=new DataView(this.block.buffer);
    view.setUint32(56,Number((bits>>32n)&0xffffffffn),false);
    view.setUint32(60,Number(bits&0xffffffffn),false);
    this.compress();this.finished=true;
    return Array.from(this.h,x=>x.toString(16).padStart(8,'0')).join('');
  }
}
/** Verify a large already loaded Uint8Array without large additional allocations. */
export async function sha256Fallback(bytes){
  if(!(bytes instanceof Uint8Array))throw TypeError('Expected Uint8Array');
  const h=new SHA256(),chunk=1024*1024;
  for(let offset=0;offset<bytes.length;offset+=chunk){
    h.update(bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));
    // Yield to Safari's event loop periodically to keep UI responsive.
    if(offset&&offset%(chunk*4)===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return h.hex();
}

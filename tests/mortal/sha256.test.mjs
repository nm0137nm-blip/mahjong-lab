import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SHA256,sha256Fallback} from '../../src/mortal/sha256.mjs';

const expected=bytes=>createHash('sha256').update(bytes).digest('hex');

test('FIPS 180-4 official SHA-256 vectors (empty, abc)',()=>{
  assert.equal(new SHA256().hex(),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const abc=new TextEncoder().encode('abc');
  assert.equal(new SHA256().update(abc).hex(),'ba7816bf8f01cfea414140de5dae2223b00361f20015ad');
});
test('incremental SHA-256 matches Node crypto on all padding boundaries',()=>{
  for(const size of [1,3,55,56,63,64,65,119,120,127,128,129,1023,1024,5000,65537]){
    const data=Uint8Array.from({length:size},(_,i)=>(i*73+19)%256);
    const sha=new SHA256();
    for(let i=0;i<size;i+=17)sha.update(data.subarray(i,i+17));
    assert.equal(sha.hex(),expected(data),'size='+size);
  }
});
test('large model-sized buffer digest works incrementally without WebCrypto',async()=>{
  const n=43_673_425,bytes=new Uint8Array(n);
  for(let i=0;i<n;i++)bytes[i]=(i*31+i%103)%256;
  assert.equal(await sha256Fallback(bytes),expected(bytes));
});

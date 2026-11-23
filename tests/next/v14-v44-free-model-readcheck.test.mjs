import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeModelRead,diagnose} from './v14-v44-free-model-readcheck.mjs';
test('only safe model metadata reported',()=>{
 const got=summarizeModelRead(200,{id:'gpt-6-sol',object:'model',secret:'leak'});
 assert.equal(got.readableModel,true);
 assert.ok(!JSON.stringify(got).includes('leak'));
 assert.equal(got.tokenGenerationRequests,0);
 const error=summarizeModelRead(429,{error:{type:'insufficient_quota',code:'project_spend_limit_exceeded',message:'SECRET'}});
 assert.equal(error.errorCode,'project_spend_limit_exceeded');
 assert.equal(error.errorType,'insufficient_quota');
 assert.ok(!JSON.stringify(error).includes('SECRET'));
});
test('GET-only, no generation or key disclosure',async()=>{
 let observed;
 const ret=await diagnose({OPENAI_API_KEY:'FAKE_VALUE_FOR_TEST'},async(url,opts)=>{
  observed={url,method:opts.method,auth:opts.headers.Authorization};
  return {status:200,json:async()=>({object:'model',id:'gpt-6-sol'})};
 });
 assert.equal(observed.url,'https://api.openai.com/v1/models/gpt-6-sol');
 assert.equal(observed.method,'GET');
 assert.equal(ret.tokenGenerationRequests,0);
 assert.ok(!JSON.stringify(ret).includes('FAKE_VALUE_FOR_TEST'));
});

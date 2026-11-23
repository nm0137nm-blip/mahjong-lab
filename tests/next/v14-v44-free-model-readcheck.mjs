// Free, read-only authorization/model visibility diagnosis.
// Absolutely NO Responses API POST; never sends a generation request or spends tokens.
// Only status and allowlisted error fields are output. No key, prompts or body logging.
const safeToken=x=>typeof x==='string'&&/^[a-z0-9_-]{1,64}$/.test(x)?x:null;
export function summarizeModelRead(status,body) {
  return {
    check:'GET /v1/models/gpt-6-sol (metadata only)',
    httpStatus:status,
    readableModel:status===200&&body?.object==='model'&&body?.id==='gpt-6-sol',
    errorType:safeToken(body?.error?.type),
    errorCode:safeToken(body?.error?.code),
    tokenGenerationRequests:0,
    noBillingGenerationCalls:true
  };
}
export async function diagnose(env=process.env,fetchImpl=fetch){
  if(!env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY not supplied');
  const resp=await fetchImpl('https://api.openai.com/v1/models/gpt-6-sol',{
    method:'GET',
    headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY},
    signal:AbortSignal.timeout(15000)
  });
  let body={};
  try {body=await resp.json();} catch {}
  const result=summarizeModelRead(resp.status,body);
  console.log('SAFE_READ_ONLY_MODEL_CHECK',JSON.stringify(result));
  return result;
}
if(process.argv[1]?.endsWith('v14-v44-free-model-readcheck.mjs')){
  diagnose().catch(e=>{
    console.error('MODEL_CHECK_FAILED',e?.name==='TimeoutError'?'TIMEOUT':'CONNECTION_OR_SETUP_ERROR');
    process.exitCode=1;
  });
}

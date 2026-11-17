const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   const rows=[
    {mode:1,rank:1,score:32200,hands:5,wins:2,dealIns:0,openHands:1,riichiHands:2,tsumoWins:1,winPoints:8900,
     s42:{version:'S42-relative-Q-v1',count:10,agreements:6,suspected:3,index:77}},
    {mode:1,rank:2,score:27700,hands:6,wins:1,dealIns:1,openHands:1,riichiHands:1,tsumoWins:0,winPoints:1300},
    {mode:2,rank:3,score:17800,hands:9,wins:1,dealIns:2,openHands:4,riichiHands:1,tsumoWins:0,winPoints:1000,
     s42:{version:'S42-relative-Q-v1',count:20,agreements:10,suspected:8,index:60}}
   ];
   localStorage.setItem('mahjonglab-measured-v2',JSON.stringify(rows));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  let text=await page.locator('#homeS42Stats').innerText();
  if(!text.includes('77/100')||!text.includes('60.0%')||!text.includes('30.0%'))throw Error('East S42 stats wrong: '+text);
  if(!text.includes('10打牌'))throw Error('East analyzed count wrong: '+text);
  await page.locator('#statsHalf').click();
  text=await page.locator('#homeS42Stats').innerText();
  if(!text.includes('60/100')||!text.includes('50.0%')||!text.includes('40.0%'))throw Error('Hanchan stats wrong: '+text);
  await page.locator('#statsEast').click();
  text=await page.locator('#homeS42Stats').innerText();
  if(!text.includes('77/100'))throw Error('Mode filter lost');
  const old=await page.locator('#homeStats').innerText();
  if(!old.includes('2'))throw Error('Old score data not preserved');
  console.log('S42_HOME_STATS_SEED_PASS='+JSON.stringify({east:'77/100 60% 30%',half:'60/100 50% 40%',old:old.slice(0,70),errors}));
  if(errors.length)throw Error(JSON.stringify(errors));
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exit(1)});

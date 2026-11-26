import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/');
 await page.evaluate(()=>{
 localStorage.setItem('mahjonglab-measured-v2',JSON.stringify([{mode:1,rank:1,score:40000,hands:1}]));
 localStorage.setItem('mahjonglab-measured-tenhou-v1',JSON.stringify([{mode:1,ruleProfile:'tenhou-target-4p-red-v1',room:'houou',dan:7,rank:4,rankPt:-90,score:1000,hands:5}]));
 });
 await page.reload();
 await page.locator('#tenhouRoom').selectOption('houou');
 assert.equal(await page.locator('#tenhouDan').inputValue(),'7');
 assert.match(await page.locator('#detailStats').innerText(),/-90 pt/);
 await page.locator('#tenhouDan').selectOption('8');
 assert.match(await page.locator('#detailStats').innerText(),/0 pt/);
 await page.locator('#tenhouRoom').selectOption('tokujou');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mahjonglab-measured-v2')).length),1);
 await page.locator('input[name="length"][value="2"]').check();
 await page.locator('#startBtn').click();
 await page.locator('#gameScreen:not(.hidden)').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Tenhou profile mobile viewport selection and legacy-record isolation PASS');
}finally{await browser.close();}

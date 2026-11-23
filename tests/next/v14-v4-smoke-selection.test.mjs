import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectV4ProspectiveSmoke} from '../../src/coach/v14-v4-smoke-selection.mjs';
const all=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
test('proposed independent 8-case panel excludes already-answered pilot48 and keeps category quotas',()=>{
 if(!all.length)return;
 const a=selectV4ProspectiveSmoke(all),b=selectV4ProspectiveSmoke(all);
 assert.deepEqual(a,b);
 assert.equal(a.selectedIds.length,8);
 assert.equal(new Set(a.selectedIds).size,8);
 assert(!a.selectedIds.includes('pilot-48'));
 assert.equal(a.categories.reach.length,2);
 assert.equal(a.categories.callOrPass.length,2);
 assert.deepEqual(a.categories.ron,['pilot-63']);
 assert.equal(a.categories.discard.length,3);
 assert.equal(a.actualNewModelCalls,0);
 assert(a.cases.every(x=>x.status==='NOT_YET_RUN'));
});
test('selection cannot silently mutate input or drift to invalid public freeze',()=>{
 if(!all.length)return;
 const corrupt=structuredClone(all);corrupt[0].requestHash='tampered';
 assert.throws(()=>selectV4ProspectiveSmoke(corrupt),/source public hash mismatch/);
 const dup=structuredClone(all);dup[1].request.input.id=dup[0].request.input.id;
 assert.throws(()=>selectV4ProspectiveSmoke(dup),/frozen input order/);
});

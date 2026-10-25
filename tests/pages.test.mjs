import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePages } from '../scripts/prepare-pages.mjs';
import { workerHarness } from './helpers/service-worker.mjs';
import { airframe, aircraft, newFlight } from '../dist/src/profiles.js';
import { calculate } from '../dist/src/calculate.js';
import { serialize, restore, STORAGE_KEY } from '../dist/src/storage.js';

async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'balance-pages-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const sourceDir=path.join(root,'dist'),outputDir=path.join(root,'pages');
  await cp(fileURLToPath(new URL('../dist/',import.meta.url)),sourceDir,{recursive:true});
  return {root,sourceDir,outputDir};
}

async function snapshot(directory,prefix='') {
  const files={};
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const name=prefix+entry.name;
    if(entry.isDirectory())Object.assign(files,await snapshot(path.join(directory,entry.name),name+'/'));
    else files[name]=await readFile(path.join(directory,entry.name));
  }
  return files;
}

test('Pages artifact contains only dist files, changes only the staged worker and preserves all source bytes',async t=>{
  const f=await fixture(t),before=await snapshot(f.sourceDir);
  await writeFile(path.join(f.root,'private-settings.txt'),'Must never be published');
  const result=await preparePages(f),output=await snapshot(f.outputDir);
  assert.deepEqual(Object.keys(output).sort(),Object.keys(before).sort());
  assert.equal(result.fileCount,Object.keys(before).length);
  assert.match(result.version,/^balance-flight-sha256-[a-f0-9]{64}$/);
  for(const name of Object.keys(before)){
    if(name==='sw.js')assert.ok(output[name].toString().includes(`const CACHE = '${result.version}';`));
    else assert.deepEqual(output[name],before[name],name);
  }
  assert.deepEqual(await snapshot(f.sourceDir),before);
});

test('identical resources yield the same cache version and a changed resource produces a fresh clean artifact',async t=>{
  const f=await fixture(t);
  const first=await preparePages(f),second=await preparePages(f);
  assert.equal(first.version,second.version);
  await writeFile(path.join(f.outputDir,'obsolete.txt'),'old release');
  await writeFile(path.join(f.sourceDir,'styles.css'),'/* new release */\n'+await readFile(path.join(f.sourceDir,'styles.css'),'utf8'));
  const changed=await preparePages(f);
  assert.notEqual(changed.version,first.version);
  assert.ok(!('obsolete.txt' in await snapshot(f.outputDir)));
});

test('artifact build rejects overlapping source/output and unsupported links',async t=>{
  const f=await fixture(t);
  await assert.rejects(preparePages({...f,outputDir:f.sourceDir}),/must not overlap/);
  await assert.rejects(preparePages({...f,outputDir:path.join(f.sourceDir,'pages')}),/must not overlap/);
  await symlink(path.join(f.root,'private-settings.txt'),path.join(f.sourceDir,'linked-file'));
  await assert.rejects(preparePages(f),/links are not allowed/);
});

test('a Pages cache update serves the new release offline without deleting the saved flight',async t=>{
  const f=await fixture(t),baseUrl='https://gva777777.github.io/weight-balance/';
  const input=newFlight(true);input.fuel.remaining=6000;input.flight.number='TEST-123';
  const saved=serialize(input),savedStorage=new Map([[STORAGE_KEY,saved]]),cacheStorage=new Map([['unrelated-cache',new Map()]]);
  const first=await preparePages(f);
  const oldWorker=await workerHarness({sourceDir:f.outputDir,baseUrl,cacheStorage,savedStorage});
  await oldWorker.dispatch('install');await oldWorker.dispatch('activate');
  await writeFile(path.join(f.sourceDir,'styles.css'),'/* release two */\n'+await readFile(path.join(f.sourceDir,'styles.css'),'utf8'));
  const second=await preparePages(f);
  const newWorker=await workerHarness({sourceDir:f.outputDir,baseUrl,cacheStorage,savedStorage});
  await newWorker.dispatch('install');await newWorker.dispatch('activate');newWorker.offline();
  assert.notEqual(first.version,second.version);
  assert.ok(!cacheStorage.has(first.version));assert.ok(cacheStorage.has(second.version));assert.ok(cacheStorage.has('unrelated-cache'));
  assert.equal(savedStorage.get(STORAGE_KEY),saved);
  assert.deepEqual(calculate(restore(savedStorage.get(STORAGE_KEY)),aircraft,airframe),calculate(input,aircraft,airframe));
  const css=await newWorker.dispatch('fetch',{method:'GET',url:baseUrl+'styles.css',mode:'cors'});
  assert.ok((await css.text()).startsWith('/* release two */'));
  const html=await newWorker.dispatch('fetch',{method:'GET',url:baseUrl,mode:'navigate'});
  assert.ok((await html.text()).includes('Balance — вес и центровка'));
});

test('a failed release install leaves the previous complete cache available',async t=>{
  const f=await fixture(t),baseUrl='https://gva777777.github.io/weight-balance/',cacheStorage=new Map();
  const first=await preparePages(f);
  const oldWorker=await workerHarness({sourceDir:f.outputDir,baseUrl,cacheStorage});
  await oldWorker.dispatch('install');await oldWorker.dispatch('activate');
  await writeFile(path.join(f.sourceDir,'styles.css'),'/* failed release */');
  const second=await preparePages(f);
  const failedWorker=await workerHarness({sourceDir:f.outputDir,baseUrl,cacheStorage,failInstall:true});
  await assert.rejects(failedWorker.dispatch('install'));
  assert.ok(cacheStorage.has(first.version));assert.ok(!cacheStorage.has(second.version));
  oldWorker.offline();
  const page=await oldWorker.dispatch('fetch',{method:'GET',url:baseUrl,mode:'navigate'});
  assert.ok((await page.text()).includes('Balance — вес и центровка'));
});

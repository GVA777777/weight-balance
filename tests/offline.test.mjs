import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function workerHarness({failInstall=false}={}) {
  const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  const version=source.match(/const CACHE = '([^']+)'/)[1];
  const handlers={},entries=new Map(),deleted=[];let online=true;
  const cache={
    async addAll(urls){for(const url of urls){if(failInstall&&url.endsWith('app.js'))throw new Error('Missing asset');const file=url==='./'?'index.html':url.slice(2);const content=await readFile(new URL(`../dist/${file}`,import.meta.url));entries.set(new URL(url,'https://balance.test/').href,content.toString());}},
    async match(key){return entries.get(new URL(typeof key==='string'?key:key.url,'https://balance.test/').href);}
  };
  const self={location:{origin:'https://balance.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const caches={open:async()=>cache,keys:async()=>['balance-flight-v0',version,'unrelated-cache'],delete:async key=>{deleted.push(key);return true;}};
  vm.runInNewContext(source,{self,caches,URL,fetch:async()=>{if(!online)throw new Error('Offline');return {ok:true,body:'network'};}});
  return {entries,deleted,handlers,version,offline(){online=false;},async dispatch(type,request){let promise;handlers[type]({request,waitUntil:p=>promise=p,respondWith:p=>promise=p});return promise;}};
}
test('worker precaches every required app asset, including its complete module graph',async()=>{
  const h=await workerHarness();await h.dispatch('install');
  for(const file of ['index.html','styles.css','src/app.js','src/calculate.js','src/graphics.js','src/profiles.js','src/storage.js','src/print.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'])assert.ok(h.entries.has('https://balance.test/'+file),file);
  assert.equal(h.entries.size,13);
  await h.dispatch('activate');assert.deepEqual(h.deleted,['balance-flight-v0']);
});
test('offline navigation and module requests are served from the completed cache',async()=>{
  const h=await workerHarness();await h.dispatch('install');h.offline();
  const html=await h.dispatch('fetch',{method:'GET',url:'https://balance.test/',mode:'navigate'});
  assert.ok(html.includes('Balance — вес и центровка'));
  const js=await h.dispatch('fetch',{method:'GET',url:'https://balance.test/src/calculate.js',mode:'cors'});
  assert.ok(js.includes('distributeRemaining'));
});
test('a failed install deletes its incomplete cache',async()=>{
  const h=await workerHarness({failInstall:true});await assert.rejects(h.dispatch('install'));assert.deepEqual(h.deleted,[h.version]);
});

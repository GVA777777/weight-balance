import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { workerHarness } from './helpers/service-worker.mjs';
test('worker precaches every required app asset, including its complete module graph',async()=>{
  const h=await workerHarness();await h.dispatch('install');
  for(const file of ['index.html','styles.css','src/app.js','src/calculate.js','src/graphics.js','src/profiles.js','src/storage.js','src/print.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'])assert.ok(h.entries.has('https://balance.test/'+file),file);
  assert.equal(h.entries.size,13);
  await h.dispatch('activate');assert.deepEqual(h.deleted,['balance-flight-v0']);
});
test('offline navigation and module requests are served from the completed cache',async()=>{
  const h=await workerHarness();await h.dispatch('install');h.offline();
  const html=await h.dispatch('fetch',{method:'GET',url:'https://balance.test/',mode:'navigate'});
  assert.ok((await html.text()).includes('Balance — вес и центровка'));
  const js=await h.dispatch('fetch',{method:'GET',url:'https://balance.test/src/calculate.js',mode:'cors'});
  assert.ok((await js.text()).includes('distributeRemaining'));
});
test('a failed install deletes its incomplete cache',async()=>{
  const h=await workerHarness({failInstall:true});await assert.rejects(h.dispatch('install'));assert.deepEqual(h.deleted,[h.version]);
});

test('GitHub Pages subpath keeps all cached resources and offline navigation inside the project',async()=>{
  const baseUrl='https://gva777777.github.io/weight-balance/';
  const h=await workerHarness({baseUrl});await h.dispatch('install');
  assert.ok([...h.entries.keys()].every(url=>url.startsWith(baseUrl)));
  assert.ok(h.entries.has(baseUrl+'src/app.js'));
  h.offline();
  const page=await h.dispatch('fetch',{method:'GET',url:baseUrl,mode:'navigate'});
  assert.ok((await page.text()).includes('Balance — вес и центровка'));
  const module=await h.dispatch('fetch',{method:'GET',url:baseUrl+'src/calculate.js',mode:'cors'});
  assert.ok((await module.text()).includes('distributeRemaining'));
});

test('manifest, HTML and worker registration resolve relative to the GitHub Pages project path',async()=>{
  const baseUrl='https://gva777777.github.io/weight-balance/';
  const manifestUrl=new URL('manifest.webmanifest',baseUrl);
  const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
  for(const relative of [manifest.id,manifest.start_url,manifest.scope,...manifest.icons.map(icon=>icon.src)]){
    assert.ok(new URL(relative,manifestUrl).href.startsWith(baseUrl),relative);
  }
  assert.equal(new URL(manifest.scope,manifestUrl).href,baseUrl);
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  for(const [,relative] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    assert.ok(new URL(relative,baseUrl).href.startsWith(baseUrl),relative);
  }
  const app=await readFile(new URL('../dist/src/app.js',import.meta.url),'utf8');
  const registration=app.match(/serviceWorker\.register\('([^']+)'\)/);
  assert.ok(registration,'Service Worker registration is present');
  const workerUrl=new URL(registration[1],baseUrl);
  assert.equal(workerUrl.href,baseUrl+'sw.js');
  assert.equal(new URL('./',workerUrl).href,baseUrl,'Default Service Worker scope stays inside the project');
});

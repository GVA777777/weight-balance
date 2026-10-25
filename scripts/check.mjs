import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
for(const file of await readdir(new URL('../dist/src/',import.meta.url))){
  if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',new URL('../dist/src/'+file,import.meta.url).pathname],{stdio:'inherit'});if(result.status)process.exit(result.status);}
}
const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
for(const icon of manifest.icons)await readFile(new URL('../dist/'+icon.src.replace('./',''),import.meta.url));
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(!/https?:\/\//.test(html),'App shell must not load external resources');
console.log('Syntax, manifest, local icons and self-contained app shell: OK');

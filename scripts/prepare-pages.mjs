import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

async function sourceFiles(directory, prefix = '') {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const relative = prefix + entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute, relative + '/'));
    else if (entry.isFile()) files.push({ relative, data: await readFile(absolute) });
    else throw new Error(`Unsupported publication asset (links are not allowed): ${relative}`);
  }
  return files;
}

/** Prepare only static application files. Never rewrite the source dist directory. */
export async function preparePages({
  sourceDir = path.join(projectRoot, 'dist'),
  outputDir = path.join(projectRoot, 'artifacts', 'pages'),
} = {}) {
  const source = path.resolve(sourceDir);
  const output = path.resolve(outputDir);
  const within = (child, parent) => child === parent || child.startsWith(parent + path.sep);
  if (within(output, source) || within(source, output)) {
    throw new Error('Publication output and source directories must not overlap');
  }

  const files = await sourceFiles(source);
  const worker = files.find(file => file.relative === 'sw.js');
  const declaration = /^const CACHE = '[^']+';$/m;
  if (!worker || !declaration.test(worker.data.toString('utf8'))) {
    throw new Error('sw.js is missing its expected CACHE declaration');
  }
  if (!files.some(file => file.relative === 'index.html')) throw new Error('Missing index.html');

  // Include relative names and binary contents, in deterministic order, including sw.js.
  const hash = createHash('sha256');
  for (const file of files) hash.update(file.relative).update('\0').update(file.data).update('\0');
  const version = `balance-flight-sha256-${hash.digest('hex')}`;
  worker.data = Buffer.from(worker.data.toString('utf8').replace(declaration, `const CACHE = '${version}';`));

  // This is a generated, ignored directory. Remove obsolete files before each release.
  await rm(output, { recursive: true, force: true });
  for (const file of files) {
    const destination = path.join(output, file.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.data);
  }
  return { outputDir: output, version, fileCount: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await preparePages();
  console.log(`Pages artifact: ${result.outputDir}\nFiles: ${result.fileCount}\nOffline cache: ${result.version}`);
}

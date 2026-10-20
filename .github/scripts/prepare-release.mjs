import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [tag, source, destination] = process.argv.slice(2);
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '') || tag.trim() !== tag) {
  throw new Error('Expected a stable semantic version tag such as v1.4.0 or v1.4.1.');
}
if (!source || !destination || source === destination) {
  throw new Error('Provide separate source and release output paths.');
}

const code = readFileSync(source, 'utf8');
const header = code.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==/m);
if (!header || (header[0].match(/^\/\/ @version\s+\S+\s*$/gm) ?? []).length !== 1) {
  throw new Error('Expected exactly one @version in the userscript metadata header.');
}

const version = tag.replace(/^v/, '');
const updatedHeader = header[0].replace(/^(\/\/ @version[^\S\r\n]+)\S+/m, `$1${version}`);
const release = code.replace(header[0], () => updatedHeader);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, release);
console.log(`Prepared ${destination} with @version ${version}`);

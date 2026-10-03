// Bundles the OpenStreetMap scenery worker and copies MapLibre's worker into /flight (bundlers
// otherwise serve worker sources unbundled).
import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await build({entryPoints:['lib/osmWorker.ts'],bundle:true,format:'esm',minify:true,target:'es2020',outfile:'public/flight/osm-worker.js',legalComments:'eof'});
await mkdir('public/flight/maplibre',{recursive:true});
for(const f of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'])await copyFile(`node_modules/maplibre-gl/dist/${f}`,`public/flight/maplibre/${f}`);
console.log('built workers');

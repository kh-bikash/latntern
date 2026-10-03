// Bundles the OpenStreetMap scenery web worker into a static file served from /flight.
import {build} from 'esbuild';
await build({entryPoints:['lib/osmWorker.ts'],bundle:true,format:'esm',minify:true,target:'es2020',outfile:'public/flight/osm-worker.js',legalComments:'eof'});
console.log('built public/flight/osm-worker.js');

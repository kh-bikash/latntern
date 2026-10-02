import {cp,mkdir} from 'node:fs/promises';
const base=new URL('../',import.meta.url),source=new URL('node_modules/cesium/Build/Cesium/',base),destination=new URL('public/cesium/',base);
await mkdir(destination,{recursive:true});
await cp(source,destination,{recursive:true});
for(const name of ['LICENSE.md','ThirdParty.json','ThirdParty.extra.json'])await cp(new URL(`node_modules/cesium/${name}`,base),new URL(`public/cesium/${name}`,base));
console.log('Cesium browser runtime and attribution files refreshed.');

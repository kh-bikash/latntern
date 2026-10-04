// Caching relay for open photogrammetry servers. They speak HTTP/1.1 (six parallel requests per browser), so tiles
// are fetched server-side without that cap, served over HTTP/2 and kept in the CDN; only listed sources are relayed.
const SOURCES:Record<string,string>={
 nrw:'https://www.gis.nrw.de/geobasis/3D_mesh/SceneServer/layers/0',
 sxb:'https://s3.eu-west-2.wasabisys.com/ems-sgct-photomaillage/ODACIT/EMS_PM2022',
};
export async function GET(req:Request,ctx:{params:Promise<{source:string;path?:string[]}>}){
 const {source,path=[]}=await ctx.params,base=SOURCES[source];
 if(!base||path.some(p=>p==='..'||p.includes('\\')))return new Response('Not found',{status:404});
 const url=`${base}${path.length?'/'+path.map(encodeURIComponent).join('/'):''}${new URL(req.url).search}`;
 // tiles never change: the server-side data cache keeps them across deployments (the CDN cache starts empty with each)
 const upstream=await fetch(url,{headers:{'User-Agent':'Hinode-Flight-Simulator'},cache:'force-cache',next:{revalidate:2592000}}).catch(()=>null);
 if(!upstream||!upstream.ok)return new Response('Upstream unavailable',{status:upstream?.status===404?404:502,headers:{'Cache-Control':'public, s-maxage=300'}});
 return new Response(await upstream.arrayBuffer(),{headers:{'Content-Type':upstream.headers.get('Content-Type')??'application/octet-stream',
  'Cache-Control':'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800','Access-Control-Allow-Origin':'*'}});}

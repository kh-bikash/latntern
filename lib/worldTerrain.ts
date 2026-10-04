// Open global elevation (Mapzen Terrarium / SRTM / GMTED / ETOPO) with an ocean water mask and
// MSFS-style airport flattening: runway strips are levelled to the published field elevation so the
// rendered ground, the physics floor and the runway surface agree.
type Flat={lat:number;lon:number;endLat:number;endLon:number;width:number;elev:number};
const flats:Flat[]=[];const flatKeys=new Set<string>();
export function flattenAirport(a:{id:string;elevation:number;runways:{lat:number;lon:number;endLat:number;endLon:number;width:number;length:number}[]}){if(flatKeys.has(a.id))return;flatKeys.add(a.id);for(const r of a.runways.slice(0,8))if(r.length>=150)flats.push({lat:r.lat,lon:r.lon,endLat:r.endLat,endLon:r.endLon,width:Math.max(30,r.width),elev:a.elevation});}
type Tile={heights:Float32Array;water:Uint8Array|null;raw:Float32Array};
const tiles=new Map<string,Promise<Tile>>();
const tileLon=(x:number,n:number)=>x/n*360-180,tileLat=(y:number,n:number)=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
/** Level runway areas inside a height grid of `size`×`size` samples (65-vertex meshes or 256-pixel DEM images). */
function applyFlats(h:Float32Array,x:number,y:number,level:number,size=65,div=64,off=0){const n=2**level,west=tileLon(x,n),east=tileLon(x+1,n),north=tileLat(y,n),south=tileLat(y+1,n),pad=.02;
 const hit=flats.filter(f=>Math.max(f.lat,f.endLat)+pad>south&&Math.min(f.lat,f.endLat)-pad<north&&Math.max(f.lon,f.endLon)+pad>west&&Math.min(f.lon,f.endLon)-pad<east);if(!hit.length)return;
 for(let j=0;j<size;j++){const lat=tileLat(y+(j+off)/div,n),kx=111320*Math.cos(lat*Math.PI/180);for(let i=0;i<size;i++){const lon=west+(east-west)*(i+off)/div;let w=0,target=0;
  for(const f of hit){const dx=(f.endLon-f.lon)*kx,dy=(f.endLat-f.lat)*111320,len=Math.hypot(dx,dy)||1,px=(lon-f.lon)*kx,py=(lat-f.lat)*111320,along=(px*dx+py*dy)/len,cross=Math.abs(px*dy-py*dx)/len;
   const outA=Math.max(0,-along-120,along-len-120),outC=Math.max(0,cross-f.width/2-90),d=Math.hypot(outA,outC),k=d<=0?1:Math.max(0,1-d/380);if(k>w){w=k;target=f.elev;}}
  if(w>0){const p=j*size+i;h[p]=h[p]*(1-w*w*(3-2*w))+target*w*w*(3-2*w);}}}}
const flatsNear=(x:number,y:number,level:number)=>{const n=2**level,west=tileLon(x,n),east=tileLon(x+1,n),north=tileLat(y,n),south=tileLat(y+1,n),pad=.02;return flats.some(f=>Math.max(f.lat,f.endLat)+pad>south&&Math.min(f.lat,f.endLat)-pad<north&&Math.max(f.lon,f.endLon)+pad>west&&Math.min(f.lon,f.endLon)-pad<east);};
/** MapLibre elevation protocol: Terrarium tiles with the sea floor clamped to sea level and airports flattened. */
export function demProtocol(){return async(params:{url:string},abort:AbortController)=>{const [z,x,y]=params.url.replace('flatdem://','').split('/').map(Number),res=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,{signal:abort.signal});if(!res.ok)throw new Error(`dem ${res.status}`);const buf=await res.arrayBuffer();
 const img=await createImageBitmap(new Blob([buf])),cv=new OffscreenCanvas(256,256),cx=cv.getContext('2d',{willReadFrequently:true})!;cx.drawImage(img,0,0);img.close();const data=cx.getImageData(0,0,256,256),px=data.data,n=2**z,midLat=tileLat(y+.5,n),midLon=tileLon(x+.5,n),polder=midLat>51.2&&midLat<53.7&&midLon>3.2&&midLon<7.3,floor=polder?-7:0,sea=polder?-8:-1.2,flat=z>=10&&flatsNear(x,y,z);
 let changed=false;const h=new Float32Array(256*256);for(let k=0;k<h.length;k++){const v=px[k*4]*256+px[k*4+1]+px[k*4+2]/256-32768;h[k]=v<sea?0:Math.max(floor,v);if(h[k]!==v)changed=true;}
 if(flat){applyFlats(h,x,y,z,256,256,.5);changed=true;}if(!changed)return{data:buf};
 for(let k=0;k<h.length;k++){const v=h[k]+32768;px[k*4]=Math.floor(v/256);px[k*4+1]=Math.floor(v)%256;px[k*4+2]=Math.floor((v-Math.floor(v))*256);px[k*4+3]=255;}cx.putImageData(data,0,0);return{data:await (await cv.convertToBlob({type:'image/png'})).arrayBuffer()};};}
export async function terrainTile(x:number,y:number,level:number):Promise<Tile>{const key=`${level}/${x}/${y}`;let known=tiles.get(key);if(known)return known;known=(async()=>{const res=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`);if(!res.ok)throw new Error('Open terrain service is unavailable.');const image=await createImageBitmap(await res.blob()),canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);image.close();const rgba=ctx.getImageData(0,0,256,256).data,heights=new Float32Array(65*65),raw=new Float32Array(65*65);
 const n=2**level,midLat=tileLat(y+.5,n),midLon=tileLon(x+.5,n),polder=midLat>51.2&&midLat<53.7&&midLon>3.2&&midLon<7.3,sea=polder?-8:-1.2;
 for(let j=0;j<65;j++)for(let i=0;i<65;i++){const p=(Math.round(j/64*255)*256+Math.round(i/64*255))*4,v=rgba[p]*256+rgba[p+1]+rgba[p+2]/256-32768;raw[j*65+i]=v;heights[j*65+i]=v<sea?0:Math.max(polder?-7:0,v);}
 let water:Uint8Array|null=null;if(level>=4){let wet=0;const mask=new Uint8Array(256*256);for(let k=0;k<256*256;k++){const v=rgba[k*4]*256+rgba[k*4+1]+rgba[k*4+2]/256-32768;if(v<sea){mask[k]=255;wet++;}}water=wet===0?new Uint8Array([0]):wet===256*256?new Uint8Array([255]):mask;}
 applyFlats(heights,x,y,level);return{heights,water,raw};})();tiles.set(key,known);known.catch(()=>tiles.delete(key));if(tiles.size>220)tiles.delete(tiles.keys().next().value!);return known;}
/** Ground elevation and surface type below a point, sampled from flattened zoom-13 terrain. */
export async function groundInfo(lat:number,lon:number){const l=13,n=2**l,x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n,i=Math.floor(x),j=Math.floor(y),t=await terrainTile(i,j,l),h=t.heights,a=(x-i)*64,b=(y-j)*64,ix=Math.min(63,Math.floor(a)),iy=Math.min(63,Math.floor(b)),u=a-ix,v=b-iy;
 const height=h[iy*65+ix]*(1-u)*(1-v)+h[iy*65+ix+1]*u*(1-v)+h[(iy+1)*65+ix]*(1-u)*v+h[(iy+1)*65+ix+1]*u*v,raw=t.raw[Math.round(b)*65+Math.round(a)];return{height,water:raw<-1.2};}
export async function groundAt(lat:number,lon:number){return(await groundInfo(lat,lon)).height;}
/** Esri World Imagery with overzoom: where the finest level has no imagery, the nearest parent tile is enlarged into
 *  the requested quarter, so the map never shows holes or grey "not available" placeholders. */
export function imageryProtocol(){return async(params:{url:string},abort:AbortController)=>{const [z,x,y]=params.url.replace('esri://','').split('/').map(Number);
 for(let d=0;d<=6&&z-d>=0;d++){const zz=z-d,xx=x>>d,yy=y>>d,res=await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zz}/${yy}/${xx}?blankTile=false`,{signal:abort.signal});
  if(res.status===404)continue;if(!res.ok)throw new Error(`imagery ${res.status}`);const buf=await res.arrayBuffer();if(d===0)return{data:buf};
  const img=await createImageBitmap(new Blob([buf])),s=img.width/2**d,cv=new OffscreenCanvas(256,256),cx=cv.getContext('2d')!;cx.imageSmoothingQuality='high';
  cx.drawImage(img,(x-(xx<<d))*s,(y-(yy<<d))*s,s,s,0,0,256,256);img.close();return{data:await (await cv.convertToBlob({type:'image/jpeg',quality:.92})).arrayBuffer()};}
 throw new Error('no imagery');};}

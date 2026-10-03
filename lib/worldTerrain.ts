import type * as Cesium from 'cesium';
type C=typeof Cesium;
// Open global elevation (Mapzen Terrarium / SRTM / GMTED / ETOPO) with an ocean water mask and
// MSFS-style airport flattening: runway strips are levelled to the published field elevation so the
// rendered ground, the physics floor and the runway surface agree.
type Flat={lat:number;lon:number;endLat:number;endLon:number;width:number;elev:number};
const flats:Flat[]=[];const flatKeys=new Set<string>();
export function flattenAirport(a:{id:string;elevation:number;runways:{lat:number;lon:number;endLat:number;endLon:number;width:number;length:number}[]}){if(flatKeys.has(a.id))return;flatKeys.add(a.id);for(const r of a.runways.slice(0,8))if(r.length>=150)flats.push({lat:r.lat,lon:r.lon,endLat:r.endLat,endLon:r.endLon,width:Math.max(30,r.width),elev:a.elevation});}
type Tile={heights:Float32Array;water:Uint8Array|null;raw:Float32Array};
const tiles=new Map<string,Promise<Tile>>();
const tileLon=(x:number,n:number)=>x/n*360-180,tileLat=(y:number,n:number)=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
function applyFlats(h:Float32Array,x:number,y:number,level:number){const n=2**level,west=tileLon(x,n),east=tileLon(x+1,n),north=tileLat(y,n),south=tileLat(y+1,n),pad=.02;
 const hit=flats.filter(f=>Math.max(f.lat,f.endLat)+pad>south&&Math.min(f.lat,f.endLat)-pad<north&&Math.max(f.lon,f.endLon)+pad>west&&Math.min(f.lon,f.endLon)-pad<east);if(!hit.length)return;
 for(let j=0;j<65;j++){const lat=tileLat(y+j/64,n),kx=111320*Math.cos(lat*Math.PI/180);for(let i=0;i<65;i++){const lon=west+(east-west)*i/64;let w=0,target=0;
  for(const f of hit){const dx=(f.endLon-f.lon)*kx,dy=(f.endLat-f.lat)*111320,len=Math.hypot(dx,dy)||1,px=(lon-f.lon)*kx,py=(lat-f.lat)*111320,along=(px*dx+py*dy)/len,cross=Math.abs(px*dy-py*dx)/len;
   const outA=Math.max(0,-along-120,along-len-120),outC=Math.max(0,cross-f.width/2-90),d=Math.hypot(outA,outC),k=d<=0?1:Math.max(0,1-d/380);if(k>w){w=k;target=f.elev;}}
  if(w>0){const p=j*65+i;h[p]=h[p]*(1-w*w*(3-2*w))+target*w*w*(3-2*w);}}}}
export async function terrainTile(x:number,y:number,level:number):Promise<Tile>{const key=`${level}/${x}/${y}`;let known=tiles.get(key);if(known)return known;known=(async()=>{const res=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`);if(!res.ok)throw new Error('Open terrain service is unavailable.');const image=await createImageBitmap(await res.blob()),canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);image.close();const rgba=ctx.getImageData(0,0,256,256).data,heights=new Float32Array(65*65),raw=new Float32Array(65*65);
 const n=2**level,midLat=tileLat(y+.5,n),midLon=tileLon(x+.5,n),polder=midLat>51.2&&midLat<53.7&&midLon>3.2&&midLon<7.3,sea=polder?-8:-1.2;
 for(let j=0;j<65;j++)for(let i=0;i<65;i++){const p=(Math.round(j/64*255)*256+Math.round(i/64*255))*4,v=rgba[p]*256+rgba[p+1]+rgba[p+2]/256-32768;raw[j*65+i]=v;heights[j*65+i]=v<sea?0:Math.max(polder?-7:0,v);}
 let water:Uint8Array|null=null;if(level>=4){let wet=0;const mask=new Uint8Array(256*256);for(let k=0;k<256*256;k++){const v=rgba[k*4]*256+rgba[k*4+1]+rgba[k*4+2]/256-32768;if(v<sea){mask[k]=255;wet++;}}water=wet===0?new Uint8Array([0]):wet===256*256?new Uint8Array([255]):mask;}
 applyFlats(heights,x,y,level);return{heights,water,raw};})();tiles.set(key,known);known.catch(()=>tiles.delete(key));if(tiles.size>220)tiles.delete(tiles.keys().next().value!);return known;}
export function openTerrain(C:C){const provider=new C.CustomHeightmapTerrainProvider({width:65,height:65,tilingScheme:new C.WebMercatorTilingScheme(),credit:new C.Credit('<a href="https://registry.opendata.aws/terrain-tiles/">Mapzen terrain tiles · SRTM / GMTED / ETOPO1</a>'),callback:()=>undefined as unknown as Float32Array});
 provider.getTileDataAvailable=(_x,_y,l)=>l<=15;Object.defineProperty(provider,'hasWaterMask',{get:()=>true});
 provider.requestTileGeometry=(x,y,level)=>terrainTile(x,y,level).then(t=>new C.HeightmapTerrainData({buffer:t.heights,width:65,height:65,waterMask:t.water??undefined}));return provider;}
/** Ground elevation and surface type below a point, sampled from flattened zoom-13 terrain. */
export async function groundInfo(lat:number,lon:number){const l=13,n=2**l,x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n,i=Math.floor(x),j=Math.floor(y),t=await terrainTile(i,j,l),h=t.heights,a=(x-i)*64,b=(y-j)*64,ix=Math.min(63,Math.floor(a)),iy=Math.min(63,Math.floor(b)),u=a-ix,v=b-iy;
 const height=h[iy*65+ix]*(1-u)*(1-v)+h[iy*65+ix+1]*u*(1-v)+h[(iy+1)*65+ix]*(1-u)*v+h[(iy+1)*65+ix+1]*u*v,raw=t.raw[Math.round(b)*65+Math.round(a)];return{height,water:raw<-1.2};}
export async function groundAt(lat:number,lon:number){return(await groundInfo(lat,lon)).height;}
const credit=(C:C,html:string)=>new C.Credit(html);
export function worldImagery(C:C){return new C.UrlTemplateImageryProvider({url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',maximumLevel:8,credit:credit(C,'<a href="https://earthdata.nasa.gov/">NASA GIBS · Blue Marble</a>')});}
export function sentinelImagery(C:C){return new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:credit(C,'Imagery <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community')});}
/** Higher-resolution open national orthophotos layered over the global mosaic where they exist. */
export function regionalImagery(C:C){const R=(w:number,s:number,e:number,n:number)=>C.Rectangle.fromDegrees(w,s,e,n);return[
 new C.UrlTemplateImageryProvider({url:'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',rectangle:R(122,24,146,46),minimumLevel:5,maximumLevel:18,credit:credit(C,'<a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html">GSI Japan seamless photo</a>')}),
 new C.UrlTemplateImageryProvider({url:'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',rectangle:R(-5.2,41.3,9.6,51.1),minimumLevel:6,maximumLevel:18,credit:credit(C,'<a href="https://geoservices.ign.fr/">IGN-F / Géoplateforme orthophotos</a>')}),
 new C.UrlTemplateImageryProvider({url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',rectangle:R(5.9,45.8,10.5,47.85),minimumLevel:7,maximumLevel:18,credit:credit(C,'<a href="https://www.swisstopo.admin.ch/">© swisstopo SWISSIMAGE</a>')}),
 new C.UrlTemplateImageryProvider({url:'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',rectangle:R(3.3,50.7,7.3,53.6),minimumLevel:6,maximumLevel:18,credit:credit(C,'<a href="https://www.pdok.nl/">PDOK Luchtfoto (Beeldmateriaal Nederland, CC BY 4.0)</a>')}),
];}
export function nightImagery(C:C){return new C.UrlTemplateImageryProvider({url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',maximumLevel:8,credit:credit(C,'<a href="https://earthdata.nasa.gov/">NASA GIBS · VIIRS Black Marble</a>')});}

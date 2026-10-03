// Web worker: turns an OpenMapTiles vector tile (OpenStreetMap data, via OpenFreeMap) into 3D scenery
// meshes in a local east-north-up frame: extruded buildings, forests and airport aprons/taxiways.
import Pbf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import earcut from 'earcut';
type Req={id:string;url:string;x:number;y:number;z:number;terrain:Float32Array|null;buildings:boolean;trees:boolean};
type Bucket={color:[number,number,number];pos:number[];nrm:number[];st:number[]};
const WALLS:[number,number,number][]=[[.86,.84,.8],[.78,.76,.72],[.92,.9,.86],[.7,.7,.7],[.82,.78,.7],[.62,.64,.66],[.9,.86,.78],[.74,.7,.64]];
const ROOFS:[number,number,number][]=[[.42,.42,.44],[.55,.36,.3],[.5,.5,.5],[.36,.38,.4],[.6,.58,.54]];
const TREES:[number,number,number][]=[[.13,.27,.12],[.17,.31,.13],[.11,.22,.1],[.2,.33,.16]];
function hash(n:number){n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return(n^n>>>16)>>>0;}
function rng(seed:number){let s=seed|0||1;return()=>{s=Math.imul(s^s>>>15,2246822507)+0x6d2b79f5|0;return(s>>>0)/4294967296;};}
self.onmessage=async(ev:MessageEvent<Req>)=>{const r=ev.data;try{
 const res=await fetch(r.url);if(!res.ok)throw new Error(`tile ${res.status}`);const tile=new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
 const n=2**r.z,latC=Math.atan(Math.sinh(Math.PI*(1-2*(r.y+.5)/n)))*180/Math.PI,W=40075016.686*Math.cos(latC*Math.PI/180)/n;
 const buckets=new Map<string,Bucket>();const bucket=(c:[number,number,number])=>{const k=c.join();let b=buckets.get(k);if(!b){b={color:c,pos:[],nrm:[],st:[]};buckets.set(k,b);}return b;};
 const T=r.terrain,ground=(ex:number,ey:number,extent:number)=>{if(!T)return 0;const fx=Math.min(64,Math.max(0,ex/extent*64)),fy=Math.min(64,Math.max(0,ey/extent*64)),i=Math.min(63,Math.floor(fx)),j=Math.min(63,Math.floor(fy)),u=fx-i,v=fy-j;return T[j*65+i]*(1-u)*(1-v)+T[j*65+i+1]*u*(1-v)+T[(j+1)*65+i]*(1-u)*v+T[(j+1)*65+i+1]*u*v;};
 const local=(p:{x:number;y:number},extent:number)=>[(p.x/extent-.5)*W,(.5-p.y/extent)*W] as const;
 // st: facade coordinates in metres (distance along the wall, height above ground) or -1 for non-facade surfaces.
 const tri=(b:Bucket,a:number[],c:number[],d:number[],nx:number,ny:number,nz:number,st?:number[])=>{b.pos.push(...a,...c,...d);b.nrm.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);b.st.push(...(st??[-1,-1,-1,-1,-1,-1]));};
 const area=(ring:{x:number;y:number}[])=>{let s=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)s+=(ring[j].x-ring[i].x)*(ring[j].y+ring[i].y);return s;};
 // Group MVT rings into polygons (outer ring followed by its holes).
 const polygons=(rings:{x:number;y:number}[][])=>{const out:{x:number;y:number}[][][]=[];let sign=0;for(const ring of rings){if(ring.length<4)continue;const a=area(ring);if(!a)continue;if(!sign)sign=Math.sign(a);if(Math.sign(a)===sign)out.push([ring]);else out[out.length-1]?.push(ring);}return out;};
 const flat=(poly:{x:number;y:number}[][],extent:number,z:(x:number,y:number)=>number,b:Bucket)=>{const coords:number[]=[],holes:number[]=[],pts:number[][]=[];for(const ring of poly){if(coords.length)holes.push(coords.length/2);for(const p of ring.slice(0,-1)){const [x,y]=local(p,extent);coords.push(x,y);pts.push([x,y,z(p.x,p.y)]);}}
  const idx=earcut(coords,holes);for(let i=0;i<idx.length;i+=3)tri(b,pts[idx[i]],pts[idx[i+2]],pts[idx[i+1]],0,0,1);};
 if(r.buildings&&tile.layers.building){const L=tile.layers.building,ext=L.extent;let count=0;
  for(let f=0;f<L.length&&count<16000;f++){const feat=L.feature(f),pr=feat.properties as Record<string,number|string>;if(feat.type!==3)continue;const top=Number(pr.render_height??0),min=Number(pr.render_min_height??0);if(!(top>1.5))continue;
   const h=hash(f*7919+r.x*31+r.y),wall=WALLS[h%WALLS.length],roof=ROOFS[(h>>>4)%ROOFS.length],height=Math.max(top,3);
   for(const poly of polygons(feat.loadGeometry() as {x:number;y:number}[][])){const footprint=Math.abs(area(poly[0]))/2*(W/ext)**2;if(footprint<35&&height<7)continue;count++;let base=Infinity;for(const p of poly[0])base=Math.min(base,ground(p.x,p.y,ext));if(!Number.isFinite(base))base=0;
    const zTop=base+height,zBot=min>0?base+min:base-1.5,wb=bucket(wall),rb=bucket(roof);
    const vb=zBot-base,vt=zTop-base;for(const ring of poly){const s=Math.sign(area(ring));let along=0;for(let i=0;i<ring.length-1;i++){const [x1,y1]=local(ring[i],ext),[x2,y2]=local(ring[i+1],ext),dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<.05)continue;const nx=dy/len*-s,ny=-dx/len*-s,u0=along,u1=along+len;along=u1;
     tri(wb,[x1,y1,zBot],[x2,y2,zBot],[x2,y2,zTop],nx,ny,0,[u0,vb,u1,vb,u1,vt]);tri(wb,[x1,y1,zBot],[x2,y2,zTop],[x1,y1,zTop],nx,ny,0,[u0,vb,u1,vt,u0,vt]);}}
    flat(poly,ext,()=>zTop,rb);}}}
 if(r.trees&&tile.layers.landcover){const L=tile.layers.landcover,ext=L.extent,rand=rng(r.x*73856093^r.y*19349663);let placed=0;const mPerUnit=W/ext;
  for(let f=0;f<L.length&&placed<4500;f++){const feat=L.feature(f),pr=feat.properties as Record<string,string>;if(feat.type!==3)continue;const dense=pr.class==='wood'?1:pr.class==='grass'&&(pr.subclass==='park'||pr.subclass==='garden')?.18:0;if(!dense)continue;
   for(const poly of polygons(feat.loadGeometry() as {x:number;y:number}[][])){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of poly[0]){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);}
    const areaM=Math.abs(area(poly[0]))/2*mPerUnit*mPerUnit,want=Math.min(2500,Math.round(areaM/260*dense));
    const inside=(x:number,y:number)=>{let c=false;for(const ring of poly)for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i].y>y)!==(ring[j].y>y)&&x<(ring[j].x-ring[i].x)*(y-ring[i].y)/(ring[j].y-ring[i].y)+ring[i].x)c=!c;return c;};
    for(let k=0,tries=0;k<want&&tries<want*3&&placed<4500;tries++){const px=x0+rand()*(x1-x0),py=y0+rand()*(y1-y0);if(!inside(px,py))continue;k++;placed++;
     const [x,y]=local({x:px,y:py},ext),g=ground(px,py,ext),ht=7+rand()*10,rad=ht*(.22+rand()*.1),b=bucket(TREES[Math.floor(rand()*TREES.length)]),seg=6,a0=rand()*Math.PI;
     for(const [z0,z1,r0] of [[g+ht*.18,g+ht*.72,rad],[g+ht*.5,g+ht,rad*.62]]){const tip=[x,y,z1];for(let s=0;s<seg;s++){const a1=a0+s/seg*Math.PI*2,a2=a0+(s+1)/seg*Math.PI*2,p1=[x+Math.cos(a1)*r0,y+Math.sin(a1)*r0,z0],p2=[x+Math.cos(a2)*r0,y+Math.sin(a2)*r0,z0],am=(a1+a2)/2,k2=r0/(z1-z0);tri(b,p1,p2,tip,Math.cos(am),Math.sin(am),k2);}}}}}}
 if(tile.layers.aeroway){const L=tile.layers.aeroway,ext=L.extent,apron=bucket([.52,.52,.5]),taxi=bucket([.3,.31,.32]),line=bucket([.95,.75,.12]);
  for(let f=0;f<L.length;f++){const feat=L.feature(f),cls=String((feat.properties as Record<string,string>).class);
   if(feat.type===3&&(cls==='apron'||cls==='taxiway'))for(const poly of polygons(feat.loadGeometry() as {x:number;y:number}[][]))flat(poly,ext,(x,y)=>ground(x,y,ext)+(cls==='apron'?.12:.16),cls==='apron'?apron:taxi);
   if(feat.type===2&&cls==='taxiway')for(const ln of feat.loadGeometry() as {x:number;y:number}[][])for(let i=0;i<ln.length-1;i++){const [x1,y1]=local(ln[i],ext),[x2,y2]=local(ln[i+1],ext),dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<.5)continue;const ox=-dy/len,oy=dx/len,z1=ground(ln[i].x,ln[i].y,ext),z2=ground(ln[i+1].x,ln[i+1].y,ext);
    for(const [w,b,dz] of [[.4,line,.2]] as [number,Bucket,number][]){const a=[x1+ox*w,y1+oy*w,z1+dz],c=[x1-ox*w,y1-oy*w,z1+dz],d=[x2-ox*w,y2-oy*w,z2+dz],e=[x2+ox*w,y2+oy*w,z2+dz];tri(b,a,c,d,0,0,1);tri(b,a,d,e,0,0,1);}}}}
 const out=[...buckets.values()].filter(b=>b.pos.length).map(b=>({color:b.color,pos:new Float32Array(b.pos),nrm:new Float32Array(b.nrm),st:new Float32Array(b.st)}));
 (self as unknown as Worker).postMessage({id:r.id,latC,out},out.flatMap(o=>[o.pos.buffer,o.nrm.buffer,o.st.buffer]));
}catch(e){(self as unknown as Worker).postMessage({id:r.id,error:e instanceof Error?e.message:'tile failed'});}};

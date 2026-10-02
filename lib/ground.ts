import {WIDTH,HEIGHT} from './adventure';
import {projectPath,walkable} from './worldLayout';

// World coordinates remain compatible with saved journeys. A meter is 40 units.
export const WORLD_SCALE=40;
export const GROUND_COLUMNS=90,GROUND_ROWS=60;
const fields=new Map<number,Float32Array>();
export function groundField(realm:number){
 let field=fields.get(realm);if(field)return field;
 field=new Float32Array((GROUND_COLUMNS+1)*(GROUND_ROWS+1));
 for(let row=0;row<=GROUND_ROWS;row++)for(let col=0;col<=GROUND_COLUMNS;col++){
  const x=col*WIDTH/GROUND_COLUMNS,z=row*HEIGHT/GROUND_ROWS,q=projectPath(realm,{x,y:z}),d=Math.hypot(x-q.x,z-q.y);
  const rolling=.28*Math.sin(x/240+realm*.6)+.22*Math.cos(z/220-realm*.7)+.12*Math.sin((x+z)/130);
  const bank=Math.max(0,d-135)/155;
  const mountain=[1,7,8,9,12].includes(realm)?1.35:.65;
  const water=[3,5,6,11,13].includes(realm)&&!walkable(realm,{x,y:z})&&d>220;
  field[row*(GROUND_COLUMNS+1)+col]=water?-.8:.65+rolling+Math.min(4,bank*bank*.45)*mountain;
 }
 fields.set(realm,field);return field;
}
// Interpolate the SAME triangles drawn by the renderer, rather than sampling a
// separate smooth height function that leaves feet above or below the mesh.
export function groundHeight(realm:number,x:number,z:number){
 const fx=Math.max(0,Math.min(GROUND_COLUMNS-.000001,x*WORLD_SCALE/WIDTH*GROUND_COLUMNS)),fz=Math.max(0,Math.min(GROUND_ROWS-.000001,z*WORLD_SCALE/HEIGHT*GROUND_ROWS));
 const col=Math.floor(fx),row=Math.floor(fz),u=fx-col,v=fz-row,f=groundField(realm),a=row*(GROUND_COLUMNS+1)+col;
 const ha=f[a],hb=f[a+1],hc=f[a+GROUND_COLUMNS+1],hd=f[a+GROUND_COLUMNS+2];
 return u+v<=1?ha+(hb-ha)*u+(hc-ha)*v:hd+(hc-hd)*(1-u)+(hb-hd)*(1-v);
}

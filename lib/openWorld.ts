import {WIDTH,HEIGHT,type Point} from './adventure';
export type Exit=Point & {realm:number;direction:string};
export function exitsFor(realm:number):Exit[]{const row=Math.floor(realm/4),col=realm%4;return [...(col<3?[{realm:realm+1,direction:'East',x:WIDTH-65,y:HEIGHT/2}]:[]),...(col>0?[{realm:realm-1,direction:'West',x:65,y:HEIGHT/2}]:[]),...(row>0?[{realm:realm-4,direction:'North',x:WIDTH/2,y:65}]:[]),...(row<3?[{realm:realm+4,direction:'South',x:WIDTH/2,y:HEIGHT-65}]:[])];}
export type WorldBody=Point & {vx:number;vy:number;direction:number;dash:number;cooldown:number;moving:boolean};
export function stepWorld(b:WorldBody,dt:number,horizontal:number,vertical:number,run:boolean,dodge:boolean,upgraded=false,traction=1){
 b.cooldown=Math.max(0,b.cooldown-dt);b.dash=Math.max(0,b.dash-dt);
 if(dodge&&b.cooldown===0){b.dash=.3;b.cooldown=upgraded?.9:1.6;}
 const length=Math.hypot(horizontal,vertical),speed=b.dash>0?340:run?175:80;
 const dx=length?horizontal/length:b.dash>0?[0,1,0,-1][b.direction]:0,dy=length?vertical/length:b.dash>0?[-1,0,1,0][b.direction]:0;
 const response=Math.min(1,dt*(length?12:18)*traction);
 b.vx+=(dx*speed-b.vx)*response;b.vy+=(dy*speed-b.vy)*response;
 b.x=Math.max(35,Math.min(WIDTH-35,b.x+b.vx*dt));b.y=Math.max(35,Math.min(HEIGHT-35,b.y+b.vy*dt));
 b.moving=Math.hypot(b.vx,b.vy)>15;
 if(length)b.direction=Math.abs(horizontal)>Math.abs(vertical)?horizontal>0?1:3:vertical>0?2:0;
}

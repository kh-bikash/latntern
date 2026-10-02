import { FLOOR,WIDTH,type Platform,type Traveler } from "./adventure";
export type Body = Traveler & { vx:number;vy:number;coyote:number;jumpBuffer:number;airJumpUsed?:boolean };
export function stepBody(body:Body,platforms:Platform[],dt:number,direction:number,jump:boolean,sprint:boolean,barrier:number,spiritEnabled:boolean,windstep=false,environment={traction:1,wind:0}) {
  if(body.grounded)body.airJumpUsed=false;
  if(jump)body.jumpBuffer=.14;else body.jumpBuffer=Math.max(0,body.jumpBuffer-dt);
  body.coyote=body.grounded?.11:Math.max(0,body.coyote-dt);
  if(body.jumpBuffer>0&&body.coyote>0){body.vy=-735;body.grounded=false;body.coyote=0;body.jumpBuffer=0;}
  else if(jump&&windstep&&!body.grounded&&!body.airJumpUsed){body.vy=-660;body.airJumpUsed=true;body.jumpBuffer=0;}
  const speed=sprint?390:275,target=direction*speed+(body.grounded?0:environment.wind);
  body.vx+=(target-body.vx)*Math.min(1,dt*(direction?12:18)*(body.grounded?environment.traction:1));
  const beforeY=body.y,nextX=body.x+body.vx*dt;body.vy+=1520*dt;body.y+=body.vy*dt;body.x=Math.max(30,Math.min(WIDTH-40,barrier-28,nextX));
  if(body.x!==nextX)body.vx=0;
  body.grounded=false;
  if(body.vy>=0)for(const platform of platforms){
    if(platform.spirit&&!spiritEnabled)continue;
    if(body.x>platform.x-12&&body.x<platform.x+platform.w+12&&beforeY<=platform.y+2&&body.y>=platform.y){body.y=platform.y;body.vy=0;body.grounded=true;break;}
  }
  if(body.y>FLOOR){body.y=FLOOR;body.vy=0;body.grounded=true;}
  body.moving=Math.abs(body.vx)>18;if(direction)body.facing=direction<0?-1:1;
}

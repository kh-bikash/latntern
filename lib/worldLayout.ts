// Traversable paths follow the clearings and bridges in the sixteen painted maps.
export type MapPoint={x:number;y:number};
const northSouth=[
 [50,8,48,27,53,44,49,63,53,81,50,94], [48,7,55,25,46,44,52,65,43,82,50,94],
 [49,7,43,25,54,43,46,64,55,82,50,94], [50,7,57,25,48,43,54,63,46,82,50,94],
 [50,7,52,24,47,44,53,64,49,82,50,94], [50,7,43,26,51,44,48,63,55,82,50,94],
 [50,7,50,26,47,44,54,63,48,81,50,94], [50,7,58,25,49,44,53,65,45,82,50,94],
 [50,7,45,25,51,44,47,65,55,82,50,94], [50,7,55,25,46,44,54,65,46,82,50,94],
 [50,7,55,25,50,44,43,65,48,82,50,94], [50,7,53,25,47,44,55,65,48,82,50,94],
 [50,7,43,25,53,44,46,65,55,82,50,94], [50,7,56,25,47,44,54,65,45,82,50,94],
 [50,7,47,25,54,44,47,65,52,82,50,94], [50,7,50,25,48,44,53,65,48,82,50,94],
];
const eastWest=[
 [5,50,23,48,37,53,50,50,64,49,78,55,95,50], [5,50,23,54,37,48,50,50,64,58,79,47,95,50],
 [5,50,22,52,37,46,50,50,65,54,80,48,95,50], [5,50,23,57,37,51,50,50,63,46,79,53,95,50],
 [5,50,22,46,38,51,50,50,64,53,79,48,95,50], [5,50,22,45,37,53,50,50,64,44,79,52,95,50],
 [5,50,24,54,38,48,50,50,63,53,79,48,95,50], [5,50,22,47,37,54,50,50,63,48,79,56,95,50],
 [5,50,23,56,37,49,50,50,63,53,79,48,95,50], [5,50,23,44,37,54,50,50,63,48,79,55,95,50],
 [5,50,22,46,37,54,50,50,64,49,80,55,95,50], [5,50,23,54,37,47,50,50,64,56,79,48,95,50],
 [5,50,23,46,38,52,50,50,64,48,79,55,95,50], [5,50,23,55,37,48,50,50,64,54,79,46,95,50],
 [5,50,23,48,37,53,50,50,63,47,79,52,95,50], [5,50,23,53,37,48,50,50,63,54,79,49,95,50],
];
const points=(list:number[]):MapPoint[]=>Array.from({length:list.length/2},(_,i)=>({x:list[i*2]*18,y:list[i*2+1]*12}));
export function pathsFor(realm:number){return [points(northSouth[realm]),points(eastWest[realm])];}
export function worldSites(realm:number){const p=pathsFor(realm);return [p[0][1],p[0][4],p[1][2],p[1][4]];}
const segment=(p:MapPoint,a:MapPoint,b:MapPoint)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return {x:a.x+t*dx,y:a.y+t*dy};};
export function projectPath(realm:number,p:MapPoint){let nearest=p,distance=Infinity;for(const path of pathsFor(realm))for(let i=1;i<path.length;i++){const q=segment(p,path[i-1],path[i]),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<distance){nearest=q;distance=d;}}return nearest;}
export function walkable(realm:number,p:MapPoint){if(p.x<35||p.x>1765||p.y<35||p.y>1165)return false;const q=projectPath(realm,p);return Math.hypot(q.x-p.x,q.y-p.y)<105||worldSites(realm).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<185)||Math.hypot(p.x-900,p.y-600)<190;}
export function safePoint(realm:number,p:MapPoint){return walkable(realm,p)?p:projectPath(realm,p);}
// A small A* grid makes click-to-walk route around water and buildings.
export function walkPath(realm:number,start:MapPoint,end:MapPoint):MapPoint[]{
 const size=40,key=(x:number,y:number)=>`${x},${y}`,cell=(p:MapPoint)=>({x:Math.round(p.x/size),y:Math.round(p.y/size)}),a=cell(start),b=cell(safePoint(realm,end));
 if(!walkable(realm,{x:b.x*size,y:b.y*size})){const candidates:MapPoint[]=[];for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const q={x:b.x+dx,y:b.y+dy};if(walkable(realm,{x:q.x*size,y:q.y*size}))candidates.push(q);}candidates.sort((u,v)=>Math.hypot(u.x*size-end.x,u.y*size-end.y)-Math.hypot(v.x*size-end.x,v.y*size-end.y));if(candidates[0])Object.assign(b,candidates[0]);}
 const open=[a],scores=new Map([[key(a.x,a.y),0]]),parents=new Map<string,string>();let found='';
 for(let n=0;open.length&&n<1600;n++){
  open.sort((u,v)=>(scores.get(key(u.x,u.y))!+Math.hypot(u.x-b.x,u.y-b.y))-(scores.get(key(v.x,v.y))!+Math.hypot(v.x-b.x,v.y-b.y)));
  const c=open.shift()!,id=key(c.x,c.y);if(c.x===b.x&&c.y===b.y){found=id;break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const x=c.x+dx,y=c.y+dy,point={x:x*size,y:y*size};if(!walkable(realm,point)||!walkable(realm,{x:(c.x+x)*size/2,y:(c.y+y)*size/2}))continue;
   const next=key(x,y),score=scores.get(id)!+Math.hypot(dx,dy);if(score>=(scores.get(next)??Infinity))continue;scores.set(next,score);parents.set(next,id);if(!open.some(p=>p.x===x&&p.y===y))open.push({x,y});
  }
 }
 const route:MapPoint[]=[];while(found&&found!==key(a.x,a.y)){const [x,y]=found.split(',').map(Number);route.unshift({x:x*size,y:y*size});found=parents.get(found)??'';}return route;
}

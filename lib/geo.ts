export const EARTH_RADIUS=6371008.8;const R=EARTH_RADIUS,rad=Math.PI/180;
export function geoMove(lat:number,lon:number,heading:number,distance:number){const a=lat*rad,b=lon*rad,h=heading*rad,d=distance/R,latitude=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(h)),longitude=b+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(latitude));return{lat:latitude/rad,lon:((longitude/rad+540)%360)-180};}
export function geoDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}){const x=(b.lat-a.lat)*rad,y=(b.lon-a.lon)*rad,q=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));}
export function geoBearing(a:{lat:number;lon:number},b:{lat:number;lon:number}){const y=Math.sin((b.lon-a.lon)*rad)*Math.cos(b.lat*rad),x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lon-a.lon)*rad);return(Math.atan2(y,x)/rad+360)%360;}
/** Signed cross-track distance (m, + right of course) from the great circle a→b. */
export function crossTrack(p:{lat:number;lon:number},a:{lat:number;lon:number},b:{lat:number;lon:number}){const d=geoDistance(a,p)/R,t=(geoBearing(a,p)-geoBearing(a,b))*rad;return Math.asin(Math.sin(d)*Math.sin(t))*R;}
export const angleDiff=(a:number,b:number)=>((a-b+540)%360)-180;

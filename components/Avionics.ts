// Glass-cockpit displays drawn on canvas: primary flight display, navigation display and engine/systems page.
// Shared by the on-screen instrument panel and the textures of the 3D cockpit.
export type NavPoint={id:string;lat:number;lon:number;kind:'wpt'|'apt'|'rwy'|'active'|'dest'};
export type Traffic={id:string;label:string;lat:number;lon:number;alt:number|null;rate:number;ground:boolean};
export type AvionicsData={ias:number;tas:number;gs:number;mach:number;alt:number;baro:number;std:boolean;vs:number;pitch:number;roll:number;heading:number;track:number;beta:number;aoa:number;
 altSel:number;hdgSel:number;spdSel:number;vsSel:number;ap:{master:boolean;athr:boolean;athrMode:string;lat:string;vert:string;arm:string;fd:boolean};fdPitch:number|null;fdBank:number|null;
 v:{vs:number;vs0:number;vr:number;v2:number;vref:number;vfe:number;vmax:number;green:number};radio:number;loc:number|null;gsDev:number|null;
 lat:number;lon:number;route:NavPoint[];activeId:string;distNext:number;distDest:number;dest:string;eteMin:number;traffic:Traffic[];wind:{dir:number;speed:number};oat:number;
 engine:'piston'|'jet';engines:number;n1:number;running:boolean;ff:number;fuelKg:number;fuelMax:number;flaps:string;flapPos:number;gearPos:number;gearDown:boolean;retract:boolean;spoilers:number;brakes:number;parking:boolean;trim:number;reverse:boolean;
 warnings:string[];cautions:string[];range:number;utc:string;power:boolean;airportRunways:{a:{lat:number;lon:number};b:{lat:number;lon:number}}[]};
const R=6371008.8,rad=Math.PI/180;
const toXY=(d:AvionicsData,p:{lat:number;lon:number},scale:number)=>{const x=(p.lon-d.lon)*rad*R*Math.cos(d.lat*rad)*scale,y=(p.lat-d.lat)*rad*R*scale,h=-d.heading*rad;return[x*Math.cos(h)-y*Math.sin(h),-(x*Math.sin(h)+y*Math.cos(h))];};
const C={sky:'#2a72c8',sky2:'#4a92df',ground:'#7a4e24',ground2:'#5a3816',white:'#f4f4f4',cyan:'#2fe0ff',magenta:'#ff4df0',green:'#36e04a',amber:'#ffb02e',red:'#ff3b30',grey:'#2b2f36',tape:'#3c424b',dark:'#0b0d10'};
function txt(c:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color=C.white,align:CanvasTextAlign='center',weight='600'){c.font=`${weight} ${size}px "Roboto Mono",Consolas,monospace`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
function box(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,stroke=C.white,fill=C.dark){c.fillStyle=fill;c.fillRect(x,y,w,h);c.strokeStyle=stroke;c.lineWidth=1.5;c.strokeRect(x,y,w,h);}
export function drawPFD(c:CanvasRenderingContext2D,X:number,Y:number,W:number,H:number,d:AvionicsData){
 c.save();c.beginPath();c.rect(X,Y,W,H);c.clip();c.fillStyle=C.dark;c.fillRect(X,Y,W,H);if(!d.power){txt(c,'NO POWER',X+W/2,Y+H/2,W*.05,'#555');c.restore();return;}
 const s=W/400,cx=X+W*.5,cy=Y+H*.47,ppd=H*.0115;// pixels per degree of pitch
 // Attitude.
 c.save();c.beginPath();c.rect(X+W*.2,Y+H*.1,W*.6,H*.72);c.clip();c.translate(cx,cy);c.rotate(-d.roll);const off=d.pitch/rad*ppd;
 const g1=c.createLinearGradient(0,-H,0,off);g1.addColorStop(0,'#174a8c');g1.addColorStop(1,C.sky2);c.fillStyle=g1;c.fillRect(-W,-H*2,W*2,H*2+off);const g2=c.createLinearGradient(0,off,0,H);g2.addColorStop(0,C.ground);g2.addColorStop(1,C.ground2);c.fillStyle=g2;c.fillRect(-W,off,W*2,H*2);
 c.strokeStyle=C.white;c.lineWidth=2*s;c.beginPath();c.moveTo(-W,off);c.lineTo(W,off);c.stroke();
 for(let p=-90;p<=90;p+=2.5){if(!p)continue;const y=off-p*ppd;if(Math.abs(y)>H*.33)continue;const major=p%10===0,mid=p%5===0,w=(major?60:mid?30:14)*s;c.lineWidth=(major?2:1.4)*s;c.beginPath();c.moveTo(-w/2,y);c.lineTo(w/2,y);c.stroke();if(major){txt(c,String(Math.abs(p)),-w/2-14*s,y,11*s);txt(c,String(Math.abs(p)),w/2+14*s,y,11*s);}}
 c.restore();
 // Bank scale and pointer.
 c.save();c.translate(cx,cy);const rr=H*.3;c.strokeStyle=C.white;c.lineWidth=2*s;c.beginPath();c.arc(0,0,rr,(-90-60)*rad,(-90+60)*rad);c.stroke();for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){const r1=rr,r2=rr+(Math.abs(a)%30===0?14:8)*s;c.beginPath();c.moveTo(Math.sin(a*rad)*r1,-Math.cos(a*rad)*r1);c.lineTo(Math.sin(a*rad)*r2,-Math.cos(a*rad)*r2);c.stroke();}
 c.rotate(-d.roll);c.fillStyle=Math.abs(d.roll)>35*rad?C.amber:C.white;c.beginPath();c.moveTo(0,-rr+1);c.lineTo(-8*s,-rr+13*s);c.lineTo(8*s,-rr+13*s);c.closePath();c.fill();const slip=Math.max(-1,Math.min(1,d.beta*8))*14*s;c.fillRect(-9*s+slip,-rr+15*s,18*s,4*s);c.restore();
 // Flight director and aircraft symbol.
 if(d.ap.fd&&d.fdPitch!==null&&d.fdBank!==null){c.save();c.translate(cx,cy);c.strokeStyle=C.magenta;c.lineWidth=3*s;const fy=-(d.fdPitch-d.pitch)/rad*ppd,fx=(d.fdBank-d.roll)/rad*2.2*s;c.beginPath();c.moveTo(-55*s,Math.max(-80*s,Math.min(80*s,fy)));c.lineTo(55*s,Math.max(-80*s,Math.min(80*s,fy)));c.moveTo(Math.max(-70*s,Math.min(70*s,fx)),-45*s);c.lineTo(Math.max(-70*s,Math.min(70*s,fx)),45*s);c.stroke();c.restore();}
 c.fillStyle='#000';c.strokeStyle='#ffd400';c.lineWidth=3*s;for(const side of [-1,1]){c.beginPath();c.moveTo(cx+side*80*s,cy);c.lineTo(cx+side*36*s,cy);c.lineTo(cx+side*36*s,cy+10*s);c.stroke();}c.fillStyle='#ffd400';c.fillRect(cx-4*s,cy-4*s,8*s,8*s);
 // Flight path vector.
 const fpvY=cy+(d.aoa/rad)*ppd*Math.cos(d.roll),fpvX=cx-(d.aoa/rad)*ppd*Math.sin(d.roll)+(-d.beta/rad)*ppd;c.strokeStyle='#4bf07c';c.lineWidth=2*s;c.beginPath();c.arc(fpvX,fpvY,6*s,0,Math.PI*2);c.moveTo(fpvX-16*s,fpvY);c.lineTo(fpvX-6*s,fpvY);c.moveTo(fpvX+6*s,fpvY);c.lineTo(fpvX+16*s,fpvY);c.moveTo(fpvX,fpvY-6*s);c.lineTo(fpvX,fpvY-13*s);c.stroke();
 // ILS deviation.
 if(d.loc!==null){const y=Y+H*.85,x=cx+Math.max(-2,Math.min(2,d.loc/1.25))*50*s;c.strokeStyle=C.white;c.lineWidth=1.5*s;for(const k of [-2,-1,1,2]){c.beginPath();c.arc(cx+k*50*s/2,y,3*s,0,7);c.stroke();}c.fillStyle=C.magenta;c.beginPath();c.moveTo(x,y-7*s);c.lineTo(x+8*s,y);c.lineTo(x,y+7*s);c.lineTo(x-8*s,y);c.fill();}
 if(d.gsDev!==null){const x=X+W*.77,y=cy+Math.max(-2,Math.min(2,d.gsDev/.35))*50*s;c.strokeStyle=C.white;for(const k of [-2,-1,1,2]){c.beginPath();c.arc(x,cy+k*25*s,3*s,0,7);c.stroke();}c.fillStyle=C.magenta;c.beginPath();c.moveTo(x-7*s,y);c.lineTo(x,y-8*s);c.lineTo(x+7*s,y);c.lineTo(x,y+8*s);c.fill();}
 // Speed tape.
 const tx=X+W*.04,tw=W*.15,ty=Y+H*.1,th=H*.72,mid=ty+th/2,kpp=th/90;c.fillStyle='#3a3f47cc';c.fillRect(tx,ty,tw,th);c.save();c.beginPath();c.rect(tx,ty,tw,th);c.clip();
 for(let v=Math.floor((d.ias-50)/10)*10;v<=d.ias+50;v+=10){if(v<0)continue;const y=mid-(v-d.ias)*kpp;c.strokeStyle=C.white;c.lineWidth=1.5*s;c.beginPath();c.moveTo(tx+tw-12*s,y);c.lineTo(tx+tw,y);c.stroke();if(v%20===0)txt(c,String(v),tx+tw-16*s,y,12*s,C.white,'right');}
 const band=(from:number,to:number,color:string,dash=false)=>{const y1=mid-(to-d.ias)*kpp,y2=mid-(from-d.ias)*kpp;c.fillStyle=color;if(dash){for(let y=y1;y<y2;y+=8*s)c.fillRect(tx+tw-6*s,y,6*s,4*s);}else c.fillRect(tx+tw-6*s,y1,6*s,y2-y1);};
 band(0,d.v.vs,C.red,true);band(d.v.vs,d.v.vs*1.13,C.amber);band(d.v.vmax,d.v.vmax+80,C.red,true);if(d.flapPos>0)band(d.v.vfe,d.v.vfe+2,C.amber);
 for(const [v,l] of [[d.v.vr,'R'],[d.v.v2,'2'],[d.v.vref,'REF'],[d.v.green,'○']] as [number,string][]){if(!v)continue;const y=mid-(v-d.ias)*kpp;c.strokeStyle=C.cyan;c.beginPath();c.moveTo(tx+tw,y);c.lineTo(tx+tw+6*s,y);c.stroke();txt(c,l,tx+tw-30*s,y,10*s,C.cyan);}
 if(d.ap.athr||d.ap.master){const y=mid-(d.spdSel-d.ias)*kpp;c.fillStyle=C.magenta;c.beginPath();c.moveTo(tx+tw,y);c.lineTo(tx+tw-10*s,y-6*s);c.lineTo(tx+tw-10*s,y+6*s);c.fill();}
 c.restore();box(c,tx-2*s,mid-14*s,tw-6*s,28*s,C.white,'#000');txt(c,String(Math.round(Math.max(0,d.ias))),tx+tw*.45,mid,18*s,d.ias<d.v.vs*1.05&&d.ias>20?C.red:C.white);
 txt(c,d.ap.athr||d.ap.master?String(Math.round(d.spdSel)):'---',tx+tw/2,ty-10*s,13*s,C.magenta);txt(c,d.mach>.4?`M.${Math.round(d.mach*1000).toString().padStart(3,'0').slice(0,3)}`:`GS ${Math.round(d.gs)}`,tx+tw/2,ty+th+12*s,12*s);txt(c,`TAS ${Math.round(d.tas)}`,tx+tw/2,ty+th+28*s,11*s,'#bbb');
 // Altitude tape and VSI.
 const ax=X+W*.8,aw=W*.14,fpp=th/1000;c.fillStyle='#3a3f47cc';c.fillRect(ax,ty,aw,th);c.save();c.beginPath();c.rect(ax,ty,aw,th);c.clip();
 for(let a=Math.floor((d.alt-600)/100)*100;a<=d.alt+600;a+=100){const y=mid-(a-d.alt)*fpp;c.strokeStyle=C.white;c.lineWidth=1.5*s;c.beginPath();c.moveTo(ax,y);c.lineTo(ax+(a%500===0?14:8)*s,y);c.stroke();if(a%200===0)txt(c,String(a),ax+aw-4*s,y,11*s,C.white,'right');}
 {const y=mid-(d.altSel-d.alt)*fpp;c.fillStyle=C.cyan;c.fillRect(ax,Math.max(ty,Math.min(ty+th,y))-8*s,6*s,16*s);}
 if(d.radio<2500){const gy=mid+d.radio*fpp;if(gy<ty+th){c.fillStyle='#a8641e';c.fillRect(ax,gy,aw,th);c.strokeStyle=C.amber;c.beginPath();c.moveTo(ax,gy);c.lineTo(ax+aw,gy);c.stroke();}}
 c.restore();box(c,ax+2*s,mid-14*s,aw,28*s,C.white,'#000');txt(c,String(Math.round(d.alt/10)*10),ax+aw-6*s,mid,16*s,C.white,'right');
 txt(c,String(Math.round(d.altSel)),ax+aw/2,ty-10*s,13*s,C.cyan);txt(c,d.std?'STD':`${Math.round(d.baro)} hPa`,ax+aw/2,ty+th+12*s,12*s,d.std?C.cyan:C.cyan);
 const vx=ax+aw+4*s,vw=W*.05;c.fillStyle='#3a3f47aa';c.fillRect(vx,ty+th*.15,vw,th*.7);const vy=(v:number)=>mid-Math.sign(v)*Math.min(1,Math.sqrt(Math.abs(v)/6000))*th*.34;for(const v of [-6000,-2000,-1000,-500,0,500,1000,2000,6000]){c.strokeStyle='#ddd';c.lineWidth=1;c.beginPath();c.moveTo(vx,vy(v));c.lineTo(vx+5*s,vy(v));c.stroke();}
 c.strokeStyle=Math.abs(d.vs)>6000?C.amber:C.green;c.lineWidth=3*s;c.beginPath();c.moveTo(vx+vw,mid);c.lineTo(vx+2*s,vy(d.vs));c.stroke();txt(c,Math.abs(d.vs)>=100?String(Math.round(d.vs/50)*50):'',vx+vw/2,vy(d.vs)+(d.vs>0?-10:10)*s,10*s,C.green);
 // Heading scale.
 const hy=Y+H*.9,hw=W*.56,hx=cx-hw/2;c.fillStyle='#3a3f47cc';c.fillRect(hx,hy,hw,H*.08);c.save();c.beginPath();c.rect(hx,hy,hw,H*.08);c.clip();for(let h=Math.floor(d.heading/5)*5-40;h<=d.heading+40;h+=5){const x=cx+(h-d.heading)*hw/80,n=(h+360)%360;c.strokeStyle=C.white;c.lineWidth=1.5*s;c.beginPath();c.moveTo(x,hy);c.lineTo(x,hy+(n%10===0?10:5)*s);c.stroke();if(n%10===0)txt(c,n%30===0?(({0:'N',90:'E',180:'S',270:'W'} as Record<number,string>)[n]??String(n/10)):String(n/10),x,hy+20*s,11*s);}
 const bx=cx+(((d.hdgSel-d.heading+540)%360)-180)*hw/80;c.fillStyle=C.cyan;c.fillRect(bx-5*s,hy,10*s,6*s);const tkx=cx+(((d.track-d.heading+540)%360)-180)*hw/80;c.strokeStyle=C.green;c.beginPath();c.moveTo(tkx,hy);c.lineTo(tkx-5*s,hy+8*s);c.lineTo(tkx+5*s,hy+8*s);c.closePath();c.stroke();c.restore();c.fillStyle='#ffd400';c.fillRect(cx-1.5*s,hy-6*s,3*s,14*s);
 // Radio altitude, FMA and warnings.
 if(d.radio<2500)txt(c,String(Math.max(0,Math.round(d.radio/(d.radio<50?1:10))*(d.radio<50?1:10))),cx,cy+H*.25,16*s,d.radio<200?C.amber:C.green);
 const fy=Y+H*.045,cols=[d.ap.athrMode,d.ap.lat,d.ap.vert,d.ap.arm,`${d.ap.master?'AP':''}${d.ap.fd?' FD':''}${d.ap.athr?' A/THR':''}`];for(let i=0;i<5;i++){const x=X+W*(.1+i*.2);c.strokeStyle='#666';c.lineWidth=1;if(i)c.beginPath(),c.moveTo(x-W*.1,Y+4*s),c.lineTo(x-W*.1,Y+H*.085),c.stroke();txt(c,cols[i]||'',x,fy,13*s,i===3?C.cyan:i===4?C.white:C.green);}
 const warn=d.warnings[0];if(warn){const blink=Math.floor(performance.now()/400)%2===0;if(blink){box(c,cx-W*.17,cy-H*.17,W*.34,30*s,C.red,'#000c');txt(c,warn,cx,cy-H*.17+15*s,17*s,C.red,'center','700');}}
 else if(d.cautions[0]){box(c,cx-W*.17,cy-H*.17,W*.34,26*s,C.amber,'#000b');txt(c,d.cautions[0],cx,cy-H*.17+13*s,14*s,C.amber);}
 c.restore();}
export function drawND(c:CanvasRenderingContext2D,X:number,Y:number,W:number,H:number,d:AvionicsData){
 c.save();c.beginPath();c.rect(X,Y,W,H);c.clip();c.fillStyle=C.dark;c.fillRect(X,Y,W,H);if(!d.power){c.restore();return;}const s=W/400,cx=X+W/2,cy=Y+H*.68,rr=H*.56,scale=rr/(d.range*1852);
 c.strokeStyle='#ffffff55';c.lineWidth=1;c.beginPath();c.arc(cx,cy,rr,Math.PI*1.12,Math.PI*1.88);c.stroke();c.setLineDash([4,6]);c.beginPath();c.arc(cx,cy,rr/2,Math.PI*1.05,Math.PI*1.95);c.stroke();c.setLineDash([]);txt(c,String(d.range),cx-rr*.72,cy-rr*.62,11*s,'#bbb');txt(c,String(d.range/2),cx-rr*.33,cy-rr*.38,11*s,'#bbb');
 c.save();c.beginPath();c.arc(cx,cy,rr+20*s,0,Math.PI*2);c.clip();c.translate(cx,cy);
 for(const r of d.airportRunways){const a=toXY(d,r.a,scale),b=toXY(d,r.b,scale);c.strokeStyle=C.white;c.lineWidth=3*s;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
 const pts=d.route.filter(p=>p.kind!=='apt');c.strokeStyle=C.magenta;c.lineWidth=2.5*s;c.beginPath();let first=true;const activeIdx=pts.findIndex(p=>p.id===d.activeId);for(let i=Math.max(0,activeIdx);i<pts.length;i++){const [x,y]=i===Math.max(0,activeIdx)&&activeIdx>=0?[0,0]:toXY(d,pts[i-1]??pts[i],scale);if(first){c.moveTo(x,y);first=false;}const [x2,y2]=toXY(d,pts[i],scale);c.lineTo(x2,y2);}c.stroke();
 for(const p of d.route){const [x,y]=toXY(d,p,scale);if(Math.hypot(x,y)>rr*1.3)continue;if(p.kind==='apt'){c.strokeStyle=C.cyan;c.lineWidth=1.5*s;c.beginPath();c.arc(x,y,5*s,0,7);c.stroke();txt(c,p.id,x+8*s,y-8*s,10*s,C.cyan,'left');}else{c.strokeStyle=p.id===d.activeId?C.magenta:C.white;c.lineWidth=2*s;c.beginPath();c.moveTo(x,y-6*s);c.lineTo(x+6*s,y);c.lineTo(x,y+6*s);c.lineTo(x-6*s,y);c.closePath();c.stroke();txt(c,p.id,x+9*s,y,10*s,p.id===d.activeId?C.magenta:C.white,'left');}}
 for(const t of d.traffic){const [x,y]=toXY(d,t,scale);if(Math.hypot(x,y)>rr*1.1)continue;const rel=t.alt===null?null:Math.round((t.alt-d.alt)/100),close=Math.hypot(x,y)/scale<3704&&rel!==null&&Math.abs(rel)<10,col=t.ground?'#888':close?C.amber:C.cyan;c.fillStyle=col;c.strokeStyle=col;c.beginPath();c.moveTo(x,y-5*s);c.lineTo(x+5*s,y);c.lineTo(x,y+5*s);c.lineTo(x-5*s,y);c.closePath();close?c.fill():c.stroke();if(rel!==null&&!t.ground){txt(c,`${rel>=0?'+':'-'}${String(Math.abs(rel)).padStart(2,'0')}`,x,y+(rel>0?-11:11)*s,9*s,col);if(Math.abs(t.rate)>500)txt(c,t.rate>0?'↑':'↓',x+9*s,y,10*s,col);}}
 c.restore();
 // Compass rose and own ship.
 c.save();c.translate(cx,cy);for(let h=0;h<360;h+=5){const a=(h-d.heading)*rad;if(Math.cos(a)<-.1)continue;const r1=rr,r2=rr+(h%10===0?10:5)*s;c.strokeStyle=C.white;c.lineWidth=1.5*s;c.beginPath();c.moveTo(Math.sin(a)*r1,-Math.cos(a)*r1);c.lineTo(Math.sin(a)*r2,-Math.cos(a)*r2);c.stroke();if(h%30===0)txt(c,String(h/10),Math.sin(a)*(rr+20*s),-Math.cos(a)*(rr+20*s),12*s);}
 const hb=(d.hdgSel-d.heading)*rad;c.fillStyle=C.cyan;c.save();c.rotate(hb);c.fillRect(-5*s,-rr-8*s,10*s,8*s);c.restore();const tk=(d.track-d.heading)*rad;c.strokeStyle=C.green;c.setLineDash([5,5]);c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(tk)*rr,-Math.cos(tk)*rr);c.stroke();c.setLineDash([]);
 c.strokeStyle='#ffd400';c.lineWidth=3*s;c.beginPath();c.moveTo(0,-14*s);c.lineTo(0,14*s);c.moveTo(-14*s,-2*s);c.lineTo(14*s,-2*s);c.moveTo(-6*s,11*s);c.lineTo(6*s,11*s);c.stroke();c.restore();
 txt(c,String(Math.round(d.heading)).padStart(3,'0'),cx,Y+14*s,15*s,C.white,'center','700');box(c,cx-24*s,Y+3*s,48*s,22*s,C.white,'transparent');
 txt(c,`GS ${Math.round(d.gs)}  TAS ${Math.round(d.tas)}`,X+8*s,Y+16*s,11*s,C.white,'left');txt(c,`${String(Math.round(d.wind.dir)).padStart(3,'0')}°/${Math.round(d.wind.speed)}`,X+8*s,Y+32*s,11*s,C.white,'left');
 c.save();c.translate(X+22*s,Y+56*s);c.rotate((d.wind.dir+180-d.heading)*rad);c.strokeStyle=C.green;c.lineWidth=2*s;c.beginPath();c.moveTo(0,-11*s);c.lineTo(0,11*s);c.moveTo(-5*s,5*s);c.lineTo(0,11*s);c.lineTo(5*s,5*s);c.stroke();c.restore();
 txt(c,d.activeId,X+W-8*s,Y+16*s,12*s,C.magenta,'right');txt(c,`${d.distNext<10?d.distNext.toFixed(1):Math.round(d.distNext)} NM`,X+W-8*s,Y+32*s,11*s,C.white,'right');txt(c,`${d.dest} ${Math.round(d.distDest)} NM`,X+W-8*s,Y+48*s,11*s,C.white,'right');txt(c,d.eteMin<6000?`ETE ${Math.floor(d.eteMin/60)}:${String(Math.round(d.eteMin%60)).padStart(2,'0')}`:'',X+W-8*s,Y+64*s,11*s,C.white,'right');
 txt(c,`${d.utc}Z`,X+8*s,Y+H-12*s,11*s,'#bbb','left');txt(c,`TFC ${d.traffic.filter(t=>!t.ground).length}`,X+W-8*s,Y+H-12*s,11*s,C.cyan,'right');
 c.restore();}
export function drawEICAS(c:CanvasRenderingContext2D,X:number,Y:number,W:number,H:number,d:AvionicsData){
 c.save();c.beginPath();c.rect(X,Y,W,H);c.clip();c.fillStyle=C.dark;c.fillRect(X,Y,W,H);if(!d.power){c.restore();return;}const s=Math.min(W/260,H/300);
 const gauge=(x:number,y:number,r:number,v:number,max:number,label:string,value:string,red=max*.98)=>{c.strokeStyle='#ddd';c.lineWidth=2*s;c.beginPath();c.arc(x,y,r,Math.PI*.8,Math.PI*2.2);c.stroke();c.strokeStyle=C.red;c.beginPath();c.arc(x,y,r,Math.PI*.8+red/max*Math.PI*1.4,Math.PI*2.2);c.stroke();const a=Math.PI*.8+Math.max(0,Math.min(1.05,v/max))*Math.PI*1.4;c.strokeStyle=d.running?C.green:'#777';c.lineWidth=3*s;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.95);c.stroke();txt(c,value,x+r*.35,y+r*.55,13*s,d.running?C.green:'#999');txt(c,label,x,y+r+10*s,10*s,'#bbb');};
 const n1=d.engine==='jet'?d.n1*100:d.n1*2700,max=d.engine==='jet'?104:2800;for(let e=0;e<d.engines;e++){const x=X+W*(d.engines===1?.5:.27+e*.46);gauge(x,Y+44*s,30*s,n1,max,d.engine==='jet'?'N1 %':'RPM',d.engine==='jet'?n1.toFixed(1):String(Math.round(n1/10)*10));}
 if(d.reverse)txt(c,'REV',X+W/2,Y+44*s,14*s,C.green,'center','700');
 let y=Y+98*s;const row=(l:string,v:string,col=C.green)=>{txt(c,l,X+10*s,y,11*s,'#bbb','left');txt(c,v,X+W-10*s,y,12*s,col,'right');y+=17*s;};
 row('FUEL FLOW',`${Math.round(d.ff)} KG/H`);row('FUEL',`${Math.round(d.fuelKg)} KG`,d.fuelKg<d.fuelMax*.1?C.amber:C.green);row('ENDURANCE',d.ff>1?`${Math.floor(d.fuelKg/d.ff)}:${String(Math.round(d.fuelKg/d.ff%1*60)).padStart(2,'0')}`:'--');
 row('FLAPS',d.flaps,C.cyan);row('SPOILERS',d.spoilers>.05?(d.spoilers>.9?'FULL':'EXT'):'RET',d.spoilers>.05?C.amber:C.green);row('BRAKES',d.parking?'PARK':d.brakes>.05?'ON':'OFF',d.parking?C.amber:C.green);row('TRIM',`${d.trim>=0?'UP ':'DN '}${Math.abs(Math.round(d.trim*100))}%`);row('OAT',`${Math.round(d.oat)}°C`);
 if(d.retract){const gy=Y+H-28*s;for(let i=0;i<3;i++){const gx=X+W*(.3+i*.2),col=d.gearPos>.99?C.green:d.gearPos<.01?'#333':C.red;c.fillStyle=col;c.fillRect(gx-14*s,gy-10*s,28*s,20*s);txt(c,d.gearPos>.99?'DN':d.gearPos<.01?'UP':'▲▼',gx,gy,10*s,d.gearPos<.01?'#999':'#000');}txt(c,'GEAR',X+10*s,gy,10*s,'#bbb','left');}else txt(c,'FIXED GEAR',X+W/2,Y+H-28*s,10*s,'#888');
 c.restore();}
export function drawPanel(c:CanvasRenderingContext2D,W:number,H:number,d:AvionicsData){const gap=6,pw=Math.min(H,W*.38);c.fillStyle='#14171b';c.fillRect(0,0,W,H);drawPFD(c,0,0,pw,H,d);drawND(c,pw+gap,0,pw,H,d);drawEICAS(c,pw*2+gap*2,0,W-pw*2-gap*2,H,d);}

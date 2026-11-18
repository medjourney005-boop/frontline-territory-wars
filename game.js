// Frontline Territory Wars V18 — server-authoritative simulation.
// Uses V17 unit costs and core rules. No state data is trusted from clients.
import { randomInt } from 'node:crypto';
export const WIDTH = 1200, HEIGHT = 750;
export const UNITS = {
  rifle:{name:'Infanterie',cost:1,hp:50,speed:66,range:114,dmg:8,rate:.85,r:8,ammo:40},
  gunner:{name:'Machinegun',cost:5,hp:105,speed:51,range:225,dmg:9,rate:.22,r:11,ammo:90},
  grenadier:{name:'Grenadier',cost:4,hp:44,speed:61,range:105,dmg:23,rate:2.1,r:9,ammo:12,splash:39},
  tank:{name:'Tank',cost:10,hp:290,speed:88,range:245,dmg:48,rate:1.65,r:18,ammo:14,splash:24},
  artillery:{name:'Artillerie',cost:12,hp:100,speed:24,range:385,dmg:63,rate:3.4,r:17,ammo:10,splash:46},
  truck:{name:'Transporttruck',cost:10,hp:175,speed:112,range:0,dmg:0,rate:100,r:15,ammo:0},
  scout:{name:'Verkenner',cost:3,hp:42,speed:145,range:115,dmg:6,rate:1.05,r:7,ammo:30},
  decoy:{name:'Neptank',cost:3,hp:18,speed:65,range:0,dmg:0,rate:100,r:18,ammo:0},
};
export const BUILDINGS = {
  wall:{name:'Muur',cost:4,hp:240,len:100,w:15},
  sandbag:{name:'Zandzakken',cost:2,hp:130,len:115,w:18},
  turret:{name:'Geschutstoren',cost:9,hp:155,len:30,w:26,range:210},
  minefield:{name:'Mijnenveld',cost:20,hp:1,len:100,w:17},
  barracks:{name:'Kazerne',cost:18,hp:275,len:44,w:44},
  tankfactory:{name:'Tankfabriek',cost:25,hp:320,len:53,w:53},
  depot:{name:'Reparatiedepot',cost:20,hp:270,len:46,w:46},
  radar:{name:'Radarpost',cost:18,hp:220,len:42,w:42},
  bunker:{name:'Bunker',cost:15,hp:400,len:54,w:54,range:185},
};
export const MAPS = [
  {name:'Iron Ridge',desc:'Heuvelruggen en open dal',kind:'ridge', caps:[[285,175],[445,570],[740,180],[875,555]]},
  {name:'River Crossing',desc:'Twee oevers en drie bruggen',kind:'river',caps:[[315,130],[465,370],[752,375],[875,615]]},
  {name:'Green Valley',desc:'Hoge heuvels en lage doorgangen',kind:'valley',caps:[[345,255],[445,545],[755,190],[840,440]]},
  {name:'Broken Coast',desc:'Kustlijn en smalle landstrook',kind:'coast',caps:[[285,110],[450,570],[730,125],[880,570]]},
  {name:'Dust Plains',desc:'Uitgestrekte droge vlaktes',kind:'desert',caps:[[305,355],[480,160],[735,565],[895,290]]},
  {name:'Twin Lakes',desc:'Meren dwingen omtrekkende bewegingen',kind:'lakes',caps:[[295,400],[455,390],[750,380],[875,380]]},
  {name:'Mountain Pass',desc:'Smalle valleien tussen heuvels',kind:'mountain',caps:[[320,260],[475,380],[735,365],[865,515]]},
  {name:'Marshland',desc:'Moeras met lage bewegingssnelheid',kind:'marsh',caps:[[280,155],[450,520],[760,175],[880,530]]},
  {name:'The Narrows',desc:'Bottlenecks rond de centrale weg',kind:'narrows',caps:[[285,345],[490,110],[740,640],[895,355]]},
  {name:'Last Fortress',desc:'Sterk verdedigbare eindzone',kind:'fortress',caps:[[285,220],[445,545],[755,250],[880,475]]},
];
export const GENERALS = [
  {id:'rommel',name:'Erwin Rommel',attack:.08,kills:3},
  {id:'montgomery',name:'Bernard Montgomery',attack:.10,kills:6},
  {id:'zhukov',name:'Georgy Zhukov',attack:.12,kills:10},
  {id:'guderian',name:'Heinz Guderian',attack:.14,kills:15},
  {id:'patton',name:'George S. Patton',attack:.15,kills:21},
  {id:'manstein',name:'Erich von Manstein',attack:.17,kills:28},
  {id:'rokossovsky',name:'Konstantin Rokossovski',attack:.19,kills:36},
  {id:'eisenhower',name:'Dwight D. Eisenhower',attack:.20,kills:46},
];
const r=(a,b)=>Math.random()*(b-a)+a;
const clamp=(a,b,c)=>Math.max(b,Math.min(c,a));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const enemy=t=>t==='blue'?'red':'blue';
function rel(x,y,b){const dx=x-b.x,dy=y-b.y,c=Math.cos(b.a),s=Math.sin(b.a);return {x:dx*c+dy*s,y:-dx*s+dy*c}}
function segmentHit(u,o,pad=0){const v=rel(u.x,u.y,o);return Math.abs(v.x)<=o.len/2+pad&&Math.abs(v.y)<=o.w/2+pad}
function isFinitePoint(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=WIDTH&&p.y>=0&&p.y<=HEIGHT}
function seedTerrain(index){const kind=MAPS[index].kind,water=[],hills=[],mud=[];
 const add=(x,y,rx,ry,a=0)=>hills.push({x,y,rx,ry,a});
 if(kind==='ridge')for(let i=0;i<6;i++){add(260+i*145,135+(i%2)*55,84,36,.4);add(290+i*140,585-(i%2)*60,87,35,-.35)}
 if(kind==='river'){water.push({kind:'river',x:595,w:110,bridges:[170,375,605],bh:64});for(let i=0;i<4;i++){add(240+i*165,80,75,36,.1);add(370+i*130,685,80,35,-.1)}}
 if(kind==='valley')for(let i=0;i<6;i++){add(200+i*155,115+Math.sin(i)*55,110,94,.2);add(205+i*155,650+Math.sin(i)*25,112,82,-.2)}
 if(kind==='coast'){water.push({kind:'coast',edge:495,w:155,bridges:[135,380,605],bh:76});for(let i=0;i<5;i++)add(300+i*160,220+(i%2)*315,70,65,.4)}
 if(kind==='desert')for(let i=0;i<14;i++)add(190+(i%7)*145,125+Math.floor(i/7)*475,72,27,i%2?.4:-.35)
 if(kind==='lakes'){water.push({kind:'ellipse',x:475,y:205,rx:185,ry:120},{kind:'ellipse',x:725,y:575,rx:194,ry:115});for(let i=0;i<4;i++)add(270+i*210,380,55,30,.2)}
 if(kind==='mountain'){for(let i=0;i<7;i++){add(180+i*151,145,90,105,.24);add(180+i*151,610,89,109,-.15)}add(610,355,94,55)}
 if(kind==='marsh'){for(let i=0;i<9;i++)mud.push({x:205+(i%5)*190,y:140+Math.floor(i/5)*430,rx:95,ry:88});water.push({kind:'ellipse',x:585,y:338,rx:87,ry:82},{kind:'ellipse',x:805,y:185,rx:70,ry:55});for(let i=0;i<4;i++)add(300+i*230,365,45,30)}
 if(kind==='narrows'){water.push({kind:'river',x:645,w:130,bridges:[110,365,630],bh:64});for(let i=0;i<5;i++){add(275+i*170,175,81,93);add(270+i*172,585,82,97)}}
 if(kind==='fortress'){for(let i=0;i<5;i++){add(300+i*150,140,82,62);add(340+i*135,620,80,67)}add(975,370,127,123)}
 return {water,hills,mud};
}
export class Battle {
 constructor(settings={}){
  const ix=clamp(Math.trunc(Number(settings.map)||0),0,9),mode=settings.mode==='classic'?'classic':'realistic';
  this.settings={map:ix,mode,noVision:mode==='realistic'&&!!settings.noVision,noMunition:mode==='realistic'&&!!settings.noMunition,weather:mode==='realistic'&&['clear','rain','fog','snow'].includes(settings.weather)?settings.weather:'clear',phase:mode==='realistic'&&['day','dusk','night','dawn'].includes(settings.phase)?settings.phase:'day',dynamic:mode==='realistic'&&!!settings.dynamic};
  this.map=seedTerrain(ix);this.mapIndex=ix;this.time=0;this.weatherClock=0;this.phaseClock=0;this.id=0;this.done=false;this.winner=null;this.feed=[];this.effects=[];this.projectiles=[];this.airlifts=[];this.units=[];this.objects=[];
  this.players={blue:{cash:24,kills:0,totalKills:0},red:{cash:24,kills:0,totalKills:0}};
  this.bases={blue:{x:90,y:375,hp:850,max:850,progress:0},red:{x:1110,y:375,hp:850,max:850,progress:0}};
  this.caps=MAPS[ix].caps.map(([x,y],i)=>({id:i,x,y,owner:null,progress:0,by:null}));
  for(const c of this.caps)if(this.water(c.x,c.y)){for(let radius=20,found=false;radius<290&&!found;radius+=20)for(let i=0;i<24;i++){let x=c.x+Math.cos(i*Math.PI/12)*radius,y=c.y+Math.sin(i*Math.PI/12)*radius;if(x>195&&x<1005&&y>60&&y<690&&!this.water(x,y)){c.x=x;c.y=y;found=true;break;}}}
  this.incomeClock=0;
  // Equal starting forces, unlike the single-player AI campaign.
  for(const team of ['blue','red'])for(let i=0;i<3;i++)this.spawn(team,'rifle',this.bases[team].x+(team==='blue'?65:-65),315+i*60,false);
  this.log('Multiplayer-operatie gestart. Beide legers hebben gelijke middelen.');
 }
 get realistic(){return this.settings.mode==='realistic'}
 log(message){this.feed.unshift({text:message,time:Math.floor(this.time)});this.feed=this.feed.slice(0,12)}
 water(x,y){return this.map.water.some(w=>w.kind==='ellipse'?((x-w.x)/w.rx)**2+((y-w.y)/w.ry)**2<1:w.kind==='river'?Math.abs(x-w.x)<w.w/2&&!w.bridges.some(b=>Math.abs(y-b)<w.bh/2):x>w.edge&&x<w.edge+w.w&&!w.bridges.some(b=>Math.abs(y-b)<w.bh/2))}
 hill(x,y){return this.map.hills.some(h=>{const q=rel(x,y,{...h,a:h.a});return(q.x/h.rx)**2+(q.y/h.ry)**2<.8})}
 mud(x,y){return this.map.mud.some(m=>((x-m.x)/m.rx)**2+((y-m.y)/m.ry)**2<1)}
 free(x,y,rad=8){return x>rad+6&&y>rad+6&&x<WIDTH-rad-6&&y<HEIGHT-rad-6&&!this.water(x,y)&&!this.objects.some(o=>o.hp>0&&o.type!=='minefield'&&segmentHit({x,y},o,rad))}
 clearLine(a,b,rad=8){let len=distance(a,b);for(let i=1;i<=Math.ceil(len/8);i++){const t=i/Math.ceil(len/8);if(!this.free(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,rad))return false}return true}
 nearBuild(team,x,y){return distance({x,y},this.bases[team])<=310||this.caps.some(c=>c.owner===team&&distance(c,{x,y})<150)}
 has(team,type){return this.objects.some(o=>o.hp>0&&o.team===team&&o.type===type)}
 cost(team,type){let n=UNITS[type].cost;if(this.realistic&&this.has(team,'barracks')&&['gunner','grenadier'].includes(type))n--;if(this.realistic&&this.has(team,'tankfactory')){if(type==='tank')n=8;if(type==='artillery')n=11}return n}
 spawn(team,type,x,y,pay=true){const st=UNITS[type];if(!st||(!this.realistic&&['scout','decoy'].includes(type)))return null;
  const player=this.players[team];if(pay&&(player.cash<this.cost(team,type)||distance({x,y},this.bases[team])>155+(this.has(team,'barracks')?35:0)))return null;
  if(!this.free(x,y,st.r)||this.units.filter(u=>u.team===team&&u.hp>0).length>=110)return null;
  if(pay)player.cash-=this.cost(team,type);
  const u={id:++this.id,team,type,x,y,hp:st.hp,max:st.hp,angle:team==='blue'?0:Math.PI,fire:Math.random()*st.rate,ammo:st.ammo,maxAmmo:st.ammo,order:null,orderType:'hold',target:null,supplyTime:0,generalId:null,cargo:[],loadedInto:null};this.units.push(u);return u;
 }
 vision(team,observer){if(!this.settings.noVision)return Infinity;let radius=observer.type==='scout'?355:observer.type==='artillery'?210:observer.type==='tank'||observer.type==='decoy'?245:observer.type==='radar'?290:observer.type==='bunker'?155:observer.type==='base'?135:215;
  if(this.settings.phase==='night')radius*=.67;else if(['dusk','dawn'].includes(this.settings.phase))radius*=.84;
  if(this.settings.weather==='fog')radius*=.56;else if(this.settings.weather==='snow')radius*=.89;
  if(observer.type==='radar')radius=Math.max(radius,290);return radius;
 }
 seen(team,target){if(!this.settings.noVision)return true;
  if(this.units.some(u=>u.team===team&&u.hp>0&&!u.loadedInto&&distance(u,target)<this.vision(team,u)))return true;
  if(distance(this.bases[team],target)<this.vision(team,{type:'base'}))return true;
  if(this.caps.some(c=>c.owner===team&&distance(c,target)<100))return true;
  return this.objects.some(o=>o.team===team&&o.type==='radar'&&o.hp>0&&distance(o,target)<this.vision(team,o));
 }
 identified(team,u){return u.type==='decoy'&&u.team!==team&&this.units.some(s=>s.team===team&&s.type==='scout'&&s.hp>0&&!s.loadedInto&&distance(s,u)<185*(this.settings.weather==='fog'?.76:1)*(this.settings.phase==='night'?.82:1))}
 validTarget(team,target){return target.hp>0&&this.seen(team,target)&&!(target.type==='decoy'&&this.identified(team,target));}
 mineSeen(team,o){return o.team===team||this.units.some(u=>u.team===team&&u.hp>0&&u.type==='scout'&&distance(u,o)<115);}
 candidateOrders(team,ids){if(!Array.isArray(ids))return [];let set=new Set(ids.slice(0,110).filter(x=>Number.isInteger(x)));return this.units.filter(u=>u.team===team&&u.hp>0&&!u.loadedInto&&set.has(u.id))}
 findFreeNear(team,type,p){const st=UNITS[type];for(let rad=0;rad<=110;rad+=20)for(let j=0;j<(rad?18:1);j++){let a=j/18*Math.PI*2+rad*.03,x=clamp(p.x+rad*Math.cos(a),20,1180),y=clamp(p.y+rad*Math.sin(a),20,730);
  if(distance({x,y},this.bases[team])<=155+(this.has(team,'barracks')?35:0)&&this.free(x,y,st.r)&&!this.units.some(u=>u.hp>0&&!u.loadedInto&&distance(u,{x,y})<st.r+UNITS[u.type].r+4))return {x,y};}return null}
 command(team,msg){if(this.done||!msg||typeof msg!=='object')return 'Wedstrijd afgelopen.';let action=String(msg.action||'');const p={x:Number(msg.x),y:Number(msg.y)};const selected=this.candidateOrders(team,msg.ids);
  if(action==='recruit'){const type=String(msg.unit||'');if(!UNITS[type])return 'Onbekende eenheid.';if(!isFinitePoint(p))return 'Ongeldige positie.';
   const count=Math.min(msg.batch?10:1,Math.floor(this.players[team].cash/this.cost(team,type)));let made=0;for(let i=0;i<count;i++){let near=this.findFreeNear(team,type,p);if(!near)break;if(this.spawn(team,type,near.x,near.y))made++};return made?`${made}× ${UNITS[type].name} gerekruteerd.`:'Onvoldoende credits, spawnruimte of limiet bereikt.'}
  if(action==='move'||action==='retreat'){if(!selected.length)return 'Selecteer eigen eenheden.';if(action==='move'&&!isFinitePoint(p))return 'Ongeldige bestemming.';
   let made=0;const cols=Math.ceil(Math.sqrt(selected.length)),rows=Math.ceil(selected.length/cols);for(let i=0;i<selected.length;i++){let u=selected[i];let dest=action==='retreat'?{x:this.bases[team].x+(team==='blue'?75:-75),y:clamp(u.y,200,550)}:{x:clamp(p.x+(i%cols-(cols-1)/2)*Math.max(20,UNITS[u.type].r*2+8),20,1180),y:clamp(p.y+(Math.floor(i/cols)-(rows-1)/2)*27,20,730)};
    if(!this.free(dest.x,dest.y,UNITS[u.type].r)){for(let r=15;r<130;r+=15){let found=false;for(let a=0;a<12;a++){const q={x:clamp(dest.x+Math.cos(a*Math.PI/6)*r,20,1180),y:clamp(dest.y+Math.sin(a*Math.PI/6)*r,20,730)};if(this.free(q.x,q.y,UNITS[u.type].r)){dest=q;found=true;break}}if(found)break}}
    if(!this.free(dest.x,dest.y,UNITS[u.type].r))continue;u.order=dest;u.orderType='move';u.target=null;made++}return `Verplaatsingsbevel voor ${made}/${selected.length} eenheden.`}
  if(action==='hold'){for(const u of selected){u.order=null;u.target=null;u.orderType='hold'}return `${selected.length} eenheden houden positie.`}
  if(action==='attack'){if(!selected.length)return 'Selecteer eerst troepen.';if(!isFinitePoint(p))return 'Ongeldig aanvalsdoel.';
   const all=[...this.units,...this.objects].filter(o=>o.team!==team&&o.hp>0&&o.type!=='minefield'&&this.seen(team,o));all.push(this.bases[enemy(team)]);
   all.sort((a,b)=>distance(a,p)-distance(b,p));let target=all[0];if(!target||distance(target,p)>55)return 'Geen zichtbaar doelwit op die positie.';
   for(const u of selected){u.order=null;u.orderType='attack';u.target=target.id??'base'}return `${selected.length} eenheden vallen aan.`}
  if(action==='build'){const type=String(msg.build||'');const b=BUILDINGS[type];if(!b)return 'Onbekend bouwwerk.';if(!this.realistic&&['barracks','tankfactory','depot','radar','bunker'].includes(type))return 'Alleen Realistic Game.';
   if(!isFinitePoint(p)||!this.nearBuild(team,p.x,p.y))return 'Bouw alleen in eigen gebied.';if(this.players[team].cash<b.cost)return 'Onvoldoende credits.';
   if(['radar','barracks','tankfactory','depot','bunker'].includes(type)&&this.objects.filter(o=>o.team===team&&o.type===type&&o.hp>0).length>=(type==='radar'?1:2))return 'Gebouwenlimiet bereikt.';
   const angle=clamp(Number(msg.angle)||0,-1000,1000);if(type==='minefield'){for(let i=-5;i<=5;i++){let x=p.x+Math.cos(angle)*i*10,y=p.y+Math.sin(angle)*i*10;if(x<15||x>1185||y<15||y>735||this.water(x,y)||this.objects.some(o=>o.type==='minefield'&&o.hp>0&&distance(o,{x,y})<18))return 'Geen ruimte voor mijnenveld.';}}
   else {for(let i=-3;i<=3;i++){let x=p.x+Math.cos(angle)*b.len/2*i/3,y=p.y+Math.sin(angle)*b.len/2*i/3;if(!this.free(x,y,b.w/2))return 'Geen vrije bouwruimte.';}}
   this.players[team].cash-=b.cost;this.objects.push({id:++this.id,team,type,x:p.x,y:p.y,a:angle,len:b.len,w:b.w,hp:b.hp,max:b.hp,fire:0});return `${b.name} gebouwd (${b.cost} credits).`}
  if(action==='upgrade'){if(this.players[team].cash<8)return '8 credits nodig.';this.players[team].cash-=8;this.bases[team].hp+=230;this.bases[team].max+=230;return 'Basis versterkt: +230 HP.'}
  if(action==='airlift'){if(!this.realistic)return 'Alleen Realistic Game.';if(this.players[team].cash<45)return 'Helikopterdropping kost 45 credits.';if(!isFinitePoint(p)||!this.free(p.x,p.y,20))return 'Kies droge, vrije grond.';
   if(this.units.filter(u=>u.team===team&&u.hp>0).length>100)return 'Troepenlimiet.';this.players[team].cash-=45;
   this.airlifts.push({id:++this.id,team,x:team==='blue'?-85:1285,y:clamp(p.y-180,50,700),goal:{x:p.x,y:p.y},arrival:4.3,delivered:false});return 'Helikopter onderweg met 10 machinegunners.'}
  if(action==='bomb'){if(this.players[team].cash<8)return 'Luchtaanval kost 8 credits.';if(!isFinitePoint(p))return 'Ongeldige locatie.';if(this.settings.noVision&&!this.visionAt(team,p))return 'In No Vision moet je de landingszone verkennen.';
   this.players[team].cash-=8;this.explode(p,78,95,team,'bomb');return 'Luchtaanval uitgevoerd.'}
  if(action==='assignGeneral'){const g=GENERALS.find(g=>g.id===msg.general);if(!g||this.players[team].totalKills<g.kills)return 'Generaal nog vergrendeld.';if(!selected.length||selected.length>20)return 'Selecteer 1 tot 20 eenheden.';
   for(const u of this.units)if(u.team===team&&u.generalId===g.id)u.generalId=null;for(const u of selected)u.generalId=g.id;return `${g.name} aangesteld.`}
  if(action==='load'){let troops=selected.filter(u=>!['truck','tank','artillery','decoy'].includes(u.type));let count=0;for(const u of troops){let tr=this.units.find(t=>t.team===team&&t.type==='truck'&&t.hp>0&&distance(u,t)<85&&t.cargo.length<6);if(tr){u.loadedInto=tr.id;u.order=null;tr.cargo.push(u.id);count++}}return `${count} soldaten ingestapt.`}
  if(action==='unload'){let count=0;for(const tr of selected.filter(u=>u.type==='truck')){for(const uid of tr.cargo){let u=this.units.find(x=>x.id===uid);if(!u)continue;for(let r=25;r<70;r+=15){let found=false;for(let a=0;a<12;a++){let x=tr.x+Math.cos(a*Math.PI/6)*r,y=tr.y+Math.sin(a*Math.PI/6)*r;if(this.free(x,y,UNITS[u.type].r)){u.x=x;u.y=y;u.loadedInto=null;count++;found=true;break}}if(found)break}}tr.cargo=tr.cargo.filter(uid=>this.units.some(u=>u.id===uid&&u.loadedInto===tr.id))}return `${count} soldaten uitgestapt.`}
  return 'Onbekend bevel.';
 }
 visionAt(team,p){return this.seen(team,p)}
 speed(u){let m=1;if(this.realistic){if(this.settings.weather==='rain')m*=['tank','artillery','truck'].includes(u.type)?.76:.95;if(this.settings.weather==='snow')m*=['tank','artillery','truck'].includes(u.type)?.69:.84;if(u.generalId==='rommel')m*=1.2;if(u.generalId==='patton'&&['tank','truck'].includes(u.type))m*=1.14;}if(this.mud(u.x,u.y))m*=.54;if(this.hill(u.x,u.y))m*=.86;return UNITS[u.type].speed*m}
 findPath(a,dest,radius){if(this.clearLine(a,dest,radius))return [dest];const S=30,nx=40,ny=25;
  let sx=clamp(Math.floor(a.x/S),0,nx-1),sy=clamp(Math.floor(a.y/S),0,ny-1),gx=clamp(Math.floor(dest.x/S),0,nx-1),gy=clamp(Math.floor(dest.y/S),0,ny-1);
  const ok=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny&&this.free(x*S+15,y*S+15,radius);
  const key=(x,y)=>y*nx+x;let open=[{x:sx,y:sy}],seen=new Set([key(sx,sy)]),parent=new Map(),end=null;const neighbors=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  for(let k=0;k<open.length&&k<1000;k++){const v=open[k];if(Math.hypot(v.x-gx,v.y-gy)<=1){end=v;break}for(const [dx,dy] of neighbors){const x=v.x+dx,y=v.y+dy,id=key(x,y);if(seen.has(id)||!ok(x,y))continue;if(dx&&dy&&(!ok(v.x+dx,v.y)||!ok(v.x,v.y+dy)))continue;seen.add(id);parent.set(id,key(v.x,v.y));open.push({x,y})}}
  if(!end)return [];const points=[];let id=key(end.x,end.y),start=key(sx,sy);for(let i=0;id!==start&&i<120;i++){const x=id%nx,y=Math.floor(id/nx);points.push({x:x*S+15,y:y*S+15});if(!parent.has(id))break;id=parent.get(id)}points.reverse();if(this.clearLine(points.at(-1)||a,dest,radius))points.push(dest);
  const output=[],cur={...a};for(let i=0;i<points.length;){let j=points.length-1;while(j>i&&!this.clearLine(cur,points[j],radius))j--;output.push(points[j]);Object.assign(cur,points[j]);i=j+1}return output;
 }
 damage(u,dmg,source,from){if(u.hp<=0)return;let reduction=this.hill(u.x,u.y)?.7:1;if(u.generalId==='montgomery')reduction*=.82;if(u.team&&this.objects.some(o=>o.type==='bunker'&&o.team===u.team&&o.hp>0&&distance(o,u)<95))reduction*=.80;
  if(source?.x!==undefined&&this.objects.some(o=>o.team===u.team&&o.hp>0&&['wall','sandbag'].includes(o.type)&&this.wallBetween(source,u,o)))reduction*=.35;
  const diff=Math.abs(Math.atan2(Math.sin((from??0)-u.angle),Math.cos((from??0)-u.angle)));if(diff>2.25)dmg*=1.7;else if(diff>1.1)dmg*=1.35;
  if(source?.type==='artillery'&&u.type==='tank')dmg*=2.2;
  u.hp-=dmg*reduction;if(u.hp<=0){u.hp=0;this.effects.push({x:u.x,y:u.y,r:28,life:.6});if(source&&source.team&&u.type!=='decoy'){let p=this.players[source.team];p.cash+=u.type==='tank'?5:u.type==='artillery'?6:u.type==='gunner'?3:2;p.kills++;p.totalKills++}if(u.cargo?.length)for(let uid of u.cargo){let passenger=this.units.find(x=>x.id===uid);if(passenger){passenger.hp=0;passenger.loadedInto=null}}}
 }
 wallBetween(a,b,o){const av=rel(a.x,a.y,o),bv=rel(b.x,b.y,o);if(av.y*bv.y>0)return false;const d=bv.y-av.y;if(Math.abs(d)<.01)return false;const t=-av.y/d;return t>0&&t<1&&Math.abs(av.x+(bv.x-av.x)*t)<=o.len/2+4}
 explode(p,radius,dmg,team,type){this.effects.push({x:p.x,y:p.y,r:radius,life:.65});for(const u of this.units){if(u.hp>0&&u.team!==team&&!u.loadedInto&&distance(u,p)<radius+UNITS[u.type].r)this.damage(u,dmg*(1-distance(u,p)/(radius+UNITS[u.type].r)*.45),{x:p.x,y:p.y,team,type},Math.atan2(u.y-p.y,u.x-p.x))}
  for(const o of this.objects)if(o.hp>0&&o.type!=='minefield'&&o.team!==team&&distance(o,p)<radius+o.len/2)o.hp-=dmg*.9;
  const b=this.bases[enemy(team)];if(distance(p,b)<radius+62)b.hp=Math.max(0,b.hp-dmg*.8);
 }
 fireAt(u,t){const st=UNITS[u.type];if(this.settings.noMunition&&u.ammo<=0)return;
  if(this.settings.noMunition)u.ammo--;u.fire=st.rate;const angle=Math.atan2(t.y-u.y,t.x-u.x);u.angle=angle;
  let dmg=st.dmg;const g=GENERALS.find(g=>g.id===u.generalId);if(g)dmg*=1+g.attack;if(this.realistic&&this.settings.weather==='snow')dmg*=.88;
  const isLob=['grenadier','artillery'].includes(u.type);const v=st.range>270?260:st.range>200?420:560;
  this.projectiles.push({id:++this.id,x:u.x,y:u.y,sx:u.x,sy:u.y,ex:t.x,ey:t.y,angle,team:u.team,type:u.type,damage:dmg,blast:st.splash||0,sourceId:u.id,life:st.range/v+.2,age:0,travel:Math.max(.12,distance(u,t)/v),vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,lob:isLob});
 }
 update(dt){if(this.done)return;this.time+=dt;this.incomeClock+=dt;while(this.incomeClock>=3){this.incomeClock-=3;for(const t of ['blue','red'])this.players[t].cash+=3+this.caps.filter(c=>c.owner===t).length}
  if(this.settings.dynamic){this.weatherClock+=dt;this.phaseClock+=dt;if(this.weatherClock>=90){this.weatherClock=0;let choices=['clear','rain','fog','snow'].filter(w=>w!==this.settings.weather);this.settings.weather=choices[randomInt(choices.length)];this.log('Nieuw weer: '+this.settings.weather+'.')}
   if(this.phaseClock>=80){this.phaseClock=0;let phases=['day','dusk','night','dawn'];this.settings.phase=phases[(phases.indexOf(this.settings.phase)+1)%4]}}
  for(const a of this.airlifts){a.arrival-=dt;if(a.arrival<=0&&!a.delivered){a.delivered=true;let made=0;for(let ring=28;ring<=180&&made<10;ring+=24)for(let i=0;i<16&&made<10;i++){let x=a.goal.x+Math.cos(i*Math.PI/8)*ring,y=a.goal.y+Math.sin(i*Math.PI/8)*ring;if(this.spawn(a.team,'gunner',x,y,false))made++}if(made<10)this.players[a.team].cash+=(10-made)*4.5;this.log('Helikopter '+(a.team==='blue'?'blauw':'rood')+' zet '+made+' machinegunners af.')}}this.airlifts=this.airlifts.filter(a=>!a.delivered);
  for(const u of this.units){if(u.hp<=0||u.loadedInto)continue;const st=UNITS[u.type];u.fire-=dt;
   if(u.target){const target=u.target==='base'?this.bases[enemy(u.team)]:[...this.units,...this.objects].find(t=>t.id===u.target&&t.hp>0);
    if(!target||!this.seen(u.team,target)){u.target=null;u.order=null;u.orderType='hold'}else{const desired=st.range?Math.max(20,st.range-20):30;if(distance(u,target)>desired){u.order={x:target.x,y:target.y}}else u.order=null}}
   if(u.order){let d=distance(u,u.order);if(d<=Math.max(st.r,8)){u.order=null;u.path=null}
    else {if(!u.path||!u.path.length||u.pathDestX!==u.order.x||u.pathDestY!==u.order.y){u.path=this.findPath(u,u.order,st.r);u.pathDestX=u.order.x;u.pathDestY=u.order.y}
      if(u.path?.length){const stepTo=u.path[0],d0=distance(u,stepTo);let speed=this.speed(u);let step=Math.min(d0,speed*dt);
       if(d0>0&&step>0){let x=u.x+(stepTo.x-u.x)*step/d0,y=u.y+(stepTo.y-u.y)*step/d0;if(this.clearLine(u,{x,y},st.r)){u.angle=Math.atan2(y-u.y,x-u.x);u.x=x;u.y=y}else u.path=[]}
       if(distance(u,stepTo)<Math.max(5,st.r*.3))u.path.shift();
      }
    }
   }
   if(st.range<=0||u.fire>0||(this.settings.noMunition&&u.ammo<=0)||u.orderType==='move'&&u.order)continue;
   let target=null;
   if(u.target){target=u.target==='base'?this.bases[enemy(u.team)]:[...this.units,...this.objects].find(t=>t.id===u.target&&t.hp>0);if(target&&!this.validTarget(u.team,target))target=null}
   if(!target){let candidates=[...this.units.filter(v=>v.team!==u.team&&v.hp>0&&!v.loadedInto),...this.objects.filter(o=>o.team!==u.team&&o.hp>0&&o.type!=='minefield'),this.bases[enemy(u.team)].hp>0?this.bases[enemy(u.team)]:null].filter(Boolean);
    candidates=candidates.filter(t=>this.validTarget(u.team,t)&&distance(u,t)<st.range*(this.realistic&&this.settings.weather==='snow'?.9:1)+((t===this.bases[enemy(u.team)])?40:0));candidates.sort((a,b)=>distance(a,u)-distance(b,u));target=candidates[0];}
   if(target&&distance(u,target)<=st.range+40)this.fireAt(u,target);
  }
  // Direct projectiles and ballistic explosives are computed on the server.
  for(const p of this.projectiles){p.age+=dt;p.life-=dt;
   if(p.lob){const f=Math.min(1,p.age/p.travel);p.x=p.sx+(p.ex-p.sx)*f;p.y=p.sy+(p.ey-p.sy)*f;if(f>=1){this.explode(p,p.blast,p.damage,p.team,p.type);p.life=0;}continue}
   p.x+=p.vx*dt;p.y+=p.vy*dt;let hit=this.units.find(u=>u.team!==p.team&&u.hp>0&&!u.loadedInto&&distance(p,u)<UNITS[u.type].r+5);
   if(!hit)hit=this.objects.find(o=>o.hp>0&&o.type!=='minefield'&&segmentHit(p,o,4));
   const eb=this.bases[enemy(p.team)];if(!hit&&eb.hp>0&&distance(p,eb)<57)hit=eb;
   if(hit){p.life=0;if(p.blast)this.explode(p,p.blast,p.damage,p.team,p.type);
    else if(hit===eb)eb.hp=Math.max(0,eb.hp-p.damage);
    else if('type' in hit&&hit.max&&'ammo' in hit)this.damage(hit,p.damage,{team:p.team,type:p.type,x:p.sx,y:p.sy},p.angle+Math.PI);
    else hit.hp-=p.damage;}
  }
  this.projectiles=this.projectiles.filter(p=>p.life>0);
  // Defensive structures fire automatically, respecting their owner's visibility.
  for(const o of this.objects){if(o.hp<=0||!['turret','bunker'].includes(o.type))continue;o.fire-=dt;if(o.fire>0)continue;let target=this.units.filter(u=>u.team!==o.team&&u.hp>0&&!u.loadedInto&&this.seen(o.team,u)&&distance(o,u)<BUILDINGS[o.type].range).sort((a,b)=>distance(o,a)-distance(o,b))[0];if(!target)continue;o.fire=o.type==='bunker'?.8:.55;this.damage(target,o.type==='bunker'?12:14,{team:o.team,type:o.type,x:o.x,y:o.y},Math.atan2(target.y-o.y,target.x-o.x))}
  for(const o of this.objects){if(o.type!=='minefield'||o.hp<=0)continue;let u=this.units.find(v=>v.team!==o.team&&v.hp>0&&!v.loadedInto&&segmentHit(v,o,UNITS[v.type].r));if(u){o.hp=0;this.explode({x:u.x,y:u.y},78,140,o.team,'minefield');this.log('Mijnenveld ontploft!')}}
  // V17 mechanic: 3 seconds of continuous physical contact with a friendly supply truck.
  for(const u of this.units){if(u.hp<=0||u.loadedInto||['truck','decoy'].includes(u.type)){u.supplyTime=0;continue}
   let needsAmmo=this.settings.noMunition&&u.ammo<u.maxAmmo,needsHealth=u.hp<u.max;
   if(!this.realistic||(!needsAmmo&&!needsHealth)){u.supplyTime=0;continue}
   const touching=this.units.some(tr=>tr.team===u.team&&tr.type==='truck'&&tr.hp>0&&distance(tr,u)<=UNITS.truck.r+UNITS[u.type].r+7);
   if(!touching){u.supplyTime=0;continue}u.supplyTime+=dt;if(u.supplyTime>=3){if(this.settings.noMunition)u.ammo=u.maxAmmo;u.hp=u.max;u.supplyTime=0;this.effects.push({x:u.x,y:u.y,r:24,life:.5});}}
  // Repair stations heal near units in realistic mode; munitions still require trucks.
  if(this.realistic)for(const o of this.objects){if(o.type!=='depot'||o.hp<=0)continue;for(const u of this.units)if(u.team===o.team&&u.hp>0&&!u.loadedInto&&distance(u,o)<135)u.hp=Math.min(u.max,u.hp+(['tank','truck','artillery'].includes(u.type)?10:5)*dt)}
  for(const c of this.caps){const near=this.units.filter(u=>u.hp>0&&!u.loadedInto&&distance(u,c)<48),blue=near.some(u=>u.team==='blue'),red=near.some(u=>u.team==='red');if(blue!==red){const t=blue?'blue':'red';if(c.by!==t){c.by=t;c.progress=0}if(c.owner!==t){c.progress+=dt;if(c.progress>=10){c.owner=t;c.progress=0;c.by=null;this.log((t==='blue'?'Blauw':'Rood')+' verovert post '+(c.id+1))}}}else if(!blue&&!red){c.progress=Math.max(0,c.progress-dt*.35);if(c.progress===0)c.by=null}}
  for(const team of ['blue','red']){const b=this.bases[team],other=enemy(team);const all=this.caps.every(c=>c.owner===other),attacking=this.units.some(u=>u.team===other&&u.hp>0&&!u.loadedInto&&distance(u,b)<68),defending=this.units.some(u=>u.team===team&&u.hp>0&&!u.loadedInto&&distance(u,b)<68);
   if(b.hp<=0&&all&&attacking&&!defending){b.progress+=dt;if(b.progress>=30){this.winner=other;this.done=true;this.log((other==='blue'?'Blauw':'Rood')+' wint!');}}else b.progress=Math.max(0,b.progress-dt*.35)}
  this.units=this.units.filter(u=>u.hp>0);this.objects=this.objects.filter(o=>o.hp>0);this.effects=this.effects.map(f=>({...f,life:f.life-dt})).filter(f=>f.life>0);
 }
 snapshot(team){const sanitizeUnit=u=>{const out={id:u.id,team:u.team,type:u.team!==team&&u.type==='decoy'&&!this.identified(team,u)?'tank':u.type,x:u.x,y:u.y,hp:u.hp,max:u.max,angle:u.angle,loadedInto:u.loadedInto??null};if(u.team===team){out.ammo=u.ammo;out.maxAmmo=u.maxAmmo;out.order=u.order;out.supplyTime=u.supplyTime;out.generalId=u.generalId;out.cargo=u.cargo}return out};
  const units=this.units.filter(u=>!u.loadedInto&&(u.team===team||this.seen(team,u))).map(sanitizeUnit);
  const objects=this.objects.filter(o=>o.team===team||(o.type==='minefield'?this.mineSeen(team,o):this.seen(team,o))).map(o=>({id:o.id,team:o.team,type:o.type,x:o.x,y:o.y,a:o.a,len:o.len,w:o.w,hp:o.hp,max:o.max}));
  const projectiles=this.projectiles.filter(p=>p.team===team||this.seen(team,p)).map(p=>({x:p.x,y:p.y,lob:p.lob,age:p.age,travel:p.travel,team:p.team}));
  const airlifts=this.airlifts.filter(a=>a.team===team||this.seen(team,a.goal)).map(a=>({id:a.id,team:a.team,x:a.goal.x,y:a.goal.y,seconds:a.arrival}));
  return {team,settings:this.settings,time:this.time,winner:this.winner,done:this.done,units,objects,projectiles,airlifts,effects:this.effects.filter(f=>this.seen(team,f)).map(f=>({x:f.x,y:f.y,r:f.r,life:f.life})),bases:this.bases,caps:this.caps,players:{[team]:this.players[team]},feed:this.feed.filter(e=>this.time-e.time<60),map:this.mapIndex};
 }
}

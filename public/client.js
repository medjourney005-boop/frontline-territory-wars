const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const T=Math.PI*2,W=1200,H=750;
let ws=null,connected=false,session=null,room=null,state=null,config=null;
let selected=new Set(),tool=null,toolKind=null,rotate=0,attackMode=false,batchMode=false,drag=null,mouse={x:0,y:0},prevRoomStatus=null;
const canvas=$('battlefield'),ctx=canvas.getContext('2d');
let ToastTimeout=null;
function show(page){for(const id of ['home','lobby','game'])$(id).hidden=id!==page;$('topstats').hidden=page!=='game';}
function status(message){$('statusText').textContent=message;}
function toast(message){$('mapToast').textContent=message;if(ToastTimeout)clearTimeout(ToastTimeout);ToastTimeout=setTimeout(()=>{$('mapToast').textContent='Selecteer troepen of kies links een eenheid om te plaatsen.'},4000);}
function send(obj){if(!connected||!ws||ws.readyState!==WebSocket.OPEN){status('Geen verbinding met server.');return false}ws.send(JSON.stringify(obj));return true}
function cmd(action,params={}){if(!session)return;send({type:'command',command:{action,ids:[...selected],...params}})}
function storeSession(s){try{if(s)localStorage.setItem('frontlineV18Session',JSON.stringify(s));else localStorage.removeItem('frontlineV18Session')}catch{}}
function savedSession(){try{return JSON.parse(localStorage.getItem('frontlineV18Session')||'null')}catch{return null}}
function connect(){const proto=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(proto+'//'+location.host+'/ws');status('Verbinden met spelserver…');
 ws.addEventListener('open',()=>{connected=true;status('Verbonden met online spelserver');$('connection').textContent='Online server beschikbaar';const saved=savedSession();if(saved?.token&&saved?.code){send({type:'resume',code:saved.code,token:saved.token})}else if(new URLSearchParams(location.search).get('room')){$('roomInput').value=new URLSearchParams(location.search).get('room')}});
 ws.addEventListener('message',e=>{let data;try{data=JSON.parse(e.data)}catch{return}handleMessage(data)});
 ws.addEventListener('close',()=>{connected=false;status('Verbinding onderbroken — opnieuw verbinden…');$('connection').textContent='Geen verbinding — automatische herverbinding…';if(state)$('battleBanner').hidden=false,$('battleBanner').textContent='VERBINDING VERBROKEN — HERSTELLEN…';setTimeout(connect,2000)});
 ws.addEventListener('error',()=>status('Serververbinding mislukt. Start of publiceer de Node.js-server.'));
}
function handleMessage(msg){if(msg.type==='error'){status(msg.message);if(msg.message.includes('herstelcode')||msg.message.includes('kamersessie')){storeSession(null);session=null;room=null;state=null;show('home')}if($('home').hidden)toast(msg.message);else $('connection').textContent=msg.message;return}
 if(msg.type==='session'){session={code:msg.code,team:msg.team,token:msg.token,host:msg.host};storeSession(session);$('roomCode').textContent=msg.code;const u=new URL(location.href);u.searchParams.set('room',msg.code);history.replaceState(null,'',u);status('Verbonden met kamer '+msg.code);}
 if(msg.type==='room'){room=msg;if(!session)return;if(msg.status==='lobby'){state=null;selected.clear();updateLobby();show('lobby')}else if(msg.status==='playing'||msg.status==='ended'){
  if(!state){show('game');buildShops();}$('battleBanner').hidden=msg.status!=='ended'&&!!msg.seats.blue?.connected&&!!msg.seats.red?.connected;
  if(msg.status==='ended')$('battleBanner').textContent=(msg.winner===session.team?'OVERWINNING':'NEDERLAAG')+' — wedstrijd beëindigd';
  else if(!msg.seats.blue?.connected||!msg.seats.red?.connected)$('battleBanner').textContent='TEGENSTANDER VERBINDING VERBROKEN — GEPAUZEERD';
  $('networkInfo').textContent=msg.seats.blue?.connected&&msg.seats.red?.connected?'2 spelers online · '+msg.code:'Verbinding met een speler verbroken · wedstrijd gepauzeerd';
 }}
 if(msg.type==='state'){if(!session)return;state=msg.state;if(!shopsMade)buildShops();show('game');selected=new Set([...selected].filter(id=>state.units.some(u=>u.id===id&&u.team===session.team)));updateGameUI();}
 if(msg.type==='notice'){toast(msg.message)}
 if(msg.type==='closed'){session=null;room=null;state=null;storeSession(null);history.replaceState(null,'',location.pathname);show('home');$('connection').textContent=msg.message;}
 if(msg.type==='left'){session=null;room=null;state=null;storeSession(null);history.replaceState(null,'',location.pathname);show('home')}
}
function localSettings(){return {map:Number($('mapSelect').value),mode:$('gameMode').value,noVision:$('noVision').checked,noMunition:$('noMunition').checked,weather:$('weather').value,phase:$('phase').value,dynamic:$('dynamic').checked}}
function updateLobby(){if(!room||!session)return;
 $('roomCode').textContent=room.code;for(const team of ['blue','red']){const seat=room.seats[team];$(team+'Name').textContent=seat?seat.name:'Wachten op speler…';$(team+'Status').textContent=seat?(seat.connected?(seat.ready?'GEREED':'NIET GEREED'):'OFFLINE'):'LEEG'}
 const me=room.seats[session.team],isHost=session.host;
 $('ready').textContent=me?.ready?'GEREED ✓ (intrekken)':'IK BEN GEREED';$('ready').classList.toggle('alt',!!me?.ready);
 $('start').hidden=!isHost;$('start').disabled=!(room.seats.blue?.ready&&room.seats.red?.ready&&room.seats.blue?.connected&&room.seats.red?.connected);
 for(const id of ['mapSelect','gameMode','noVision','noMunition','weather','phase','dynamic'])$(id).disabled=!isHost;
 const s=room.settings;for(const [id,val] of Object.entries({mapSelect:s.map,gameMode:s.mode,weather:s.weather,phase:s.phase}))$(id).value=val;
 $('noVision').checked=!!s.noVision;$('noMunition').checked=!!s.noMunition;$('dynamic').checked=!!s.dynamic;
 $('realisticSettings').hidden=s.mode!=='realistic';$('modeNote').textContent=s.mode==='classic'?'Classic: bestaande troepen, mijnen en basisversterkingen.':'Realistic Game: kies No Vision en No Munition onafhankelijk van elkaar. Beide gelden voor alle spelers.';
}
function updateGameUI(){if(!state||!session)return;const team=session.team,own=state.players[team];$('cash').textContent=Math.floor(own.cash);$('posts').textContent=state.caps.filter(c=>c.owner===team).length+'/4';$('kills').textContent=own.kills;
 const minutes=Math.floor(state.time/60),seconds=Math.floor(state.time%60);$('timer').textContent=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
 $('battleTitle').textContent='OPERATIE '+(state.map+1)+' — '+config.maps[state.map].name.toUpperCase();$('battleMode').textContent=state.settings.mode.toUpperCase()+(state.settings.noVision?' · NO VISION':'')+(state.settings.noMunition?' · NO MUNITION':'');
 $('teamLabel').textContent=team==='blue'?'BLAUW — JOUW LEGER':'ROOD — JOUW LEGER';$('teamLabel').classList.toggle('red',team==='red');
 $('objectives').innerHTML=state.caps.map((c,i)=>`<div class="target"><div class="title"><span>${i+1}. POST ${i+1}</span><small>${c.owner===team?'JOUW POST':c.owner?'VIJAND':'NEUTRAAL'}</small></div><div class="bar"><i style="width:${c.owner===team?100:c.progress*10}%;background:${c.by===team?'#76d9ec':'#e98780'}"></i></div></div>`).join('')+`<div class="target"><div class="title"><span>VIJANDELIJKE BASIS</span><span>${Math.ceil(state.bases[team==='blue'?'red':'blue'].hp)} HP</span></div><div class="bar"><i style="width:${100*state.bases[team==='blue'?'red':'blue'].hp/state.bases[team==='blue'?'red':'blue'].max}%;background:#eb8a85"></i></div><small>Verover alle vier posten en bezet de basis 30 sec.</small></div>`;
 const sel=state.units.filter(u=>selected.has(u.id)&&u.team===team);$('selectionInfo').innerHTML=sel.length?`<b>${sel.length} geselecteerd</b><div>${sel.map(u=>config.units[u.type]?.name).slice(0,5).join(', ')}${sel.length>5?'…':''}</div><div>HP: ${Math.ceil(sel.reduce((n,u)=>n+u.hp,0))}</div>${state.settings.noMunition?'<div>Munitie: '+sel.map(u=>(u.maxAmmo?`${u.ammo}/${u.maxAmmo}`:'n.v.t.')).slice(0,6).join(' · ')+'</div>':''}`:'Geen eigen eenheden geselecteerd.';
 $('events').innerHTML=state.feed.slice(0,7).map(x=>'<div>› '+escapeHtml(x.text)+'</div>').join('');
 for(const b of document.querySelectorAll('[data-available-realistic]'))b.hidden=state.settings.mode!=='realistic';
 renderGenerals();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shopButton(parent,key,meta,icon,price,kind,real=false){const b=document.createElement('button');b.type='button';b.dataset.unit=kind==='unit'?key:'';b.dataset.availableRealistic=real?'1':'';
 b.innerHTML=`<span class="symbol">${icon}</span><span class="item-meta"><b>${escapeHtml(meta)}</b><small>${kind==='unit'?(key==='decoy'?'Rijdt · kan niet schieten':key==='truck'?'Transport · bevoorraadt':key==='scout'?'Detecteert vijanden':'Rekruteer bij eigen basis'):kind==='build'?'Plaats in eigen gebied':'Klik op een doelplek'}</small></span><span class="price">${price}</span>`;
 b.onclick=()=>selectTool(key,kind,b);parent.append(b);return b;}
let shopsMade=false;
function buildShops(){if(!config)return;if(shopsMade)return;shopsMade=true;
 const icons={rifle:'♟',gunner:'⌁',grenadier:'✹',tank:'▰',artillery:'◉',truck:'▣',scout:'◈',decoy:'▱',wall:'▰',sandbag:'▱',turret:'⌖',minefield:'✹',barracks:'⌂',tankfactory:'▰',depot:'✚',radar:'◈',bunker:'▣'};
 for(const [key,st] of Object.entries(config.units))shopButton($('unitShop'),key,st.name,icons[key]||'•',st.cost,'unit',['scout','decoy'].includes(key));
 for(const [key,b] of Object.entries(config.buildings))shopButton($('buildShop'),key,b.name,icons[key]||'⌂',b.cost,'build',['barracks','tankfactory','depot','radar','bunker'].includes(key));
 shopButton($('specials'),'airlift','Helikopterdropping','🚁',45,'special',true);shopButton($('specials'),'bomb','Luchtaanval','✦',8,'special');
}
function selectTool(key,kind,button){tool=key;toolKind=kind;attackMode=false;$('attackMode').classList.remove('selected');$('selectMode').classList.remove('selected');document.querySelectorAll('.shop button').forEach(b=>b.classList.toggle('active',b===button));toast(kind==='unit'?'Tik in je basiszone om '+config.units[key].name+' te plaatsen.':kind==='build'?'Tik op de kaart om '+config.buildings[key].name+' te bouwen.':'Tik op de kaart om '+key+' uit te voeren.');}
function clearTool(){tool=null;toolKind=null;attackMode=false;document.querySelectorAll('.shop button').forEach(b=>b.classList.remove('active'));$('selectMode').classList.add('selected');$('attackMode').classList.remove('selected');}
function renderGenerals(){if(!state)return;const kills=state.players[session.team].totalKills;$('generals').innerHTML=config.generals.map(g=>`<button class="general-option" data-general="${g.id}" ${kills<g.kills?'disabled':''}>★ ${escapeHtml(g.name)} · +${Math.round(g.attack*100)}%<small>${kills>=g.kills?'Beschikbaar':'Vrij bij '+g.kills+' kills'}</small></button>`).join('');}
function optionsWiring(){for(const id of ['mapSelect','gameMode','noVision','noMunition','weather','phase','dynamic'])$(id).addEventListener('change',()=>{if(room&&session?.host)send({type:'settings',settings:localSettings()})});
 $('create').onclick=()=>send({type:'create',name:$('createName').value,settings:localSettings()});$('join').onclick=()=>send({type:'join',name:$('joinName').value,code:$('roomInput').value});
 $('ready').onclick=()=>send({type:'ready',ready:!room?.seats[session.team]?.ready});$('start').onclick=()=>send({type:'start'});
 $('leave').onclick=leaveRoom;$('backLobby').onclick=leaveRoom;
 $('copyCode').onclick=()=>navigator.clipboard?.writeText(session.code).then(()=>status('Kamercode gekopieerd')).catch(()=>window.prompt('Kopieer de kamercode:',session.code))||window.prompt('Kamercode:',session.code);
 $('shareLink').onclick=()=>{const u=new URL(location.href);u.searchParams.set('room',session.code);if(navigator.share)navigator.share({title:'Frontline Territory Wars 1v1',text:'Speel tegen mij. Kamercode: '+session.code,url:u.href}).catch(()=>{});else navigator.clipboard?.writeText(u.href).then(()=>status('Uitnodigingslink gekopieerd'))};
 $('all').onclick=()=>{if(!state)return;selected=new Set(state.units.filter(u=>u.team===session.team).map(u=>u.id));clearTool();updateGameUI()};$('hold').onclick=()=>cmd('hold');$('retreat').onclick=()=>cmd('retreat');$('load').onclick=()=>cmd('load');$('unload').onclick=()=>cmd('unload');$('clear').onclick=()=>{selected.clear();updateGameUI()};$('upgrade').onclick=()=>cmd('upgrade');
 $('rotateLeft').onclick=()=>{rotate-=Math.PI/12;toast('Gedraaid: '+Math.round(rotate*180/Math.PI)+'°')};$('rotateRight').onclick=()=>{rotate+=Math.PI/12;toast('Gedraaid: '+Math.round(rotate*180/Math.PI)+'°')};
 $('selectMode').onclick=()=>clearTool();$('clearTool').onclick=()=>clearTool();$('attackMode').onclick=()=>{clearTool();attackMode=true;$('attackMode').classList.add('selected');$('selectMode').classList.remove('selected');toast('Tik op een zichtbaar vijandelijk doelwit om het aan te vallen.')};$('batchMode').onclick=()=>{batchMode=!batchMode;$('batchMode').textContent='10× rekruteren: '+(batchMode?'AAN':'UIT');$('batchMode').classList.toggle('selected',batchMode)};
 $('generals').addEventListener('click',e=>{let b=e.target.closest('[data-general]');if(b)cmd('assignGeneral',{general:b.dataset.general})});
 window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)||!state)return;const key=e.key.toLowerCase();if(key==='q')rotate-=Math.PI/12;if(key==='e')rotate+=Math.PI/12;if(key==='h')cmd('hold');if(key==='r')cmd('retreat');if(key==='escape')clearTool();if(e.ctrlKey&&key==='a'){e.preventDefault();$('all').click()}});
}
function leaveRoom(){if(!confirm('Deze online kamer verlaten?'))return;send({type:'leave'});storeSession(null);session=null;room=null;state=null;selected.clear();history.replaceState(null,'',location.pathname);show('home')}
function point(e){const r=canvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width*W,0,W),y:clamp((e.clientY-r.top)/r.height*H,0,H)}}
canvas.addEventListener('pointerdown',e=>{if(!state||state.done||e.button!==0)return;drag={start:point(e),end:point(e),active:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{mouse=point(e);if(drag){drag.end=mouse;drag.active=dist(drag.start,drag.end)>18}});
canvas.addEventListener('pointerup',e=>{if(!state||state.done||!drag||e.button!==0)return;const p=point(e),start=drag.start,box=drag.active;drag=null;
 if(box&&tool===null&&!attackMode){selected=new Set(state.units.filter(u=>u.team===session.team&&u.x>=Math.min(start.x,p.x)&&u.x<=Math.max(start.x,p.x)&&u.y>=Math.min(start.y,p.y)&&u.y<=Math.max(start.y,p.y)).map(u=>u.id));updateGameUI();return}
 if(tool){if(toolKind==='unit')cmd('recruit',{unit:tool,x:p.x,y:p.y,batch:batchMode||e.ctrlKey});else if(toolKind==='build')cmd('build',{build:tool,x:p.x,y:p.y,angle:rotate});else cmd(tool,{x:p.x,y:p.y});return}
 if(attackMode){cmd('attack',{x:p.x,y:p.y});return}
 const unit=state.units.filter(u=>u.team===session.team).reverse().find(u=>dist(u,p)<(config.units[u.type]?.r||8)+12);
 if(unit&&!selected.has(unit.id)){if(!e.shiftKey)selected.clear();selected.add(unit.id);updateGameUI();return}
 if(unit&&e.shiftKey){if(selected.has(unit.id))selected.delete(unit.id);else selected.add(unit.id);updateGameUI();return}
 if(selected.size){cmd('move',{x:p.x,y:p.y});return}
 if(unit){selected=new Set([unit.id]);updateGameUI();return}
});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(!state||!selected.size)return;const p=point(e);cmd('attack',{x:p.x,y:p.y})});
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,T);ctx.fill()}
function line(x,y,X,Y,c,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke()}
function ellipse(x,y,rx,ry,fill,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,T);ctx.fill();ctx.restore()}
function inWater(x,y,water){return water.some(w=>w.kind==='ellipse'?((x-w.x)/w.rx)**2+((y-w.y)/w.ry)**2<1:w.kind==='river'?Math.abs(x-w.x)<w.w/2&&!w.bridges.some(b=>Math.abs(y-b)<w.bh/2):x>w.edge&&x<w.edge+w.w&&!w.bridges.some(b=>Math.abs(y-b)<w.bh/2))}
function terrain(index){const kind=config.maps[index].kind,water=[],hills=[],mud=[];
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
 return {kind,water,hills,mud};
}
let mapCacheIndex=-1,mapCache=null;
function paintTerrain(){let index=state.map;if(mapCacheIndex!==index){mapCache=terrain(index);mapCacheIndex=index}const m=mapCache,desert=m.kind==='desert';rect(0,0,W,H,desert?'#6c6547':'#344f40');
 for(let y=0;y<H;y+=35)for(let x=0;x<W;x+=35){let n=(Math.sin(x*.07+y*.03+index*4)+Math.cos(y*.085-x*.03))*.5;rect(x,y,35,35,`rgba(${desert?'140,113,63':'108,136,90'},${.04+Math.abs(n)*.052})`)}
 ctx.save();ctx.setLineDash([13,13]);line(40,372,1160,372,'#a99d7455',29);ctx.restore();
 for(const h of m.hills){ellipse(h.x,h.y,h.rx,h.ry,desert?'#97835c':'#64785b',h.a);ellipse(h.x-6,h.y-5,h.rx*.74,h.ry*.72,'#ffffff08',h.a)}
 for(const q of m.mud)ellipse(q.x,q.y,q.rx,q.ry,'#534c39a6');
 for(const z of m.water){if(z.kind==='ellipse'){ellipse(z.x,z.y,z.rx,z.ry,'#326d83');ellipse(z.x,z.y,z.rx*.92,z.ry*.91,'#36758c');}else{let x=z.kind==='river'?z.x-z.w/2:z.edge;rect(x,0,z.w,750,'#326d83');for(let b of z.bridges){rect(x-6,b-z.bh/2,z.w+12,z.bh,'#958368');for(let xx=x;xx<x+z.w;xx+=12)line(xx,b-z.bh/2,xx,b+z.bh/2,'#574f3d77',2)}}}
 // Deterministic decoration, without any network-visible hidden unit info.
 for(let i=0;i<85;i++){let x=55+fract(Math.sin((i+310+index*37.1)*78.233)*43758.1)*1080,y=20+fract(Math.sin((i+425+index*37.1)*78.233)*43758.1)*700;if(inWater(x,y,m.water))continue;let radius=3+(i%4);circle(x,y,radius+1,'#192c2499');circle(x,y,radius,desert?'#777150':'#35563e')}
}
function fract(a){return a-Math.floor(a)}
function paintBases(){for(const team of ['blue','red']){let b=state.bases[team],color=team==='blue'?'#7ad9e9':'#ed8881';circle(b.x,b.y,69,team==='blue'?'#1b5260':'#6d4040');ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,65,0,T);ctx.stroke();ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.PI/4);rect(-35,-35,70,70,'#233840');rect(-25,-25,50,50,team==='blue'?'#608d99':'#a36b63');rect(-15,-15,30,30,'#1a2836');ctx.restore();ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#f1f5ed';ctx.fillText(team===session.team?'JOUW BASIS':'VIJAND',b.x,b.y-90);rect(b.x-50,b.y+78,100,7,'#213241');rect(b.x-50,b.y+78,100*Math.max(0,b.hp/b.max),7,color);if(b.hp<=0){ctx.fillStyle=color;ctx.fillText('BEZETTING '+Math.floor(b.progress)+'/30',b.x,b.y+108)}}}
function paintCaps(){for(const c of state.caps){let color=c.owner==='blue'?'#6edde9':c.owner==='red'?'#f38e83':'#e6d0a2';circle(c.x,c.y,48,color+'20');ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.x,c.y,36,-Math.PI/2,-Math.PI/2+T*(c.owner?1:c.progress/10));ctx.stroke();circle(c.x,c.y,23,'#152a33dd');ctx.fillStyle=color;ctx.font='bold 19px system-ui';ctx.textAlign='center';ctx.fillText('⚑',c.x,c.y+7);ctx.font='bold 11px system-ui';ctx.fillText('POST '+(c.id+1),c.x,c.y-53)}}
function paintObjects(){for(const o of state.objects){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.a);let color=o.team==='blue'?'#7edce8':'#ea8c83';if(o.type==='wall'){rect(-o.len/2-3,-o.w/2-3,o.len+6,o.w+6,'#203535');rect(-o.len/2,-o.w/2,o.len,o.w,'#8c988f');for(let xx=-o.len/2;xx<o.len/2;xx+=20)line(xx,-o.w/2,xx,o.w/2,'#53635b',2)}else if(o.type==='sandbag'){rect(-o.len/2,-o.w/2,o.len,o.w,'#534e3d');for(let xx=-o.len/2+8;xx<o.len/2;xx+=17)ellipse(xx,0,7,6,'#b8a17e')}else if(o.type==='minefield'){rect(-o.len/2,-o.w/2,o.len,o.w,'#8e4f35a5');for(let xx=-o.len/2+12;xx<o.len/2;xx+=19){circle(xx,0,5,'#d28454');line(xx-6,-6,xx+6,6,'#231d19',2)}}else if(o.type==='turret'){circle(0,0,16,'#283e46');circle(0,0,12,color);rect(0,-3,25,6,'#26323b')}else{let sym={barracks:'⌂',tankfactory:'▰',depot:'✚',radar:'◈',bunker:'▣'}[o.type]||'•';rect(-o.len/2,-o.w/2,o.len,o.w,o.team==='blue'?'#335c62':'#795151');ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(-o.len/2,-o.w/2,o.len,o.w);ctx.fillStyle='#ffe3a4';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.fillText(sym,0,8)}ctx.restore();if(o.hp<o.max){rect(o.x-25,o.y-o.w/2-12,50,4,'#1b2730');rect(o.x-25,o.y-o.w/2-12,50*o.hp/o.max,4,color)}}}
function paintUnits(){for(const u of state.units){const spec=config.units[u.type];if(!spec)continue;const r=spec.r,col=u.team==='blue'?'#72dce9':'#f18b82';circle(u.x+2,u.y+3,r+2,'#0d1c22aa');ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.angle);
 if(['tank','artillery','truck','decoy'].includes(u.type)){rect(-r,-r*.75,r*2,r*1.5,u.team==='blue'?'#487984':'#9c6255');if(['tank','decoy'].includes(u.type)){rect(-10,-10,20,20,'#283d43');rect(3,-3,r+12,6,'#1b2e32')}else if(u.type==='artillery'){circle(0,0,9,'#29373e');rect(2,-4,r+16,8,'#222e35')}else{rect(-9,-9,18,18,'#b1b4a5');rect(-r,-r,r*2,3,'#25323b');rect(-r,r-3,r*2,3,'#25323b')}}else{circle(0,0,r,col);circle(0,0,r*.65,u.team==='blue'?'#274953':'#643c3e');rect(3,-2,r+9,4,'#243138');if(u.type==='scout'){ctx.strokeStyle='#a5f5cd';ctx.lineWidth=2;ctx.strokeRect(-6,-6,12,12)}if(u.type==='grenadier')circle(2,5,3,'#ffd981');if(u.type==='gunner')rect(7,-4,12,8,'#273039')}
 ctx.restore();if(u.team===session.team&&u.type==='decoy'){ctx.fillStyle='#ffe19e';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText('NEP',u.x,u.y-r-11)}
 if(selected.has(u.id)){ctx.lineWidth=2;ctx.strokeStyle='#f7d785';ctx.beginPath();ctx.arc(u.x,u.y,r+7,0,T);ctx.stroke();if(u.order)line(u.x,u.y,u.order.x,u.order.y,'#f5d48d77',1)}
 if(u.team===session.team&&u.generalId){ctx.fillStyle='#ffe2a0';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('★',u.x,u.y-r-16)}
 if(u.hp<u.max){rect(u.x-20,u.y-r-11,40,4,'#18242d');rect(u.x-20,u.y-r-11,40*Math.max(0,u.hp/u.max),4,col)}
 if(state.settings.noMunition&&u.team===session.team&&u.maxAmmo){ctx.strokeStyle='#ffcf55';ctx.lineWidth=3;ctx.beginPath();ctx.arc(u.x,u.y,r+4,-Math.PI/2,-Math.PI/2+T*(u.ammo/u.maxAmmo));ctx.stroke();if(u.ammo===0){ctx.fillStyle='#ffb954';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText('LEEG',u.x,u.y+r+18)}}
 if(u.team===session.team&&u.supplyTime>0){ctx.strokeStyle='#8fffc0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(u.x,u.y,r+11,-Math.PI/2,-Math.PI/2+T*(u.supplyTime/3));ctx.stroke()}
 if(u.type==='truck'&&u.team===session.team&&u.cargo?.length){ctx.fillStyle='#fff';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(u.cargo.length+'/6',u.x,u.y-20)}
 }}
function paintSight(){if(!state.settings.noVision)return;ctx.save();ctx.fillStyle='rgba(6,16,28,.86)';ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='destination-out';const reveal=(x,y,r)=>{let gr=ctx.createRadialGradient(x,y,Math.max(1,r*.55),x,y,r);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,T);ctx.fill()};
 let rad=(type)=>{let radius=type==='scout'?355:type==='artillery'?210:type==='tank'||type==='decoy'?245:type==='radar'?290:type==='base'?135:215;if(state.settings.phase==='night')radius*=.67;else if(['dusk','dawn'].includes(state.settings.phase))radius*=.84;if(state.settings.weather==='fog')radius*=.56;else if(state.settings.weather==='snow')radius*=.89;if(type==='radar')radius=Math.max(radius,290);return radius};
 for(const u of state.units)if(u.team===session.team)reveal(u.x,u.y,rad(u.type));for(const o of state.objects)if(o.team===session.team&&o.type==='radar')reveal(o.x,o.y,rad(o.type));const base=state.bases[session.team];reveal(base.x,base.y,rad('base'));for(const c of state.caps)if(c.owner===session.team)reveal(c.x,c.y,100);
 ctx.restore();}
function paintWeather(){const w=state.settings.weather,p=state.settings.phase;if(p==='night')rect(0,0,W,H,'#07142640');else if(p==='dusk')rect(0,0,W,H,'#10162a22');if(w==='fog')rect(0,0,W,H,'#c4d5dc19');if(w==='rain'){for(let i=0;i<90;i++){let x=(i*83+state.time*50)%W,y=(i*49+state.time*230)%H;line(x,y,x-8,y+19,'#a2c9e044',1)}}if(w==='snow')for(let i=0;i<90;i++){let x=(i*83+state.time*(6+i%4))%W,y=(i*47+state.time*18)%H;circle(x,y,1.7,'#eff7ff88')}}
function draw(){if(state&&config){ctx.clearRect(0,0,W,H);paintTerrain();paintCaps();paintBases();paintObjects();paintUnits();paintWeather();paintSight();
  for(const p of state.projectiles)circle(p.x,p.y-(p.lob?Math.sin(Math.PI*clamp(p.age/p.travel,0,1))*35:0),p.lob?3.5:2,p.team==='blue'?'#ffe9a9':'#fbc6a2');
  for(const f of state.effects){ctx.strokeStyle='#ffcc7188';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1-f.life),0,T);ctx.stroke()}
  if(drag?.active){const x=Math.min(drag.start.x,drag.end.x),y=Math.min(drag.start.y,drag.end.y),w=Math.abs(drag.start.x-drag.end.x),h=Math.abs(drag.start.y-drag.end.y);rect(x,y,w,h,'#83e6eb22');ctx.strokeStyle='#8de6e8';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h)}
  if(toolKind==='build'&&tool){const b=config.buildings[tool];if(b){ctx.save();ctx.globalAlpha=.55;ctx.translate(mouse.x,mouse.y);ctx.rotate(rotate);rect(-b.len/2,-b.w/2,b.len,b.w,'#f6d886');ctx.restore()}}
 }requestAnimationFrame(draw)}
(async function init(){try{config=await (await fetch('/config.json')).json();for(let i=0;i<config.maps.length;i++)$('mapSelect').add(new Option(String(i+1).padStart(2,'0')+' — '+config.maps[i].name,String(i)));optionsWiring();show('home');connect();requestAnimationFrame(draw)}catch(e){$('connection').textContent='Kon spelinstellingen niet laden. Start de Node.js-server.';console.error(e)}})();

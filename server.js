import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { Battle, MAPS, UNITS, BUILDINGS, GENERALS } from './game.js';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const PORT=Number(process.env.PORT)||3000;
const rooms=new Map();
const makeToken=()=>randomBytes(24).toString('base64url');
const makeCode=()=>{let code;do{code='FT-'+randomInt(100000,1000000)}while(rooms.has(code));return code};
const nameOf=s=>String(s||'Speler').replace(/[<>\r\n\x00-\x1f]/g,'').trim().slice(0,22)||'Speler';
const whitelistSettings=s=>({map:Math.max(0,Math.min(9,Math.trunc(Number(s?.map)||0))),mode:s?.mode==='classic'?'classic':'realistic',noVision:s?.noVision===true,noMunition:s?.noMunition===true,weather:['clear','rain','fog','snow'].includes(s?.weather)?s.weather:'clear',phase:['day','dusk','night','dawn'].includes(s?.phase)?s.phase:'day',dynamic:!!s?.dynamic});
const lobby=room=>({type:'room',code:room.code,status:room.status,settings:room.settings,seats:{blue:room.seats.blue?{name:room.seats.blue.name,connected:!!room.seats.blue.ws,ready:room.seats.blue.ready}:null,red:room.seats.red?{name:room.seats.red.name,connected:!!room.seats.red.ws,ready:room.seats.red.ready}:null},winner:room.game?.winner||null});
function send(ws,obj){if(ws&&!ws.destroyed)try{ws.send(JSON.stringify(obj))}catch{}}
function broadcast(room,obj){for(const team of ['blue','red'])send(room.seats[team]?.ws,obj)}
function broadcastRoom(room){broadcast(room,lobby(room))}
function error(ws,message){send(ws,{type:'error',message})}
function sessionOf(ws){if(!ws.room||!ws.team)return null;let room=rooms.get(ws.room);let seat=room?.seats[ws.team];return seat?.ws===ws?{room,seat,team:ws.team}:null}
function detach(ws){let old=sessionOf(ws);if(old){old.seat.ws=null;old.seat.ready=old.room.status==='playing'?old.seat.ready:false;old.room.lastActivity=Date.now();broadcastRoom(old.room);}ws.room=null;ws.team=null}
function handle(ws,data){const type=String(data?.type||'');if(type==='create'){
  if(sessionOf(ws))return error(ws,'Je zit al in een kamer.');if(rooms.size>=200)return error(ws,'Server heeft tijdelijk te veel kamers.');
  const code=makeCode(),token=makeToken(),settings=whitelistSettings(data.settings),room={code,settings,status:'lobby',seats:{blue:{name:nameOf(data.name),token,ready:false,ws},red:null},game:null,lastActivity:Date.now()};rooms.set(code,room);ws.room=code;ws.team='blue';send(ws,{type:'session',code,team:'blue',token,host:true});broadcastRoom(room);return;
 }
 if(type==='join'){
  if(sessionOf(ws))return error(ws,'Je zit al in een kamer.');const code=String(data.code||'').trim().toUpperCase();const room=rooms.get(code);if(!room)return error(ws,'Kamer niet gevonden. Controleer de code.');
  if(room.status!=='lobby'||room.seats.red)return error(ws,'De kamer is vol of de wedstrijd is gestart.');
  let token=makeToken();room.seats.red={name:nameOf(data.name),token,ready:false,ws};ws.room=code;ws.team='red';room.lastActivity=Date.now();send(ws,{type:'session',code,team:'red',token,host:false});broadcastRoom(room);return;
 }
 if(type==='resume'){
  if(sessionOf(ws))return error(ws,'Je zit al in een kamer.');const code=String(data.code||'').trim().toUpperCase(),token=String(data.token||'');const room=rooms.get(code);if(!room||!token)return error(ws,'Eerdere kamersessie niet gevonden.');
  const team=['blue','red'].find(t=>room.seats[t]&&secureMatch(room.seats[t].token,token));if(!team)return error(ws,'De herstelcode is niet geldig.');
  let seat=room.seats[team];if(seat.ws&&seat.ws!==ws){let old=seat.ws;seat.ws=null;old.room=null;old.team=null;old.close()}
  seat.ws=ws;ws.room=code;ws.team=team;room.lastActivity=Date.now();send(ws,{type:'session',code,team,token,host:team==='blue'});broadcastRoom(room);if(room.game)send(ws,{type:'state',state:room.game.snapshot(team)});return;
 }
 const session=sessionOf(ws);if(!session)return error(ws,'Maak eerst een kamer of voer een kamercode in.');const {room,team,seat}=session;room.lastActivity=Date.now();
 if(type==='leave'){
  if(room.status==='lobby'){
   if(team==='blue'){for(const t of ['blue','red']){const other=room.seats[t]?.ws;if(other&&other!==ws){other.room=null;other.team=null;send(other,{type:'closed',message:'De host heeft de kamer gesloten.'})}}rooms.delete(room.code)}
   else {room.seats.red=null;broadcastRoom(room)}
  }else if(room.status==='playing'&&room.game){room.game.done=true;room.game.winner=team==='blue'?'red':'blue';room.status='ended';room.game.log('Een speler heeft de wedstrijd verlaten.');}
  detach(ws);send(ws,{type:'left'});if(room.status==='ended')broadcastRoom(room);return}

 if(type==='settings'){if(room.status!=='lobby'||team!=='blue')return error(ws,'Alleen de host stelt de lobby in.');room.settings=whitelistSettings(data.settings);for(const t of ['blue','red'])if(room.seats[t])room.seats[t].ready=false;broadcastRoom(room);return}
 if(type==='ready'){if(room.status!=='lobby')return;seat.ready=!!data.ready;broadcastRoom(room);return}
 if(type==='start'){if(team!=='blue'||room.status!=='lobby')return error(ws,'Alleen de host kan de wedstrijd starten.');if(!room.seats.red||!room.seats.blue.ready||!room.seats.red.ready||!room.seats.red.ws||!room.seats.blue.ws)return error(ws,'Beide spelers moeten verbonden en gereed zijn.');room.game=new Battle(room.settings);room.status='playing';broadcastRoom(room);for(const t of ['blue','red'])send(room.seats[t]?.ws,{type:'state',state:room.game.snapshot(t)});return}
 if(type==='command'){if(room.status!=='playing'||!room.game)return error(ws,'De wedstrijd is niet gestart.');if(!room.seats.blue?.ws||!room.seats.red?.ws)return error(ws,'Wedstrijd gepauzeerd: verbinding van tegenstander ontbreekt.');
  let now=Date.now();if(now-(ws.rateStart||0)>1000){ws.rateStart=now;ws.rateCount=0}if(++ws.rateCount>40)return error(ws,'Te veel bevelen tegelijk.');let result=room.game.command(team,data.command);send(ws,{type:'notice',message:result});return}
 if(type==='rematch'){if(room.status!=='ended')return error(ws,'Wedstrijd nog niet voorbij.');seat.ready=!!data.ready;if(room.seats.blue?.ready&&room.seats.red?.ready&&room.seats.blue.ws&&room.seats.red.ws){room.game=new Battle(room.settings);room.status='playing';for(const t of ['blue','red'])room.seats[t].ready=false;}broadcastRoom(room);return}
 }
function secureMatch(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return}
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 if(pathname==='/config.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({maps:MAPS,units:UNITS,buildings:BUILDINGS,generals:GENERALS}));return}
 if(pathname==='/')pathname='/index.html';let filepath=path.resolve(ROOT,'.'+pathname);if(!filepath.startsWith(ROOT+path.sep)||!fs.existsSync(filepath)||!fs.statSync(filepath).isFile()){res.writeHead(404);res.end('Not found');return}
 res.writeHead(200,{'Content-Type':mime[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(filepath).pipe(res);
});

class Socket {
 constructor(socket){this.socket=socket;this.buffer=Buffer.alloc(0);this.destroyed=false;this.room=null;this.team=null;this.rateStart=0;this.rateCount=0;
  socket.on('data',buf=>this.read(buf));socket.on('end',()=>this.drop());socket.on('close',()=>this.drop());socket.on('error',()=>this.drop());}
 send(text){if(this.destroyed)return;const payload=Buffer.from(text);let header;
  if(payload.length<126){header=Buffer.from([0x81,payload.length])}else if(payload.length<65536){header=Buffer.alloc(4);header[0]=0x81;header[1]=126;header.writeUInt16BE(payload.length,2)}else{header=Buffer.alloc(10);header[0]=0x81;header[1]=127;header.writeBigUInt64BE(BigInt(payload.length),2)}
  if(this.socket.writable&&this.socket.writableLength<1_000_000)this.socket.write(Buffer.concat([header,payload]));}
 close(){if(!this.destroyed)this.socket.end()}
 drop(){if(this.destroyed)return;detach(this);this.destroyed=true}
 read(buf){if(this.destroyed)return;this.buffer=Buffer.concat([this.buffer,buf]);if(this.buffer.length>100_000){this.close();return}
  while(this.buffer.length>=2){let b0=this.buffer[0],b1=this.buffer[1],opcode=b0&15,mask=(b1&128)!==0,len=b1&127,offset=2;
   if((b0&0x80)===0||!mask){this.close();return}if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);offset=4}
   if(len===127){if(this.buffer.length<10)return;const n=this.buffer.readBigUInt64BE(2);if(n>16384n){this.close();return}len=Number(n);offset=10}
   if(len>16384){this.close();return}if(this.buffer.length<offset+4+len)return;
   let key=this.buffer.subarray(offset,offset+4),payload=Buffer.from(this.buffer.subarray(offset+4,offset+4+len));this.buffer=this.buffer.subarray(offset+4+len);for(let i=0;i<len;i++)payload[i]^=key[i%4];
   if(opcode===8){this.close();return}if(opcode===9){this.pong(payload);continue}if(opcode!==1)continue;
   let data;try{data=JSON.parse(payload.toString('utf8'))}catch{error(this,'Ongeldig bericht.');continue}
   try{handle(this,data)}catch(e){console.error('Command error:',e);error(this,'Het bevel kon niet worden verwerkt.');}
  }
 }
 pong(payload){if(!this.destroyed)this.socket.write(Buffer.concat([Buffer.from([0x8a,payload.length]),payload]))}
}
server.on('upgrade',(req,socket)=>{
  let origin=req.headers.origin;let target=req.headers.host;
  let validOrigin=true;try{if(origin&&new URL(origin).host!==target)validOrigin=false}catch{validOrigin=false}
  if(req.url!=='/ws'||!req.headers['sec-websocket-key']||req.headers.upgrade?.toLowerCase()!=='websocket'||!validOrigin){socket.destroy();return}
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');new Socket(socket);
});
let loopLast=performance.now(),broadcastTick=0;
setInterval(()=>{let now=performance.now(),dt=Math.min(.1,(now-loopLast)/1000);loopLast=now;broadcastTick++;
 for(const room of rooms.values()){if(room.status!=='playing'||!room.game)continue;
  if(!room.seats.blue?.ws||!room.seats.red?.ws)continue;
  try{room.game.update(dt)}catch(err){console.error('Simulation error',err);continue}
  if(room.game.done){room.status='ended';broadcastRoom(room)}
  if(broadcastTick%2===0||room.game.done)for(const team of ['blue','red'])send(room.seats[team]?.ws,{type:'state',state:room.game.snapshot(team)});
 }
},50);
setInterval(()=>{const now=Date.now();for(const [code,room] of rooms){const online=!!room.seats.blue?.ws||!!room.seats.red?.ws;if(!online&&now-room.lastActivity>60*60*1000)rooms.delete(code)}},60000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log('FRONTLINE V18 multiplayer: http://localhost:'+PORT));
export {server,rooms};

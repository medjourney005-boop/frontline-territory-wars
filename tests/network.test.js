import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const sleep=n=>new Promise(r=>setTimeout(r,n));
const message=(ws,accept,timeout=3000)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{ws.removeEventListener('message',f);reject(new Error('Socket timeout'))},timeout);function f(e){const m=JSON.parse(e.data);if(accept(m)){clearTimeout(t);ws.removeEventListener('message',f);resolve(m)}}ws.addEventListener('message',f)});
const wsOpen=url=>new Promise((resolve,reject)=>{const ws=new WebSocket(url);const t=setTimeout(()=>reject(new Error('connect timeout')),3000);ws.addEventListener('open',()=>{clearTimeout(t);resolve(ws)},{once:true});ws.addEventListener('error',reject,{once:true})});

test('real WebSocket room and 1v1 battle with separately filtered snapshots',async()=>{
 const port=32000+Math.floor(Math.random()*30000),origin=`http://127.0.0.1:${port}`;
 const proc=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 let a,b;
 try{
  let live=false;for(let i=0;i<40;i++){try{const res=await fetch(origin+'/health');if(res.ok){live=true;break}}catch{}await sleep(50)}assert.ok(live,'test server running');
  assert.equal((await fetch(origin+'/config.json')).status,200);
  a=await wsOpen(origin.replace('http','ws')+'/ws');b=await wsOpen(origin.replace('http','ws')+'/ws');
  const pa=message(a,m=>m.type==='session');a.send(JSON.stringify({type:'create',name:'Blauw',settings:{mode:'realistic',noVision:true,noMunition:true}}));const sa=await pa;
  const pb=message(b,m=>m.type==='session');b.send(JSON.stringify({type:'join',name:'Rood',code:sa.code}));const sb=await pb;assert.equal(sb.team,'red');
  a.send(JSON.stringify({type:'ready',ready:true}));b.send(JSON.stringify({type:'ready',ready:true}));
  // Allow lobby messages to settle and then request start.
  await message(a,m=>m.type==='room'&&m.seats.blue?.ready&&m.seats.red?.ready);
  const ga=message(a,m=>m.type==='state');const gb=message(b,m=>m.type==='state');a.send(JSON.stringify({type:'start'}));const [ba,bb]=await Promise.all([ga,gb]);
  assert.equal(ba.state.team,'blue');assert.equal(bb.state.team,'red');assert.equal(ba.state.settings.noMunition,true);
  assert.equal(ba.state.units.filter(u=>u.team==='red').length,0);assert.equal(bb.state.units.filter(u=>u.team==='blue').length,0);
  const notice=message(a,m=>m.type==='notice');a.send(JSON.stringify({type:'command',command:{action:'recruit',unit:'decoy',x:180,y:375}}));assert.match((await notice).message,/Neptank/);
 }finally{if(a)a.close();if(b)b.close();proc.kill('SIGTERM');await Promise.race([once(proc,'exit'),sleep(1000)]);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle,UNITS,MAPS} from '../game.js';

test('10 original V17 multiplayer maps',()=>assert.equal(MAPS.length,10));
test('equal start and clean Classic settings',()=>{
 const g=new Battle({mode:'classic',noVision:true,noMunition:true});assert.equal(g.players.blue.cash,g.players.red.cash);assert.equal(g.units.filter(u=>u.team==='blue').length,3);assert.equal(g.units.filter(u=>u.team==='red').length,3);assert.equal(g.settings.noVision,false);assert.equal(g.settings.noMunition,false);
});
test('fog does not transmit undiscovered enemy troops',()=>{
 const g=new Battle({mode:'realistic',noVision:true});const a=g.snapshot('blue');assert.equal(a.units.filter(u=>u.team==='red').length,0);assert.equal(g.snapshot('red').units.filter(u=>u.team==='blue').length,0);
});
test('opponent decoy appears as tank until scouted',()=>{
 const g=new Battle({mode:'realistic',noVision:false});const fake=g.spawn('red','decoy',870,375,false);assert.ok(fake);let seen=g.snapshot('blue').units.find(u=>u.id===fake.id);assert.equal(seen.type,'tank');g.spawn('blue','scout',760,375,false);seen=g.snapshot('blue').units.find(u=>u.id===fake.id);assert.equal(seen.type,'decoy');
});
test('moving fake tanks have no weapon',()=>{
 const g=new Battle({mode:'realistic'});const d=g.spawn('blue','decoy',230,375,false);assert.equal(UNITS.decoy.range,0);const old=d.x;assert.match(g.command('blue',{action:'move',ids:[d.id],x:370,y:375}),/Verplaatsingsbevel/);for(let i=0;i<30;i++)g.update(.05);assert.ok(d.x>old+30,`expected moving decoy: ${d.x}`);assert.equal(g.projectiles.filter(p=>p.sourceId===d.id).length,0);
});
test('ammo actually empties and truck refills in 3 seconds of touch',()=>{
 const g=new Battle({mode:'realistic',noMunition:true});let soldier=g.units.find(u=>u.team==='blue');const dummy={x:300,y:375,hp:999};for(let i=0;i<UNITS.rifle.ammo;i++)g.fireAt(soldier,dummy);assert.equal(soldier.ammo,0);assert.equal(g.projectiles.length,40);assert.equal(soldier.hp,50);soldier.hp=10;const truck=g.spawn('blue','truck',soldier.x+22,soldier.y,false);assert.ok(truck);for(let i=0;i<50;i++)g.update(.05);assert.equal(soldier.ammo,0);assert.equal(soldier.hp,10);for(let i=0;i<15;i++)g.update(.05);assert.equal(soldier.ammo,UNITS.rifle.ammo);assert.equal(soldier.hp,soldier.max);
});
test('placed minefield matches wall length and explodes when enemy steps in',()=>{
 const g=new Battle({mode:'realistic'});g.players.blue.cash=50;assert.match(g.command('blue',{action:'build',build:'minefield',x:250,y:375,angle:0}),/Mijnenveld/);let mine=g.objects.find(o=>o.type==='minefield');assert.equal(mine.len,100);assert.equal(g.players.blue.cash,30);let enemy=g.units.find(u=>u.team==='red');enemy.x=250;enemy.y=375;g.update(.05);assert.ok(!g.objects.find(o=>o.id===mine.id));assert.ok(enemy.hp<UNITS.rifle.hp);
});
test('invalid attempts to command opponent soldiers cannot move them',()=>{
 const g=new Battle({mode:'realistic'});const red=g.units.find(u=>u.team==='red');const before=red.x;g.command('blue',{action:'move',ids:[red.id],x:500,y:350});g.update(.05);assert.equal(red.x,before);
});
test('income and capture happen symmetrically',()=>{
 const g=new Battle({mode:'realistic'});g.update(3.1);assert.equal(g.players.blue.cash,g.players.red.cash);
});

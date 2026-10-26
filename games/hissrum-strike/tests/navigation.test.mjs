import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation,selectAnchors} from '../src/navigation.mjs';

function fakeRoom(){
  const bounds={min:{x:0,z:0},max:{x:18,z:18}};
  const canOccupy=(x,z,r=.26)=>{
    if(x<.5+r||x>17.5-r||z<.5+r||z>17.5-r)return false;
    // Actual-obstacle stand-in: partition with opening at its far end.
    return !(x>8-r&&x<10+r&&z<13);
  };
  const canTravel=(a,b,r=.26)=>{
    const d=Math.hypot(b.x-a.x,b.z-a.z);
    return Array.from({length:Math.ceil(d/.26)+1},(_,j)=>{
      const t=j/Math.max(1,Math.ceil(d/.26));
      return canOccupy(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,r);
    }).every(Boolean);
  };
  return {bounds,canOccupy,canTravel};
}

test('navigation derives routes around obstacles instead of crossing invisible walls',()=>{
  const world=fakeRoom(),nav=createNavigation(world,{spacing:1.1});
  assert.ok(nav.nodes.length>80);
  const a={x:3,z:3},b={x:15,z:3};
  const route=nav.findPath(a,b);
  assert.ok(route.length>1,'wall must require a detour');
  assert.ok(route.some(p=>p.z>12),'route must pass around physical partition');
  let last=a;
  for(const p of route){assert.ok(world.canTravel(last,p,.25),'each navigation edge must be swept against collision');last=p;}
  const fast=nav.findPath({x:2,z:2},{x:3,z:3});
  assert.equal(fast.length,1,'unobstructed route can be direct');
});

test('all ten mini-spawns and mission anchors share a connected floor',()=>{
  const world=fakeRoom(),nav=createNavigation(world,{spacing:1.1});
  const anchors=selectAnchors(nav,world.bounds);
  assert.equal(anchors.analysts.length,5);
  assert.equal(anchors.counterAnalysts.length,5);
  assert.equal(anchors.hostages.length,2);
  for(const p of [...anchors.analysts,...anchors.counterAnalysts,anchors.bomb,...anchors.hostages]){
    assert.ok(world.canOccupy(p.x,p.z,.2));
    assert.ok(nav.findPath(anchors.analysts[0],p).length>0);
  }
});

test('empty or disconnected scene fails closed',()=>{
  const world={bounds:{min:{x:0,z:0},max:{x:8,z:8}},canOccupy:()=>false,canTravel:()=>false};
  assert.throws(()=>createNavigation(world),/walkable floor/i);
});

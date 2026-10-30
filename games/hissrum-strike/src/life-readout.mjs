/** Read-only HUD model. Never extrapolate a killer's current location. */
const vehicleCauses={cannon:'Cartridge-kanon',ram:'Påkörning',
 'tank-wreck':'Förstört fordon'};
export function lifeReadout(game,weapons){
 const p=game?.player;if(!p)return {kind:'hidden'};
 const time=game.state.time;
 if(p.alive){
  const remaining=Math.max(0,(p.spawnProtectedUntil||0)-time);
  return remaining>0?{kind:'protection',title:'SPAWNSKYDD · '+remaining.toFixed(1)+' s',
   detail:'Skyddet upphör när du skjuter.',progress:Math.min(1,remaining/game.config.spawnProtection)}:{kind:'hidden'};
 }
 const r=p.combat?.recap,at=p.respawnAt,remaining=Number.isFinite(at)?Math.max(0,at-time):null;
 return {kind:'death',title:r?'UTSLAGEN AV '+r.attacker:'UTSLAGEN',
  detail:r?[weapons[r.weapon]?.name||vehicleCauses[r.weapon]||'Miljön','Totalt '+r.hits+' träffar',r.damage+' skada'].join(' · '):'Ditt lag fortsätter striden.',
  next:remaining===null?'Nästa runda':remaining>0?'Tillbaka om '+remaining.toFixed(1)+' s':'Inväntar en ledig spawnplats',
  progress:remaining===null?0:Math.min(1,Math.max(0,1-remaining/Math.max(.1,at-(p.deathAt??time))))};
}

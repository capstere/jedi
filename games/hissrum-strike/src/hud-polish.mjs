/** Small presentation-only fixes; no combat timing, score or simulation writes. */
export class KillFeedView{
 constructor(container,limit=5){
   this.container=container;
   this.nodes=Array.from({length:limit},()=>{
     const node=container.ownerDocument.createElement('div');
     node.hidden=true;container.append(node);return node;
   });
 }
 render(items){
   for(let i=0;i<this.nodes.length;i++){
     const node=this.nodes[i],item=items[i],hidden=!item;
     if(node.hidden!==hidden)node.hidden=hidden;
     if(hidden)continue;
     const name=String(item.name),className=item.team==='analysts'?'friendly':'';
     if(node.textContent!==name)node.textContent=name;
     if(node.className!==className)node.className=className;
   }
 }
}

export function drawPlayerHeading(ctx,x,y,yaw){
 const angle=Number.isFinite(yaw)?yaw:0;
 ctx.beginPath();
 ctx.moveTo(x-Math.sin(angle)*7,y-Math.cos(angle)*7);
 // All three vertices use heading, never actor.y (altitude). This keeps the
 // triangle rigid when turning or flying and agrees with FPS forward (-sin,-cos).
 ctx.lineTo(x+Math.sin(angle+.6)*6,y+Math.cos(angle+.6)*6);
 ctx.lineTo(x+Math.sin(angle-.6)*6,y+Math.cos(angle-.6)*6);
 ctx.closePath();ctx.fill();
}

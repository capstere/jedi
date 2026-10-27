/** Single-owner touch gestures. No Game/weapon writes: callers own the actions.
 * Each control owns one pointer until up/cancel/capture loss. Reset before
 * releasing capture so delayed lostpointercapture events cannot revive input.
 * References: W3C Pointer Events; Element lostpointercapture / setPointerCapture.
 */
export function joystickAxes(dx,dy,radius=45,deadzone=.08){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||!(radius>0))return {strafe:0,forward:0};
 const length=Math.hypot(dx,dy),amount=Math.min(1,length/radius);
 if(amount<=deadzone||!length)return {strafe:0,forward:0};
 const scale=(amount-deadzone)/(1-deadzone)/length;
 return {strafe:dx*scale||0,forward:-dy*scale||0};
}

export function bindOwnedPointer(element,{enabled=()=>true,start=()=>{},move=()=>{},end=()=>{}}={}){
 let owner=null,disposed=false;
 const reset=()=>{
   const id=owner;owner=null;
   if(id===null)return;
   end();
   try{if(element.hasPointerCapture(id))element.releasePointerCapture(id);}catch{}
 };
 const down=e=>{
   if(disposed||owner!==null||!enabled()||e.button>0)return;
   e.preventDefault();owner=e.pointerId;
   try{element.setPointerCapture(owner);}catch{owner=null;return;}
   start(e);
 };
 const drag=e=>{
   if(owner!==e.pointerId)return;
   if(!enabled()){reset();return;}
   move(e);
 };
 const release=e=>{if(owner===e.pointerId)reset();};
 const handlers={pointerdown:down,pointermove:drag,pointerup:release,
   pointercancel:release,lostpointercapture:release};
 for(const [type,fn] of Object.entries(handlers))element.addEventListener(type,fn);
 return {reset,get pointerId(){return owner;},dispose(){
   disposed=true;reset();
   for(const [type,fn] of Object.entries(handlers))element.removeEventListener(type,fn);
 }};
}

export function bindTouchControls({pad,stick,look,buttons,enabled,onMove,onLook,onPress,onRelease}){
 let centerX=0,centerY=0,travel=29,lookX=0,lookY=0;
 const bindings=[];
 const padMove=e=>{
   const {strafe,forward}=joystickAxes(e.clientX-centerX,e.clientY-centerY);
   onMove(strafe,forward);
   stick.style.transform=`translate(${strafe*travel}px,${-forward*travel}px)`;
 };
 bindings.push(bindOwnedPointer(pad,{enabled,start:e=>{
   // Layout is read once per gesture, not on every pointermove. Resize resets
   // the gesture through the caller before dimensions can become stale.
   const rect=pad.getBoundingClientRect();
   centerX=rect.left+rect.width/2;centerY=rect.top+rect.height/2;
   travel=Math.max(0,(Math.min(rect.width,rect.height)-(stick.offsetWidth||38))/2);
   padMove(e);
 },move:padMove,end:()=>{onMove(0,0);stick.style.transform='translate(0,0)';}}));
 bindings.push(bindOwnedPointer(look,{enabled,start:e=>{lookX=e.clientX;lookY=e.clientY;},
   move:e=>{onLook(e.clientX-lookX,e.clientY-lookY);lookX=e.clientX;lookY=e.clientY;}}));
 for(const button of buttons){
   const action=button.dataset.touch;
   bindings.push(bindOwnedPointer(button,{enabled,
     start:()=>onPress(action),end:()=>onRelease(action)}));
 }
 return {reset(){for(const binding of bindings)binding.reset();},
   dispose(){for(const binding of bindings)binding.dispose();}};
}

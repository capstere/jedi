/**
 * Keep the WebGL backbuffer, optical axis and HUD reticle on the SAME
 * on-screen canvas rectangle. In mobile Safari the CSS viewport can change
 * (landscape rotation, browser chrome, dynamic island) without innerWidth
 * matching the original THREE.WebGLRenderer.setSize inline dimensions.
 *
 * Never let WebGL set an inline canvas style width/height. CSS owns layout;
 * this adapter only updates buffer pixels and the camera's aspect.
 */
export function measureGameCanvas(rect){
  if(!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
    !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
    rect.width<=0 || rect.height<=0)return null;
  const width=Math.max(1,Math.round(rect.width));
  const height=Math.max(1,Math.round(rect.height));
  return {
    width,height,aspect:width/height,
    aimX:rect.left+rect.width/2,
    aimY:rect.top+rect.height/2,
  };
}
export function createGameViewportSync({canvas,renderer,cameras,root}){
  let sizeX=-1,sizeY=-1,aimX=NaN,aimY=NaN;
  return function syncGameViewport(){
    const m=measureGameCanvas(canvas.getBoundingClientRect());
    if(!m)return null;
    if(m.width!==sizeX||m.height!==sizeY){
      sizeX=m.width;sizeY=m.height;
      for(const camera of cameras){
        if(!camera)continue;
        camera.aspect=m.aspect;
        camera.updateProjectionMatrix();
      }
      // updateStyle=false is critical on iPhone: setSize's default writes
      // stale inline pixel dimensions, overriding #scene's responsive CSS.
      renderer.setSize(m.width,m.height,false);
    }
    if(m.aimX!==aimX||m.aimY!==aimY){
      aimX=m.aimX;aimY=m.aimY;
      root.style.setProperty('--aim-x',m.aimX+'px');
      root.style.setProperty('--aim-y',m.aimY+'px');
    }
    return m;
  };
}

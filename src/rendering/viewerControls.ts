import * as T from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Clash } from '../geometry/sterics';

export type ViewerControlOptions={pan?:boolean};

// Pan is opt-in so viewers that share PeptideScene (α-Helix, β-Sheet) keep rotate + zoom only.
// With pan on, OrbitControls maps: left drag = rotate, Shift/Ctrl/⌘ + left drag = pan, right drag = pan,
// wheel = zoom; one finger = rotate, two fingers = pinch zoom + drag pan (TOUCH.DOLLY_PAN).
// Pan moves the camera and controls target together; molecular coordinates are never touched.
export function configureViewerControls(controls:OrbitControls,{pan=false}:ViewerControlOptions={}){
  controls.enablePan=pan;
  if(pan){
    controls.screenSpacePanning=true;
    controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};
    controls.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};
  }
}

// Focus choice: the detector already reports overlap magnitude, so the most severe clash is the pair
// with the largest overlap. Ties keep detector order. No new ranking chemistry is introduced here.
export function mostSevereClash(clashes:readonly Clash[]):Clash|null{
  return clashes.reduce<Clash|null>((worst,c)=>!worst||c.overlap>worst.overlap?c:worst,null);
}

// Screen-space room around the pair: clash highlight radius (0.39 Å) plus room for labels/leader lines.
export const CLASH_FOCUS_MARGIN=0.39+1.6;

/** Camera frame that centres a two-atom pair and shows both atoms side by side. */
export function pairFocusFrame(a:T.Vector3,b:T.Vector3,currentDirection:T.Vector3,up:T.Vector3,fov:number,aspect:number,minDistance:number,maxDistance:number){
  const target=a.clone().lerp(b,0.5),axis=b.clone().sub(a);
  const direction=currentDirection.clone().normalize();
  if(axis.lengthSq()>1e-8){
    axis.normalize();
    // Keep the student's viewing side, but look perpendicular to the pair so the atoms do not eclipse.
    direction.addScaledVector(axis,-direction.dot(axis));
    if(direction.lengthSq()<1e-4)direction.copy(axis).cross(up);
    if(direction.lengthSq()<1e-4)direction.copy(axis).cross(new T.Vector3(1,0,0));
    if(direction.lengthSq()<1e-4)direction.copy(axis).cross(new T.Vector3(0,1,0));
    direction.normalize();
    // Avoid looking straight along camera.up, where OrbitControls' polar angle is clamped.
    if(Math.abs(direction.dot(up.clone().normalize()))>0.95){const side=axis.clone().cross(up);if(side.lengthSq()>1e-4)direction.copy(side.normalize());}
  }
  const half=a.distanceTo(b)/2+CLASH_FOCUS_MARGIN,tan=Math.tan(T.MathUtils.degToRad(fov/2));
  const distance=T.MathUtils.clamp(half/(tan*Math.min(1,aspect)),minDistance,maxDistance);
  return {target,direction,distance};
}

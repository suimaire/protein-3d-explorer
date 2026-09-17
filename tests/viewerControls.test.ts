import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {conformation} from '../src/geometry/peptide';
import {clashes} from '../src/geometry/sterics';
import {configureViewerControls,mostSevereClash,pairFocusFrame,CLASH_FOCUS_MARGIN} from '../src/rendering/viewerControls';

const controls=()=>new OrbitControls(new T.PerspectiveCamera(36,1,0.1,200));

describe('viewer control configuration',()=>{
  it('keeps pan off by default (α-Helix / β-Sheet viewers share PeptideScene)',()=>{
    const c=controls();configureViewerControls(c);
    expect(c.enablePan).toBe(false);
    expect(c.enableRotate).toBe(true);expect(c.enableZoom).toBe(true);
  });
  it('opt-in pan: left rotate, right pan, wheel/middle zoom; one-finger rotate, two-finger dolly+pan',()=>{
    const c=controls();configureViewerControls(c,{pan:true});
    expect(c.enablePan).toBe(true);expect(c.screenSpacePanning).toBe(true);
    expect(c.mouseButtons).toEqual({LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN});
    expect(c.touches).toEqual({ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN});
  });
});

describe('clash focus selection',()=>{
  it('returns null when there are no clashes',()=>{expect(mostSevereClash([])).toBeNull();});
  it('picks the largest detector overlap without re-ranking chemistry',()=>{
    const list=[{a:'x',b:'y',distance:2,overlap:0.5},{a:'p',b:'q',distance:1.6,overlap:0.9},{a:'m',b:'n',distance:1.6,overlap:0.9}];
    expect(mostSevereClash(list)).toBe(list[1]);
  });
  it('matches the first (largest overlap) pair reported for the 0°/0° geometry',()=>{
    const found=clashes(conformation(0,0));
    expect(found.length).toBe(8);
    expect(mostSevereClash(found)).toBe(found[0]);
  });
});

describe('pair focus framing',()=>{
  const a=new T.Vector3(1,2,3),b=new T.Vector3(3,2,3),up=new T.Vector3(0,1,0);
  it('targets the midpoint and looks perpendicular to the pair',()=>{
    const f=pairFocusFrame(a,b,new T.Vector3(1,0,1),up,36,1.5,7,65);
    expect(f.target.toArray()).toEqual([2,2,3]);
    expect(Math.abs(f.direction.dot(new T.Vector3(1,0,0)))).toBeLessThan(1e-9);
    expect(f.direction.length()).toBeCloseTo(1,9);
  });
  it('keeps both atoms plus highlight margin inside the view frustum, within zoom limits',()=>{
    for(const aspect of [0.6,1,1.8]){
      const f=pairFocusFrame(a,b,new T.Vector3(0,0,1),up,36,aspect,7,65),tan=Math.tan(T.MathUtils.degToRad(18));
      const half=1+CLASH_FOCUS_MARGIN;
      expect(f.distance).toBeGreaterThanOrEqual(7);expect(f.distance).toBeLessThanOrEqual(65);
      expect(half).toBeLessThanOrEqual(f.distance*tan*Math.min(1,aspect)+1e-9);
      expect(f.distance-half).toBeGreaterThan(0.1); // well beyond the 0.1 near plane
    }
  });
  it('handles a pair aligned with the current view direction',()=>{
    const f=pairFocusFrame(new T.Vector3(0,0,0),new T.Vector3(0,0,2),new T.Vector3(0,0,1),up,36,1,7,65);
    expect(Math.abs(f.direction.z)).toBeLessThan(1e-9);expect(f.direction.length()).toBeCloseTo(1,9);
  });
});

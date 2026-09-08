import { buildPeptide, point } from './peptide';
import type { Peptide } from './peptide';
import { add, sub, scale, unit, cross, dot } from './vector';
import {classifyInteractions} from './sterics';
import type {HydrogenBond} from './hydrogenBond';
export type {HydrogenBond} from './hydrogenBond';
export const HELIX = {count:12,phi:-60,psi:-45} as const;
export const buildHelix=(count:number=HELIX.count)=>buildPeptide(count,HELIX.phi,HELIX.psi);
export const residueCount=(m:Peptide)=>m.atoms.filter(a=>a.name==='CB').length;
/** Educational distance/direction screen, not an energy or universal H-bond definition. Caps excluded. */
export function hydrogenBonds(m:Peptide):HydrogenBond[]{
  return classifyInteractions(m).hydrogenBonds.filter(b=>b.acceptor>=1&&b.donor<=residueCount(m)&&b.donor===b.acceptor+4);
}
/** Screw axis from repeated Cα displacements; no atom transforms or mirrored coordinates. */
export function helixGeometry(m:Peptide){
  const p=point(m,1,'CA'),q=point(m,2,'CA'),r=point(m,3,'CA'),s=point(m,4,'CA');
  const d=sub(q,p),e=sub(r,q),f=sub(s,r);
  let axis=unit(cross(sub(e,d),sub(f,e)));
  if(dot(axis,d)<0)axis=scale(axis,-1);
  const rise=dot(d,axis),u=sub(d,scale(axis,rise)),v=sub(e,scale(axis,rise));
  const twist=Math.atan2(dot(axis,cross(u,v)),dot(u,v));
  const radial=add(scale(u,-0.5),scale(cross(axis,u),-0.5/Math.tan(twist/2)));
  const start=sub(p,radial),end=add(start,scale(axis,rise*(residueCount(m)-1)));
  return {axis,start,end,center:scale(add(start,end),0.5),twist:twist*180/Math.PI,rise,perTurn:2*Math.PI/twist,pitch:rise*2*Math.PI/twist};
}

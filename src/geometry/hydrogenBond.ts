import type {Atom,Peptide} from './peptide';
import {distance,dot,sub,unit} from './vector';

export type HydrogenBond={acceptor:number;donor:number;o:string;h:string;n:string;on:number;ho:number;angle:number};
/** Model-specific amide N–H / carbonyl O screen; not an energy calculation. */
export function validHydrogenBond(m:Peptide,a:Atom,b:Atom):HydrogenBond|undefined {
  const o=a.element==='O'?a:b,h=a.element==='H'?a:b;
  if(o.element!=='O'||h.element!=='H')return;
  const neighbors=(atom:Atom)=>m.bonds.flatMap(edge=>{
    const id=edge.a===atom.id?edge.b:edge.b===atom.id?edge.a:undefined;
    const other=m.atoms.find(x=>x.id===id);
    return other?[{atom:other,order:edge.order}]:[];
  });
  const oxygenBonds=neighbors(o),hydrogenBonds=neighbors(h);
  if(oxygenBonds.length!==1||oxygenBonds[0].order!==2||oxygenBonds[0].atom.element!=='C')return;
  if(hydrogenBonds.length!==1||hydrogenBonds[0].order!==1||hydrogenBonds[0].atom.element!=='N')return;
  const n=hydrogenBonds[0].atom;
  // The donor nitrogen must be an amide: single-bonded to a carbonyl carbon.
  if(!neighbors(n).some(x=>x.order===1&&x.atom.element==='C'&&neighbors(x.atom).some(y=>y.order===2&&y.atom.element==='O')))return;
  const on=distance(o.position,n.position),ho=distance(h.position,o.position);
  const nh=distance(n.position,h.position);
  if(![on,ho,nh].every(Number.isFinite)||nh<=0||ho<=0)return;
  const angle=Math.acos(Math.max(-1,Math.min(1,dot(unit(sub(n.position,h.position)),unit(sub(o.position,h.position))))))*180/Math.PI;
  if(on>=2.5&&on<=3.5&&ho>=1.5&&ho<=2.6&&angle>=120)
    return {acceptor:o.residue,donor:n.residue,o:o.id,h:h.id,n:n.id,on,ho,angle};
}

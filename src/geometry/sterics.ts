import type { Peptide } from './peptide';
import { distance } from './vector';
import { CLASH_EXCLUDED_BONDS,CLASH_OVERLAP_TOLERANCE,CLASH_VDW } from '../data/science';
export type Clash={a:string;b:string;distance:number;overlap:number};
export function bondSeparation(m:Peptide,start:string,end:string) {
  const seen=new Set([start]);let frontier=[start];
  for(let depth=0;frontier.length;depth++) {
    if(frontier.includes(end)) return depth;
    const next:string[]=[];
    for(const current of frontier) for(const edge of m.bonds) {
      const neighbor=edge.a===current?edge.b:edge.b===current?edge.a:null;
      if(neighbor&&!seen.has(neighbor)){seen.add(neighbor);next.push(neighbor);}
    }
    frontier=next;
  }
  return Infinity;
}
export function excludedPairs(m:Peptide) {
  const excluded=new Set<string>();
  for(const atom of m.atoms) {
    let frontier=[atom.id];const seen=new Set(frontier);
    // Probe/Reduce default: contacts separated by no more than three bonds are covalent neighbors.
    for(let depth=0;depth<CLASH_EXCLUDED_BONDS;depth++) {
      const next:string[]=[];
      for(const a of frontier) for(const b of m.bonds) {
        const n=b.a===a?b.b:b.b===a?b.a:null;
        if(n&&!seen.has(n)){seen.add(n);next.push(n);excluded.add([atom.id,n].sort().join('|'));}
      }
      frontier=next;
    }
  }
  return excluded;
}
export function clashes(m:Peptide):Clash[] {
  const excluded=excludedPairs(m), result:Clash[]=[];
  for(let i=0;i<m.atoms.length;i++) for(let j=i+1;j<m.atoms.length;j++) {
    const a=m.atoms[i],b=m.atoms[j];
    if(excluded.has([a.id,b.id].sort().join('|'))) continue;
    const d=distance(a.position,b.position),overlap=CLASH_VDW[a.element]+CLASH_VDW[b.element]-d;
    if(overlap>CLASH_OVERLAP_TOLERANCE) result.push({a:a.id,b:b.id,distance:d,overlap});
  }
  return result.sort((a,b)=>b.overlap-a.overlap);
}

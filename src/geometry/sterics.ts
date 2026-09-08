import type { Peptide } from './peptide';
import { distance } from './vector';
import { VDW } from '../data/science';
export type Clash={a:string;b:string;distance:number;overlap:number};
export function excludedPairs(m:Peptide) {
  const excluded=new Set<string>();
  for(const atom of m.atoms) {
    let frontier=[atom.id];const seen=new Set(frontier);
    // Exclude 1–2 and 1–3 only. 1–4 retained; overlap >0.4 Å is an educational threshold.
    for(let depth=0;depth<2;depth++) {
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
    const d=distance(a.position,b.position),overlap=VDW[a.element]+VDW[b.element]-d;
    if(overlap>0.4) result.push({a:a.id,b:b.id,distance:d,overlap});
  }
  return result.sort((a,b)=>b.overlap-a.overlap);
}

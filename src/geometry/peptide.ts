import { GEOMETRY as G } from '../data/science';
import { add,sub,scale,unit,dot,cross,place,dihedral,rotate,wrap } from './vector';
import type { Vec } from './vector';
export type Atom = {id:string;residue:number;name:string;element:'C'|'N'|'O'|'H';position:Vec;sidechain:boolean};
export type Bond = {a:string;b:string;order:1|2};
export type Peptide = {atoms:Atom[];bonds:Bond[]};
export const id = (r:number,n:string) => `${r}:${n}`;
export const atom = (m:Peptide,r:number,n:string) => m.atoms.find(a=>a.id===id(r,n))!;
export const point = (m:Peptide,r:number,n:string) => atom(m,r,n).position;
/** Ac–(L-Ala)5–NHMe. Carbon-bound H omitted; amide H explicit. Å units. */
export function buildPeptide():Peptide {
  const m:Peptide={atoms:[],bonds:[]};
  const push=(r:number,n:string,e:Atom['element'],p:Vec) => m.atoms.push({id:id(r,n),residue:r,name:n,element:e,position:p,sidechain:n==='CB'});
  const bond=(r:number,n:string,s:number,k:string,order:1|2=1)=>m.bonds.push({a:id(r,n),b:id(s,k),order});
  let n:Vec=[0,0,0],ca:Vec=[G.nCa,0,0],c:Vec=add(ca,[G.caC*Math.cos((180-G.nCaC)*Math.PI/180),G.caC*Math.sin((180-G.nCaC)*Math.PI/180),0]);
  for(let r=0;r<=6;r++) {
    if(r>0) push(r,'N','N',n);
    push(r,'CA','C',ca);
    if(r<6) {push(r,'C','C',c);push(r,'O','O',place(n,ca,c,G.cO,G.caCO,-45));bond(r,'CA',r,'C');bond(r,'C',r,'O',2);}
    if(r>0) {
      bond(r-1,'C',r,'N');bond(r,'N',r,'CA');
      const previousC=point(m,r-1,'C');
      const h=add(n,scale(unit(scale(add(unit(sub(previousC,n)),unit(sub(ca,n))),-1)),G.nH));
      push(r,'H','H',h);bond(r,'N',r,'H');
    }
    if(r>0&&r<6) {
      const u=unit(sub(n,ca)),v=unit(sub(c,ca));
      const bisector=scale(add(u,v),-1/(3*(1+dot(u,v))));
      const cb=add(ca,scale(add(bisector,scale(unit(cross(u,v)),Math.sqrt(1-dot(bisector,bisector)))),G.caCb));
      push(r,'CB','C',cb);bond(r,'CA',r,'CB');
    }
    if(r<6) {
      // ψ=135°, ω=180°, φ=-135°. O is opposite the following N (ψ−180).
      const nextN=place(n,ca,c,G.cN,G.caCN,135);
      const nextCa=place(ca,c,nextN,G.nCa,G.cNCa,180);
      const nextC=place(c,nextN,nextCa,G.caC,G.nCaC,-135);
      n=nextN;ca=nextCa;c=nextC;
    }
  }
  return m;
}
export function angles(m:Peptide,r=3) {
  return {phi:dihedral(point(m,r-1,'C'),point(m,r,'N'),point(m,r,'CA'),point(m,r,'C')),psi:dihedral(point(m,r,'N'),point(m,r,'CA'),point(m,r,'C'),point(m,r+1,'N'))};
}
/** Cut the chosen covalent edge and rotate only its downstream connected component. */
export function setTorsion(m:Peptide,kind:'phi'|'psi',target:number):Peptide {
  const a=id(3,kind==='phi'?'N':'CA'),b=id(3,kind==='phi'?'CA':'C');
  const selected=new Set([b]), queue=[b];
  while(queue.length) {
    const current=queue.pop()!;
    for(const edge of m.bonds) {
      if((edge.a===a&&edge.b===b)||(edge.b===a&&edge.a===b)) continue;
      const next=edge.a===current?edge.b:edge.b===current?edge.a:null;
      if(next&&!selected.has(next)){selected.add(next);queue.push(next);}
    }
  }
  const origin=m.atoms.find(x=>x.id===a)!.position,axis=sub(m.atoms.find(x=>x.id===b)!.position,origin);
  const delta=wrap(target-angles(m)[kind]);
  return {bonds:m.bonds,atoms:m.atoms.map(x=>({...x,position:selected.has(x.id)?rotate(x.position,origin,axis,delta):[...x.position]}))};
}
const reference=buildPeptide();
export function conformation(phi:number,psi:number) {return setTorsion(setTorsion(reference,'phi',phi),'psi',psi);}
export function omega(m:Peptide,r:number) {return dihedral(point(m,r,'CA'),point(m,r,'C'),point(m,r+1,'N'),point(m,r+1,'CA'));}

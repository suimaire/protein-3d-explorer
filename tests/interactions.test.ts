import {describe,it,expect} from 'vitest';
import {buildHelix,hydrogenBonds} from '../src/geometry/helix';
import type {Peptide} from '../src/geometry/peptide';
import {classifyInteractions} from '../src/geometry/sterics';
import {validHydrogenBond} from '../src/geometry/hydrogenBond';

// Independent geometry fixture: H at origin, O along +x, N at angle N–H···O.
function fixture(ho=2.08,angle=160):Peptide {
  const radians=angle*Math.PI/180;
  return {atoms:[
    {id:'h',residue:5,name:'H',element:'H',position:[0,0,0],sidechain:false},
    {id:'n',residue:5,name:'N',element:'N',position:[1.01*Math.cos(radians),1.01*Math.sin(radians),0],sidechain:false},
    {id:'o',residue:1,name:'O',element:'O',position:[ho,0,0],sidechain:false},
    {id:'c',residue:1,name:'C',element:'C',position:[ho+1.23,0,0],sidechain:false},
    {id:'dc',residue:4,name:'C',element:'C',position:[-2,1,0],sidechain:false},
    {id:'do',residue:4,name:'O',element:'O',position:[-3,1,0],sidechain:false},
  ],bonds:[{a:'h',b:'n',order:1},{a:'o',b:'c',order:2},{a:'n',b:'dc',order:1},{a:'dc',b:'do',order:2}]};
}
const target=(a:string,b:string)=>[a,b].sort().join('|')==='h|o';
function expectClash(m:Peptide){const result=classifyInteractions(m);expect(result.hydrogenBonds.some(b=>b.h==='h'&&b.o==='o')).toBe(false);expect(result.seriousClashes.some(c=>target(c.a,c.b))).toBe(true);}

describe('chemistry and geometry aware interaction classification',()=>{
  it('recognizes a valid pair in either atom order, independently of residue offset',()=>{
    const m=fixture();m.atoms[2].residue=20;
    expect(validHydrogenBond(m,m.atoms[0],m.atoms[2])).toEqual(validHydrogenBond(m,m.atoms[2],m.atoms[0]));
    const result=classifyInteractions(m);
    expect(result.hydrogenBonds.some(b=>b.h==='h'&&b.o==='o')).toBe(true);
    expect(result.severeOverlaps.some(c=>target(c.a,c.b))).toBe(true);
    expect(result.seriousClashes.some(c=>target(c.a,c.b))).toBe(false);
  });
  it.each([0,1.49])('keeps too-short H···O distance %s as a clash',ho=>expectClash(fixture(ho)));
  it('keeps a bent N–H···O contact with plausible N···O distance as a clash',()=>expectClash(fixture(2.08,110)));
  it('rejects excessive H···O distance',()=>{const m=fixture(2.61);expect(validHydrogenBond(m,m.atoms[0],m.atoms[2])).toBeUndefined();});
  it('rejects excessive N···O distance despite acceptable H···O and angle',()=>{const m=fixture(2.6,180);expect(validHydrogenBond(m,m.atoms[0],m.atoms[2])).toBeUndefined();});
  it.each(['unbound H','carbon-bound H','non-carbonyl O','non-amide N'])('keeps %s even with valid geometry',kind=>{
    const m=fixture();
    if(kind==='unbound H')m.bonds=m.bonds.filter(b=>b.a!=='h');
    if(kind==='carbon-bound H')m.bonds[0].b='dc';
    if(kind==='non-carbonyl O')m.bonds[1].order=1;
    if(kind==='non-amide N')m.bonds=m.bonds.filter(b=>b.a!=='n');
    expectClash(m);
  });
  it('applies topology exclusions before H-bond classification',()=>{
    const m=fixture();m.bonds.push({a:'n',b:'c',order:1});
    const result=classifyInteractions(m);
    expect(result.hydrogenBonds.some(b=>b.h==='h'&&b.o==='o')).toBe(false);
    expect(result.severeOverlaps.some(c=>target(c.a,c.b))).toBe(false);
  });
  it.each([[0,4],[9,13]])('applies the same angle screen to cap pair %s → %s',(acceptor,donor)=>{
    const m=buildHelix(),o=m.atoms.find(a=>a.id===`${acceptor}:O`)!,h=m.atoms.find(a=>a.id===`${donor}:H`)!,n=m.atoms.find(a=>a.id===`${donor}:N`)!;
    n.position=[...o.position];
    const result=classifyInteractions(m);
    expect(result.hydrogenBonds.some(b=>b.o===o.id&&b.h===h.id)).toBe(false);
    expect(result.seriousClashes.some(c=>[c.a,c.b].includes(o.id)&&[c.a,c.b].includes(h.id))).toBe(true);
  });
  it('displayed backbone bonds also require donor identity',()=>{
    const m=buildHelix();m.bonds=m.bonds.filter(b=>b.b!=='5:H');
    expect(hydrogenBonds(m).some(b=>b.donor===5)).toBe(false);
    expect(classifyInteractions(m).seriousClashes.some(c=>c.a==='1:O'&&c.b==='5:H')).toBe(true);
  });
});

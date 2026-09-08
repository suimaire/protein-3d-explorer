import { describe,it,expect } from 'vitest';
import {buildHelix,helixGeometry,hydrogenBonds,HELIX,residueCount} from '../src/geometry/helix';
import {angles,point,omega,buildPeptide} from '../src/geometry/peptide';
import {clashes} from '../src/geometry/sterics';
import {sub,dot,cross,unit,distance,wrap,scale,add} from '../src/geometry/vector';
import {plotPoint} from '../src/components/RamachandranPlot';
const m=buildHelix(),n=residueCount(m),g=helixGeometry(m);
const close=(a:number,b:number)=>expect(Math.abs(wrap(a-b))).toBeLessThan(1e-8);
describe('alpha helix measured geometry',()=>{
  it('builds twelve L-Ala with neutral caps and explicit amide H',()=>{expect(n).toBe(12);expect(m.atoms).toHaveLength(78);expect(m.bonds).toHaveLength(77);});
  it('all evaluable phi match target',()=>{for(let r=1;r<=n;r++)close(angles(m,r).phi,HELIX.phi);});
  it('all evaluable psi match target',()=>{for(let r=1;r<=n;r++)close(angles(m,r).psi,HELIX.psi);});
  it('all peptide omega remain trans including caps',()=>{for(let r=0;r<=n;r++)close(omega(m,r),180);});
  it('all six-atom peptide groups are planar',()=>{for(let r=0;r<=n;r++){const c=point(m,r,'C'),normal=unit(cross(sub(point(m,r,'CA'),c),sub(point(m,r+1,'N'),c)));for(const p of [point(m,r,'O'),point(m,r+1,'H'),point(m,r+1,'CA')])expect(Math.abs(dot(sub(p,c),normal))).toBeLessThan(1e-10);}});
  it('preserves every covalent length and adjacent bond angle against extended reference',()=>{
    const ref=buildPeptide(n),pos=(model:typeof m,id:string)=>model.atoms.find(a=>a.id===id)!.position;
    for(const b of m.bonds)expect(distance(pos(m,b.a),pos(m,b.b))).toBeCloseTo(distance(pos(ref,b.a),pos(ref,b.b)),10);
    for(const a of m.atoms){const adj=m.bonds.filter(b=>b.a===a.id||b.b===a.id).map(b=>b.a===a.id?b.b:b.a);for(let i=0;i<adj.length;i++)for(let j=i+1;j<adj.length;j++){const measure=(model:typeof m)=>dot(unit(sub(pos(model,adj[i]),pos(model,a.id))),unit(sub(pos(model,adj[j]),pos(model,a.id))));expect(measure(m)).toBeCloseTo(measure(ref),10);}}
  });
  it('preserves L stereochemistry',()=>{for(let r=1;r<=n;r++){const ca=point(m,r,'CA');expect(dot(cross(sub(point(m,r,'N'),ca),sub(point(m,r,'C'),ca)),sub(point(m,r,'CB'),ca))).toBeGreaterThan(0);}});
  it('has positive right-handed screw twist for every successive residue',()=>{
    expect(g.rise).toBeCloseTo(1.54036,5);expect(g.perTurn).toBeCloseTo(3.64117,5);expect(g.pitch).toBeCloseTo(5.60871,5);
    const radial=(r:number)=>{const p=sub(point(m,r,'CA'),g.start);return sub(p,scale(g.axis,dot(p,g.axis)));};
    for(let r=1;r<n;r++){expect(dot(g.axis,cross(radial(r),radial(r+1)))).toBeGreaterThan(0);expect(dot(sub(point(m,r+1,'CA'),point(m,r,'CA')),g.axis)).toBeCloseTo(g.rise,10);expect(Math.acos(dot(unit(radial(r)),unit(radial(r+1))))*180/Math.PI).toBeCloseTo(g.twist,10);}
  });
  it('side-chain Cbeta projects outward from actual screw axis',()=>{for(let r=1;r<=n;r++){const ca=point(m,r,'CA'),v=sub(ca,g.start),radial=sub(v,scale(g.axis,dot(v,g.axis)));expect(dot(radial,sub(point(m,r,'CB'),ca))).toBeGreaterThan(0);}});
  it('Ramachandran inspection uses coordinates for every selectable residue',()=>{for(let r=1;r<=n;r++){const a=angles(m,r),p=plotPoint(a.phi,a.psi);close((p.x-50)*360/300-180,a.phi);close(180-(p.y-20)*360/300,a.psi);}});
});
describe('geometry-screened backbone H bonds and unchanged sterics',()=>{
  it('maps acceptor i to donor i+4, excludes caps and derives count for multiple lengths',()=>{for(const count of [10,12,14]){const bonds=hydrogenBonds(buildHelix(count));expect(bonds).toHaveLength(count-4);expect(bonds.map(b=>[b.acceptor,b.donor])).toEqual(Array.from({length:count-4},(_,i)=>[i+1,i+5]));}});
  it('all displayed distances and donor-H-acceptor directions use actual coordinates',()=>{for(const b of hydrogenBonds(m)){expect(b.on).toBeCloseTo(distance(point(m,b.acceptor,'O'),point(m,b.donor,'N')),12);expect(b.ho).toBeCloseTo(2.082598,6);expect(b.angle).toBeCloseTo(162.321327,6);expect(b.on).toBeCloseTo(3.060309,6);}});
  it('rejects i+4 pairs with bad distance',()=>{const bad=buildHelix();bad.atoms.find(a=>a.id==='1:O')!.position=[100,100,100];expect(hydrogenBonds(bad)).toHaveLength(n-5);});
  it('rejects a donor H pointed away even with plausible O-N distance',()=>{const bad=buildHelix();bad.atoms.find(a=>a.id==='5:H')!.position=add(point(bad,5,'N'),scale(unit(sub(point(bad,5,'N'),point(bad,1,'O'))),1.01));expect(hydrogenBonds(bad).some(b=>b.acceptor===1)).toBe(false);});
  it('extended backbone does not display artificial index-only H bonds',()=>expect(hydrogenBonds(buildPeptide(12))).toHaveLength(0));
  it('audits all ten detector hits as H-bond O-H contacts including two caps, with no others',()=>{
    const hits=clashes(m);expect(hits).toHaveLength(n-2);
    expect(hits.map(c=>`${c.a}|${c.b}`).sort()).toEqual(Array.from({length:n-2},(_,r)=>`${r}:O|${r+4}:H`).sort());
    for(const c of hits){expect(c.distance).toBeCloseTo(2.082598,6);expect(c.overlap).toBeCloseTo(0.437402,6);}
  });
});

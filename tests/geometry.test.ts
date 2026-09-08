import { describe,it,expect } from 'vitest';
import { angles,conformation,buildPeptide,setTorsion,omega,point } from '../src/geometry/peptide';
import { dihedral,wrap,distance,sub,dot,cross,unit } from '../src/geometry/vector';
import { clashes,excludedPairs } from '../src/geometry/sterics';
import { plotPoint } from '../src/components/RamachandranPlot';
const close=(a:number,b:number)=>expect(Math.abs(wrap(a-b))).toBeLessThan(1e-8);
describe('signed torsion and periodicity',()=>{
  it('matches independently constructed positive/negative 90° and trans examples',()=>{
    close(dihedral([1,0,0],[0,0,0],[0,0,1],[0,1,1]),90);
    close(dihedral([1,0,0],[0,0,0],[0,0,1],[0,-1,1]),-90);
    close(dihedral([1,0,0],[0,0,0],[0,0,1],[-1,0,1]),180);
    close(-180,180);
  });
  for(const phi of [-180,-179,-135,-60,0,60,179,180])for(const psi of [-180,-179,-45,0,135,179,180])it(`actual φ/ψ = ${phi}/${psi}`,()=>{
    const a=angles(conformation(phi,psi));close(a.phi,phi);close(a.psi,psi);
  });
  it('phi and psi do not change each other or upstream atoms',()=>{
    const original=conformation(-60,-45),p=setTorsion(original,'phi',100),q=setTorsion(original,'psi',-130);
    close(angles(p).psi,-45);close(angles(q).phi,-60);
    for(const a of original.atoms.filter(a=>a.residue<3||a.id==='3:N'||a.id==='3:H'))expect(p.atoms.find(b=>b.id===a.id)!.position).toEqual(a.position);
    for(const a of original.atoms.filter(a=>a.residue<3||['3:N','3:H','3:CA','3:CB'].includes(a.id)))expect(q.atoms.find(b=>b.id===a.id)!.position).toEqual(a.position);
    expect(distance(point(original,3,'O'),point(p,3,'O'))).toBeGreaterThan(0.5);
    expect(distance(point(original,4,'N'),point(q,4,'N'))).toBeGreaterThan(0.5);
  });
});
describe('covalent geometry',()=>{
  const base=buildPeptide();
  const pos=(m:typeof base,id:string)=>m.atoms.find(a=>a.id===id)!.position;
  for(const [phi,psi] of [[-60,-45],[-135,135],[0,0],[179,-179],[85,62]])it(`lengths, angles, planarity, omega, L chirality at ${phi}/${psi}`,()=>{
    const m=conformation(phi,psi);
    for(const b of base.bonds)expect(distance(pos(m,b.a),pos(m,b.b))).toBeCloseTo(distance(pos(base,b.a),pos(base,b.b)),10);
    for(const a of base.atoms){const adjacent=base.bonds.filter(b=>b.a===a.id||b.b===a.id).map(b=>b.a===a.id?b.b:b.a);for(let i=0;i<adjacent.length;i++)for(let j=i+1;j<adjacent.length;j++){
      const angle=(model:typeof base)=>dot(unit(sub(pos(model,adjacent[i]),pos(model,a.id))),unit(sub(pos(model,adjacent[j]),pos(model,a.id))));expect(angle(m)).toBeCloseTo(angle(base),10);
    }}
    for(let r=0;r<6;r++){
      close(omega(m,r),180);
      const c=point(m,r,'C'),normal=unit(cross(sub(point(m,r,'CA'),c),sub(point(m,r+1,'N'),c)));
      for(const p of [point(m,r,'O'),point(m,r+1,'H'),point(m,r+1,'CA')])expect(Math.abs(dot(sub(p,c),normal))).toBeLessThan(1e-10);
    }
    for(let r=1;r<=5;r++){
      const ca=point(m,r,'CA');
      // Positive ordered N,C,Cβ volume corresponds to S (L-Ala), with implicit H opposite.
      expect(dot(cross(sub(point(m,r,'N'),ca),sub(point(m,r,'C'),ca)),sub(point(m,r,'CB'),ca))).toBeGreaterThan(0);
    }
  });
  it('has neutral caps, five alanines, six complete peptide groups',()=>{expect(base.atoms).toHaveLength(36);expect(base.bonds).toHaveLength(35);expect(base.atoms.filter(a=>a.name==='CB')).toHaveLength(5);});
});
describe('sterics and synchronized plot',()=>{
  it('excludes covalent neighbors from every reported clash',()=>{const m=buildPeptide(),ex=excludedPairs(m);for(const c of clashes(m))expect(ex.has([c.a,c.b].sort().join('|'))).toBe(false);});
  it('detects deliberately overlapping nonbonded atoms and changes across conformations',()=>{const m=buildPeptide();m.atoms.find(a=>a.id==='5:O')!.position=[...point(m,1,'O')];expect(clashes(m).some(c=>[c.a,c.b].includes('1:O')&&[c.a,c.b].includes('5:O'))).toBe(true);expect(clashes(conformation(0,0)).length).toBeGreaterThan(clashes(conformation(-135,135)).length);});
  it('maps actual geometry to plot coordinates, including seam endpoints',()=>{const a=angles(conformation(80,-120)),p=plotPoint(a.phi,a.psi);close((p.x-50)*360/300-180,80);close(180-(p.y-20)*360/300,-120);expect(plotPoint(-180,180)).toEqual({x:50,y:20});expect(plotPoint(180,-180)).toEqual({x:350,y:320});});
});

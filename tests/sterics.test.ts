import {describe,it,expect} from 'vitest';
import {buildPeptide,conformation,point} from '../src/geometry/peptide';
import {bondSeparation,clashes,excludedPairs} from '../src/geometry/sterics';
import {CLASH_EXCLUDED_BONDS,CLASH_OVERLAP_TOLERANCE,CLASH_VDW,VDW} from '../src/data/science';

const key=(a:string,b:string)=>[a,b].sort().join('|');
const pairIds=(phi:number,psi:number)=>clashes(conformation(phi,psi)).map(c=>`${c.a}|${c.b}`);

describe('steric-clash topology policy',()=>{
  const model=buildPeptide(),excluded=excludedPairs(model);
  it('excludes 1–2 directly bonded pairs',()=>{
    expect(bondSeparation(model,'3:N','3:CA')).toBe(1);
    expect(excluded.has(key('3:N','3:CA'))).toBe(true);
  });
  it('excludes 1–3 angle-connected pairs',()=>{
    expect(bondSeparation(model,'3:N','3:C')).toBe(2);
    expect(excluded.has(key('3:N','3:C'))).toBe(true);
  });
  it('excludes 1–4 pairs, including the six former O(i)–Cα(i+1) artifacts',()=>{
    expect(CLASH_EXCLUDED_BONDS).toBe(3);
    for(let residue=0;residue<6;residue++){
      const a=`${residue}:O`,b=`${residue+1}:CA`;
      expect(bondSeparation(model,a,b)).toBe(3);
      expect(excluded.has(key(a,b))).toBe(true);
    }
  });
  it('does not exclude atoms four or more bonds apart',()=>{
    expect(bondSeparation(model,'3:H','3:O')).toBe(4);
    expect(excluded.has(key('3:H','3:O'))).toBe(false);
  });
});

describe('validated serious-clash criterion',()=>{
  it('uses a 0.40 Å overlap tolerance and a 1.00 Å polar-H radius',()=>{
    expect(CLASH_OVERLAP_TOLERANCE).toBe(0.4);
    expect(CLASH_VDW.H).toBe(1.0);
    expect(VDW.H).toBe(1.2); // Full-radius sphere display remains the Bondi visualization.
  });
  it.each([
    ['α-like',-60,-45],['β-like',-135,135],['Extended',-180,180],
  ])('%s preset has no severe nonbonded overlap',(_name,phi,psi)=>{
    expect(pairIds(phi as number,psi as number)).toEqual([]);
  });
  it('matches the audited severe-pair list at deliberately unfavorable 0°/0°',()=>{
    expect(pairIds(0,0)).toEqual([
      '2:O|4:H','2:O|4:N','2:C|4:H','2:C|4:N',
      '2:O|4:CA','2:O|3:C','2:O|4:O','2:O|4:C',
    ]);
  });
  it('still evaluates nonlocal cap contacts rather than excluding caps wholesale',()=>{
    const model=buildPeptide();
    model.atoms.find(a=>a.id==='6:CA')!.position=[...point(model,0,'O')];
    expect(clashes(model).some(c=>key(c.a,c.b)===key('0:O','6:CA'))).toBe(true);
  });
});

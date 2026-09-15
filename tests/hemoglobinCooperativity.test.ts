import {describe,it,expect} from 'vitest';
import tRaw from '../src/data/structures/2DN2.pdb?raw';
import rRaw from '../src/data/structures/2DN1.pdb?raw';
import labSource from '../src/modules/HemoglobinCooperativityLab.tsx?raw';
import panelSource from '../src/modules/CooperativityStructurePanel.tsx?raw';
import plotSource from '../src/components/SaturationPlot.tsx?raw';
import modelSource from '../src/protein/cooperativity.ts?raw';
import {MWC_DEFAULT,checkParameters,hillCoefficient,independentOccupancy,independentSaturation,mwcState,normalizedModel,occupancyDistribution,partitionTerms,saturation,saturationClosedForm,solveP50,type MwcParameters} from '../src/protein/cooperativity';
import {inspectionView} from '../src/protein/cooperativityStructure';
import {analyzeTransition,guidePositions,transitionSceneModel,R_SOURCE,T_SOURCE} from '../src/protein/hemoglobinTransition';
import {HEMOGLOBIN_SOURCE} from '../src/protein/hemoglobin';

const P=MWC_DEFAULT,model=normalizedModel(P);
const logGrid=(from:number,to:number,count:number)=>Array.from({length:count},(_,i)=>from*(to/from)**(i/(count-1)));
const X_GRID=[0,...logGrid(1e-6,1e6,121)];
const U_GRID=Array.from({length:401},(_,i)=>i/100);
/** Central difference of ln(Y/(1−Y)) against ln p, independent of the analytic Hill formula. */
const numericHill=(f:(x:number)=>number,x:number,h=1e-4)=>{const g=(v:number)=>{const y=f(v);return Math.log(y/(1-y));};return (g(x*Math.exp(h))-g(x*Math.exp(-h)))/(2*h);};
const binom=(n:number,k:number)=>{let b=1;for(let i=1;i<=k;i++)b=b*(n-k+i)/i;return b;};

describe('MWC core',()=>{
 it('1 · partition terms equal the written closed form; Y from the stable ratio form equals the MWC saturation equation',()=>{
  expect(partitionTerms(0)).toEqual({QR:1,QT:P.L0,Q:1+P.L0});
  const x=2.5,{QR,QT,Q}=partitionTerms(x);
  expect(QR).toBeCloseTo(3.5**4,10);expect(QT).toBeCloseTo(P.L0*(1+P.c*x)**4,8);expect(Q).toBe(QR+QT);
  // Independent check of Y = (1/n) d ln Q / d ln x by finite difference.
  const lnQ=(v:number)=>Math.log(partitionTerms(v).Q),h=1e-5;
  for(const v of [0.1,1,9.9,40,300]){
   const s=mwcState(v);
   expect(s.Y).toBeCloseTo(saturationClosedForm(v),12);
   expect(s.Y).toBeCloseTo((lnQ(v*Math.exp(h))-lnQ(v*Math.exp(-h)))/(2*h)/4,8);
   expect(s.PR).toBeCloseTo(partitionTerms(v).QR/partitionTerms(v).Q,12);
   expect(s.PT).toBeCloseTo(partitionTerms(v).QT/partitionTerms(v).Q,12);
   expect(s.Y).toBeCloseTo(s.PR*v/(1+v)+s.PT*P.c*v/(1+P.c*v),14);
  }
 });
 it('2 · P_T + P_R = 1 for every ligand level and several parameter sets',()=>{
  for(const p of [P,{n:4,L0:1,c:0.5},{n:2,L0:1e6,c:1e-3},{n:4,L0:1e-3,c:0.9}] as MwcParameters[])
   for(const x of X_GRID){const s=mwcState(x,p);expect(Math.abs(s.PR+s.PT-1)).toBeLessThan(1e-12);}
 });
 it('3 · 0 ≤ Y, P_T, P_R ≤ 1 and never NaN or Infinity, including x = ∞ and extreme parameters',()=>{
  const sets:MwcParameters[]=[P,{n:4,L0:1e12,c:1e-6},{n:4,L0:1e-12,c:1},{n:8,L0:1e9,c:1e-4}];
  for(const p of sets)for(const x of [...X_GRID,1e12,1e200,Number.MAX_VALUE,Infinity]){
   const s=mwcState(x,p);
   for(const v of [s.Y,s.PT,s.PR,s.yR,s.yT]){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(1);}
   expect(Number.isFinite(hillCoefficient(x,p))).toBe(true);
  }
  expect(()=>mwcState(-1)).toThrow();expect(()=>mwcState(NaN)).toThrow();
  expect(()=>checkParameters({n:4,L0:0,c:0.1})).toThrow();expect(()=>checkParameters({n:0,L0:1,c:0.1})).toThrow();expect(()=>checkParameters({n:4,L0:1,c:-1})).toThrow();
 });
 it('4 · low-ligand limit: Y → 0, P_T → L0/(1+L0), P_R → 1/(1+L0)',()=>{
  const s0=mwcState(0);expect(s0.Y).toBe(0);
  expect(s0.PT).toBeCloseTo(P.L0/(1+P.L0),15);expect(s0.PR).toBeCloseTo(1/(1+P.L0),15);
  const s=mwcState(1e-9);expect(s.Y).toBeLessThan(1e-9);expect(s.PT).toBeCloseTo(model.lowLimit.PT,8);expect(s.PR).toBeCloseTo(model.lowLimit.PR,8);
  expect(model.at(0)).toMatchObject({Y:0,meanBound:0,reference:0});
 });
 it('5 · high-ligand limit: Y → 1, P_R → 1/(1+L0·c⁴) (not exactly 1: T still exists at L0·c⁴)',()=>{
  const LcN=P.L0*P.c**4;
  expect(model.highLimit.PR).toBeCloseTo(1/(1+LcN),15);expect(model.highLimit.PR).toBeGreaterThan(0.999);expect(model.highLimit.PR).toBeLessThan(1);
  const s=mwcState(1e9);expect(s.Y).toBeGreaterThan(1-1e-7);expect(s.PR).toBeCloseTo(model.highLimit.PR,8);
  expect(mwcState(Infinity)).toMatchObject({Y:1,yR:1,yT:1});expect(mwcState(Infinity).PR).toBeCloseTo(model.highLimit.PR,14);
  expect(saturation(1e300)).toBeCloseTo(1,12);
 });
 it('6 · Y rises monotonically with ligand and P_R rises while P_T falls (default parameters)',()=>{
  const grid=[...X_GRID.slice(0,100)];
  for(let i=1;i<grid.length;i++){
   const a=mwcState(grid[i-1]),b=mwcState(grid[i]);
   expect(b.Y).toBeGreaterThanOrEqual(a.Y);expect(b.PR).toBeGreaterThanOrEqual(a.PR);expect(b.PT).toBeLessThanOrEqual(a.PT);
  }
  const ys=U_GRID.map(u=>model.at(u).Y);for(let i=1;i<ys.length;i++)expect(ys[i]).toBeGreaterThan(ys[i-1]);
 });
 it('7 · deterministic: repeated evaluation and a fresh model give identical numbers',()=>{
  const again=normalizedModel({...MWC_DEFAULT});
  expect(again.x50).toBe(model.x50);expect(again.hillAtP50).toBe(model.hillAtP50);
  for(const u of [0,0.3,1,2.2,4])expect(again.at(u)).toEqual(model.at(u));
  expect(model.curve(4,400)).toEqual(again.curve(4,400));
 });
});

describe('P50 normalization',()=>{
 it('8 · bisection root solver brackets and converges; P50 is not hard-coded in the model or UI',()=>{
  const x50=solveP50(P);
  expect(saturation(x50*(1-1e-9))).toBeLessThan(0.5);expect(saturation(x50*(1+1e-9))).toBeGreaterThan(0.5);
  // Cross-check: independent linear-space bisection on the written closed form.
  let a=0,b=1000;for(let i=0;i<200;i++){const mid=(a+b)/2;if(saturationClosedForm(mid)<0.5)a=mid;else b=mid;}
  expect(x50).toBeCloseTo((a+b)/2,9);
  // Known closed-form check: n = 1 gives x50 = (1+L0)/(1+L0·c) exactly.
  const p1={n:1,L0:3,c:0.2};expect(solveP50(p1)).toBeCloseTo((1+3)/(1+3*0.2),10);
  // Noncooperative special case L0 → tiny: P50 → K_R (x50 → 1).
  expect(solveP50({n:4,L0:1e-12,c:0.01})).toBeCloseTo(1,9);
  for(const src of [modelSource,labSource,plotSource])expect(src).not.toMatch(/9\.8\d|x50\s*=\s*\d/);
 });
 it('9 · Y(P50) = 0.5 to 1e-12',()=>{
  expect(Math.abs(saturation(model.x50)-0.5)).toBeLessThan(1e-12);
  expect(Math.abs(saturationClosedForm(model.x50)-0.5)).toBeLessThan(1e-12);
  expect(model.x50).toBeGreaterThan(1);expect(model.p50OverKT).toBeLessThan(1); // P50 lies between K_R and K_T
  expect(model.p50OverKT).toBeCloseTo(model.x50*P.c,14);
 });
 it('10 · normalization: u = 1 gives Y = 0.5; u maps to p = u·P50',()=>{
  expect(Math.abs(model.at(1).Y-0.5)).toBeLessThan(1e-12);
  for(const u of [0.25,0.5,2,3])expect(model.at(u).Y).toBeCloseTo(saturation(u*model.x50),14);
  expect(model.at(0.5).Y).toBeLessThan(0.5);expect(model.at(2).Y).toBeGreaterThan(0.5);
 });
});

describe('Independent one-site reference',()=>{
 it('11 · u = 1 → 0.5, and Y = u/(1+u) elsewhere',()=>{
  expect(independentSaturation(1)).toBe(0.5);expect(independentSaturation(0)).toBe(0);expect(independentSaturation(3)).toBe(0.75);expect(independentSaturation(Infinity)).toBe(1);
  expect(model.at(1).reference).toBe(0.5);expect(()=>independentSaturation(-0.1)).toThrow();
 });
 it('12 · monotonic, concave hyperbola (no inflection point for u > 0)',()=>{
  const ys=U_GRID.map(independentSaturation);
  for(let i=1;i<ys.length;i++)expect(ys[i]).toBeGreaterThan(ys[i-1]);
  for(let i=1;i<ys.length-1;i++)expect(ys[i+1]-2*ys[i]+ys[i-1]).toBeLessThan(0);
 });
 it('13 · Hill coefficient of the reference is 1 everywhere (numerical derivative)',()=>{
  for(const u of [0.01,0.2,1,2.5,4,50])expect(numericHill(independentSaturation,u)).toBeCloseTo(1,6);
  // An MWC protein with c = 1 (both states same affinity) is also noncooperative: analytic n_H = 1.
  for(const x of [0.1,1,10])expect(hillCoefficient(x,{n:4,L0:9054,c:1})).toBeCloseTo(1,12);
 });
});

describe('Cooperativity',()=>{
 it('14 · default MWC curve is sigmoidal: convex at low pressure with an inflection point, unlike the reference',()=>{
  const ys=U_GRID.map(u=>model.at(u).Y),second=ys.slice(1,-1).map((y,i)=>ys[i+2]-2*y+ys[i]);
  expect(second[5]).toBeGreaterThan(0); // u ≈ 0.06: accelerating (convex)
  expect(second[second.length-1]).toBeLessThan(0); // u ≈ 4: decelerating (concave)
  const flip=second.findIndex((v,i)=>i>0&&second[i-1]>0&&v<=0);
  expect(flip).toBeGreaterThan(0);const uInflect=(flip+1)/100;expect(uInflect).toBeGreaterThan(0.3);expect(uInflect).toBeLessThan(1.2);
  // Same P50, different shape: below P50 Hb is less saturated, above it more saturated than the reference.
  for(const u of [0.1,0.25,0.5,0.9])expect(model.at(u).Y).toBeLessThan(model.at(u).reference);
  for(const u of [1.1,1.5,2,3,4])expect(model.at(u).Y).toBeGreaterThan(model.at(u).reference);
 });
 it('15 · effective Hill coefficient: analytic = numerical derivative; > 1 near P50; ≤ n everywhere; → 1 at extremes',()=>{
  for(const x of [0.01,1,5,model.x50,20,100,1e4])expect(hillCoefficient(x)).toBeCloseTo(numericHill(v=>saturation(v),x),5);
  expect(model.hillAtP50).toBeGreaterThan(2.5);expect(model.hillAtP50).toBeLessThan(P.n);
  const all=X_GRID.map(x=>hillCoefficient(x));for(const h of all){expect(h).toBeGreaterThanOrEqual(1-1e-9);expect(h).toBeLessThanOrEqual(P.n);}
  expect(hillCoefficient(1e-8)).toBeCloseTo(1,5);expect(hillCoefficient(1e8)).toBeCloseTo(1,4);
  // Upper bound approached only for an extremely concerted model (huge L0, tiny c): still ≤ n.
  const extreme={n:4,L0:1e16,c:1e-8},h=hillCoefficient(solveP50(extreme),extreme);expect(h).toBeGreaterThan(3.9);expect(h).toBeLessThanOrEqual(4);
  // The UI number is the model's value, not typed in.
  expect(labSource).toContain('model.hillAtP50.toFixed(2)');
 });
 it('16 · convention c = K_R/K_T (dissociation): 0 < c < 1 makes R the higher-affinity state; both states bind',()=>{
  expect(P).toEqual({n:4,L0:9054,c:0.014});expect(P.c).toBeGreaterThan(0);expect(P.c).toBeLessThan(1);
  for(const x of [0.5,5,50]){const s=mwcState(x);expect(s.yR).toBeGreaterThan(s.yT);expect(s.yT).toBeGreaterThan(0);expect(s.yT).toBeCloseTo(P.c*x/(1+P.c*x),14);}
  // Swapping to c > 1 would make T the higher-affinity state and binding would shift the ensemble toward T.
  const inverted={n:4,L0:9054,c:1/0.014};expect(mwcState(5,inverted).PT).toBeGreaterThan(mwcState(0,inverted).PT);
  expect(mwcState(5).PT).toBeLessThan(mwcState(0).PT);
  // Larger L0 or smaller c → stronger cooperativity (Hill at P50), as MWC predicts.
  const nH=(p:MwcParameters)=>hillCoefficient(solveP50(p),p);
  expect(nH({n:4,L0:9054,c:0.05})).toBeLessThan(nH(P));expect(nH({n:4,L0:100,c:0.014})).toBeLessThan(nH(P));
 });
});

describe('Occupancy distribution',()=>{
 it('17 · Σ P(k) = 1 at many pressures; P(k) matches C(4,k)[x^k + L0(cx)^k]/Q',()=>{
  for(const x of X_GRID){const d=occupancyDistribution(x);expect(d).toHaveLength(5);expect(Math.abs(d.reduce((s,v)=>s+v,0)-1)).toBeLessThan(1e-12);}
  for(const x of [0.3,3,9.9,40]){const {Q}=partitionTerms(x),d=occupancyDistribution(x);
   d.forEach((v,k)=>expect(v).toBeCloseTo(binom(4,k)*(x**k+P.L0*(P.c*x)**k)/Q,13));}
 });
 it('18 · mean occupancy Σ k·P(k) = 4Y; variance gives the analytic Hill coefficient',()=>{
  for(const x of X_GRID){const d=occupancyDistribution(x),mean=d.reduce((s,v,k)=>s+k*v,0),Y=saturation(x);
   expect(Math.abs(mean-4*Y)).toBeLessThan(1e-11);
   if(Y>1e-6&&Y<1-1e-6){const variance=d.reduce((s,v,k)=>s+k*k*v,0)-mean*mean;expect(hillCoefficient(x)).toBeCloseTo(variance/(4*Y*(1-Y)),6);}
  }
  for(const u of [0.3,1,3]){const pt=model.at(u);expect(pt.meanBound).toBeCloseTo(4*pt.Y,14);expect(pt.referenceOccupancy.reduce((s,v,k)=>s+k*v,0)).toBeCloseTo(4*pt.reference,12);}
  // At P50 the MWC ensemble is bimodal (mostly 0 or 4 bound), unlike the binomial reference.
  const d=model.at(1).occupancy,ref=independentOccupancy(4,1);
  expect(d[0]+d[4]).toBeGreaterThan(ref[0]+ref[4]);expect(d[2]).toBeLessThan(ref[2]);
 });
 it('19 · no negative or >1 probabilities, including extremes',()=>{
  for(const p of [P,{n:4,L0:1e12,c:1e-6}] as MwcParameters[])for(const x of [...X_GRID,Infinity])
   for(const v of occupancyDistribution(x,p)){expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(1);expect(Number.isNaN(v)).toBe(false);}
  expect(occupancyDistribution(0)).toEqual([1,0,0,0,0]);
 });
});

describe('Structural integration (Phase 4B endpoints reused, never interpolated)',()=>{
 const m=analyzeTransition(tRaw,rRaw),scene=transitionSceneModel(m);
 it('20 · T structure remains PDB 2DN2 (deoxy) at its deposited coordinates',()=>{
  expect(T_SOURCE.pdbId).toBe('2DN2');expect(m.t.structure.id).toBe('2DN2');expect(HEMOGLOBIN_SOURCE.pdbId).toBe('2DN2');
  expect(scene.t.positions).toEqual(m.t.structure.atoms.map(a=>a.position));expect(m.t.ligands).toHaveLength(0);
  expect(inspectionView('T')).toEqual({state:'T',fraction:0,highlight:'all',showHeme:true,showLigand:true,showInterface:false,showGuide:false,heme:null});
 });
 it('21 · R structure remains PDB 2DN1 with its four deposited O₂ (not removed to match a saturation)',()=>{
  expect(R_SOURCE.pdbId).toBe('2DN1');expect(m.r.structure.id).toBe('2DN1');
  expect(scene.r.positions).toBe(m.rAligned);expect(scene.r.ligands).toHaveLength(4);
  expect(inspectionView('R')).toMatchObject({state:'R',fraction:0,showLigand:true,showGuide:false});
 });
 it('22 · no pO₂-dependent coordinate interpolation: the inspection view depends only on the endpoint',()=>{
  expect(inspectionView.length).toBe(1);
  expect(inspectionView('T')).toEqual(inspectionView('T'));
  // Guide positions at fraction 0 (the only fraction the module can pass) are the T coordinates themselves.
  expect(guidePositions(scene.t.positions,scene.motion,inspectionView('T').fraction)).toEqual(scene.t.positions);
  // The structure panel receives only `endpoint`; the cooperativity UI never feeds model values into the 3D scene.
  expect(panelSource).toMatch(/CooperativityStructurePanel\(\{endpoint\}:\{endpoint:InspectedEndpoint\}\)/);
  expect(labSource).toMatch(/<CooperativityStructurePanel endpoint=\{endpoint\}\/>/);
  for(const src of [labSource,panelSource]){expect(src).not.toMatch(/guidePositions|guidePose|slerp|state:'motion'|lerp|interpolat\w*\(/);expect(src).not.toMatch(/fraction[:=]\s*(u|p\.|model)/);}
  expect(modelSource).not.toMatch(/import/);
 });
 it('23 · Phase 4B motion guide and structural results unchanged (0.93 Å, 14.1°, rigid guide, chain RMSD)',()=>{
  expect(m.reference.rmsd.toFixed(2)).toBe('0.93');expect(m.moving.screw.angle.toFixed(1)).toBe('14.1');
  expect(m.moving.centroidDisplacement.toFixed(1)).toBe('3.1');expect(m.reference.matched).toBe(285);
  expect(Object.fromEntries(Object.entries(m.subunitFits).map(([k,v])=>[k,v.rmsd.toFixed(2)]))).toEqual({'α1':'0.61','β1':'0.84','α2':'0.54','β2':'0.84'});
  const g1=guidePositions(scene.t.positions,scene.motion,1);
  const d=(p:number[],q:number[])=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
  for(const [a,b] of scene.t.polymerBonds.slice(0,2000))expect(Math.abs(d(g1[a],g1[b])-d(scene.t.positions[a],scene.t.positions[b]))).toBeLessThan(1e-9);
 });
});

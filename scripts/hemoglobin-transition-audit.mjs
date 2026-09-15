import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
// Audit of the T ↔ R comparison with the same code the app uses (PDB 2DN2 = T endpoint, 2DN1 = R endpoint).
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const tText=await readFile('src/data/structures/2DN2.pdb','utf8'),rText=await readFile('src/data/structures/2DN1.pdb','utf8');
 const {analyzeTransition,morphPositions,REFERENCE_DIMER,MOVING_DIMER}=await server.ssrLoadModule('/src/protein/hemoglobinTransition.ts');
 const {interfaceContacts}=await server.ssrLoadModule('/src/protein/quaternary.ts');
 const started=performance.now(),m=analyzeTransition(tText,rText),ms=performance.now()-started;
 const round=(v,n=3)=>Number(v.toFixed(n)),vec=(v,n=3)=>v.map(x=>round(x,n));
 const sha=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
 const endpoint=(model,file)=>({
  pdb:model.structure.id,sha256:null,file,resolution:model.header.resolution,method:model.header.method,assembly:model.assembly,operators:model.operators,
  chains:model.structure.chains,subunits:model.subunits.map(s=>({label:s.label,chain:s.chain,sourceChain:s.sourceChain,operator:s.operator,type:s.type,uniprot:s.uniprot,sequenceLength:s.sequenceLength,modeledResidues:s.modeledResidues,range:[s.firstResSeq,s.lastResSeq],
   heavyAtoms:s.residues.reduce((n,i)=>n+model.structure.residues[i].atoms.length,0),heme:{number:s.heme.number,record:`${s.heme.resName} ${s.heme.fileChain} ${s.heme.resSeq}`,group:s.heme.group,contacts:s.heme.association.contacts,proximal:`His${s.heme.proximal.resSeq} ${s.heme.proximal.atomName}`,feHis:round(s.heme.proximal.distance)}})),
  missingResidues:model.header.missingResidues,missingAtomRecords:model.header.missingAtoms,omitted:model.structure.omitted,
  altlocAtoms:model.structure.atoms.filter(a=>a.altLoc).length,partialOccupancyAtoms:model.structure.atoms.filter(a=>a.occupancy<1).length,
  hetero:model.structure.hetero.map(g=>`${g.resName} ${g.chain} ${g.resSeq} (${g.atoms.length})`),
  ligands:model.ligands.map(l=>({record:`${l.resName} ${l.chain} ${l.resSeq}`,heme:model.hemes.find(h=>h.group===l.heme).number,feAtom:model.structure.atoms[l.feAtom].name,feDistance:round(l.feDistance),occupancy:l.occupancy,altlocs:l.altlocs,
   atoms:l.atoms.map(i=>{const a=model.structure.atoms[i];return `${a.name} occ ${a.occupancy} B ${a.bFactor}`;})})),
  additives:model.additives,links:model.header.links.map(l=>`${l.a.name} ${l.a.resName} ${l.a.chain}${l.a.resSeq} – ${l.b.name} ${l.b.resName} ${l.b.chain}${l.b.resSeq} ${l.distance} Å`),
  interfaces:interfaceContacts(model.structure).pairs.map(p=>{const lab=c=>model.subunits.find(s=>s.chain===c).label;return {pair:`${lab(p.chains[0])}–${lab(p.chains[1])}`,chains:p.chains.join('-'),residues:[p.residues[0].length,p.residues[1].length],atomPairs:p.atomPairs};}),
  polymerHeavyAtoms:model.structure.residues.reduce((n,r)=>n+r.atoms.length,0),bonds:model.bonds.length,hemeBonds:model.hemeBonds.length,
 });
 const T=endpoint(m.t,'src/data/structures/2DN2.pdb'),R=endpoint(m.r,'src/data/structures/2DN1.pdb');T.sha256=await sha(T.file);R.sha256=await sha(R.file);
 const mid=morphPositions(m,0.5),t0=morphPositions(m,0),t1=morphPositions(m,1);
 const {transitionSceneModel}=await server.ssrLoadModule('/src/protein/hemoglobinTransition.ts'),scene=transitionSceneModel(m);
 const len=(p,a,b)=>Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1],p[a][2]-p[b][2]),BB=new Set(['N','CA','C','O','OXT']),nameOf=i=>m.common[i].key.split(':').at(-1);
 const bondStats=list=>{const d=list.map(([a,b])=>({bond:`${m.common[a].key}–${nameOf(b)}`,endpointMin:len(t0,a,b)<len(t1,a,b)?len(t0,a,b):len(t1,a,b),mid:len(mid,a,b)})).map(x=>({...x,short:x.endpointMin-x.mid})).sort((x,y)=>y.short-x.short);
  return {bonds:d.length,shortenedOver0_1:d.filter(x=>x.short>0.1).length,shortenedOver0_5:d.filter(x=>x.short>0.5).length,minMidpoint:round(Math.min(...d.map(x=>x.mid))),worst:d.slice(0,8).map(x=>`${x.bond} ${round(x.endpointMin,2)}→${round(x.mid,2)} Å`)};};
 const backbone=scene.morph.polymerBonds.filter(([a,b])=>BB.has(nameOf(a))&&BB.has(nameOf(b))),side=scene.morph.polymerBonds.filter(([a,b])=>!(BB.has(nameOf(a))&&BB.has(nameOf(b))));
 // Sensitivity: exclude three residues at each chain terminus from the reference fit.
 const {fitRigid}=await server.ssrLoadModule('/src/protein/rigid.ts');
 const out={
  endpoints:{T,R},
  correspondence:m.correspondence,commonAtoms:{total:m.common.length,polymer:m.common.filter(c=>!c.key.includes(':HEM:')).length,heme:m.common.filter(c=>c.key.includes(':HEM:')).length,
   tAtoms:m.t.structure.atoms.length,rAtoms:m.r.structure.atoms.length},
  reference:{dimer:REFERENCE_DIMER.join(''),atoms:'Cα',matched:m.reference.matched,rmsd:round(m.reference.rmsd),maxDeviation:round(m.reference.maxDeviation),determinant:round(m.reference.determinant,12),
   rotation:m.reference.rotation.map(r=>vec(r,6)),translation:vec(m.reference.translation)},
  moving:{dimer:MOVING_DIMER.join(''),matched:m.moving.fit.matched,rmsdAfterReferenceAlignmentOnly:round(m.moving.rmsdBeforeFit),rmsdAfterOwnFit:round(m.moving.fit.rmsd),
   determinant:round(m.moving.fit.determinant,12),angle:round(m.moving.screw.angle,2),axis:vec(m.moving.screw.axis,4),axisPoint:vec(m.moving.screw.axisPoint,2),
   screwTranslation:round(m.moving.screw.screwTranslation,2),radius:round(m.moving.screw.radius,2),centroidT:vec(m.moving.centroidT,2),centroidR:vec(m.moving.centroidR,2),centroidDisplacement:round(m.moving.centroidDisplacement,2)},
  reversed:{referenceRmsd:round(m.reversed.referenceRmsd),angle:round(m.reversed.angle,2)},
  wholeTetramerFitRmsd:round(m.wholeTetramerRmsd),perSubunitFitRmsd:Object.fromEntries(Object.entries(m.perSubunitRmsd).map(([k,v])=>[k,round(v)])),
  hemes:{t:m.hemes.t.map(h=>({...h,feHis:round(h.feHis,5),feFromPorphyrin:round(h.feFromPorphyrin,5),feFromPyrroleN:round(h.feFromPyrroleN,5)})),r:m.hemes.r.map(h=>({...h,feHis:round(h.feHis,5),feFromPorphyrin:round(h.feFromPorphyrin,5),feFromPyrroleN:round(h.feFromPyrroleN,5),ligand:h.ligand&&{...h.ligand,feDistance:round(h.ligand.feDistance,5)}}))},
  contacts:{cutoff:m.contacts.cutoff,t:m.contacts.t.length,r:m.contacts.r.length,common:m.contacts.common.length,lost:m.contacts.lost.length,gained:m.contacts.gained.length,byPair:m.contacts.byPair,
   lostList:m.contacts.lost,gainedList:m.contacts.gained},
  morph:{midpointFinite:mid.every(p=>p.every(Number.isFinite)),atoms:mid.length,
   midpointBondDistortion:{note:'straight-line interpolation at fraction 0.5; shortening relative to the shorter endpoint length',backbone:bondStats(backbone),sideChain:bondStats(side),heme:bondStats(scene.morph.hemeBonds)}},
  analysisMs:round(ms,1),
  // First displayed Cα of each layer (browser endpoint-exactness checks).
  samples:(()=>{const ca=(atoms,chain)=>atoms.findIndex(a=>a.chain===chain&&a.name==='CA'&&!a.hetero),k=m.common.findIndex(c=>c.key==='α1:2:LEU:CA'),t=m.t.structure.atoms,r=m.r.structure.atoms;
   return {T:{atom:'A:1:VAL:CA',position:t[ca(t,'A')].position},R:{atom:'A:2:LEU:CA',position:m.rAligned[ca(r,'A')]},morph:{atom:'A:2:LEU:CA',t:t0[k],r:t1[k],mid:mid[k]}};})(),
  camera:{dimerDirection:m.moving.screw.axis},
 };
 const trimmed=m.common.filter(c=>c.key.endsWith(':CA')&&!c.key.includes(':HEM:')&&['α1','β1'].some(l=>c.key.startsWith(l+':'))).filter(c=>{const [l,p]=c.key.split(':');const n=l.startsWith('α')?141:146;return +p>4&&+p<=n-3;});
 const tf=fitRigid(trimmed.map(c=>m.r.structure.atoms[c.r].position),trimmed.map(c=>m.t.structure.atoms[c.t].position));
 const {applyRigid}=await server.ssrLoadModule('/src/protein/rigid.ts'),{screwMotion}=await server.ssrLoadModule('/src/protein/hemoglobinTransition.ts');
 const movTrim=m.common.filter(c=>c.key.endsWith(':CA')&&!c.key.includes(':HEM:')&&['α2','β2'].some(l=>c.key.startsWith(l+':'))).filter(c=>{const [l,p]=c.key.split(':');const n=l.startsWith('α')?141:146;return +p>4&&+p<=n-3;});
 const tMov=movTrim.map(c=>m.t.structure.atoms[c.t].position),rMov=movTrim.map(c=>applyRigid(tf,m.r.structure.atoms[c.r].position)),mf=fitRigid(tMov,rMov);
 const refCa=m.common.filter(c=>c.key.endsWith(':CA')&&!c.key.includes(':HEM:')&&['α1','β1'].some(l=>c.key.startsWith(l+':')));
 const deviations=refCa.map(c=>{const p=m.rAligned[c.r],q=m.t.structure.atoms[c.t].position;return {key:c.key,d:Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])};}).sort((a,b)=>b.d-a.d);
 out.reference.largestDeviations=deviations.slice(0,6).map(x=>`${x.key} ${round(x.d,2)} Å`);
 out.reference.within1A=deviations.filter(x=>x.d<=1).length;
 out.sensitivity={referenceWithoutTermini:{rule:'exclude UniProt positions 1–4 and the last 3 of each chain (both dimers)',matched:trimmed.length,rmsd:round(tf.rmsd),movingAngle:round(screwMotion(mf,tMov.reduce((s,p)=>[s[0]+p[0]/tMov.length,s[1]+p[1]/tMov.length,s[2]+p[2]/tMov.length],[0,0,0])).angle,2),movingOwnFitRmsd:round(mf.rmsd)}};
 await writeFile('artifacts/hemoglobin-transition-audit.json',JSON.stringify(out,null,1));
 console.log(JSON.stringify({...out,contacts:{...out.contacts,lostList:out.contacts.lostList.length,gainedList:out.contacts.gainedList.length}},null,1));
}finally{await server.close();}

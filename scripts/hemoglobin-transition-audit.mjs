import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
// Audit of the T ↔ R comparison with the same code the app uses (PDB 2DN2 = T endpoint, 2DN1 = R endpoint).
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const tText=await readFile('src/data/structures/2DN2.pdb','utf8'),rText=await readFile('src/data/structures/2DN1.pdb','utf8');
 const {analyzeTransition,guidePose,guidePositions,REFERENCE_DIMER,MOVING_DIMER}=await server.ssrLoadModule('/src/protein/hemoglobinTransition.ts');
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
 const {transitionSceneModel}=await server.ssrLoadModule('/src/protein/hemoglobinTransition.ts'),scene=transitionSceneModel(m),guide=scene.motion;
 const tPos=m.t.structure.atoms.map(a=>a.position),len=(p,a,b)=>Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1],p[a][2]-p[b][2]);
 const movingSet=new Set(guide.atoms),guideBonds=[...scene.t.polymerBonds,...scene.t.hemeBonds].filter(([a,b])=>movingSet.has(a)&&movingSet.has(b));
 const g0=guidePositions(tPos,guide,0),gMid=guidePositions(tPos,guide,0.5),g1=guidePositions(tPos,guide,1);
 const maxBondChange=Math.max(...[0.25,0.5,0.75,1].flatMap(f=>{const p=guidePositions(tPos,guide,f);return guideBonds.map(([a,b])=>Math.abs(len(p,a,b)-len(tPos,a,b)));}));
 const movCa=m.common.filter(c=>c.key.endsWith(':CA')&&!c.key.includes(':HEM:')&&MOVING_DIMER.some(l=>c.key.startsWith(l+':')));
 const guideEndVsR=Math.sqrt(movCa.reduce((s,c)=>s+len([g1[c.t],m.rAligned[c.r]],0,1)**2,0)/movCa.length);
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
  wholeTetramerFitRmsd:round(m.wholeTetramerRmsd),subunitFits:Object.fromEntries(Object.entries(m.subunitFits).map(([k,v])=>[k,{matched:v.matched,rmsd:round(v.rmsd,6)}])),
  hemes:{t:m.hemes.t.map(h=>({...h,feHis:round(h.feHis,5),feFromPorphyrin:round(h.feFromPorphyrin,5),feFromPyrroleN:round(h.feFromPyrroleN,5)})),r:m.hemes.r.map(h=>({...h,feHis:round(h.feHis,5),feFromPorphyrin:round(h.feFromPorphyrin,5),feFromPyrroleN:round(h.feFromPyrroleN,5),ligand:h.ligand&&{...h.ligand,feDistance:round(h.ligand.feDistance,5)}}))},
  contacts:{cutoff:m.contacts.cutoff,t:m.contacts.t.length,r:m.contacts.r.length,common:m.contacts.common.length,lost:m.contacts.lost.length,gained:m.contacts.gained.length,byPair:m.contacts.byPair,
   lostList:m.contacts.lost,gainedList:m.contacts.gained},
  motionGuide:{method:'moving dimer (all T polymer atoms + 2 hemes) as one rigid body; rotation = quaternion SLERP about the T Cα centroid, centroid moved linearly; α1β1 fixed',
   movingAtoms:guide.atoms.length,hemeAtoms:guide.atoms.filter(i=>m.t.structure.atoms[i].resName==='HEM').length,quaternion:vec(guide.quaternion,6),
   midpointAngle:round(Math.acos(Math.min(1,(guidePose(guide,0.5).rotation.reduce((s,r,i)=>s+r[i],0)-1)/2))*180/Math.PI,3),
   bondsChecked:guideBonds.length,maxBondLengthChange:maxBondChange,
   endpointVsExperimentalRCaRmsd:round(guideEndVsR),note:'guide 100% = T moving dimer after the calculated rigid motion; differs from aligned R by the moving dimer own-fit RMSD'},
  analysisMs:round(ms,1),
  // First displayed Cα of each layer (browser endpoint-exactness checks).
  samples:(()=>{const ca=(atoms,chain)=>atoms.findIndex(a=>a.chain===chain&&a.name==='CA'&&!a.hetero),t=m.t.structure.atoms,r=m.r.structure.atoms;
   const mv=ca(t,'C');
   return {T:{atom:'A:1:VAL:CA',position:t[ca(t,'A')].position},R:{atom:'A:2:LEU:CA',position:m.rAligned[ca(r,'A')]},
    motion:{atom:'C:1:VAL:CA',g0:g0[mv],mid:gMid[mv],g1:g1[mv],referenceAtom:'A:1:VAL:CA',reference:gMid[ca(t,'A')]}};})(),
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

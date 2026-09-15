import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
// Audit the same parser/SASA/orientation/classification code the app uses.
// Optional: `--fit path/to/opm-1qj8.pdb` re-derives the deposited → OPM rigid transform from the OPM file.
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ompx,ompxDeposited,ompxAnalysis,ompxBonds,OMPX_SLAB,OMPX_TO_OPM}=await server.ssrLoadModule('/src/protein/ompx.ts');
 const {ubiquitinExposure}=await server.ssrLoadModule('/src/protein/ubiquitin.ts');
 const {classifyMembrane,highlightIndices,countClasses,SURFACE_THRESHOLD,sideChainCentroid}=await server.ssrLoadModule('/src/protein/membrane.ts');
 const {fitRigid}=await server.ssrLoadModule('/src/protein/rigid.ts');
 const fitArg=process.argv.indexOf('--fit');
 let fit=null;
 if(fitArg>0){
  const col=(l,a,b)=>l.slice(a-1,b).trim(),opm=new Map((await readFile(process.argv[fitArg+1],'utf8')).split(/\r?\n/).filter(l=>l.startsWith('ATOM')).map(l=>[`${col(l,23,26)}:${col(l,13,16)}`,[+col(l,31,38),+col(l,39,46),+col(l,47,54)]]));
  const raw=(await readFile('src/data/structures/1QJ8.pdb','utf8')).split(/\r?\n/).filter(l=>l.startsWith('ATOM')&&['',"A"].includes(col(l,17,17)));
  const pairs=raw.map(l=>[`${col(l,23,26)}:${col(l,13,16)}`,[+col(l,31,38),+col(l,39,46),+col(l,47,54)]]).filter(([k])=>opm.has(k)&&!/^20:(CG|CD|CE|NZ)$/.test(k));
  fit=fitRigid(pairs.map(p=>p[1]),pairs.map(p=>opm.get(p[0])));fit.pairs=pairs.length;
  console.log('fit',JSON.stringify(fit));
 }
 const started=performance.now(),{exposure,membrane}=ompxAnalysis(),ms=performance.now()-started,ubq=ubiquitinExposure().residues;
 const name=r=>`${r.resName[0]}${r.resName.slice(1).toLowerCase()}${r.resSeq}`;
 const groups={};
 for(const [key,mode] of [['lipidFacing','lipid'],['aqueousFacing','aqueous'],['surface','surface'],['buried','buried']]){const set=highlightIndices(exposure.residues,membrane,mode);groups[key]={composition:countClasses(exposure.residues,set),residues:exposure.residues.filter(r=>set.has(r.index)).map(name)};}
 const ubqSurface=highlightIndices(ubq,null,'surface'),ubqBuried=highlightIndices(ubq,null,'buried');
 const membraneZone=new Set(membrane.filter(m=>m.zone==='membrane').map(m=>m.index));
 const sensitivity=[0.15,0.2,0.25,0.3].map(threshold=>{const m=classifyMembrane(ompx,exposure.residues,OMPX_SLAB,threshold);return {threshold,lipid:countClasses(exposure.residues,highlightIndices(exposure.residues,m,'lipid',threshold)),aqueous:countClasses(exposure.residues,highlightIndices(exposure.residues,m,'aqueous',threshold)),ubiquitinSurface:countClasses(ubq,highlightIndices(ubq,null,'surface',threshold))};});
 // SASA is stored from the deposited frame. Diagnostic only: how much a recomputation on the oriented copy would differ.
 const {analyzeExposure}=await server.ssrLoadModule('/src/protein/exposure.ts');
 const oriented=analyzeExposure(ompx).residues;
 const frame={source:'deposited',totalStored:exposure.total,totalOrientedRecomputed:oriented.reduce((s,r)=>s+r.sasa,0),maxResidueDiff:Math.max(...oriented.map((r,i)=>Math.abs(r.sasa-exposure.residues[i].sasa))),
  maxRelativeDiff:Math.max(...oriented.map((r,i)=>Math.abs(r.relative-exposure.residues[i].relative))),wouldFlip:exposure.residues.filter((r,i)=>(r.relative>=SURFACE_THRESHOLD)!==(oriented[i].relative>=SURFACE_THRESHOLD)).map(r=>`${name(r)} stored ${(r.relative*100).toFixed(1)} vs oriented ${(oriented[r.index].relative*100).toFixed(1)}`)};
 console.log('frame',JSON.stringify(frame));
 // Depth reference sensitivity: Cα instead of side-chain centroid.
 const caLipid=new Set(membrane.filter(m=>m.surface&&Math.abs(m.caDepth)<=OMPX_SLAB.halfThickness).map(m=>m.index));
 const audit={structure:{id:ompx.id,chain:ompx.chain,residues:ompx.residues.length,atoms:ompx.atoms.length,bonds:ompxBonds.length,omitted:ompx.omitted,
   partialOccupancy:ompx.residues.filter(r=>r.occupancy<1).map(r=>`${name(r)}:${r.occupancy}`)},transform:OMPX_TO_OPM,fit,slab:OMPX_SLAB,surfaceThreshold:SURFACE_THRESHOLD,ms,total:exposure.total,
  groups,membraneZone:countClasses(exposure.residues,membraneZone),ubiquitin:{surface:countClasses(ubq,ubqSurface),buried:countClasses(ubq,ubqBuried),surfaceResidues:ubq.filter(r=>ubqSurface.has(r.index)).map(name)},
  sensitivity,frame,caDepthLipid:countClasses(exposure.residues,caLipid),
  residues:exposure.residues.map(r=>{const m=membrane[r.index];return {...r,depth:m.depth,caDepth:m.caDepth,zone:m.zone,surface:m.surface,category:m.category,secondary:ompx.residues[r.index].secondary,deposited:sideChainCentroid(ompxDeposited,r.index)};})};
 await writeFile('artifacts/membrane-audit.json',JSON.stringify(audit,null,2));
 console.log(JSON.stringify({structure:audit.structure,slab:audit.slab,ms:ms.toFixed(0),total:audit.total.toFixed(1),membraneZone:audit.membraneZone,
  lipid:groups.lipidFacing.composition,aqueous:groups.aqueousFacing.composition,surface:groups.surface.composition,buried:groups.buried.composition,ubiquitin:audit.ubiquitin.surface,ubiquitinBuried:audit.ubiquitin.buried,caDepthLipid:audit.caDepthLipid},null,1));
 for(const s of sensitivity)console.log('threshold',s.threshold,'lipid',JSON.stringify(s.lipid),'aqueous',JSON.stringify(s.aqueous),'ubq',JSON.stringify(s.ubiquitinSurface));
 for(const r of audit.residues)console.log(`${name(r).padEnd(7)} ${r.chemical.padEnd(8)} rel ${(r.relative*100).toFixed(1).padStart(5)}% z ${r.depth.toFixed(1).padStart(6)} ca ${r.caDepth.toFixed(1).padStart(6)} ${r.zone.padEnd(8)} ${r.category} ${r.secondary}`);
}finally{await server.close();}

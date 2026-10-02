import {createServer} from 'vite';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
const {parsePdb,parsePdbHeader,parseMultiChainPdb}=await server.ssrLoadModule('/src/protein/pdb.ts'),{fitRigid,applyRigid}=await server.ssrLoadModule('/src/protein/rigid.ts');
const raw=await readFile('src/data/structures/1J4N.pdb','utf8'),opmRaw=await readFile(process.argv[2]??'artifacts/protein-additions/1j4n-opm.pdb','utf8'),s=parsePdb(raw),opm=parsePdb(opmRaw),hdr=parsePdbHeader(raw);
if(createHash('sha256').update(opmRaw).digest('hex')!=='b3e38a3194b932b38431caaafa8f64b5400826ae4b97f423b6e755ede1f847c3')throw new Error('OPM checksum differs: verify source before regenerating');
const by=new Map(opm.atoms.map(a=>[a.resSeq+':'+a.name,a])),atoms=s.atoms.filter(a=>['N','CA','C','O'].includes(a.name)&&by.has(a.resSeq+':'+a.name));
const fit=fitRigid(atoms.map(a=>a.position),atoms.map(a=>by.get(a.resSeq+':'+a.name).position));
const waters=raw.split(/\r?\n/).filter(l=>l.startsWith('HETATM')&&l.slice(17,20)==='HOH').map(l=>({id:Number(l.slice(22,26)),p:[Number(l.slice(30,38)),Number(l.slice(38,46)),Number(l.slice(46,54))]})),anchors=waters.filter(w=>w.id<=304).sort((a,b)=>a.p[2]-b.p[2]);
const radii={C:1.7,N:1.55,O:1.52,S:1.8},dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const gap=p=>Math.min(...s.atoms.map(a=>dist(p,a.position)-radii[a.element]));
function seed(z){if(z<anchors[0].p[2])return [anchors[0].p[0],anchors[0].p[1],z];if(z>anchors.at(-1).p[2])return [anchors.at(-1).p[0],anchors.at(-1).p[1],z];const b=anchors.findIndex(a=>a.p[2]>=z);if(b===0)return [...anchors[0].p];const a=anchors[b-1].p,c=anchors[b].p,t=(z-a[2])/(c[2]-a[2]);return [a[0]+t*(c[0]-a[0]),a[1]+t*(c[1]-a[1]),z];}
function optimize(start,stop,step){
 const points=[];let prev=seed(start);
 for(let z=start;step>0?z<=stop:z>=stop;z+=step){const ref=seed(z);let best=null;
 for(let dx=-5;dx<=5;dx+=.4)for(let dy=-5;dy<=5;dy+=.4){
 const p=[ref[0]+dx,ref[1]+dy,z];if(points.length&&Math.hypot(p[0]-prev[0],p[1]-prev[1])>1)continue;
 const g=gap(p),score=Math.min(g,2.2)-.035*Math.hypot(dx,dy)-.15*Math.hypot(p[0]-prev[0],p[1]-prev[1]);
 if(!best||score>best.score)best={p,g,score};}
 if(!best)throw new Error('No path candidate');points.push(best.p);prev=best.p;
 }return points;
}
const mid=26,path=[...optimize(mid,2,-.5).reverse(),...optimize(mid+.5,55,.5)];
let min=Infinity,minAt=null;
for(let i=1;i<path.length;i++)for(let j=0;j<=10;j++){const t=j/10,p=path[i-1].map((v,k)=>v+(path[i][k]-v)*t),g=gap(p);if(g<min){min=g;minAt=p;}}
const opmAll=parseMultiChainPdb(opmRaw);
const centroids={};for(const chain of opmAll.chains){const ca=opmAll.atoms.filter(a=>a.chain===chain&&a.name==='CA');centroids[chain]=ca.reduce((p,a)=>p.map((x,i)=>x+a.position[i]/ca.length),[0,0,0]);}
const opCentroids=hdr.assemblies[0].operators.map(op=>{const ca=s.atoms.filter(a=>a.name==='CA');return ca.reduce((p,a)=>p.map((x,i)=>x+applyRigid(fit,applyRigid(op,a.position))[i]/ca.length),[0,0,0]);});
const audit={opmSha256:createHash('sha256').update(opmRaw).digest('hex'),fit,centroids,opCentroids,pathMinClearance:min,pathMinAt:minAt,pathPoints:path.length,waterGap:anchors.map(w=>({id:w.id,gap:gap(w.p)}))};
await writeFile('artifacts/protein-additions/aqp-path-preaudit.json',JSON.stringify(audit,null,2));
await writeFile('src/data/aqp1-channel.json',JSON.stringify({description:'Illustrative clearance-guided path in original 1J4N coordinates; not MD, HOLE or a physical water trajectory. Constrained around deposited waters 301–304; all samples checked against protein vdW spheres.',points:path.map(p=>p.map(x=>Number(x.toFixed(6)))),particleRadius:.35,minimumClearance:min},null,2));
await writeFile('src/protein/aqp1Orientation.ts','// OPM 1j4n, 2026-10-03. Rigid fit of 996 matched backbone atoms.\nimport type {RigidTransform} from \'./rigid\';\nexport const AQP1_OPM:RigidTransform='+JSON.stringify({rotation:fit.rotation,translation:fit.translation},null,2)+';\nexport const AQP1_HALF_THICKNESS=15.9;\n');
await writeFile('tests/fixtures/1j4n-opm-backbone.json',JSON.stringify({source:'https://opm-assets.storage.googleapis.com/pdb/1j4n.pdb',sha256:audit.opmSha256,halfThickness:15.9,atoms:atoms.map(a=>({resSeq:a.resSeq,name:a.name,position:by.get(a.resSeq+':'+a.name).position})),subunitCentroids:centroids},null,2));
console.log(JSON.stringify(audit,null,2));
}finally{await server.close();}

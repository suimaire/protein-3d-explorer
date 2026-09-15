import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
// Audit of the MWC cooperativity model with the same code the app uses (src/protein/cooperativity.ts).
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {MWC_DEFAULT,normalizedModel,hillCoefficient,solveP50,saturation}=await server.ssrLoadModule('/src/protein/cooperativity.ts');
 const m=normalizedModel(MWC_DEFAULT),r=(v,n=6)=>Number(v.toPrecision(n));
 const point=u=>{const p=m.at(u),sum=p.occupancy.reduce((s,v)=>s+v,0),mean=p.occupancy.reduce((s,v,k)=>s+k*v,0);
  return {u,Y:r(p.Y),reference:r(p.reference),meanBound:r(p.meanBound),PT:r(p.PT),PR:r(p.PR),yT:r(p.yT),yR:r(p.yR),hill:r(p.hill),
   occupancy:p.occupancy.map(v=>r(v)),referenceOccupancy:p.referenceOccupancy.map(v=>r(v)),occupancySum:r(sum,12),occupancyMean:r(mean,12),fourY:r(4*p.Y,12)};};
 // Inflection point of Y(u) from second differences (sigmoid check).
 const ys=Array.from({length:4001},(_,i)=>m.at(i/1000).Y);let inflection=null;
 for(let i=2;i<ys.length-1;i++){const a=ys[i]-2*ys[i-1]+ys[i-2],b=ys[i+1]-2*ys[i]+ys[i-1];if(a>0&&b<=0){inflection=i/1000;break;}}
 let maxHill={u:0,value:0};for(let i=1;i<=4000;i++){const h=m.at(i/1000).hill;if(h>maxHill.value)maxHill={u:i/1000,value:r(h)};}
 const sensitivity=[{L0:9054,c:0.014},{L0:9054,c:0.05},{L0:100,c:0.014},{L0:1e5,c:0.015}].map(p=>{const q={n:4,...p},x50=solveP50(q);return {...p,x50:r(x50),hillAtP50:r(hillCoefficient(x50,q))};});
 const audit={parameters:MWC_DEFAULT,convention:'x = p/K_R; L0 = [T0]/[R0]; c = K_R/K_T (dissociation constants)',
  x50:r(m.x50,10),p50OverKT:r(m.p50OverKT,10),yAtP50:r(saturation(m.x50),15),hillAtP50:r(m.hillAtP50),maxHill,inflectionU:inflection,
  lowLimit:{PT:r(m.lowLimit.PT,10),PR:r(m.lowLimit.PR,10)},highLimit:{PT:r(m.highLimit.PT,10),PR:r(m.highLimit.PR,10)},
  points:Object.fromEntries([0,0.3,0.5,1,2,3,4].map(u=>[u,point(u)])),sensitivity};
 await writeFile('artifacts/hemoglobin-cooperativity-audit.json',JSON.stringify(audit,null,1));
 console.log(JSON.stringify({x50:audit.x50,p50OverKT:audit.p50OverKT,hillAtP50:audit.hillAtP50,maxHill,inflection,low:audit.lowLimit,high:audit.highLimit,
  u0:audit.points[0],u1:audit.points[1],u3:audit.points[3],sensitivity},null,1));
}finally{await server.close();}

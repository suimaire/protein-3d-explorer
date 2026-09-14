import type {Vec} from '../geometry/vector';

/** Bondi (1964) heavy-atom vdW radii, Å. Same C/N/O values as the peptide modules; S added. */
export const SASA_RADII:Record<string,number>={C:1.70,N:1.55,O:1.52,S:1.80};
export const PROBE_RADIUS=1.4;
export const SASA_POINTS=960;

export type SasaAtom={element:string;position:Vec};

/** Golden-section spiral: deterministic, near-uniform unit-sphere test points. */
export function spherePoints(n:number):Vec[]{
 const points:Vec[]=[],increment=Math.PI*(3-Math.sqrt(5)),dz=2/n;
 for(let k=0;k<n;k++){const z=1-dz/2-k*dz,r=Math.sqrt(1-z*z),longitude=k*increment;points.push([Math.cos(longitude)*r,Math.sin(longitude)*r,z]);}
 return points;
}

export const radiusOf=(element:string)=>{
 const r=SASA_RADII[element];
 if(r===undefined)throw new Error(`No SASA radius for element ${element}`);
 return r;
};

/**
 * Shrake–Rupley (1973) numerical solvent-accessible surface area per atom, Å².
 * Each atom sphere is expanded by the probe radius; a test point counts as accessible when it lies
 * outside every other expanded sphere. Area = 4π(r+probe)² × accessible fraction.
 */
export function shrakeRupley(atoms:SasaAtom[],{probe=PROBE_RADIUS,points=SASA_POINTS}:{probe?:number;points?:number}={}):number[]{
 const sphere=spherePoints(points),radii=atoms.map(a=>radiusOf(a.element)+probe);
 const cell=Math.max(...radii,0)*2,grid=new Map<string,number[]>(),key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
 const cellOf=(p:Vec)=>p.map(v=>Math.floor(v/cell)) as Vec;
 atoms.forEach((a,i)=>{const k=key(...cellOf(a.position));const list=grid.get(k);if(list)list.push(i);else grid.set(k,[i]);});
 return atoms.map((atom,i)=>{
  const [cx,cy,cz]=cellOf(atom.position),ri=radii[i],neighbors:number[]=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of grid.get(key(cx+dx,cy+dy,cz+dz))??[]){
   if(j===i)continue;
   const p=atoms[j].position,d2=(p[0]-atom.position[0])**2+(p[1]-atom.position[1])**2+(p[2]-atom.position[2])**2;
   if(d2<(ri+radii[j])**2)neighbors.push(j);
  }
  neighbors.sort((a,b)=>a-b);
  let accessible=0,last=0;
  for(const s of sphere){
   const x=atom.position[0]+s[0]*ri,y=atom.position[1]+s[1]*ri,z=atom.position[2]+s[2]*ri;
   const occluded=(j:number)=>{const p=atoms[j].position;return (p[0]-x)**2+(p[1]-y)**2+(p[2]-z)**2<radii[j]**2;};
   // Try the last occluding neighbor first; this only changes speed, never the result.
   if(neighbors.length&&occluded(neighbors[last]))continue;
   let buried=false;
   for(let n=0;n<neighbors.length;n++){if(occluded(neighbors[n])){buried=true;last=n;break;}}
   if(!buried)accessible++;
  }
  return 4*Math.PI*ri*ri*accessible/points;
 });
}

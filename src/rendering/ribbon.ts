import * as T from 'three';
import type {PdbAtom,PdbResidue} from '../protein/pdb';

const SAMPLES=8;

/**
 * Cartoon tube through actual Cα coordinates of one continuous residue list; width follows deposited HELIX/SHEET
 * records. Shared by the single-chain ProteinScene (whole chain) and the assembly scene (one call per chain,
 * so separate polypeptide chains are never joined). `vertexResidue` holds each vertex's residue `index`.
 */
export function ribbonGeometry(residues:PdbResidue[],atoms:PdbAtom[],positions:T.Vector3[],colorOf:(residue:PdbResidue)=>number){
 const n=residues.length;
 const ca=residues.map(r=>positions[r.atoms.find(i=>atoms[i].name==='CA')!]);
 const guide=residues.map((r,i)=>{const c=r.atoms.find(j=>atoms[j].name==='C'),o=r.atoms.find(j=>atoms[j].name==='O');return c!==undefined&&o!==undefined?positions[o].clone().sub(positions[c]):ca[Math.min(i+1,n-1)].clone().sub(ca[Math.max(i-1,0)]).cross(new T.Vector3(0,0,1));});
 const curve=new T.CatmullRomCurve3(ca,false,'centripetal');
 const size=(i:number,frac:number)=>{
  const ss=residues[i].secondary,nextSame=i+1<n&&residues[i+1].secondary==='strand';
  if(ss==='strand'&&!nextSame)return [2.4*(1-frac)+0.25,0.34];
  if(ss==='strand')return [1.6,0.34];
  if(ss==='helix')return [1.5,0.32];
  if(ss==='helix310')return [1.1,0.3];
  return [0.5,0.5];
 };
 const rings=(n-1)*SAMPLES+1,segments=12,pos:number[]=[],nor:number[]=[],col:number[]=[],index:number[]=[],vertexResidue:number[]=[];
 let previous:T.Vector3|null=null;
 const flipped=guide.map(()=>1);
 for(let i=1;i<n;i++)if(guide[i].dot(guide[i-1])*flipped[i-1]<0)flipped[i]=-1;
 for(let s=0;s<rings;s++){
  const t=s/(rings-1),p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),u=t*(n-1),i=Math.min(Math.floor(u),n-1),frac=u-i,j=Math.min(i+1,n-1);
  const g=guide[i].clone().multiplyScalar(flipped[i]).lerp(guide[j].clone().multiplyScalar(flipped[j]),frac);
  let normal=g.sub(tangent.clone().multiplyScalar(g.dot(tangent)));
  if(normal.lengthSq()<1e-6)normal=previous?.clone()??new T.Vector3(0,0,1).cross(tangent);
  normal.normalize();if(previous&&normal.dot(previous)<0)normal.negate();previous=normal.clone();
  const binormal=tangent.clone().cross(normal).normalize(),ri=Math.round(u),[w0,h0]=size(i,frac),[w1,h1]=size(j,0);
  const arrow=residues[i].secondary==='strand'&&residues[j].secondary!=='strand',blend=arrow||residues[i].secondary===residues[j].secondary||frac<0.5?0:(frac-0.5)*2;
  const w=(w0+(w1-w0)*blend)/2,h=(h0+(h1-h0)*blend)/2;
  const color=new T.Color(colorOf(residues[ri]));
  for(let k=0;k<segments;k++){
   const a=k/segments*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
   pos.push(...p.clone().addScaledVector(normal,c*w).addScaledVector(binormal,sn*h).toArray());
   nor.push(...normal.clone().multiplyScalar(c/w).addScaledVector(binormal,sn/h).normalize().toArray());
   col.push(color.r,color.g,color.b);vertexResidue.push(residues[ri].index);
  }
  if(s>0)for(let k=0;k<segments;k++){const a=(s-1)*segments+k,b=(s-1)*segments+(k+1)%segments,c2=a+segments,d=b+segments;index.push(a,c2,b,b,c2,d);}
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(nor,3));geometry.setAttribute('color',new T.Float32BufferAttribute(col,3));geometry.setIndex(index);
 return {geometry,vertexResidue};
}

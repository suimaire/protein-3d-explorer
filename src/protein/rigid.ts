import type {Vec} from '../geometry/vector';

export type Mat3=[Vec,Vec,Vec];
/** p' = rotation · p + translation (rows of `rotation` are applied as dot products). */
export type RigidTransform={rotation:Mat3;translation:Vec};

export const applyRigid=({rotation:R,translation:t}:RigidTransform,p:Vec):Vec=>[
 R[0][0]*p[0]+R[0][1]*p[1]+R[0][2]*p[2]+t[0],
 R[1][0]*p[0]+R[1][1]*p[1]+R[1][2]*p[2]+t[1],
 R[2][0]*p[0]+R[2][1]*p[1]+R[2][2]*p[2]+t[2],
];

export const determinant=(R:Mat3)=>R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])-R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])+R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);

/** Symmetric-matrix eigen decomposition by cyclic Jacobi rotations (small, dependency-free). */
function jacobi(input:number[][]){
 const A=input.map(r=>[...r]),n=A.length,V=A.map((r,i)=>r.map((_,j):number=>i===j?1:0));
 for(let sweep=0;sweep<60;sweep++)for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){
  if(Math.abs(A[p][q])<1e-14)continue;
  const theta=(A[q][q]-A[p][p])/(2*A[p][q]),t=(theta>=0?1:-1)/(Math.abs(theta)+Math.sqrt(theta*theta+1)),c=1/Math.sqrt(t*t+1),s=t*c;
  for(let k=0;k<n;k++){const kp=A[k][p],kq=A[k][q];A[k][p]=c*kp-s*kq;A[k][q]=s*kp+c*kq;}
  for(let k=0;k<n;k++){const pk=A[p][k],qk=A[q][k];A[p][k]=c*pk-s*qk;A[q][k]=s*pk+c*qk;}
  for(let k=0;k<n;k++){const kp=V[k][p],kq=V[k][q];V[k][p]=c*kp-s*kq;V[k][q]=s*kp+c*kq;}
 }
 return {values:A.map((r,i)=>r[i]),vectors:V};
}

/**
 * Least-squares proper rotation + translation mapping `from` onto `to` (Horn 1987 unit quaternion).
 * Used only to recover and verify the rigid-body orientation that OPM applied to the deposited file.
 */
export function fitRigid(from:Vec[],to:Vec[]):RigidTransform&{rmsd:number;maxDeviation:number}{
 if(from.length!==to.length||from.length<3)throw new Error('fitRigid needs ≥3 paired points');
 const mean=(ps:Vec[])=>ps.reduce<Vec>((s,p)=>[s[0]+p[0]/ps.length,s[1]+p[1]/ps.length,s[2]+p[2]/ps.length],[0,0,0]);
 const a=mean(from),b=mean(to),S=[[0,0,0],[0,0,0],[0,0,0]];
 from.forEach((p,k)=>{for(let i=0;i<3;i++)for(let j=0;j<3;j++)S[i][j]+=(p[i]-a[i])*(to[k][j]-b[j]);});
 const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=S;
 const N=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
 const {values,vectors}=jacobi(N),k=values.indexOf(Math.max(...values)),[w,x,y,z]=vectors.map(r=>r[k]);
 const rotation:Mat3=[[w*w+x*x-y*y-z*z,2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),w*w-x*x+y*y-z*z,2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),w*w-x*x-y*y+z*z]];
 const rotated=applyRigid({rotation,translation:[0,0,0]},a),translation:Vec=[b[0]-rotated[0],b[1]-rotated[1],b[2]-rotated[2]];
 let sq=0,maxDeviation=0;
 from.forEach((p,i)=>{const q=applyRigid({rotation,translation},p),d=Math.hypot(q[0]-to[i][0],q[1]-to[i][1],q[2]-to[i][2]);sq+=d*d;maxDeviation=Math.max(maxDeviation,d);});
 return {rotation,translation,rmsd:Math.sqrt(sq/from.length),maxDeviation};
}

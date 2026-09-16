import type {Vec} from '../geometry/vector';
import {inverseMat3,type Mat3,type RigidTransform} from './rigid';

/**
 * Crystal frame of a deposited structure: the CRYST1 cell and the SCALEn records, which define the deposited
 * orthogonal → fractional transform. No structure-specific knowledge; any PDB file with CRYST1 + SCALE works.
 */
export type CrystalFrame={
 /** CRYST1 cell edges (Å) and angles (degrees), exactly as deposited. */
 cell:{a:number;b:number;c:number;alpha:number;beta:number;gamma:number};
 /** CRYST1 space-group name (Hermann–Mauguin) and Z. */ spaceGroup:string;z:number;
 /** SCALEn: fractional = rotation · xyz + translation. */ scale:{rotation:Mat3;translation:Vec};
 /** Unit-cell vectors a, b, c in orthogonal Å — the columns of the inverted SCALE matrix. */ lattice:[Vec,Vec,Vec];
};

const column=(line:string,start:number,end:number)=>line.slice(start-1,end).trim();

/** CRYST1 + SCALE1/2/3 of a PDB file. Throws when either record is missing, so a lattice is never guessed. */
export function parseCrystalFrame(text:string):CrystalFrame{
 const lines=text.split(/\r?\n/);
 const cryst=lines.find(l=>l.startsWith('CRYST1'));
 if(!cryst)throw new Error('Crystal frame: no CRYST1 record');
 const rows=lines.filter(l=>/^SCALE[123]/.test(l)).sort((a,b)=>a[5].localeCompare(b[5]));
 if(rows.length!==3)throw new Error(`Crystal frame: expected 3 SCALE records, found ${rows.length}`);
 const rotation=rows.map(l=>[Number(column(l,11,20)),Number(column(l,21,30)),Number(column(l,31,40))] as Vec) as Mat3;
 const translation=rows.map(l=>Number(column(l,46,55))) as Vec;
 const inverse=inverseMat3(rotation);
 return {
  cell:{a:Number(column(cryst,7,15)),b:Number(column(cryst,16,24)),c:Number(column(cryst,25,33)),
   alpha:Number(column(cryst,34,40)),beta:Number(column(cryst,41,47)),gamma:Number(column(cryst,48,54))},
  spaceGroup:column(cryst,56,66),z:Number(column(cryst,67,70)),
  scale:{rotation,translation},
  // Column k of the inverted SCALE matrix is the image of the unit fractional step along axis k.
  lattice:[0,1,2].map(k=>[inverse[0][k],inverse[1][k],inverse[2][k]] as Vec) as [Vec,Vec,Vec],
 };
}

/** Fractional coordinates of an orthogonal point, using the deposited SCALE records. */
export const toFractional=({scale:{rotation:R,translation:t}}:CrystalFrame,p:Vec):Vec=>
 [0,1,2].map(i=>R[i][0]*p[0]+R[i][1]*p[1]+R[i][2]*p[2]+t[i]) as Vec;

/**
 * Rigid transform for a whole-unit-cell translation by `cells` = [i, j, k]: p' = p + i·a + j·b + k·c.
 * Lattice translations belong to every space group, so this is an exact crystallographic symmetry operation:
 * the rotation is the identity, so nothing inside the moved copy can be deformed, rotated or rescaled.
 */
export function latticeTransform(frame:CrystalFrame,cells:[number,number,number]):RigidTransform{
 const [a,b,c]=frame.lattice;
 return {rotation:[[1,0,0],[0,1,0],[0,0,1]],
  translation:[0,1,2].map(i=>cells[0]*a[i]+cells[1]*b[i]+cells[2]*c[i]) as Vec};
}

/** Cell edge lengths implied by the SCALE records, for checking them against the CRYST1 values. */
export const latticeLengths=(frame:CrystalFrame)=>frame.lattice.map(v=>Math.hypot(...v)) as [number,number,number];
/** Cell angles implied by the SCALE records (α, β, γ in degrees), same purpose. */
export function latticeAngles(frame:CrystalFrame){
 const [a,b,c]=frame.lattice,angle=(u:Vec,v:Vec)=>Math.acos((u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(Math.hypot(...u)*Math.hypot(...v)))*180/Math.PI;
 return [angle(b,c),angle(a,c),angle(a,b)] as [number,number,number];
}
/** Short label of a lattice translation, e.g. `x, y, z` or `x−a, y, z`. */
export const latticeLabel=(cells:[number,number,number])=>{
 const axis=['a','b','c'],term=(v:number,k:number)=>v===0?'':`${v>0?'+':'−'}${Math.abs(v)===1?'':Math.abs(v)}${axis[k]}`;
 return `x${term(cells[0],0)}, y${term(cells[1],1)}, z${term(cells[2],2)}`;
};

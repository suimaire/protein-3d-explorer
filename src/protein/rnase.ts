import {parsePdbHeader} from './pdb';
import {parseCoherentPdb,requireResidue} from './coherentPdb';
import {inferBonds,analyzeExposure} from './exposure';
import {sequencePositions} from './sequenceSpace';
import {distance,type Vec} from '../geometry/vector';
export const RNASE_NATIVE_PAIRS=[[26,84],[40,95],[58,110],[65,72]] as const;
export const RNASE_SCRAMBLED_PAIRS=[[26,40],[58,65],[72,84],[95,110]] as const;
export function analyzeRnase(text:string){
 const {structure,...alt}=parseCoherentPdb(text),header=parsePdbHeader(text);
 if(structure.id!=='7RSA'||header.method!=='X-RAY DIFFRACTION'||header.resolution!==1.26||!text.includes('BOS TAURUS'))throw new Error('Unexpected RNase source');
 const positions=sequencePositions(structure,header.seqres);
 if(structure.residues.length!==124||header.missingResidues||header.missingAtoms)throw new Error('Incomplete RNase chain');
 const disulfides=RNASE_NATIVE_PAIRS.map(([a,b])=>{
  const ra=requireResidue(structure,'A',a,'CYS'),rb=requireResidue(structure,'A',b,'CYS');
  const atom=(r:typeof ra)=>{const hits=r.atoms.filter(i=>structure.atoms[i].name==='SG');if(hits.length!==1)throw new Error('Missing or duplicate SG');return hits[0];};
  const atomA=atom(ra),atomB=atom(rb),d=distance(structure.atoms[atomA].position,structure.atoms[atomB].position);
  if(d<1.8||d>2.3)throw new Error('Unexpected native S–S geometry');
  return {a:ra.index,b:rb.index,atomA,atomB,distance:d,label:`Cys${a}–Cys${b}`};
 });
 return {structure,header,positions,disulfides,bonds:inferBonds(structure),exposure:analyzeExposure(structure).residues,
  cysteines:new Set(disulfides.flatMap(p=>[p.a,p.b])),...alt,
  // Current 2024-05-22 entry contains neither SSBOND nor struct_conn disulf records.
  depositedDisulfideRecords:text.split(/\r?\n/).filter(l=>l.startsWith('SSBOND'))};
}
export type RnaseModel=ReturnType<typeof analyzeRnase>;
export type RnaseCondition='native'|'reduced'|'refolded'|'scrambled'|'exchanged';
export const RNASE_CONDITIONS:Record<RnaseCondition,{label:string;evidence:string;disulfides:string;shape:string;description:string;schematic:boolean}>={
 native:{label:'천연 상태',evidence:'실험 구조 · PDB 7RSA',disulfides:'천연 연결 4쌍',shape:'천연 접힘',description:'소 RNase A의 실험 좌표에서 출발합니다.',schematic:false},
 reduced:{label:'변성제 + 환원제 처리',evidence:'교육용 모식도 / SCHEMATIC',disulfides:'S–S 환원 · Cys의 SH 상태',shape:'다양한 펼쳐진 형태 중 하나를 상징',description:'요소(urea)는 비공유 상호작용과 접힘의 안정성을 바꾸고, β-mercaptoethanol은 이황화 결합을 환원합니다. 두 역할은 다릅니다. 펩타이드 사슬 절단은 모델링하지 않습니다.',schematic:true},
 refolded:{label:'재접힘 조건에서 재산화',evidence:'천연 기준 좌표 재사용 · PDB 7RSA',disulfides:'천연 연결 회복을 나타냄',shape:'천연 접힘의 기준 표현',description:'변성제·환원제를 제거하고 재접힘이 가능한 조건에서 산화시키는 경로입니다. 좌표는 처리 후 새로 측정한 구조가 아니라 천연 기준 7RSA를 다시 보여 줍니다.',schematic:false},
 scrambled:{label:'변성 조건에서 먼저 산화',evidence:'교육용 모식도 / SCHEMATIC',disulfides:'비천연 연결의 예시 4쌍',shape:'잘못 연결된 여러 형태 중 하나를 상징',description:'환원제를 제거하되 요소가 있는 변성 조건에서 먼저 산화한 뒤 요소를 제거한 경우입니다. 여러 연결 이성질체가 생길 수 있습니다. 그림의 연결은 임의의 교육용 예시이며 실제 생성물 구조가 아닙니다.',schematic:true},
 exchanged:{label:'이황화 교환 조건 제공',evidence:'천연 기준 좌표 재사용 · PDB 7RSA',disulfides:'교환·재배열 후 천연 연결의 기준',shape:'천연 접힘의 기준 표현',description:'잘못 연결된 RNase에서 요소를 제거하고 소량의 thiol 시약으로 이황화 교환을 허용하면 천연 연결로 재배열될 수 있습니다. 영구적인 복구 불가 상태가 아닙니다. 7RSA는 결과를 설명하는 기준 좌표입니다.',schematic:false},
};
export type RnaseState={exploration:'native'|'conditions';condition:RnaseCondition;showBonds:boolean;selectedBond:number|null;selectedResidue:number|null};
export const RNASE_INITIAL:RnaseState={exploration:'native',condition:'native',showBonds:true,selectedBond:null,selectedResidue:null};
export type RnaseAction={type:'condition';value:RnaseCondition}|{type:'display';value:boolean}|{type:'exploration';value:RnaseState['exploration']}|{type:'select';bond:number|null;residue:number|null}|{type:'reset'};
export function rnaseReducer(s:RnaseState,a:RnaseAction):RnaseState{
 if(a.type==='reset')return {...RNASE_INITIAL};
 if(a.type==='display')return {...s,showBonds:a.value};
 if(a.type==='condition')return {...s,condition:a.value,selectedBond:null,selectedResidue:null};
 if(a.type==='exploration')return {...s,exploration:a.value,condition:'native',selectedBond:null,selectedResidue:null};
 return {...s,selectedBond:a.bond,selectedResidue:a.residue};
}
/** Unitless, residue-level teaching layout, NOT atom coordinates or an unfolding trajectory. */
export function rnaseTopology(model:RnaseModel,condition:'reduced'|'scrambled'){
 const residues=model.structure.residues;
 const points:Vec[]=residues.map((_,i)=>{const t=i/(residues.length-1);return [38*(t-.5),7*Math.sin(t*Math.PI*5),4*Math.sin(t*Math.PI*9+.3)];});
 const peptideEdges=residues.slice(1).map((r,i)=>[residues[i].index,r.index] as [number,number]);
 const crosslinks=condition==='scrambled'?RNASE_SCRAMBLED_PAIRS.map(([a,b])=>[requireResidue(model.structure,'A',a,'CYS').index,requireResidue(model.structure,'A',b,'CYS').index] as [number,number]):[];
 return {points,peptideEdges,crosslinks,residueOrder:residues.map(r=>r.index),unit:'schematic' as const};
}

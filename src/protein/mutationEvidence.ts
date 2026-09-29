import {tem1Site,EXPERIMENTS,type MutationModel,type TEM1_SITES} from './mutationTolerance';
import type {ProteinStructure} from './pdb';

export const CATALYTIC_SITES=['s70','k73','s130','e166','k234'] as const;
// Jacquier 2013, Methods: MIC Measurements. The original paper says 100, not 125.
export const MIC_CONCENTRATIONS=[0,12.5,25,50,100,250,500,1000,2000,4000] as const;
export const RESULT_SOURCES={
 assay:{title:'Jacquier et al. (2013) · Table 2 / Methods',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3740883/',doi:'10.1073/pnas.1215206110'},
 stability:{title:'Zimmerman et al. (2017) · Figures 1–4 / Results',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC5746865/',doi:'10.1021/acscentsci.7b00465'},
 verified:'2026-09-29',
};
export function siteAtom(s:ProteinStructure,key:keyof typeof TEM1_SITES,name:string,mutant=false){
 const residue=tem1Site(s,key,mutant),matches=residue.atoms.filter(i=>s.atoms[i].name===name);
 if(matches.length!==1)throw new Error('Missing or ambiguous TEM-1 atom: '+key+' '+name);
 return matches[0];
}
export const atomDistance=(s:ProteinStructure,a:number,b:number)=>Math.hypot(...s.atoms[a].position.map((v,i)=>v-s.atoms[b].position[i]));
/** Conservative heavy-atom distance screen, NOT a hydrogen-bond assignment (no explicit H/angle). */
export const contactDistanceCompatible=(d:number)=>Number.isFinite(d)&&d>=2.5&&d<=3.5;
export function measureMutationEvidence(model:MutationModel){
 const s=model.aligned,og=siteAtom(s,'m182','OG1',true),n=siteAtom(s,'a185','N',true);
 const localRmsd=Math.sqrt(CATALYTIC_SITES.reduce((sum,key)=>{
  const a=model.wt.atoms[siteAtom(model.wt,key,'CA')].position,b=s.atoms[siteAtom(s,key,'CA',true)].position;
  return sum+a.reduce((v,x,i)=>v+(x-b[i])**2,0);
 },0)/CATALYTIC_SITES.length);
 const distance=atomDistance(s,og,n);
 return {localRmsd,localCount:CATALYTIC_SITES.length,contact:{og,n,distance,compatible:contactDistanceCompatible(distance)},
  alternateDistances:(['e63','e64'] as const).map(key=>({key,distance:atomDistance(s,og,siteAtom(s,key,'O',true))}))};
}
export type MutationEvidence=ReturnType<typeof measureMutationEvidence>;
export const micConceptState=(concentration:number)=>concentration<EXPERIMENTS.WT.mic?'growth':'inhibited';
export const thermalPosition=(temperature:number,tm:number)=>temperature===tm?'midpoint':temperature<tm?'below':'above';

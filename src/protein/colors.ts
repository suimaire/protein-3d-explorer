import {CLASS_INFO,type ChemicalClass} from './chemistry';

export type ColorScheme='default'|'chemistry'|'exposure';
export const ELEMENT_COLORS:Record<string,number>={C:0x596775,N:0x2866c8,O:0xd74238,S:0xd8b21d};
export const RIBBON_DEFAULT=0x7d95a8;
export const DIMMED=0xd3dade;
/** Sequential exposure ramp: more buried (dark indigo) → teal → more exposed (light gold). */
export const EXPOSURE_STOPS=[0x33306f,0x2a8f8a,0xe6c65a] as const;

const mix=(a:number,b:number,t:number)=>{
 const ch=(c:number,s:number)=>(c>>s)&255,v=(s:number)=>Math.round(ch(a,s)+(ch(b,s)-ch(a,s))*t);
 return (v(16)<<16)|(v(8)<<8)|v(0);
};
export function exposureColor(relative:number){
 const t=Math.min(Math.max(relative,0),1);
 return t<0.5?mix(EXPOSURE_STOPS[0],EXPOSURE_STOPS[1],t*2):mix(EXPOSURE_STOPS[1],EXPOSURE_STOPS[2],(t-0.5)*2);
}
export const chemistryColor=(c:ChemicalClass)=>CLASS_INFO[c].color;

export const BACKBONE_NEUTRAL=0xb3bcc2;
/**
 * Color for one atom, or a ribbon segment when atom is null.
 * Chemistry colors the side chain (Gly: its Cα) and keeps backbone atoms neutral, because the class
 * describes the side chain. Exposure colors the whole residue, matching the whole-residue metric.
 */
export function atomColor(scheme:ColorScheme,residue:{resName:string;chemical:ChemicalClass;relative:number},atom:{name:string;element:string}|null){
 if(scheme==='exposure')return exposureColor(residue.relative);
 if(scheme==='chemistry'){
  const sideChain=!atom||!['N','CA','C','O','OXT'].includes(atom.name)||(residue.resName==='GLY'&&atom.name==='CA');
  return sideChain?chemistryColor(residue.chemical):BACKBONE_NEUTRAL;
 }
 return atom?ELEMENT_COLORS[atom.element]??0x888888:RIBBON_DEFAULT;
}
export const hex=(n:number)=>'#'+n.toString(16).padStart(6,'0');

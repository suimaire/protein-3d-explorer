export type ChemicalClass='nonpolar'|'polar'|'acidic'|'basic';

/**
 * Educational four-group side-chain classification (common introductory-textbook grouping):
 * nonpolar includes Gly, Pro and the aromatic Phe/Trp; Tyr and Cys are grouped as polar uncharged;
 * His is grouped with the basic (ionizable) side chains without implying a fixed +1 charge.
 */
export const CHEMICAL_CLASS:Record<string,ChemicalClass>={
 GLY:'nonpolar',ALA:'nonpolar',VAL:'nonpolar',LEU:'nonpolar',ILE:'nonpolar',MET:'nonpolar',PRO:'nonpolar',PHE:'nonpolar',TRP:'nonpolar',
 SER:'polar',THR:'polar',CYS:'polar',ASN:'polar',GLN:'polar',TYR:'polar',
 ASP:'acidic',GLU:'acidic',
 LYS:'basic',ARG:'basic',HIS:'basic',
};

export const CLASS_INFO:Record<ChemicalClass,{label:string;korean:string;symbol:string;color:number;css:string}>={
 nonpolar:{label:'Nonpolar',korean:'비극성',symbol:'■',color:0xc98e1c,css:'#c98e1c'},
 polar:{label:'Polar, uncharged',korean:'극성 · 전하 없음',symbol:'●',color:0x23927f,css:'#23927f'},
 acidic:{label:'Acidic',korean:'산성',symbol:'▲',color:0xc8382b,css:'#c8382b'},
 basic:{label:'Basic',korean:'염기성',symbol:'◆',color:0x2f64c0,css:'#2f64c0'},
};
export const CLASS_ORDER:ChemicalClass[]=['nonpolar','polar','acidic','basic'];

export const RESIDUE_NAMES:Record<string,string>={
 ALA:'Alanine',ARG:'Arginine',ASN:'Asparagine',ASP:'Aspartate',CYS:'Cysteine',GLN:'Glutamine',GLU:'Glutamate',GLY:'Glycine',HIS:'Histidine',ILE:'Isoleucine',
 LEU:'Leucine',LYS:'Lysine',MET:'Methionine',PHE:'Phenylalanine',PRO:'Proline',SER:'Serine',THR:'Threonine',TRP:'Tryptophan',TYR:'Tyrosine',VAL:'Valine',
};

/** Short caveats where the four-group scheme hides chemistry. */
export const CLASS_CAVEATS:Partial<Record<string,string>>={
 GLY:'Side chain이 H 하나뿐이라 4분류로 성질이 잘 설명되지 않습니다.',
 PRO:'고리형 side chain이 backbone N에 연결된 특수 residue입니다.',
 TYR:'방향족 고리는 비극성, OH는 극성 — 중간 성격을 가집니다.',
 CYS:'SH는 약한 극성이며 이황화 결합을 만들 수 있습니다.',
 HIS:'주변 환경에 따라 protonation 상태가 달라질 수 있어 항상 +1은 아닙니다.',
 MET:'S를 포함하지만 대체로 비극성으로 분류합니다.',
};

export const classOf=(resName:string):ChemicalClass=>{
 const c=CHEMICAL_CLASS[resName];
 if(!c)throw new Error(`Unclassified residue ${resName}`);
 return c;
};

/** Tien et al. (2013) theoretical maximum ASA, Å², Gly-X-Gly (Table 1, PLoS ONE 8:e80635). */
export const MAX_ASA_TIEN_2013:Record<string,number>={
 ALA:129,ARG:274,ASN:195,ASP:193,CYS:167,GLN:225,GLU:223,GLY:104,HIS:224,ILE:197,
 LEU:201,LYS:236,MET:224,PHE:240,PRO:159,SER:155,THR:172,TRP:285,TYR:263,VAL:174,
};

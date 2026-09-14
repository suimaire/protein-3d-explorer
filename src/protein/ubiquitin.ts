import pdbText from '../data/structures/1UBQ.pdb?raw';
import {parsePdb} from './pdb';
import {analyzeExposure,inferBonds,type ExposureAnalysis} from './exposure';

/** RCSB entry 1UBQ (Vijay-Kumar, Bugg & Cook 1987), human ubiquitin, X-ray diffraction, chain A. */
export const UBIQUITIN_SOURCE={pdbId:'1UBQ',protein:'Ubiquitin',organism:'Homo sapiens',method:'X-ray diffraction',resolution:1.8,chain:'A',doi:'10.1016/0022-2836(87)90679-6'} as const;

export const ubiquitin=parsePdb(pdbText,'A');
export const ubiquitinBonds=inferBonds(ubiquitin);
let cached:ExposureAnalysis|null=null;
export const ubiquitinExposure=()=>cached??=analyzeExposure(ubiquitin);

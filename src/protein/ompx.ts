import pdbText from '../data/structures/1QJ8.pdb?raw';
import {parsePdb} from './pdb';
import {analyzeExposure,inferBonds,type ExposureAnalysis} from './exposure';
import {classifyMembrane,transformStructure,MEMBRANE_NORMAL,type MembraneSlab,type ResidueMembrane} from './membrane';
import type {RigidTransform} from './rigid';

/** RCSB entry 1QJ8 (Vogt & Schulz 1999), E. coli outer membrane protein X, X-ray diffraction, chain A. */
export const OMPX_SOURCE={pdbId:'1QJ8',protein:'Outer membrane protein X (OmpX)',organism:'Escherichia coli',method:'X-ray diffraction',resolution:1.9,chain:'A',
 doi:'10.1016/S0969-2126(00)80063-5',uniprot:'P36546 (OMPX_ECOLI), mature residues 24–171',mutation:'His100→Asn (engineered, SEQADV)'} as const;

/**
 * OPM (Orientations of Proteins in Membranes; Lomize et al.) entry 1qj8: hydrophobic thickness 23.6 ± 2.8 Å,
 * tilt 12 ± 5°, ΔG_transfer −30.7 kcal/mol, Gram-negative outer membrane. OPM's oriented file places the
 * membrane normal on z with the bilayer centre at z = 0 and dummy boundary atoms at z = ±11.8 Å.
 */
export const OMPX_OPM={entry:'1qj8',thickness:23.6,thicknessError:2.8,tilt:12,tiltError:5,gibbs:-30.7,membrane:'Gram-negative outer membrane',
 file:'https://opm-assets.storage.googleapis.com/pdb/1qj8.pdb'} as const;
export const OMPX_SLAB:MembraneSlab={normal:MEMBRANE_NORMAL,center:0,halfThickness:OMPX_OPM.thickness/2};

/**
 * Deposited 1QJ8 coordinates → OPM membrane frame. Recovered by least-squares rigid fit of the deposited
 * atoms onto OPM's oriented file (1154 atoms; RMSD 0.0022 Å, max 0.0054 Å = coordinate rounding;
 * Lys20 CG–NZ excluded because OPM's file carries a different Lys20 side-chain conformation).
 * Reproduce: `node scripts/membrane-audit.mjs --fit <opm 1qj8.pdb>`; re-verified in tests against an OPM fixture.
 */
export const OMPX_TO_OPM:RigidTransform={
 rotation:[[0.6063554860948249,-0.5313006621388138,-0.5916524578615099],[0.4343629091603333,0.8445243719202414,-0.3132210854627971],[0.6660794904727811,-0.06706855927764392,0.7428592873000516]],
 translation:[2.0525891937945357,-21.27864994792806,-64.03657462676253],
};

/** Deposited coordinates exactly as in the file (kept for provenance and tests). */
export const ompxDeposited=parsePdb(pdbText,'A');
/** Rigid-body oriented copy used for display and every membrane calculation. */
export const ompx=transformStructure(ompxDeposited,OMPX_TO_OPM);
export const ompxBonds=inferBonds(ompx);
let cached:{exposure:ExposureAnalysis;membrane:ResidueMembrane[]}|null=null;
/** SASA with the shared Phase 3A implementation, then membrane classification; computed once on first use. */
export const ompxAnalysis=()=>{
 if(!cached){const exposure=analyzeExposure(ompx);cached={exposure,membrane:classifyMembrane(ompx,exposure.residues,OMPX_SLAB)};}
 return cached;
};

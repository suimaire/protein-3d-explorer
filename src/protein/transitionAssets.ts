import tUrl from '../data/structures/2DN2.pdb?url';
import rUrl from '../data/structures/2DN1.pdb?url';
import {analyzeTransition,type TransitionModel} from './hemoglobinTransition';

// Both deposited files are separate static assets, fetched from the same origin only when first requested.
// Shared by the T ↔ R module and the cooperativity module's structure inspection (one fetch + analysis per page).
let pending:Promise<TransitionModel>|null=null;
const text=(url:string)=>fetch(url).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();});
export const loadTransition=()=>pending??=Promise.all([text(tUrl),text(rUrl)]).then(([t,r])=>analyzeTransition(t,r)).catch(e=>{pending=null;throw e;});

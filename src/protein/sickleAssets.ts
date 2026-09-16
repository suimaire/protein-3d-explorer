import hbsUrl from '../data/structures/2HBS.pdb?url';
import hbaUrl from '../data/structures/2DN2.pdb?url';
import {analyzeSickle,type SickleModel} from './sickle';

// Both deposited files are static assets fetched from the same origin, and only when this module is first opened.
// 2DN2 is the HbA reference already used by Chapter 3; 2HBS is loaded only here.
let pending:Promise<SickleModel>|null=null;
const text=(url:string)=>fetch(url).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();});
export const loadSickle=()=>pending??=Promise.all([text(hbsUrl),text(hbaUrl)]).then(([s,a])=>analyzeSickle(s,a)).catch(e=>{pending=null;throw e;});

import wtUrl from '../data/structures/1BTL.pdb?url';
import mutantUrl from '../data/structures/1JWP.pdb?url';
import {analyzeMutation,type MutationModel} from './mutationTolerance';
let pending:Promise<MutationModel>|null=null;
const text=async(url:string)=>{const response=await fetch(url);if(!response.ok)throw new Error('HTTP '+response.status);return response.text();};
// Same-origin static files, matching the existing transition/sickle asset policy.
export const loadMutation=()=>pending??=Promise.all([text(wtUrl),text(mutantUrl)])
 .then(([wt,mutant])=>analyzeMutation(wt,mutant)).catch(error=>{pending=null;throw error;});

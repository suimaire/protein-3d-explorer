import url from '../data/structures/7RSA.pdb?url';
import {analyzeRnase,type RnaseModel} from './rnase';
let cached:RnaseModel|null=null,inflight:Promise<RnaseModel>|null=null;
export function loadRnase(){
 if(cached)return Promise.resolve(cached);
 return inflight??=fetch(url).then(r=>{if(!r.ok)throw new Error('7RSA를 불러오지 못했습니다.');return r.text();}).then(t=>cached=analyzeRnase(t)).finally(()=>{inflight=null;});
}

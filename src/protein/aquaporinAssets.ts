import url from '../data/structures/1J4N.pdb?url';
import {analyzeAquaporin,type AquaporinModel} from './aquaporin';
let cached:AquaporinModel|null=null,inflight:Promise<AquaporinModel>|null=null;
export function loadAquaporin(){
 if(cached)return Promise.resolve(cached);
 return inflight??=fetch(url).then(r=>{if(!r.ok)throw new Error('AQP1 원본을 불러오지 못했습니다.');return r.text();}).then(t=>cached=analyzeAquaporin(t)).finally(()=>{inflight=null;});
}

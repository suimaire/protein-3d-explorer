import {isA36,isApplied,type MutationState} from '../modules/mutationState';
/** Cached layer selection. Assay sliders never mutate coordinates or allocate Three.js objects. */
export function mutationLayers(state:MutationState,contactCompatible:boolean){
 const e=state.explanation;
 if(isA36(state))return ['wt','ala','ser-wt'];
 if(state.stage==='M182_RESULTS_REVEALED'){
  if(e.mode==='mic')return [];
  if(e.mode==='activity')return e.comparison==='wt'?['wt-context','active-wt','met-context']:e.comparison==='mutant'?['mutant-context','active-mutant','thr-context']:['wt-context','mutant-context','active-wt','active-mutant','thr-context'];
  if(e.mode==='thermal')return e.comparison==='wt'?['wt-context','thermal-wt']:['mutant-context','thermal-mutant',...(e.interaction?['interaction-atoms',...(contactCompatible?['ncap-contact']:[])]:[])];
 }
 return isApplied(state)?['mutant','met-ghost','thr','ser-mutant',...(state.overlay?['wt-overlay']:[])]:['wt','met','ser-wt'];
}

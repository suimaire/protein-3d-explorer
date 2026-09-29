import {MIC_CONCENTRATIONS} from '../protein/mutationEvidence';

export type MutationStage='M182_WT'|'M182_MUTANT_APPLIED'|'M182_RESULTS_REVEALED'|'A36_CASE'|'A36_RESULTS_REVEALED';
export type Prediction='decrease'|'similar'|'increase'|null;
export type ResultExplanationMode='summary'|'activity'|'mic'|'thermal';
export type ExplanationState=
 |{mode:'summary'}
 |{mode:'activity';comparison:'wt'|'mutant'|'overlay'}
 |{mode:'mic';concentrationIndex:number;answer:'yes'|'no'|null}
 |{mode:'thermal';comparison:'wt'|'mutant';interaction:boolean;temperature:number};
export type MutationState={stage:MutationStage;prediction:Prediction;overlay:boolean;hasFocused:boolean;camera:{view:'whole'|'m182'|'a36'|'active';token:number};
 explanation:ExplanationState;visited:Exclude<ResultExplanationMode,'summary'>[];neutralAnswer:'yes'|'uncertain'|null};
export type MutationAction={type:'predict';value:Prediction}|{type:'apply'|'reset'|'reveal'|'a36'|'restart'|'overlay'}|{type:'focus';view:MutationState['camera']['view']}
 |{type:'explain';mode:ResultExplanationMode}
 |{type:'activity-comparison';value:'wt'|'mutant'|'overlay'}
 |{type:'thermal-comparison';value:'wt'|'mutant'}
 |{type:'interaction'}
 |{type:'concentration';index:number}
 |{type:'temperature';value:number}
 |{type:'mic-answer';value:'yes'|'no'}
 |{type:'neutral-answer';value:'yes'|'uncertain'};
const cleanExplanation={explanation:{mode:'summary'} as ExplanationState,visited:[] as MutationState['visited'],neutralAnswer:null};
export const initialMutationState:MutationState={stage:'M182_WT',prediction:null,overlay:false,hasFocused:false,camera:{view:'whole',token:0},...cleanExplanation};
export const isA36=(s:MutationState)=>s.stage==='A36_CASE'||s.stage==='A36_RESULTS_REVEALED';
export const isApplied=(s:MutationState)=>s.stage==='M182_MUTANT_APPLIED'||s.stage==='M182_RESULTS_REVEALED';
export const resultsRevealed=(s:MutationState)=>s.stage==='M182_RESULTS_REVEALED'||s.stage==='A36_RESULTS_REVEALED';
export const allResultsVisited=(s:MutationState)=>s.stage==='M182_RESULTS_REVEALED'&&(['activity','mic','thermal'] as const).every(m=>s.visited.includes(m));
export function mutationReducer(s:MutationState,a:MutationAction):MutationState{
 const e=s.explanation,canExplain=s.stage==='M182_RESULTS_REVEALED';
 switch(a.type){
  case 'predict':return s.stage==='M182_WT'?{...s,prediction:a.value}:s;
  case 'apply':return s.stage==='M182_WT'?{...s,stage:'M182_MUTANT_APPLIED',hasFocused:true,camera:s.hasFocused?s.camera:{view:'m182',token:s.camera.token+1}}:s;
  case 'reset':return isApplied(s)?{...s,...cleanExplanation,stage:'M182_WT',overlay:false}:s;
  case 'reveal':return s.stage==='M182_MUTANT_APPLIED'?{...s,stage:'M182_RESULTS_REVEALED'}:s.stage==='A36_CASE'?{...s,stage:'A36_RESULTS_REVEALED'}:s;
  case 'a36':return canExplain?{...s,...cleanExplanation,stage:'A36_CASE',overlay:false,camera:{view:'a36',token:s.camera.token+1}}:s;
  case 'restart':return isA36(s)?{...initialMutationState,camera:{view:'whole',token:s.camera.token+1}}:s;
  case 'overlay':return isApplied(s)&&e.mode==='summary'?{...s,overlay:!s.overlay}:s;
  case 'focus':return {...s,camera:{view:a.view,token:s.camera.token+1}};
  case 'explain':{
   if(!canExplain)return s;
   const mode=a.mode;
   if(mode===e.mode)return s;
   const explanation:ExplanationState=mode==='activity'?{mode,comparison:'overlay'}:mode==='mic'?{mode,concentrationIndex:5,answer:null}:mode==='thermal'?{mode,comparison:'mutant',interaction:false,temperature:25}:{mode};
   return {...s,explanation,visited:mode==='summary'||s.visited.includes(mode)?s.visited:[...s.visited,mode],
    camera:{view:mode==='activity'?'active':mode==='thermal'?'m182':mode==='summary'?'whole':s.camera.view,token:s.camera.token+1}};
  }
  case 'activity-comparison':return canExplain&&e.mode==='activity'?{...s,explanation:{...e,comparison:a.value}}:s;
  case 'thermal-comparison':return canExplain&&e.mode==='thermal'?{...s,explanation:{...e,comparison:a.value}}:s;
  case 'interaction':return canExplain&&e.mode==='thermal'?{...s,explanation:{...e,interaction:e.comparison==='wt'?true:!e.interaction,comparison:'mutant'}}:s;
  case 'concentration':return canExplain&&e.mode==='mic'&&Number.isInteger(a.index)&&a.index>=0&&a.index<MIC_CONCENTRATIONS.length?{...s,explanation:{...e,concentrationIndex:a.index}}:s;
  case 'temperature':return canExplain&&e.mode==='thermal'&&Number.isFinite(a.value)&&a.value>=25&&a.value<=70?{...s,explanation:{...e,temperature:a.value}}:s;
  case 'mic-answer':return canExplain&&e.mode==='mic'?{...s,explanation:{...e,answer:a.value}}:s;
  case 'neutral-answer':return allResultsVisited(s)?{...s,neutralAnswer:a.value}:s;
 }
}

import type {TransitionView} from '../rendering/TransitionScene';

export type InspectedEndpoint='T'|'R';

/**
 * Viewer state for inspecting one experimental endpoint from the cooperativity module (reuses the Phase 4B scene).
 * Depends only on which endpoint is chosen: never on pO₂/P50, saturation or T/R population, so the drawn coordinates are
 * always the deposited 2DN2 (T) or the aligned 2DN1 (R) atoms — no interpolation, no motion guide (fraction 0), and the
 * deposited O₂ of 2DN1 is shown unchanged (never removed to match a model saturation).
 */
export function inspectionView(endpoint:InspectedEndpoint):TransitionView{
 return {state:endpoint,fraction:0,highlight:'all',showHeme:true,showLigand:true,showInterface:false,showGuide:false,heme:null};
}

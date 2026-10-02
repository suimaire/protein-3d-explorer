import {Segmented} from './Segmented';
import {SequenceStrip} from './SequenceStrip';
import {ubiquitin,ubiquitinSequence} from '../protein/ubiquitin';
import {atomIdentifier,measureResidues,residueLabel,sequencePositions,sequenceSpaceExamples,type PairSelection} from '../protein/sequenceSpace';

export const coreSequencePositions=sequencePositions(ubiquitin,ubiquitinSequence);
export const coreExamples=sequenceSpaceExamples(ubiquitin,coreSequencePositions);
export function SequenceSpaceExplorer({pair,target,onTarget,onPick,onPair,onFocus}:{pair:PairSelection;target:'a'|'b';onTarget:(t:'a'|'b')=>void;onPick:(i:number)=>void;onPair:(p:PairSelection)=>void;onFocus:()=>void}){
 const measured=pair.a!==null&&pair.b!==null?measureResidues(ubiquitin,pair.a,pair.b,coreSequencePositions):null;
 const marks=new Map<number,string>();if(pair.a!==null)marks.set(pair.a,'A');if(pair.b!==null)marks.set(pair.b,'B');
 return <div className="sequence-exploration">
 <p>서열에서는 떨어져 있는 잔기들이 접힌 구조에서는 가까울 수 있을까?</p>
 <Segmented label="서열·3D 클릭으로 고를 잔기" value={target} onChange={onTarget} options={[['a','A · 기존 선택'],['b','B · 비교 상대']]}/>
 <SequenceStrip residues={ubiquitin.residues} positions={coreSequencePositions} marks={marks} onPick={onPick}/>
 <div className="pair-selectors">{(['a','b'] as const).map((key,i)=><label key={key}>{i?'B · 비교 상대':'A · 기존 선택'}<select aria-label={i?'B 비교 잔기':'A 비교 잔기'} value={pair[key]??''} onChange={e=>{const value=e.target.value===''?null:Number(e.target.value),other=key==='a'?'b':'a';onPair({...pair,[key]:value,[other]:pair[other]===value?null:pair[other]});}}>
 <option value="">선택 안 함</option>{ubiquitin.residues.map(r=><option key={r.index} value={r.index}>{residueLabel(r)}</option>)}</select></label>)}</div>
 {measured?<div className="pair-measurement" data-testid="pair-measurement" aria-live="polite">
 <dl><dt>서열 위치 차이</dt><dd data-testid="sequence-gap"><strong>{measured.sequenceGap}</strong>개 위치 <small>(SEQRES {coreSequencePositions.get(measured.a)!+1} ↔ {coreSequencePositions.get(measured.b)!+1})</small></dd>
 <dt>최소 비수소 원자 간 거리</dt><dd><strong data-testid="pair-distance">{measured.distance.toFixed(2)} Å</strong></dd>
 <dt>측정에 사용한 원자</dt><dd data-testid="pair-atoms">A · {atomIdentifier(ubiquitin,measured.atomA)}<br/>B · {atomIdentifier(ubiquitin,measured.atomB)}</dd></dl>
 <button onClick={onFocus}>두 잔기 함께 보기</button>
 </div>:<p className="small">A를 선택한 뒤 B를 골라 비교하세요. 원래 잔기 정보 패널은 A를 보여 줍니다.</p>}
 <div className="pair-examples"><strong>서열에서는 멀지만 공간에서는 가까운 예시</strong>{coreExamples.map((p,i)=><button key={i} onClick={()=>onPair({a:p.a,b:p.b})}>예시 {i+1} · {residueLabel(ubiquitin.residues[p.a])} ↔ {residueLabel(ubiquitin.residues[p.b])}</button>)}</div>
 <p className="small">예시 기준: 같은 사슬 · 서열 위치 차이 ≥ 10 · 최소 비수소 원자 거리 ≤ 4.5 Å. 특정 화학 결합의 판정 기준이 아닙니다. 서열 위치는 SEQRES와 좌표 잔기를 대조한 순서이며 PDB 잔기 번호의 뺄셈이 아닙니다. 이 1UBQ 사슬은 결손 잔기·삽입 코드가 없습니다.</p>
 <p className="note">점선은 원자 사이 <strong>측정선</strong>입니다. 가까워도 수소결합으로 판정하지 않으며, 비극성 잔기 사이의 공유결합을 뜻하지 않습니다. 자주색 A / 파란색 B의 테두리와 표식은 선택 표시입니다. 단면으로 가려진 원자는 측정선에서도 가려집니다.</p>
 <details className="observe"><summary>관찰 후 확인하기 · 서열에서 이웃하지 않아도 공간에서 이웃할 수 있는가?</summary><p>그렇습니다. 사슬이 접히면 서열상 멀리 떨어진 부분도 같은 공간에 놓일 수 있습니다. 서열 위치 차이와 원자 사이의 공간 거리는 서로 다른 값입니다. 이 기능은 이미 접힌 실험 구조의 분석이며, 접힘 예측이나 펼침 시뮬레이션이 아닙니다.</p></details>
 </div>;
}

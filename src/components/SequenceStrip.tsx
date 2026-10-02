import {useRef,useState} from 'react';
import type {PdbResidue} from '../protein/pdb';
import {residueLabel} from '../protein/sequenceSpace';
const LETTERS:Record<string,string>={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V'};
export function SequenceStrip({residues,positions,marks,onPick,label='아미노산 서열'}:{residues:PdbResidue[];positions:Map<number,number>;marks:Map<number,string>;onPick:(i:number)=>void;label?:string}){
 const host=useRef<HTMLDivElement>(null),[focus,setFocus]=useState(0);
 return <div className="sequence-strip-wrap"><div className="sequence-ends"><b>N 말단 →</b><span>잔기 번호 · 방향키 이동, Enter 선택</span><b>→ C 말단</b></div>
 <div className="sequence-strip" role="group" aria-label={label} ref={host}>{residues.map((r,i)=><button key={r.index} type="button" tabIndex={focus===i?0:-1}
 aria-label={`${residueLabel(r)} · 서열 위치 ${(positions.get(r.index)??i)+1}${marks.has(r.index)?' · '+marks.get(r.index):''}`} aria-pressed={marks.has(r.index)} data-mark={marks.get(r.index)??''} data-residue-index={r.index}
 onFocus={()=>setFocus(i)} onClick={()=>onPick(r.index)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=Math.min(i+1,residues.length-1);else if(e.key==='ArrowLeft')next=Math.max(i-1,0);else if(e.key==='Home')next=0;else if(e.key==='End')next=residues.length-1;else return;e.preventDefault();const el=host.current?.children[next] as HTMLElement;el?.focus({preventScroll:true});el?.scrollIntoView({block:'nearest',inline:'nearest'});}}>
 <small>{marks.get(r.index)??'·'}</small><strong>{LETTERS[r.resName]??'X'}</strong><span>{r.resSeq}{r.insertionCode}</span></button>)}</div></div>;
}

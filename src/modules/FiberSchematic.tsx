/**
 * Schematic of the higher-order HbS fiber, drawn as a diagram and labelled as one everywhere it appears.
 * It is NOT atomic coordinates and NOT derived from the crystal file: the fiber's 14 strands, arranged as seven
 * double strands, come from electron-microscopy 3D reconstructions and X-ray fibre diffraction, a different and
 * lower-resolution kind of evidence than the deposited crystal structure shown in the 3D view above.
 */
export function FiberSchematic({doubleStrands=7}:{doubleStrands?:number}){
 const cx=86,cy=74,r=46,pair=9.5;
 // One double strand per position: the central one plus a ring of the rest.
 const centres=Array.from({length:doubleStrands},(_,k)=>{
  if(k===0)return {x:cx,y:cy,angle:0};
  const a=(k-1)/(doubleStrands-1)*Math.PI*2-Math.PI/2;
  return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,angle:a};
 });
 return <figure className="fiber-schematic" data-testid="fiber-schematic">
  <figcaption><span className="schematic-tag">SCHEMATIC</span> Higher-order fiber organisation — 원자 좌표가 아닙니다</figcaption>
  <div className="schematic-body">
   <svg viewBox="0 0 172 150" role="img" aria-label={`HbS fiber 단면 도식: ${doubleStrands}개의 double strand가 모여 14개 strand를 이룹니다. 원자 모델이 아닌 개념도입니다.`}>
    <defs><marker id="fiber-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
     <path d="M0 0 L8 4 L0 8 z" fill="currentColor"/></marker></defs>
    <circle cx={cx} cy={cy} r={r+16} className="fiber-outline"/>
    {centres.map((c,k)=>{
     const dx=Math.cos(c.angle+Math.PI/2)*pair/2,dy=Math.sin(c.angle+Math.PI/2)*pair/2;
     return <g key={k} className="fiber-pair">
      <line x1={c.x-dx} y1={c.y-dy} x2={c.x+dx} y2={c.y+dy} className="fiber-link"/>
      <circle cx={c.x-dx} cy={c.y-dy} r="5.4" className="fiber-strand a"/>
      <circle cx={c.x+dx} cy={c.y+dy} r="5.4" className="fiber-strand b"/>
     </g>;
    })}
    <g className="fiber-annotation">
     <line x1="150" y1="118" x2="126" y2="96" markerEnd="url(#fiber-arrow)"/>
     <text x="152" y="122">1 double strand</text>
     <text x="8" y="142">{doubleStrands} double strands = {doubleStrands*2} strands (단면 개념도)</text>
    </g>
   </svg>
   <p className="small">3D 화면의 tetramer 배열은 deoxy HbS 결정에서 관측된 좌표입니다. 이 단면 도식은 전자현미경 3차원 재구성과 섬유 회절로 추론된 상위 구조를 개념적으로만 나타냅니다. 두 가지를 하나의 직접 관측된 원자 구조처럼 합치지 않습니다.</p>
  </div>
 </figure>;
}

export const plotPoint=(phi:number,psi:number)=>({x:50+(phi+180)*300/360,y:20+(180-psi)*300/360});
export function RamachandranPlot({phi,psi,onSelect}:{phi:number;psi:number;onSelect:(phi:number,psi:number)=>void}){
  const p=plotPoint(phi,psi);
  return <figure className="rama"><svg viewBox="0 0 385 366" role="img" aria-label={`Ramachandran 개념도, 현재 φ ${phi.toFixed(0)}도, ψ ${psi.toFixed(0)}도`} onClick={e=>{const svg=e.currentTarget,pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const q=pt.matrixTransform(svg.getScreenCTM()!.inverse());if(q.x<50||q.x>350||q.y<20||q.y>320)return;onSelect(Math.round((q.x-50)*360/300-180),Math.round(180-(q.y-20)*360/300));}}>
    <rect x="50" y="20" width="300" height="300" fill="#fff" stroke="#bfcbd2"/>
    {/* Deliberately simple, discrete patches: no empirical density or probability contours. */}
    <rect x="67" y="37" width="87" height="75" rx="18" fill="#e4eef6" stroke="#5983a0" strokeDasharray="4 3"/>
    <text x="110" y="66" textAnchor="middle" className="region">β / extended</text>
    <rect x="115" y="183" width="63" height="63" rx="18" fill="#e0f0e9" stroke="#48836c" strokeDasharray="4 3"/>
    <text x="146" y="219" textAnchor="middle" className="region">αR</text>
    <line x1="200" y1="20" x2="200" y2="320" stroke="#dce2e5" strokeDasharray="3 4"/><line x1="50" y1="170" x2="350" y2="170" stroke="#dce2e5" strokeDasharray="3 4"/>
    {[-180,-90,0,90,180].map(t=><g key={t}><text x={plotPoint(t,0).x} y="340" textAnchor="middle">{t}</text><text x="41" y={plotPoint(0,t).y+5} textAnchor="end">{t}</text></g>)}
    <text x="200" y="363" textAnchor="middle">φ (°)</text><text x="12" y="170" transform="rotate(-90 12 170)" textAnchor="middle">ψ (°)</text>
    <circle data-testid="rama-marker" data-phi={phi} data-psi={psi} cx={p.x} cy={p.y} r="7" fill="#a65d00" stroke="white" strokeWidth="2"/><line x1={p.x-10} x2={p.x+10} y1={p.y} y2={p.y} stroke="#563500"/><line x1={p.x} x2={p.x} y1={p.y-10} y2={p.y+10} stroke="#563500"/>
  </svg><figcaption>일반적인 non-Gly/non-Pro residue의 대표 영역을 단순화한 <strong>개념도</strong>입니다. 실측 확률밀도나 엄밀한 허용 경계가 아닙니다.</figcaption></figure>;
}

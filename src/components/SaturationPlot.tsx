import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {NormalizedModel} from '../protein/cooperativity';

export type CurveMode='both'|'hb'|'reference';
export const PLOT_COLORS={hb:'#a8322d',reference:'#15618f',T:'#7f8a92',R:'#d2602a'} as const;

/** Y vs pO₂/P50 in plain SVG, sized in real pixels so text stays legible from 320 px to desktop. */
export function SaturationPlot({model,u,uMax,mode,showStates}:{model:NormalizedModel;u:number;uMax:number;mode:CurveMode;showStates:boolean}){
 const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(640);
 useLayoutEffect(()=>{const el=host.current!;const set=()=>{if(el.clientWidth)setWidth(Math.max(240,el.clientWidth));};set();const ro=new ResizeObserver(set);ro.observe(el);return()=>ro.disconnect();},[]);
 const samples=useMemo(()=>model.curve(uMax,400),[model,uMax]);
 const narrow=width<420,H=Math.round(Math.min(400,Math.max(260,width*0.62)));
 const m={l:narrow?50:58,r:narrow?12:20,t:14,b:narrow?46:50},pw=width-m.l-m.r,ph=H-m.t-m.b;
 const X=(v:number)=>m.l+v/uMax*pw,Yp=(v:number)=>m.t+(1-v)*ph;
 const path=(key:'Y'|'reference'|'yR'|'yT')=>samples.map((s,i)=>`${i?'L':'M'}${X(s.u).toFixed(2)},${Yp(s[key]).toFixed(2)}`).join('');
 const point=model.at(u),showHb=mode!=='reference',showRef=mode!=='hb';
 const xTicks=Array.from({length:uMax+1},(_,i)=>i),yTicks=[0,0.25,0.5,0.75,1];
 const hbLabel=model.at(2.4),refLabel=model.at(3);
 return <div ref={host} className="saturation-plot">
  <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" data-testid="coop-graph" data-mode={mode} data-states={showStates?'on':'off'}
   aria-label={`O₂ saturation curve. x: pO₂/P50 0–${uMax}. y: fractional saturation. Current pO₂/P50 ${u.toFixed(2)}: hemoglobin MWC model ${(point.Y*100).toFixed(1)}%, one-site reference ${(point.reference*100).toFixed(1)}%.`}>
   <g className="plot-grid">
    {yTicks.map(t=><g key={t}><line x1={m.l} x2={m.l+pw} y1={Yp(t)} y2={Yp(t)}/><text x={m.l-5} y={Yp(t)+4} textAnchor="end" fontSize={narrow?10.5:12}>{Math.round(t*100)}%</text></g>)}
    {xTicks.map(t=><g key={t}><line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t+ph}/><text x={X(t)} y={m.t+ph+16} textAnchor="middle">{t}</text></g>)}
   </g>
   <rect className="plot-frame" x={m.l} y={m.t} width={pw} height={ph}/>
   <text className="axis-label" x={m.l+pw/2} y={H-8} textAnchor="middle">pO₂ / P50 (relative O₂ pressure)</text>
   <text className="axis-label" transform={`translate(${narrow?11:13} ${m.t+ph/2}) rotate(-90)`} textAnchor="middle">Y (fractional O₂ saturation)</text>
   <g className="p50-guide" data-testid="p50-guide"><line x1={m.l} x2={X(1)} y1={Yp(0.5)} y2={Yp(0.5)}/><line x1={X(1)} x2={X(1)} y1={Yp(0.5)} y2={m.t+ph}/>
    <text x={X(1)+5} y={m.t+ph-6}>P50</text></g>
   {showStates&&<g data-testid="state-curves">
    <path d={path('yR')} fill="none" stroke={PLOT_COLORS.R} strokeWidth={1.6} strokeDasharray="1.5 4" strokeLinecap="round"/>
    <path d={path('yT')} fill="none" stroke={PLOT_COLORS.T} strokeWidth={1.6} strokeDasharray="1.5 4" strokeLinecap="round"/>
   </g>}
   {showRef&&<path data-testid="reference-curve" d={path('reference')} fill="none" stroke={PLOT_COLORS.reference} strokeWidth={2.4} strokeDasharray="8 5"/>}
   {showHb&&<path data-testid="hb-curve" d={path('Y')} fill="none" stroke={PLOT_COLORS.hb} strokeWidth={3}/>}
   {!narrow&&showHb&&<text className="curve-label" x={X(2.4)+4} y={Yp(hbLabel.Y)+18} fill={PLOT_COLORS.hb}>Hemoglobin · MWC (sigmoid)</text>}
   {!narrow&&showRef&&<text className="curve-label" x={X(3)} y={Yp(refLabel.reference)+22} fill={PLOT_COLORS.reference} textAnchor="middle">One-site reference (hyperbola)</text>}
   <line className="u-line" x1={X(u)} x2={X(u)} y1={m.t} y2={m.t+ph}/>
   {showRef&&<rect data-testid="reference-marker" x={X(u)-5} y={Yp(point.reference)-5} width={10} height={10} fill="white" stroke={PLOT_COLORS.reference} strokeWidth={2.2} transform={`rotate(45 ${X(u)} ${Yp(point.reference)})`}/>}
   {showHb&&<circle data-testid="coop-marker" data-u={u.toFixed(2)} data-y={point.Y.toFixed(4)} cx={X(u)} cy={Yp(point.Y)} r={6.5} fill={PLOT_COLORS.hb} stroke="white" strokeWidth={2}/>}
  </svg>
 </div>;
}

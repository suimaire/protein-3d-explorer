import {useRef,type MouseEvent,type ReactNode} from 'react';

/** Must match the media query that turns .workbench into the one-screen layout in styles.css. */
const ONE_SCREEN='(min-width:1180px) and (min-height:600px)';

/**
 * Controls, 3D view and readouts in one frame sized to the screen. When a control inside it is used while part of
 * the frame is scrolled off screen, the whole frame is brought into view so the change and the controls are seen
 * together. Dragging in the 3D view never scrolls the page.
 */
export function Workbench({className,children}:{className:string;children:ReactNode}){
 const frame=useRef<HTMLDivElement>(null);
 const reveal=(e:MouseEvent)=>{
  const el=frame.current;
  if(!el||!(e.target as Element).closest('button,input,label')||!matchMedia(ONE_SCREEN).matches)return;
  const r=el.getBoundingClientRect();
  if(r.height>innerHeight||(r.top>=0&&r.bottom<=innerHeight))return;
  el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 return <div ref={frame} className={`workbench ${className}`} onClick={reveal}>{children}</div>;
}

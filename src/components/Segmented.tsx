export function Segmented<V extends string>({label,value,options,onChange}:{label:string;value:V;options:readonly (readonly [V,string])[];onChange:(v:V)=>void}){
 return <fieldset className="segmented"><legend>{label}</legend><div role="group" aria-label={label}>{options.map(([v,text])=><button key={v} aria-pressed={value===v} onClick={()=>onChange(v)}>{text}</button>)}</div></fieldset>;
}

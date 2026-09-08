export const VDW = {H:1.20,C:1.70,N:1.55,O:1.52} as const;
export const COLORS = {H:0xe1e5e8,C:0x596775,N:0x2866c8,O:0xd74238} as const;
export const GEOMETRY = { nCa:1.458, caC:1.525, cN:1.329, cO:1.231, caCb:1.521, nH:1.01, nCaC:111.2, caCN:116.2, cNCa:121.7, caCO:120.8 } as const;
export const PRESETS = [{label:'α-like',phi:-60,psi:-45},{label:'β-like',phi:-135,psi:135},{label:'Extended',phi:-180,psi:180}] as const;
export const INITIAL = {phi:-60,psi:-45};
export const MODULES = [{id:'peptide-geometry',chapter:'Chapter 1 — Amino Acid & Peptide',title:'Peptide Geometry Lab'}] as const;

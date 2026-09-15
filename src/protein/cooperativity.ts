/**
 * Monod–Wyman–Changeux (MWC) concerted two-state model for a protein with n equivalent ligand sites.
 * Pure math: no UI, no structures.
 *
 * Convention (dissociation constants):
 *   x  = p / K_R            ligand activity in units of the R-state microscopic dissociation constant
 *   L0 = [T0] / [R0]        T/R equilibrium constant with no ligand bound
 *   c  = K_R / K_T          0 < c < 1 ⇒ R has the smaller dissociation constant (higher affinity)
 *
 *   Q_R = (1 + x)^n         Q_T = L0 (1 + c x)^n         Q = Q_R + Q_T
 *   P_R = Q_R / Q           P_T = Q_T / Q
 *   Y   = [x (1+x)^(n−1) + L0 c x (1+c x)^(n−1)] / Q = P_R·y_R + P_T·y_T,
 *   with y_R = x/(1+x), y_T = c x/(1+c x) the site saturation within each state.
 *
 * Calculations use the ratio r = Q_T/Q_R = L0·((1+cx)/(1+x))^n, which never overflows for any finite or infinite x.
 */
export type MwcParameters={
 /** Number of equivalent binding sites. */ n:number;
 /** [T0]/[R0], ligand-free T/R equilibrium constant. */ L0:number;
 /** K_R/K_T (ratio of microscopic dissociation constants). */ c:number};

/**
 * Default: the hemoglobin parameter set reported by Monod, Wyman & Changeux (1965, J. Mol. Biol. 12:88–118),
 * L = 9054 and c = 0.014, as quoted in later literature. Used here as a normalized educational example of MWC
 * cooperativity — not a fit to HbA under stated pH, temperature, CO₂ or 2,3-BPG conditions. Not tuned.
 */
export const MWC_DEFAULT:Readonly<MwcParameters>={n:4,L0:9054,c:0.014};

export function checkParameters({n,L0,c}:MwcParameters){
 if(!Number.isInteger(n)||n<1)throw new Error('n must be a positive integer');
 if(!(L0>0&&Number.isFinite(L0)))throw new Error('L0 must be positive and finite');
 if(!(c>0&&Number.isFinite(c)))throw new Error('c must be positive and finite');
}
const checkX=(x:number)=>{if(!(x>=0))throw new Error('Ligand activity x must be ≥ 0');};

/** Unnormalized partition terms, for checking the closed form (overflow possible for huge x; use `mwcState` for curves). */
export function partitionTerms(x:number,p:MwcParameters=MWC_DEFAULT){
 checkParameters(p);checkX(x);
 const QR=(1+x)**p.n,QT=p.L0*(1+p.c*x)**p.n;
 return {QR,QT,Q:QR+QT};
}
/** Closed-form saturation exactly as written in the MWC equation (reference for tests). */
export function saturationClosedForm(x:number,p:MwcParameters=MWC_DEFAULT){
 const {Q}=partitionTerms(x,p),{n,L0,c}=p;
 return (x*(1+x)**(n-1)+L0*c*x*(1+c*x)**(n-1))/Q;
}

/** Site saturation of one independent site: s/(1+s), written so s = ∞ gives 1 and 1 − y is never cancelled. */
const siteSat=(s:number)=>s===Infinity?1:s/(1+s);
const siteFree=(s:number)=>s===Infinity?0:1/(1+s);

export type MwcState={x:number;
 /** R-like and T-like population fractions (P_R + P_T = 1). */ PR:number;PT:number;
 /** Site saturation within the R and T state. */ yR:number;yT:number;
 /** Fractional saturation of all sites (ensemble average). */ Y:number};

export function mwcState(x:number,p:MwcParameters=MWC_DEFAULT):MwcState{
 checkParameters(p);checkX(x);
 const {n,L0,c}=p;
 // (1+cx)/(1+x), rewritten for x > 1 so that x = ∞ gives c.
 const q=x>1?(1/x+c)/(1/x+1):(1+c*x)/(1+x),r=L0*q**n;
 const PR=1/(1+r),PT=r/(1+r),yR=siteSat(x),yT=siteSat(c*x);
 return {x,PR,PT,yR,yT,Y:PR*yR+PT*yT};
}
export const saturation=(x:number,p:MwcParameters=MWC_DEFAULT)=>mwcState(x,p).Y;

const binomial=(n:number,k:number)=>{let b=1;for(let i=1;i<=k;i++)b=b*(n-k+i)/i;return b;};
/** Binomial occupancy distribution of n independent sites each occupied with probability s/(1+s). */
export function independentOccupancy(n:number,s:number){
 const y=siteSat(s),f=siteFree(s);
 return Array.from({length:n+1},(_,k)=>binomial(n,k)*y**k*f**(n-k));
}

/**
 * P(k) = [C(n,k) x^k + L0 C(n,k) (c x)^k] / Q, k = 0…n: probability that a tetramer (molecule) carries k ligands.
 * Evaluated as P_R·Binomial(k; n, y_R) + P_T·Binomial(k; n, y_T), which is algebraically identical.
 */
export function occupancyDistribution(x:number,p:MwcParameters=MWC_DEFAULT){
 const s=mwcState(x,p),R=independentOccupancy(p.n,x),T=independentOccupancy(p.n,p.c*x);
 return R.map((v,k)=>s.PR*v+s.PT*T[k]);
}

/**
 * Effective Hill coefficient n_H = d ln(Y/(1−Y)) / d ln p, analytic. Because Y = (1/n) d ln Q / d ln x and
 * d² ln Q / d(ln x)² = Var(k), n_H = Var(k) / (n·Y·(1−Y)). For independent sites Var(k) = nY(1−Y) ⇒ n_H = 1;
 * since Var(k) ≤ n²Y(1−Y) for 0 ≤ k ≤ n, n_H ≤ n. At Y = 0 or 1 exactly the limiting slope 1 is returned.
 */
export function hillCoefficient(x:number,p:MwcParameters=MWC_DEFAULT){
 const s=mwcState(x,p),n=p.n,Y=s.Y,notY=s.PR*siteFree(x)+s.PT*siteFree(p.c*x);
 if(Y<=0||notY<=0)return 1;
 // E[k²] of a binomial(n, y) = n y (1−y) + n² y².
 const m2=(y:number,f:number)=>n*y*f+n*n*y*y;
 const variance=s.PR*m2(s.yR,siteFree(x))+s.PT*m2(s.yT,siteFree(p.c*x))-n*n*Y*Y;
 return Math.max(0,variance)/(n*Y*notY);
}

/** x at which Y = 0.5, by deterministic bisection on ln x (Y is strictly increasing in x). */
export function solveP50(p:MwcParameters=MWC_DEFAULT,tolerance=1e-13){
 checkParameters(p);
 let lo=1e-12,hi=1;
 while(saturation(hi,p)<0.5){hi*=2;if(hi>1e300)throw new Error('P50 not bracketed');}
 while(saturation(lo,p)>=0.5)lo/=2;
 for(let i=0;i<400&&Math.log(hi/lo)>tolerance;i++){const mid=Math.sqrt(lo*hi);if(saturation(mid,p)<0.5)lo=mid;else hi=mid;}
 return Math.sqrt(lo*hi);
}

/** One-site noncooperative reference with the same P50: Y = u/(1+u), u = p/P50. */
export const independentSaturation=(u:number)=>{if(!(u>=0))throw new Error('u must be ≥ 0');return siteSat(u);};

export type NormalizedPoint=MwcState&{
 /** pO₂ / P50 of the model. */ u:number;
 /** Tetramer-average bound ligands n·Y (an ensemble mean, not a count in one molecule). */ meanBound:number;
 hill:number;
 /** Same-P50 independent one-site reference. */ reference:number;
 occupancy:number[];referenceOccupancy:number[]};

/** The model expressed in u = p/P50, with P50 solved numerically (never hard-coded). */
export function normalizedModel(p:MwcParameters=MWC_DEFAULT){
 checkParameters(p);
 const x50=solveP50(p);
 const at=(u:number):NormalizedPoint=>{
  if(!(u>=0))throw new Error('u must be ≥ 0');
  const x=u*x50,s=mwcState(x,p);
  return {...s,u,meanBound:p.n*s.Y,hill:hillCoefficient(x,p),reference:independentSaturation(u),
   occupancy:occupancyDistribution(x,p),referenceOccupancy:independentOccupancy(p.n,u)};
 };
 const LcN=p.L0*p.c**p.n;
 return {parameters:p,
  /** Model P50 in units of K_R (x at half saturation) and of K_T. */ x50,p50OverKT:x50*p.c,
  at,
  /** Ligand-free limit (x → 0). */ lowLimit:{PT:p.L0/(1+p.L0),PR:1/(1+p.L0)},
  /** Saturating limit (x → ∞): r → L0·cⁿ. */ highLimit:{PT:LcN/(1+LcN),PR:1/(1+LcN)},
  hillAtP50:hillCoefficient(x50,p),
  /** Evenly spaced samples of Y for plotting, u from 0 to uMax. */
  curve:(uMax:number,samples:number)=>Array.from({length:samples+1},(_,i)=>{const u=uMax*i/samples,s=mwcState(u*x50,p);return {u,Y:s.Y,yR:s.yR,yT:s.yT,reference:independentSaturation(u)};}),
 };
}
export type NormalizedModel=ReturnType<typeof normalizedModel>;

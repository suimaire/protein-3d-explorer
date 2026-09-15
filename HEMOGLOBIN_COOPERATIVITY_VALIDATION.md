# Phase 4C — Hemoglobin Cooperativity & Allostery validation

Validated 2026-09-16. Initial main / HEAD `1b44769`, clean working tree, 0 ahead / 0 behind origin/main. Only
`protein-3d-explorer` modified. All numbers below come from `node scripts/hemoglobin-cooperativity-audit.mjs`
(writes `artifacts/hemoglobin-cooperativity-audit.json`), which runs the same code as the app
(`src/protein/cooperativity.ts`). Unit tests: `tests/hemoglobinCooperativity.test.ts` (23).
Browser QA: `node scripts/hemoglobin-cooperativity-browser-test.mjs` (production preview on port 4173).

# Model

- **Model**: Monod–Wyman–Changeux (MWC, 1965) concerted two-state model, n = 4 equivalent sites (one per heme).
- **Parameter convention** (dissociation constants):
  - x = p / K_R — ligand activity in units of the R-state microscopic dissociation constant
  - L0 = [T0] / [R0] — T/R equilibrium constant with **no ligand bound**
  - c = K_R / K_T — 0 < c < 1 ⇒ R has the smaller dissociation constant (higher affinity). Both states bind.
  - With association constants (e.g. Henry et al. 2021 write Q = (1 + K_R x)⁴ + L(1 + K_T x)⁴) the same c is K_T/K_R.
- **L0 = 9054, c = 0.014**: the hemoglobin parameter set reported by Monod, Wyman & Changeux (1965, J. Mol. Biol.
  12:88–118), as quoted in later literature (e.g. Saroff 2007, BBRC, and course material). The original paper was not
  accessed directly in this session; values were cross-checked against two secondary sources.
- **Status**: *normalized pedagogical model*. This parameter set is used as a normalized educational example of MWC
  cooperativity; it is **not** a fit to HbA under stated pH, temperature, CO₂, Cl⁻ or 2,3-BPG conditions. Condition-
  dependent fits differ (e.g. Henry et al. 2021, Biophys. J. 120:2543: L ≈ 0.75–1.6 × 10⁵, K_T/K_R ≈ 3.5/240 ≈ 0.015
  at 37 °C; Imai 1983 shows L0 and K_T vary with solution conditions). Values were chosen before plotting and **not
  tuned** to make the curve look better.
- **K / normalization**: K_R is never given a physical value. The x-axis is u = p / P50 with P50 solved from the model.

Sensitivity (audit, for documentation only; not in the UI):

| L0 | c | P50 (K_R units) | n_H at P50 |
|---|---|---|---|
| 9054 | 0.014 (default) | 9.8968 | 2.853 |
| 9054 | 0.05 | 10.6458 | 1.758 |
| 100 | 0.014 | 2.8674 | 2.337 |
| 1 × 10⁵ | 0.015 | 19.2742 | 2.491 |

# Equations

```
Q_R = (1 + x)^4
Q_T = L0 (1 + c x)^4
Q   = Q_R + Q_T
P_R = Q_R / Q                 P_T = Q_T / Q
Y   = [x(1+x)^3 + L0 c x (1+cx)^3] / Q
    = P_R · x/(1+x) + P_T · cx/(1+cx)
P(k) = C(4,k) [x^k + L0 (cx)^k] / Q        k = 0…4
n_H = d ln(Y/(1−Y)) / d ln p = Var(k) / (4 Y (1−Y))
```

Independent checks (tests 1, 17, 18):

- Y = (1/n) d ln Q / d ln x, verified by a finite difference of ln Q.
- The closed-form Y, P_R, P_T agree with the stable ratio form to 1e-12.
- P(k) agrees with the written C(4,k) formula; ΣP(k) = 1 and ΣkP(k) = 4Y to 1e-11 over x = 1e-6 … 1e6.
- n_H: since d² ln Q / d(ln x)² = Var(k), n_H = Var(k)/(nY(1−Y)); the analytic value equals a central-difference
  derivative of ln(Y/(1−Y)) to 5 decimals.

Numerical stability: calculations use r = Q_T/Q_R = L0·((1+cx)/(1+x))⁴, with (1/x + c)/(1/x + 1) for x > 1, so no power
of x is formed. Finite for x up to Number.MAX_VALUE and x = ∞ and for L0 up to 1e12, c down to 1e-6 (test 3). Invalid
inputs (x < 0, NaN, L0 ≤ 0, c ≤ 0, non-integer n) throw.

# P50 normalization

- **Method**: deterministic bisection on ln x (400 iterations max, relative tolerance 1e-13), bracket expanded by doubling.
  Y(x) is strictly increasing.
- **Calculated model P50**: x50 = **9.8968 K_R** = **0.1386 K_T** (lies between K_R and K_T, as expected).
- Y(x50) − 0.5 < 1e-12; cross-checked with an independent linear bisection on the written closed form; n = 1 check:
  x50 = (1+L0)/(1+L0·c) exactly; L0 → 0 gives x50 → 1.
- UI x-axis: u = pO₂/P50 = x/x50, range 0–4. u = 1 ⇒ Y = 0.5. No P50 or n_H number is typed in the source (test 8, 15).

# Cooperativity

- **Effective Hill coefficient**: n_H at P50 = **2.85**; maximum 2.856 at u = 1.05; → 1 at u → 0 and u → ∞.
  Always 1 ≤ n_H ≤ 4 over the tested range. Consistent with the n_H ≈ 2.8–3 usually quoted for hemoglobin, but not fitted.
- **Theoretical bound**: for n sites, Var(k) ≤ n²Y(1−Y) ⇒ n_H ≤ n; n_H = n only if every molecule holds 0 or n ligands
  (infinitely strong cooperativity). An extreme set (L0 = 1e16, c = 1e-8) gives n_H = 3.9+ but ≤ 4 (test 15).
- **Independent reference**: Y = u/(1+u) with the same P50; n_H = 1 at all u (numerical derivative); an MWC protein with
  c = 1 is also exactly noncooperative (test 13).
- **Sigmoid validation**: second differences of Y(u) are positive at low u and negative at high u; inflection at
  **u ≈ 0.81** (the reference is concave for all u > 0). Hb is below the reference for u < 1 and above it for u > 1.

| u = pO₂/P50 | Y (Hb) | reference | 4Y | P_T | P_R | y_T (site, in T) | y_R (site, in R) | n_H |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0.99989 | 0.000110 | 0 | 0 | (1) |
| 0.3 | 0.0560 | 0.2308 | 0.22 | 0.9772 | 0.0228 | 0.0399 | 0.7481 | 1.63 |
| 0.5 | 0.1382 | 0.3333 | 0.55 | 0.9043 | 0.0957 | 0.0648 | 0.8319 | 2.28 |
| 1 | 0.5000 | 0.5000 | 2.00 | 0.5190 | 0.4810 | 0.1217 | 0.9082 | 2.85 |
| 3 | 0.9409 | 0.7500 | 3.76 | 0.0394 | 0.9606 | 0.2936 | 0.9674 | 1.93 |

Limits (tests 4, 5): x → 0: P_T = L0/(1+L0) = 0.99989, P_R = 1/(1+L0) = 1.10 × 10⁻⁴.
x → ∞: Y → 1 and P_R → 1/(1+L0·c⁴) = 0.99965 (not exactly 1: L0·c⁴ = 3.5 × 10⁻⁴).

# Occupancy distribution

Implemented (collapsed panel). P(k), k = 0…4, beside the binomial distribution of four independent sites at the
reference saturation:

| u | P(0) | P(1) | P(2) | P(3) | P(4) | ΣP | ΣkP = 4Y |
|---|---|---|---|---|---|---|---|
| 1 (Hb) | 0.3089 | 0.1725 | 0.0556 | 0.1356 | 0.3274 | 1 | 2.000 |
| 1 (independent) | 0.0625 | 0.25 | 0.375 | 0.25 | 0.0625 | 1 | 2.000 |
| 3 (Hb) | 0.0098 | 0.0164 | 0.0159 | 0.1162 | 0.8417 | 1 | 3.764 |

At P50 the MWC ensemble is bimodal (mostly 0 or 4 bound) — the visual counter to "every tetramer fills 0→1→2→3→4
together". No probability < 0 or > 1 at any tested x, including ∞ (test 19).

# Structural link

- **T-like representative**: PDB **2DN2** (human deoxy HbA, 1.25 Å) — deposited coordinates, no O₂.
- **R-like representative**: PDB **2DN1** (human oxy HbA, 1.25 Å) — α1β1-aligned coordinates from Phase 4B, with its four
  deposited O₂ (never removed or added to match a saturation).
- Reuse: `loadTransition` moved unchanged to `src/protein/transitionAssets.ts` (shared promise; now also clears the cache
  after a failed fetch so a retry is possible) and used by both modules; the 3D panel reuses `TransitionViewer` /
  `TransitionScene` with `inspectionView(endpoint)` = state T or R, fraction 0, no guide. No new hemoglobin renderer.
- **Why endpoints, not interpolation**: P_T and P_R are fractions of an ensemble of molecules, each in one state. A slider
  value of u does not describe one molecule that is "P_R % of the way" to R. The pO₂ slider therefore changes only Y, 4Y,
  P_T/P_R and the occupancy histogram. `inspectionView` takes only the endpoint (test 22); browser QA moves the slider
  with each structure open and confirms identical sample coordinates, ligand count (0 / 4), state, fraction 0.00 and
  the identical rendered image.
- The MWC T/R populations are not claimed to be populations of the 2DN2 / 2DN1 crystal structures.
- Phase 4B unchanged (test 23 and browser regression): reference RMSD 0.93 Å (285 Cα), α2β2 rotation 14.1°, centroid
  shift 3.1 Å, chain RMSD α1 0.61 / β1 0.84 / α2 0.54 / β2 0.84 Å, rigid guide keeps bond lengths.

# Scientific simplifications

- Two-state concerted model with four identical sites; α/β site differences, tertiary (TTS-like) states, intermediate
  quaternary states and sequential/KNF-type coupling are ignored.
- One fixed literature parameter set; no pH, temperature, CO₂, Cl⁻, 2,3-BPG (Bohr effect and heterotropic effectors are
  out of scope for this phase).
- Pressure is shown only relative to the model P50; no mmHg / torr values.
- "Pure T-state / R-state curves" are hypothetical limits (all molecules locked in one state).
- Myoglobin is mentioned only as a biological example of single-site noncooperative binding; the reference curve is not
  a myoglobin curve.

# Known limitations

- The MWC parameter values were verified from secondary citations, not the 1965 paper itself.
- Two fitted MWC parameter sets can describe the same Hb data (Saroff 2007); this module shows one.
- n_H at P50 (2.85) is a property of the chosen parameters, not a measurement.
- 2DN1 is a crystal structure of fully oxygenated HbA; partially liganded structures are not shown.
- Browser QA runs Chromium with SwiftShader WebGL.

# Sources

- Monod J, Wyman J, Changeux J-P (1965) On the nature of allosteric transitions: a plausible model. J. Mol. Biol. 12:88–118.
- Saroff HA (2007) The model of Monod, Wyman, and Changeux generates two sets of parameters when applied to oxygen binding
  in hemoglobin. Biochem. Biophys. Res. Commun. (PMID 17977512).
- Henry ER et al. (2021) MWC allosteric model explains unusual hemoglobin-oxygen binding curves from sickle cell drug
  binding. Biophys. J. 120:2543–2551. doi:10.1016/j.bpj.2021.04.024.
- Imai K (1983) The Monod-Wyman-Changeux allosteric model describes haemoglobin oxygenation with only one adjustable
  parameter. J. Mol. Biol. 167:741–749.
- Park SY et al. (2006) J. Mol. Biol. 360:690–701 (PDB 2DN2, 2DN1).

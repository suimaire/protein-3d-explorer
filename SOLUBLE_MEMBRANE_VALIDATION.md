# Phase 3B — Soluble vs Membrane Protein validation

Validated 2026-09-15. Initial main / HEAD / origin/main: `b8b5975`, clean working tree, 0/0 ahead/behind
(`git ls-remote origin main` = `b8b5975`). Only `protein-3d-explorer` modified.
Reproduce: `node scripts/membrane-audit.mjs` (writes `artifacts/membrane-audit.json`);
`node scripts/membrane-audit.mjs --fit <OPM 1qj8.pdb>` also re-derives the orientation transform.

# Candidate evaluation

Metadata from the RCSB Data API (`core/entry`), the PDB file headers and the OPM API
(`opm-back.cc.lehigh.edu/opm-backend/primary_structures?search=…`), all checked on 2026-09-15.

| Candidate | PDB | Size | Architecture | Orientation source | Educational clarity | Complications |
|---|---|---:|---|---|---|---|
| **OmpX**, *E. coli* | **1QJ8** (X-ray 1.9 Å, R/Rfree 0.204/0.246) | 148 res, all modeled, 1158 heavy atoms | 8-strand β-barrel, monomer (PISA; OPM 1 subunit) | OPM: 23.6 ± 2.8 Å, tilt 12°, boundaries consistent with NMR mapping of detergent-embedded area | Whole mature protein; one clear lipid-facing band, polar loops on one side, short turns + termini on the other; links to the β-sheet side-chain alternation module | 12 residues with altlocs; engineered His100→Asn; detergent C8E4 + tetrachloroplatinate heavy-atom derivative (ignored); outer membrane, not plasma membrane |
| OmpA TM domain, *E. coli* | 1BXW (2.5 Å) / 1QJP (1.65 Å) | 171–172 res | 8-strand β-barrel, monomer | OPM 25.4 Å (verification: Trp depths vs parallax) | Classic β-barrel | Only the TM domain (periplasmic domain absent); 1BXW: 3 engineered mutations, missing His31 side chain, 175 partial-occupancy atoms, lower resolution; 1QJP: 34 unmodeled loop residues |
| GlpG rhomboid, *E. coli* | 2IC8 (2.1 Å) | 182 res (construct 91–272) | 6-TM α-helical, monomer | OPM 28.8 Å, tilt 14° | Representative α-helical TM protein | Cytoplasmic domain removed; 12 nonyl-glucoside detergents; hydrophilic internal cavity and membrane-dipping L1 loop make "TM region" vs "lipid-facing" much harder to read for students |
| Bacteriorhodopsin, *H. salinarum* | 1C3W (1.55 Å) | 222 res per subunit | 7-TM α-helical; OPM uses the trimer | OPM 31.8 Å | Iconic 7-helix protein | Biological trimer: a monomer would expose trimer interfaces as false "lipid-facing" surface, so ~666 residues would be needed; retinal cofactor and bound lipids |

α-helical vs β-barrel trade-off: helical proteins are the more common plasma-membrane architecture, but the
available small, monomeric, fully modeled helical candidates here carry truncated domains, internal cavities or
oligomer interfaces that blur the lipid-facing definition. The β-barrel gives an unambiguous exterior surface
at membrane depth and a separate, buried barrel interior, so "transmembrane ≠ lipid-facing" can be shown
without special cases. Only one structure is implemented in this phase.

Choice was made before computing any composition (no candidate was compared on "how hydrophobic it looks").

# Selected structure

| Item | Value |
|---|---|
| Protein | Outer membrane protein X (OmpX), *Escherichia coli*; UniProt P36546, mature residues 24–171 = 1–148 |
| PDB / method | 1QJ8, X-ray diffraction, 1.90 Å (Vogt & Schulz 1999, *Structure* 7:1301, doi:10.1016/S0969-2126(00)80063-5) |
| Chain / assembly | chain A; asymmetric unit = biological unit (REMARK 350 PISA: monomeric; OPM 1 subunit) — no chain was removed |
| Residues / atoms | 148 consecutive residues, sequence = SEQRES; 1158 heavy atoms; no missing atoms (test) |
| Alternate locations | 45 duplicate atoms in Ser3, Tyr28, Val39, Ile65, Ile79, Val83, Val85, Phe90, Thr92, Val121, Ser130, Val144; the shared parser keeps the highest occupancy (e.g. Tyr28 B 0.65), first on ties. The UI notes the occupancy for these residues. |
| Mutation | His100→Asn (SEQADV, engineered); counted as Asn (polar) and flagged in the UI |
| Omitted HETATM | 72 waters, C8E4 detergent (21 atoms), 2 PtCl₄ heavy-atom sites (4 atoms); not in SASA or display |
| Secondary structure | deposited SHEET records (9-strand listing of the closed 8-strand barrel) |
| File | `src/data/structures/1QJ8.pdb`, unmodified RCSB download, 144 828 bytes, SHA-256 `7158c5ef945d5e4eea27c517c58742da859c76f530de46738b65b893c1912831` (identical to the PDBe `pdb1qj8.ent`) |

# Orientation

- **Source:** OPM (Lomize et al.), entry 1qj8: hydrophobic thickness **23.6 ± 2.8 Å**, tilt 12 ± 5°,
  ΔG_transfer −30.7 kcal/mol, Gram-negative outer membrane. OPM's oriented file
  (`opm-assets.storage.googleapis.com/pdb/1qj8.pdb`) has the membrane normal on z, bilayer centre at z = 0,
  and dummy (DUM) boundary atoms at exactly **z = −11.8 and +11.8 Å** (`REMARK 1/2 of bilayer thickness: 11.8`).
- **Frame used:** normal = (0, 0, 1), centre = 0, half-thickness = 23.6 / 2 = 11.8 Å (`OMPX_SLAB`).
  The 3D slab and the classification read the same object; a test asserts the fixture DUM planes equal ±halfThickness.
- **Transform:** rigid body only. The deposited atoms (altloc A, which OPM kept) were least-squares fitted
  onto OPM's oriented atoms (Horn quaternion, `src/protein/rigid.ts`):

  ```
  R = [[ 0.606355486, -0.531300662, -0.591652458],
       [ 0.434362909,  0.844524372, -0.313221085],
       [ 0.666079490, -0.067068559,  0.742859287]]
  t = [2.052589194, -21.278649948, -64.036574627] Å      p_OPM = R·p_deposited + t
  ```

  det R = 1, orthonormal to 1e−12. 1154 atoms: **RMSD 0.0022 Å, max 0.0054 Å** (3-decimal rounding).
  Membrane normal in the deposited frame = third row of R = (0.666, −0.067, 0.743).
- **Discrepancy found:** OPM's file carries a different Lys20 side-chain conformation (CG–NZ deviate
  2.2–7.4 Å after the fit); these 4 atoms were excluded from the fit. The app uses the deposited Lys20 coordinates.
- **Preservation:** the deposited structure (`ompxDeposited`) is kept; the oriented copy is generated in code
  (`transformStructure`). Tests: 400 inter-atomic distances equal to 1e−9 Å; all 592 backbone atoms of the OPM
  fixture (`tests/fixtures/1qj8-opm-backbone.json`) reproduced within 0.01 Å; independent refit from the fixture
  recovers R and t; synthetic rotation recovered exactly.
- **Display:** the renderer maps (x, y, z) → (x, z, −y) (a proper rotation, drawing only) so the normal is
  screen-up and OrbitControls orbits about it. Side view = horizontal camera; Top view = looking down +z.
- **Sides:** z > +11.8 = "Side A" (long loops, e.g. Ser53 Cα +34.3 Å, Pro96 +35.8 Å); z < −11.8 = "Side B"
  (N- and C-termini, Ala1 Cα −18.0, Phe148 −14.8 Å). The UI keeps the neutral names; the calculation-method
  note explains that the general OMP topology (long loops extracellular, termini/turns periplasmic) would map
  Side A → extracellular, Side B → periplasm.

## Reference / literature consistency

- OPM verification text for 1qj8: hydrophobic boundaries consistent with NMR mapping of the
  detergent-embedded area of OmpX (Fernández et al. 2002).
- Aromatic girdle: the lipid-facing Tyr/Trp side chains cluster at |z| 7.8–11.4 Å (Tyr9 +9.9, Tyr28 −7.8,
  Tyr63 +11.4, Tyr71 −10.1, Trp76 −10.4, Tyr109 +9.2, Tyr127 +10.3, Trp140 +10.0, Tyr146 −9.1),
  i.e. near the boundaries, as generally observed for β-barrel membrane proteins.
- Barrel-crossing residues sit near the centre: Gly81 Cα −0.1… +0.1, Leu26 +0.9, Phe125 +1.5 Å.

# Residue classification

All from `src/protein/membrane.ts`; SASA from the unchanged Phase 3A code (`analyzeExposure`, Shrake–Rupley,
probe 1.4 Å, 960 points, Bondi radii, Tien 2013 maxima).

- **Depth** = signed z of the side-chain heavy-atom centroid (Gly: Cα) in the OPM frame. Cα z is also shown.
- **Zone:** membrane if |depth| ≤ 11.8 Å, else Side A (+) / Side B (−).
- **Surface** = whole-residue relative SASA ≥ **25 %**, applied identically to OmpX and ubiquitin. 25 % is a
  conventional rASA surface cut-off (e.g. Levy 2010, *J. Mol. Biol.* 403:660); not tuned (sensitivity below).
- **Lipid-facing candidate** = membrane zone AND surface. **Aqueous-facing** = outside zone AND surface.
  **Buried** = rSASA < 25 %.
- SASA is of the isolated protein (no detergent, lipid or water). In the UI it is called
  **surface accessibility**, never water exposure. "Lipid-facing" is a geometric candidate; no lipid contact is
  claimed (1QJ8 has no lipids, only detergent, which is ignored).
- Ubiquitin in this module: surface / buried with the same 25 % rule; it has no slab, so lipid-facing = none and
  aqueous-facing = all surface. The Phase 3A module still uses its within-protein 25 % rank groups (unchanged).
- "Show hydrophobic belt" was not added as a separate mode: Lipid-facing + Chemistry already shows the band,
  and a nonpolar-only filter would hide the Tyr girdle and invite "membrane zone = all nonpolar".

# Composition

Observed in these two structures (not tuned; counts include Gly as nonpolar).

| Group | Nonpolar | Polar, uncharged | Acidic | Basic | Total |
|---|---:|---:|---:|---:|---:|
| **OmpX lipid-facing** | **25** (Gly 1) | 7 (all Tyr) | 0 | 0 | 32 |
| **OmpX aqueous-facing** | 11 (Gly 2) | 22 | 10 | 7 | 50 |
| OmpX buried | 29 (Gly 17) | 28 | 4 | 5 | 66 |
| OmpX all residues in membrane zone | 46 (Gly 14) | 22 | 2 | 2 | 72 |
| **Ubiquitin surface (≥25 %)** | 15 (Gly 6) | 13 | 10 | 11 | 49 |
| Ubiquitin buried | 19 | 6 | 1 | 1 | 27 |

- Nonpolar fraction: OmpX lipid-facing 78 %; OmpX aqueous-facing 22 %; ubiquitin surface 31 % (9 % without Gly);
  ubiquitin buried 70 %. Charged: lipid-facing 0 %, aqueous-facing 34 %, ubiquitin surface 43 %.
- **Threshold sensitivity** (lipid-facing / aqueous-facing / ubiquitin surface as np-polar-acid-base):
  15 %: 31-8-0-0 / 13-27-11-9 / 20-16-11-11; 20 %: 30-7-0-0 / 12-24-10-8 / 17-14-10-11;
  25 %: 25-7-0-0 / 11-22-10-7 / 15-13-10-11; 30 %: 20-6-0-0 / 8-18-7-7 / 11-11-10-10.
  No charged residue is lipid-facing at any tested threshold.
- **Depth reference sensitivity:** using Cα z instead of the side-chain centroid gives lipid-facing 25-8-0-0 (33).
- **Frame sensitivity (found during testing):** Shrake–Rupley sample points are fixed in the coordinate frame,
  so SASA of the deposited vs OPM-oriented coordinates differs by sampling noise: total 8583.7 vs 8580.8 Å²,
  max 1.97 Å² / 0.93 percentage points per residue. One residue crosses the 25 % line: Val135 (Side A)
  24.1 % → 25.1 %, i.e. aqueous-facing nonpolar would be 10 instead of 11 in the deposited frame. The module
  uses the oriented frame (the one displayed). A test bounds this noise.

# Manual validation

| Residue | Class | rSASA | Depth (side chain / Cα) | Category | Check |
|---|---|---:|---|---|---|
| Phe125 | nonpolar | 42.2 % | +0.8 / +1.5 Å | lipid-facing | clear membrane-facing nonpolar at bilayer centre |
| Leu26 | nonpolar | 43.9 % | +1.0 / +0.9 Å | lipid-facing | same, strand β2 |
| Val144 | nonpolar | 50.9 % | −2.5 / −2.8 Å | lipid-facing | same; altloc residue (0.75) |
| Asp75 | acidic | 69.0 % | −17.2 / −14.8 Å | aqueous-facing (Side B) | charged, outside slab |
| Arg133 | basic | 66.8 % | +24.2 / +20.9 Å | aqueous-facing (Side A) | charged loop residue |
| Glu119 | acidic | 67.9 % | −18.2 / −15.2 Å | aqueous-facing (Side B) | charged turn |
| Tyr146 | polar (educational class) | 56.4 % | −9.1 / −9.5 Å | lipid-facing | **membrane-region polar exception**; aromatic girdle; UI note on the Tyr ring |
| Tyr28 | polar | 43.0 % | −7.8 / −5.0 Å | lipid-facing | same; altloc B 0.65 used |
| Lys27 | basic | 3.5 % | +0.1 / −1.6 Å | buried, membrane zone | **charged side chain at bilayer depth pointing into the barrel interior** — TM ≠ lipid-facing |
| Asp124 | acidic | 0.3 % | −1.2 / −1.7 Å | buried, membrane zone | same, barrel interior |
| Glu128 | acidic | 2.0 % | +7.9 / +8.3 Å | buried, membrane zone | same |
| Phe90 | nonpolar | 36.1 % | +25.2 / +22.5 Å | aqueous-facing (Side A) | exposed nonpolar outside the slab (loop) |
| Met118, Phe148 | nonpolar | 59.1 %, 63.4 % | −13.2, −12.7 Å | aqueous-facing (Side B) | exposed nonpolar just beyond the boundary (interface) |

Buttons in the collapsed observation panel are chosen by rule (`findMembraneExamples`, full occupancy only):
lipid-facing non-Gly nonpolar nearest the centre (Phe125), most accessible aqueous-facing charged (Asp75),
lipid-facing polar nearest the centre (Tyr146), buried charged in the slab nearest the centre (Lys27).

# Automated and browser verification

- `npm run typecheck`: passed. `npm test`: **198 passed = 172 preserved + 26 new**
  (`tests/solubleMembrane.test.ts`: structure 6, orientation 7, classification 8, comparison 2, UI data 3).
  Regression for Peptide Geometry, α-Helix, β-Sheet and Hydrophobic Core is the unchanged 172 unit tests plus
  their browser suites; ubiquitin SHA-256 and Phase 3A compositions re-asserted.
- `npm run build`: passed. Chunks: `index` 241.90 kB (unchanged size class), `three` **509.84 kB**
  (507.1 → 509.8 kB, Box/Plane geometry and Line for the slab; Vite's advisory >500 kB warning still appears),
  lazy `SolubleMembraneLab` 166.78 kB (includes 1QJ8), shared lazy `ubiquitin` 101.18 kB,
  `HydrophobicCoreLab` 13.88 kB. The membrane chunk is not requested on initial load (browser check).
- `npm run test:browser` (production preview, Chromium SwiftShader WebGL): **113 passed = 24 Peptide + 24 α-Helix
  + 31 β-Sheet + 18 Hydrophobic Core + 16 Soluble vs Membrane**; console errors / uncaught exceptions **0**.
  Existing scripts only had the navigation count 4 → 5 (and the check label / expected nav text) updated.
- Soluble vs Membrane checks: lazy loading; both viewers; shared representation and chemistry control; slab
  on/off with exact image restore and labels; all four highlight sets equal the audit in both viewers; 3D click
  selection with depth; residue panel (accessibility, depth, zone, category, criterion text, altloc/mutation/Tyr
  notes) for six residues; ubiquitin panel without membrane data; no "water exposure" wording; Side/Top/Fit and
  keyboard; composition table = audit; rule-based residue buttons; full reset restores both exact images;
  768/390/320 px stacking, no overflow, controls outside viewers, tap selection; repeated navigation.
- Screenshots reviewed: `phase3b-soluble-vs-membrane.png`, `phase3b-membrane-chemistry.png`,
  `phase3b-lipid-facing.png`, `phase3b-aqueous-facing.png`, `phase3b-top-view.png`, `phase3b-mobile.png`;
  results `phase3b-browser-results.json`.
- Fixed during QA: slab initially sized to the whole protein (loops) looked off-centre → lateral size now frames
  the atoms inside the slab; slab labels overlapped in Top view → hidden when viewing down the normal.

# Scientific simplifications

- Static crystal structures; no dynamics, no MD, no lipid molecules. The slab is a geometric guide.
- The membrane is a flat slab of fixed hydrophobic thickness (OPM model); real bilayers deform locally and have
  a graded polar/non-polar interface.
- Protein-alone SASA; detergent, crystal contacts, LPS/outer-membrane asymmetry are ignored.
- A single side-chain reference point per residue; long side chains spanning a boundary get one zone.
- Fixed 25 % rSASA surface cut-off; four-class educational chemistry (Tyr polar, Gly nonpolar, His basic).
- One structure per environment — observations, not population statistics.

# Known limitations

- No independent membrane-orientation program (PPM) was run locally; orientation is taken from OPM and its
  coordinate file is reproduced exactly.
- Frame-dependent SASA sampling noise (≤2 Å² per residue) can move residues within ~1 % of the cut-off.
- The OmpX outer-membrane context differs from eukaryotic plasma membranes; the teaching point (nonpolar
  exterior at hydrocarbon depth) is general, the specific protein is not representative of all membrane proteins.
- Real iOS/Android devices and Safari/Firefox not tested (Chromium viewport emulation only).

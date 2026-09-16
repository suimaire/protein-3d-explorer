# Phase 4D — HbA → HbS → Polymerization validation

Validated 2026-09-16. Initial main / HEAD / origin/main `cb2f461`, clean working tree, 0 ahead / 0 behind. Only
`protein-3d-explorer` modified. Every number below comes from `node scripts/hbs-polymerization-audit.mjs`
(writes `artifacts/hbs-polymerization-audit.json`), which runs the same code as the app (`src/protein/sickle.ts`).
Unit tests: `tests/hbsPolymerization.test.ts` (38). Browser QA: `node scripts/hbs-polymerization-browser-test.mjs`
(production preview on port 4173, 18 checks). Independent cross-check fixture: `tests/fixtures/2hbs-rcsb-metadata.json`
(RCSB Data API + the RCSB-generated assembly files `2HBS.pdb1` / `2HBS.pdb2`, retrieved 2026-09-16).

# Structures

## HbS

| | |
|---|---|
| PDB | **2HBS** |
| Title | THE HIGH RESOLUTION CRYSTAL STRUCTURE OF DEOXYHEMOGLOBIN S |
| Citation | Harrington, Adachi & Royer Jr (1997) *J. Mol. Biol.* **272**:398–407, DOI 10.1006/jmbi.1997.1253, PMID 9325099 |
| State | **deoxy** — no ligand deposited on any heme Fe; crystallised from deoxygenated HbS in an anaerobic chamber |
| Method / resolution | X-ray diffraction, **2.05 Å** |
| Space group / cell | **P 1 21 1**, a 63.344, b 185.681, c 52.933 Å, β 92.74°, Z = 8 |
| Asymmetric unit | **two complete α2βS2 tetramers** (chains A–H) |
| Assemblies | REMARK 350 biomolecule 1 = chains A, B, C, D; biomolecule 2 = chains E, F, G, H — **both a single identity operator** |
| Chain types | α = A, C, E, G (DBREF UniProt P69905 HBA_HUMAN); βS = B, D, F, H (P68871 HBB_HUMAN) |
| β6 identity | **VAL in all four βS chains**, in SEQRES and in the coordinates |
| Ligands / hetero | 8 × HEM (one per chain, assigned by spatial association), 573 waters (counted, not displayed). **No other hetero group** |
| Missing | REMARK 465 = 0, REMARK 470 = 0 — every deposited residue is modelled (1148 monomers) |
| Alternate locations | 0; all occupancies 1.00 |
| SHA-256 | `b552883a48cd11bf8bc86785cc7ab5e49203e4c0dae922aaf2cc489421cd5c09` (byte-identical to the RCSB download; `.gitattributes` keeps it unmodified) |

Mutation evidence in the file itself, independent of the coordinates:

```
SEQADV 2HBS VAL B    6  UNP  P68871    GLU     6 VARIANT      (and the same for D, F, H)
```

RCSB entity 2 (the β entity, chains B/D/F/H) reports `rcsb_mutation_count` = 1 and `pdbx_mutation` = "E6V VARIANT".
The deposited βS one-letter sequence differs from the HbA β sequence of 2DN2 at **exactly one position**:

```
β6  E → V     (no other difference over all 146 positions; the α sequence is identical to HbA's)
```

**Deoxy / T-like check** (not shown in the UI; measured here): every heme Fe has a His NE2 as its nearest protein
nitrogen at 2.36–2.64 Å and no sixth ligand. Whole-tetramer Cα fits below put both HbS tetramers within 0.61 Å of
deoxy HbA (T) — i.e. this is a T-like deoxy quaternary structure, which is what the module claims.

## HbA reference

PDB **2DN2**, human deoxyhemoglobin A, X-ray 1.25 Å, the *same file already used by Phase 4A/4B/4C*, unchanged
(SHA-256 `cc2fca41…`, asserted in both `tests/hemoglobinTransition.test.ts` and `tests/hbsPolymerization.test.ts`).
It is analysed by the existing `analyzeHemoglobin()` (Phase 4A), so its assembly, DBREF chain types, SEQRES agreement,
hemes and α1/β1/α2/β2 labels are validated by the same code and the same tests as before. β6 = **GLU** in both β chains.
The acceptor-pocket positions exist in both HbA β chains as Ala70 / Phe85 / Leu88 and Thr84 / Asp73.

Numbering: both files use **mature β-globin numbering** (DBREF `seqBegin` = `dbBegin` = 1 for every chain, asserted),
so β6 means the same sequence position in both. The student UI uses β6 only. (In HGVS protein numbering, which counts
the initiator methionine, the same variant is written HBB p.Glu7Val — stated once in `SCIENTIFIC_NOTES.md`, never
mixed into the student UI.)

# Mutation comparison

The β chain compared is the one that donates βVal6 in the pathological contact (chain H, label β2), against the HbA
subunit **carrying the same label** (2DN2 chain D, β2) — matched by educational label, never by chain letter.

| | |
|---|---|
| Alignment | rigid-body least-squares Cα superposition of the HbA β chain onto the HbS βS chain |
| Matched Cα | **146** (all residues; both chains fully modelled) |
| Cα RMSD | **0.548 Å**, max deviation 3.424 Å, rotation determinant **1.000000000000** (proper rotation, no reflection or scaling) |
| Residues differing | **1** — β6 GLU → VAL. Nothing else differs |
| β6 side chain | HbA Glu: CB, CG, CD, OE1, OE2 (5 heavy atoms, class **acidic**) · HbS Val: CB, CG1, CG2 (3 heavy atoms, class **nonpolar**) |
| Local neighbourhood | residues with a heavy atom within 10 Å of the β6 side chain: HbA 14, HbS 17 |

The deposited HbA file is never modified; the aligned copy is computed at runtime and every HbA internal distance is
preserved exactly (asserted in test 14).

**Fold sanity check** — one surface substitution has not refolded the protein. Each chain fitted independently against
its HbA counterpart of the same label, and each deposited tetramer fitted as a whole:

| HbS chain (label) | Molecule | Globin | HbA chain | matched Cα | Cα RMSD |
|---|---|---|---|---|---|
| A (α1) | Molecule 1 | α | A | 141 | 0.265 Å |
| B (β1) | Molecule 1 | β | B | 146 | 0.350 Å |
| C (α2) | Molecule 1 | α | C | 141 | 0.295 Å |
| D (β2) | Molecule 1 | β | D | 146 | 0.642 Å |
| E (α1) | Molecule 2 | α | A | 141 | 0.289 Å |
| F (β1) | Molecule 2 | β | B | 146 | 0.407 Å |
| G (α2) | Molecule 2 | α | C | 141 | 0.283 Å |
| H (β2) | Molecule 2 | β | D | 146 | 0.548 Å |
| **tetramer 1 (A–D)** | Molecule 1 | α2β2 | A–D | 574 | **0.609 Å** |
| **tetramer 2 (E–H)** | Molecule 2 | α2β2 | A–D | 574 | **0.588 Å** |

These are a sanity check only. Two different crystals at different resolutions differ for reasons other than the
mutation, so the residual is **not** presented to students as "the effect of Glu6Val".

# Pathological contact

Found from the coordinates alone: for every βS chain's residue 6, every β chain of a **different molecule instance** is
tested, and a contact is reported only when all three nonpolar pocket residues are within 4.5 Å. Donor and acceptor
chains are discovered, never hard-coded (test 17 asserts the discovered chains are H → B).

| | |
|---|---|
| Donor molecule | **Molecule 2** (biomolecule 2, chains E–H), deposited coordinates, no symmetry applied |
| Donor chain / residue | chain **H** (βS, label β2), **Val6** — key `2HBS\|M2\|H:6:VAL` |
| Acceptor molecule | **Molecule 1** (biomolecule 1, chains A–D), deposited coordinates |
| Acceptor chain | chain **B** (βS, label β1) |
| Relation | biomolecule 2 → biomolecule 1, **same deposited asymmetric unit (x, y, z)** — no crystallographic operation is needed for the primary contact |
| Intermolecular | **true** (checked, not assumed) |

Minimum heavy-atom distances (Å), each verified against an independent exhaustive search in test 20:

| Acceptor residue | Class | Role | Min heavy-atom | Atom pair | Side-chain-only |
|---|---|---|---|---|---|
| **Ala70** | nonpolar | pocket core | **3.829** | Val6 CG2 … Ala70 CB | 3.829 |
| **Phe85** | nonpolar | pocket core | **3.950** | Val6 CG2 … Phe85 CE1 | 3.950 |
| **Leu88** | nonpolar | pocket core | **4.176** | Val6 CG2 … Leu88 CD1 | 4.176 |
| Thr84 | polar | pocket rim | 3.619 | Val6 CG1 … Thr84 O | 4.286 |
| Asp73 | acidic | pocket rim | 3.102 | Val6 CB … Asp73 OD2 | 3.102 |

**Two different kinds of statement.**

- *Structural feature supported by the experimental HbS structure (and the literature):* βVal6 of one tetramer is the
  donor site, and it sits in an acceptor pocket on a β chain of a neighbouring tetramer containing **Ala70 / Phe85 /
  Leu88**. This is the characteristic pathological lateral contact of HbS polymerization. The pocket residues are
  taken from the literature definition (`POCKET_CORE`, `POCKET_PERIPHERY`) and then measured in 2HBS.
- *Operational analysis in this module:* with a **4.5 Å heavy-atom cutoff** (a threshold chosen for this analysis, not
  a physical constant), the acceptor-chain residues detected around the donor Val6 are Asp73 3.10, Thr84 3.62,
  Ala70 3.83, Phe85 3.95 and Leu88 4.18 Å — i.e. the same five residues as the literature-defined pocket and rim
  (audit → `contacts.primary.neighboursWithinCutoff`). A different cutoff could detect a different set. The UI states
  this next to the distance table (`cutoff-note`), listing the detected residues from the computed data.

**Secondary interaction** (literature-supported and present here): donor **βThr4 OG1 … acceptor βAsp73 OD2 = 3.106 Å**,
between the same two molecules. Shown in the contact table as a polar interaction, not as part of the nonpolar core.

**Contact criterion.** Heavy-atom distance ≤ 4.5 Å — geometric proximity only. The UI never says "distance < 4 Å =
hydrophobic bond" and never uses the phrase "hydrophobic bond". It says the three core residues *and* βVal6 are all
nonpolar side chains lying within 4.18 Å of each other, which is why this is described as a **hydrophobic contact**,
and states explicitly that it is not a covalent bond.

**Both βS chains carry the mutation, but only one per tetramer donates here.** In the deposited unit the donors are
chains D and H; chains B and F are acceptors and their own Val6 is not in a pocket within this segment. This is stated
in the UI rather than glossed over.

# Crystal symmetry / assembly

- The **primary contact needs no symmetry operation at all** — both tetramers are deposited chains under the identity
  operator. Verified against the RCSB-generated assembly files: `2HBS.pdb1` contains exactly deposited chains A,B,C,D
  and `2HBS.pdb2` exactly E,F,G,H (identical coordinate records ignoring atom-serial renumbering).
- The **repeat** uses only whole **unit-cell translations along a**, read from the file's own CRYST1 + SCALE records by
  `src/protein/crystal.ts` (a generic utility; no hemoglobin-specific coordinates anywhere in it or in the component).
  Lattice translations belong to every space group, so this is an exact crystallographic symmetry operation.
- Lattice vectors recovered from the deposited SCALE matrix (orthogonal Å):
  a = (63.3433, 0, 0), b = (0, 185.6665, 0), c = (−2.5320, 0, 52.8737). Lengths 63.3433 / 185.6665 / 52.9343 Å and
  angles 90 / 92.7417 / 90° reproduce the CRYST1 cell (63.344 / 185.681 / 52.933 Å, β 92.74°) to within SCALE's
  six-decimal rounding; the SCALE round-trip is exact to < 1e-9 Å (test 25).
- **Every generated copy has the identity rotation** (determinant 1) and a pure translation, so no internal distance
  can change. Test 27 checks that the cell-0 instance reproduces the deposited coordinates exactly and that a
  translated copy preserves both per-atom offsets and internal distances to 9 decimal places.
- Each generated molecule instance is tracked with its source biomolecule, its source chains, its lattice translation
  and its transform (`artifacts/hbs-polymerization-audit.json` → `segment.instances`).

Segment used by the UI: translations (−a, 0, +a) × 2 biomolecules = **6 molecule instances**, 24 chains, 3444 residues,
27312 heavy atoms.

| Junction | Donor | Acceptor | Relation | Closest heavy atom |
|---|---|---|---|---|
| 1 | Molecule 2 +a chain H | Molecule 1 +a chain B | same asymmetric unit | 3.102 Å |
| 2 | Molecule 2 chain H | Molecule 1 chain B | same asymmetric unit | 3.102 Å |
| 3 | Molecule 2 −a chain H | Molecule 1 −a chain B | same asymmetric unit | 3.102 Å |
| 4 | Molecule 1 +a chain D | Molecule 2 chain F | acceptor translated by x−a, y, z | 3.681 Å |
| 5 | Molecule 1 chain D | Molecule 2 −a chain F | acceptor translated by x−a, y, z | 3.681 Å |

All five reproduce the same pocket (Ala70/Phe85/Leu88 within 4.5 Å), and translated copies of one junction measure
identical distances to 9 decimals (test 28), as a pure translation requires.

**Packing.** Closest approach between atoms of *different* molecule instances anywhere in the segment: **2.833 Å**
(a Lys NZ … His O pair — an ordinary polar contact distance). Atom pairs closer than 2.5 Å: **0**. No severe overlap
was introduced by the repeat.

# The contact network — βVal6 is one contact among several

**Scope of these numbers.** They are *visualization-specific measurements*, not a property of the physiological HbS
fiber. They are computed for the **finite 6-tetramer crystal segment** this module builds (deposited unit + translations
−a / +a), using this module's interface criterion (any heavy atom ≤ 4.0 Å, chain pairs between **different molecules**
only). A longer or shorter segment, a different choice of copies (segment edges leave some partners absent) or a
different cutoff would give different counts. There is no claim that a real HbS fiber has exactly 22 interfaces of
which 5 involve βVal6.

What *is* experimentally established — and stated separately in the UI (`network-established`) — is that βVal6 →
the Ala70 / Phe85 / Leu88 hydrophobic pocket is the characteristic pathological lateral contact, and that the fiber is
not stabilised by that contact alone: several other axial and lateral intermolecular interactions are present
(Harrington et al. 1997; Galamba 2024). The counts below (`network-measured` in the UI) only illustrate that point in
the displayed segment.

The counts are computed by the app itself (`network` in `analyzeSickle`, ~80 ms) and shown to students as numbers
explicitly labelled as calculated for this segment and criterion:

| In the displayed 6-tetramer segment, ≤ 4.0 Å criterion | count |
|---|---|
| inter-molecule chain-pair interfaces | **22** |
| **lateral** (between the two biomolecules = the two strands) | **10** |
| **axial** (between copies of one biomolecule along the repeat) | **12** |
| involving βVal6 | **5** (all lateral) |

The five βVal6 junctions are also the largest lateral interfaces (26–27 atom pairs each), consistent with their being
the crucial pathological contact — but in this segment 17 of the 22 detected interfaces do **not** involve the mutation
site at all. The axial
contacts run along each strand between copies of the same biomolecule and are mutation-unrelated, exactly as the
literature describes. Test 30 asserts that axial interfaces never involve the mutation, that all mutation interfaces
are lateral, and that they are a strict subset of the network.

Largest interfaces (audit → `contacts.intermolecularInterfaces`):

| Chain pair | Kind | Atom pairs | βVal6 |
|---|---|---|---|
| M1/D – M2−a/F, M1+a/D – M2/F | lateral | 27 | yes |
| M1/B – M2/H (and its two translated copies) | lateral | 26 | yes |
| M1/B – M2/G (and its two translated copies) | lateral | 19 | no |
| M1+a/C – M1/B, M1−a/B – M1/C | axial | 17 | no |
| M1/C – M2−a/F, M1+a/C – M2/F | lateral | 15 | no |
| M2+a/G – M2/F, M2−a/F – M2/G | axial | 15 | no |
| M1+a/D – M1/B, M1−a/B – M1/D | axial | 11 | no |
| M2+a/H – M2/F, M2−a/F – M2/H | axial | 10 | no |
| M2+a/G – M2/E, M2−a/E – M2/G | axial | 4 | no |
| M1+a/C – M1/A, M1−a/A – M1/C | axial | 3 | no |

# Molecule-instance identity

Two tetramers repeat the same chain IDs and residue numbers, so every residue and atom identifier in this module
carries a molecule instance:

```
structure | instance | deposited chain : resSeq + insertionCode : resName     e.g. 2HBS|M2|H:6:VAL
```

Test 12 asserts all 3444 residue keys in the segment are unique, and that chain H residue 6 appears once per instance
with identical chain letter and number but distinct keys. The UI shows this key in its sources panel.

**No intermolecular bonds.** `inferBonds` only bonds atoms inside one residue or a peptide C–N inside one chain, so a
bond can never cross molecules; the analysis additionally fails loudly if one ever did (`analyzeSickle` raises
"a covalent bond was inferred between two molecule instances"). Test 24 asserts: zero bonds crossing instances, zero
bonds crossing chains, and no bond between the donor Val6 and any pocket residue. Audit `segment.intermolecularBonds`
= 0. Proximity between molecules is drawn only as dashed guides with the measured distance.

# Polymer representation

| Part | What it is | Evidence level |
|---|---|---|
| Steps 1–2 | HbA and HbS β chains, one rigid Cα superposition | deposited coordinates (2DN2, 2HBS) |
| Step 3 | two HbS tetramers and their βVal6 → pocket contact | **deposited coordinates, no symmetry applied** |
| Step 4 (3D) | 2–6 tetramers | deposited coordinates + **exact unit-cell translations** of them |
| Step 4 (figure) | 7 double strands = 14 strands, cross-section | **SCHEMATIC** — a diagram, not coordinates |

The 3D segment reproduces the crystal's double strand: the two biomolecules form two strands running along **a**, with
the βVal6 lateral contacts between them. The UI says this is the arrangement in the crystal and explicitly **not** an
atomic model of a whole intracellular fiber.

The higher-order fiber figure is labelled `SCHEMATIC` in the caption, states "원자 좌표가 아닙니다" in the caption and
again in its body text, and the side panel spells out the difference in evidence: the 3D view is directly observed
crystallographic coordinates; the 14-strand organisation is inferred from electron-microscopy 3D reconstructions and
X-ray fibre diffraction, in which the double strands are *twisted* replicas of the crystal double strand. No full
fiber was fabricated from unsupported coordinates, and the two kinds of evidence are never merged into one picture.

**Not simulated, and stated as such in the UI**: polymerization kinetics, nucleation, diffusion or binding pathway,
molecular dynamics, polymer growth speed, red-blood-cell mechanics. There is no animation of contact formation in this
module — the contact is shown at its measured position only, so no motion of any kind is implied.

# Deoxygenation link

The module says polymerization is strongly favoured in the **deoxy, polymer-compatible conformational state**, and
immediately that HbS mutation does **not** mean polymer always forms, listing HbS concentration, oxygenation degree,
nucleation and the intracellular environment as further factors whose kinetics this module does not compute. The link
to the T ↔ R module is a plain navigation link ("왜 deoxy 상태가 중요한가? → T ↔ R 구조 보기"); no T/R population
slider drives anything here, and no coordinate in this module depends on an oxygenation value.

Negative control checked in the literature but deliberately **not** added as a third structure in the UI: liganded
R-state HbS (e.g. PDB **5E6E**, carbonmonoxy HbS, 1.76 Å) does not make this lateral contact — its donor and acceptor
environments resemble CO-liganded HbA and differ from deoxy HbS, which is consistent with liganded HbS not entering the
polymer. Keeping the UI to HbA + deoxy HbS + the contact was the stated priority.

# Literature verification

- **Primary structure paper**: Harrington, Adachi & Royer Jr (1997) *J. Mol. Biol.* 272:398–407 — the 2HBS entry. Its
  abstract describes a double strand of tetramers stabilised by lateral contacts involving the mutant valine, and notes
  that the lateral contact region contains hydrophobic interactions, hydrophilic interactions and water-mediated
  bridges. The module's measurements agree: a nonpolar core (Ala70/Phe85/Leu88) plus a polar rim (Thr84/Asp73) and the
  Thr4–Asp73 interaction. Water-mediated bridges are **not** modelled here (waters are omitted) — stated as a limitation.
- **Acceptor pocket residues** βAla70, βPhe85, βLeu88 (hydrophobic) with βThr84 and βAsp73 as the peripheral hydrophilic
  residues: independently stated in the HbS-aggregation literature and in the 5E6E R-state paper. The coordinates
  reproduce exactly this set as the only residues within 4.5 Å of βVal6.
- **βLeu88 / βPhe85** are repeatedly identified as the key hydrophobic partners of Val-β6.
- **Axial vs lateral**: the βVal6 contact is the *lateral* contact between the two strands of the double strand; weaker,
  mutation-unrelated **axial** contacts along each strand also contribute to fiber growth. Both are present and counted
  in the segment (10 lateral, 12 axial, only 5 involving βVal6 — see "The contact network" above), and both the UI and
  this document state that βVal6–pocket is one crucial contact within a larger network.
- **Fiber organisation**: 14 strands as 7 double strands, established from EM 3D reconstructions cross-checked against
  X-ray fibre diffraction, with the pairing determined by matching intermolecular distances to the Wishner–Love crystal
  double strand. This is the basis for the schematic, and for labelling it as inferred rather than observed.
- No conflict was found between the literature description and the deposited coordinates. Where the literature is
  richer than what this module shows (water-mediated bridges, further lateral/axial contacts, fiber twist), the module
  says so rather than implying completeness.

# Scientific simplifications

- Four-group side-chain classification reused unchanged from the existing modules (Glu acidic, Val/Ala/Phe/Leu
  nonpolar, Thr polar). No HbS-specific reclassification.
- "Predominantly negatively charged at physiological pH" for Glu, with an explicit caveat in the UI that protonation
  depends on the local environment and that "Glu is always −1" is not claimed.
- Space filling = van der Waals spheres of actual atoms (Bondi radii, Fe display radius 2.0 Å). The renderer computes
  no molecular surface and the UI never calls it one.
- The local surface comparison uses a 10 Å neighbourhood of the β6 side chain; the two structures are seen in one frame
  via a single rigid β-chain superposition.
- Waters (573) and the fiber's water-mediated bridges are not modelled.
- Only the βVal6 → pocket contact is measured and highlighted; other lateral and axial contacts exist in the same
  segment and are acknowledged in words but not enumerated in the UI.

# Known limitations

- Two different crystal forms at different resolutions (2DN2 at 1.25 Å, 2HBS at 2.05 Å) are compared. Residual
  differences after alignment are not attributable to the mutation alone, and the UI says so.
- 2HBS was crystallised at pH 4.0 with citrate/PEG (the protein itself deoxygenated at pH 7.0). Crystal packing under
  those conditions is not identical to the intracellular polymer, which is why the module calls the 3D segment a
  crystal arrangement and keeps the fiber claim schematic.
- The segment is a finite piece of an infinite lattice: donors at the segment's edge lack a partner only because the
  segment ends. Unengaged donors are therefore reported for the deposited unit only.
- The module shows structure, not thermodynamics or kinetics: no nucleation, no concentration dependence, no polymer
  growth, no time axis, and no red-blood-cell or clinical modelling.
- Only one crystal form of deoxy HbS is used; alternative fiber models in the literature (differing in strand pairing
  or twist) are not compared.

# Phase 4A — Hemoglobin Quaternary Structure validation

Validated 2026-09-15. Initial main / HEAD `31e8949`, clean working tree, 2 local commits ahead of origin/main
(`ba52e67`, `31e8949`; preserved, not pushed). Only `protein-3d-explorer` modified.
Reproduce: `node scripts/hemoglobin-audit.mjs` (writes `artifacts/hemoglobin-audit.json`; same parser, chain mapping,
heme association and interface code as the app). Unit tests: `tests/hemoglobinQuaternary.test.ts`.
Browser QA: `node scripts/hemoglobin-browser-test.mjs` (needs the production preview on port 4173).

# Candidate evaluation

Metadata from the RCSB Data API (`core/entry`, `core/assembly`, `core/polymer_entity`) and the downloaded PDB files,
checked 2026-09-15. All four are adult human hemoglobin A in the deoxy (unliganded) state, X-ray, with
the whole α2β2 tetramer in the asymmetric unit.

| PDB | state | resolution | completeness | assembly | issues |
|---|---|---:|---|---|---|
| 2HHB (Fermi, Perutz 1984) | deoxy | 1.74 Å | 574/574 residues, no altlocs | 1 tetramer (author + PISA), identity operator | separate entry with the same 1984 title as 4HHB; 2 × PO₄ ligands; DBREF cites the older accession P01922 |
| 4HHB (1984, same title as 2HHB) | deoxy | 1.74 Å | 574/574, no altlocs | 1 tetramer, identity operator | 2 × PO₄; COMPND says `ENGINEERED: YES` although SOURCE gives no expression system (ambiguous annotation); no deposited structure factors; old refinement |
| 1A3N (1998) | deoxy | 1.80 Å | 572/574 — β Val1 missing in chains B and D (REMARK 465) | 1 tetramer, identity operator | 8 altloc atoms in 4 residues, 52 partial-occupancy atoms |
| **2DN2 (Park et al. 2006)** | deoxy | **1.25 Å** | **574/574, 0 missing atoms (REMARK 465/470 absent)** | 1 tetramer (author + PISA), identity operator | none found: no altlocs, all occupancies 1.00, only HEM + water, no SEQADV/MODRES, source type natural |

# Selected structure

**PDB 2DN2** — human deoxyhemoglobin A, Park, Yokoyama, Shibayama, Shiro & Tame (2006) J. Mol. Biol. 360:690–701,
doi 10.1016/j.jmb.2006.05.036. X-ray diffraction, 1.25 Å, R_work 0.179, pH 6.5, 298 K data collection.

Reasons: highest resolution of the candidates; every residue and atom of all four chains modeled; no alternate
locations or partial occupancies to resolve; the only hetero groups are the four hemes (no phosphate/sulfate/buffer
ligand to explain away); natural protein with no sequence changes; companion oxy (2DN1) and CO (2DN3) structures
from the same study are available for a later same-source comparison.

Bundled file: `src/data/structures/2DN2.pdb`, the unmodified RCSB download (`*.pdb -text` in `.gitattributes`),
SHA-256 `cc2fca4182e61cb85c2b0082c80167eb7d189a84b148faaa6eb810977c64e214` (tested). It is emitted as a separate
static asset and fetched from the same origin only when the module opens — no runtime RCSB request (browser-tested).

# Biological assembly

- `REMARK 350`: exactly one biomolecule, author-determined TETRAMERIC, PISA TETRAMERIC, applied to chains A, B, C, D
  with a single BIOMT operator equal to the identity. `analyzeHemoglobin` refuses any other case.
- RCSB assembly 1 (`tests/fixtures/2dn2-rcsb-metadata.json`): `author_and_software_defined_assembly`, oligomeric count 4,
  operator `1_555` identity, 4 polymer + 4 non-polymer instances, 574 modeled monomers.
- RCSB's generated assembly file `2DN2.pdb1` (SHA-256 `661e7885…abc52`) has 4777 coordinate records whose columns 1–66
  are byte-identical to the deposited file (digest `05672ce9…627e`, tested). The displayed tetramer is therefore the
  biological assembly itself; no chain was copied, generated or moved.

# Chain mapping

α/β type comes from each chain's DBREF UniProt accession (P69905 HBA_HUMAN → α, P68871 HBB_HUMAN → β), checked
against the RCSB entity records (entity 1 "Hemoglobin alpha subunit" chains A, C; entity 2 "Hemoglobin beta subunit"
chains B, D), with identical SEQRES within a type and different sequences between types. Chain letters are never used.
A test relabels chain C's DBREF as β and confirms the analysis fails (α1β3).

Educational labels (separate from PDB chain IDs): α1 = first α chain in the file; β1 = the β chain with the larger
contact with α1 (the α1β1 interface, 34 vs 27 interface residues at 4.0 Å; also larger at 3.5 / 4.5 / 5.0 Å);
α2 and β2 = the remaining chains.

| Educational label | PDB chain | globin type | modeled residues | heme |
|---|---|---|---:|---|
| α1 | A | α-globin (P69905) | 141 of 141 (1–141) | Heme 1 = HEM A 142 |
| β1 | B | β-globin (P68871) | 146 of 146 (1–146) | Heme 2 = HEM B 147 |
| α2 | C | α-globin (P69905) | 141 of 141 (1–141) | Heme 3 = HEM C 142 |
| β2 | D | β-globin (P68871) | 146 of 146 (1–146) | Heme 4 = HEM D 147 |

Sequence length is read from SEQRES / the RCSB entity sequence and modeled residues are counted from coordinates;
neither is hard-coded in the app. Polymer heavy atoms 4384 (1069 / 1123 / 1069 / 1123), no hydrogens.
Deposited HELIX records cover 116 / 131 / 117 / 128 residues; there are no SHEET records — the ribbons show the helical
globin fold as recorded, and the UI makes no absolute "no β-sheet" statement.

# Heme validation

- 4 HEM groups × 43 heavy atoms = 172 atoms; exactly 4 Fe atoms (one per group); no other hetero group; 221 waters.
- Chain association is computed from coordinates: count protein heavy atoms within 4.5 Å of any heme atom, per chain.
  Each heme has contacts with one chain only — A 68, B 54, C 66, D 58 — and 0 with the others (nearest other-chain atom
  5.7–9.0 Å). Tests confirm the result is unchanged when the heme's record chain ID is changed or its records are moved
  to the end of the file.
- Proximal ligand = nearest protein N/O/S to Fe, measured: His87 NE2 (α chains) and His92 NE2 (β chains).

| Subunit | Fe (Å) | Fe–His NE2 measured | LINK record |
|---|---|---:|---:|
| α1 A | 18.409, 18.436, 23.715 | His87 2.196 Å | 2.20 Å |
| β1 B | 19.339, 4.537, 57.319 | His92 2.194 Å | 2.19 Å |
| α2 C | 4.505, 23.402, 54.437 | His87 2.205 Å | 2.21 Å |
| β2 D | −1.659, 4.762, 23.903 | His92 2.162 Å | 2.16 Å |

- Heme bonds are inferred by distance (50 per heme; Fe bonded to NA/NB/NC/ND, 2.10–2.13 Å). Deposited geometry is kept
  as is: several propionate carboxylate C–O and vinyl C=C distances are short (1.01–1.24 Å, e.g. HEM C CGD–O1D 1.01 Å,
  B-factors 17–36 Å²) — a feature of the deposited model, not corrected and not interpreted.
- Heme is never an amino-acid residue: it is in `hetero`, not `residues`; it has no chemistry class (`classOf('HEM')`
  throws); it is drawn in its own crimson/orange colors in every color mode and counted separately from subunits.
- No O₂ is present in this deoxy structure and none is drawn. Fe is labelled only "Fe" (no oxidation state).

# Multi-chain identity

- Residue identity = `chain : resSeq insertionCode : resName` (`residueKey`), used for grouping atoms into residues in
  both parsers. 574 unique keys; resSeq 10 occurs in four chains as four residues.
- Alternate-location slots = chain + resSeq + insertion code + atom name; highest occupancy kept, first listed on ties
  (same policy as Phases 3A/3B). 2DN2 has no altlocs; synthetic tests cover altlocs, insertion codes and equal resSeq
  in different chains.
- Peptide bonds are inferred only within one chain; no bond joins chains. Ribbons are built per chain.
- `parsePdb` (single chain, used by 1UBQ/1QJ8) keeps its output and omitted counts; `parseMultiChainPdb` is the general
  reader (ATOM + non-water HETATM, element, altloc, occupancy, insertion code). No hemoglobin-specific parser code.
- `matchExposure` (Phase 3B) still joins by resSeq + resName; it is only used on single-chain structures and throws on any
  duplicate key, so a multi-chain collision cannot pass silently.

# Interface validation

- Criterion: a residue is an interface residue when any of its heavy atoms is within **4.0 Å** of a heavy atom of a
  different polymer chain (protein atoms only; heme and water excluded). Geometric contact only — not an interaction type.
- Result (122 interface residues):

| Pair | Chains | residues (first + second) | atom pairs |
|---|---|---|---:|
| α1–β1 | A–B | 16 + 18 | 108 |
| α1–α2 | A–C | 4 + 4 | 41 |
| α1–β2 | A–D | 14 + 13 | 94 |
| β1–α2 | B–C | 13 + 14 | 96 |
| α2–β2 | C–D | 16 + 18 | 113 |
| β1–β2 | B–D | no contact at 4.0 Å | 0 |

- Sanity check against the known architecture: α1β1 residues are in the B/G/H helices (α 31–36, 103–126; β 30–35, 55,
  108–131); α1β2 residues are in the C helix, FG corner and C terminus (α 37–44, 91–97, 140–141; β 34–43, 97–105, 145–146).
- Cutoff sensitivity (residues per pair): 3.5 Å α1β1 8+9, α1β2 8+7; 4.5 Å 20+20, 14+15; 5.0 Å 22+22, 15+16. The α1β1 >
  α1β2 ordering used for labels holds at every cutoff. Buried surface area was not computed (not needed for this phase).
- Tests: every listed residue truly has an other-chain atom within 4.0 Å; partners never include the residue's own chain;
  results are identical on repeated runs and when the chains are read in reverse order (compared by residue identity).

# Scientific simplifications

- One experimental state (deoxy, crystal, 298 K data) shown as a static structure; not all hemoglobin structures look like
  this. The UI says so and defers T↔R comparison to the next module.
- Waters (221) hidden and excluded from contacts; no other ligands exist in the file.
- "Separate subunits" translates each chain and its heme 8 Å outward along the tetramer-centroid → chain-centroid
  direction; no rotation or deformation. Tests show exact per-chain translation, preserved internal distances, and exact
  deposited coordinates with zero offset. The UI states it is not an experimentally observed conformation.
- Out-of-focus subunits are drawn translucent; atom coordinates are never changed.
- Space-filling Fe uses an approximate display radius of 2.0 Å (no SASA or chemistry computed with it).
- Interface = distance contact; hydrophobic contacts, H-bonds, ionic interactions and van der Waals contacts are not
  distinguished, and the UI does not describe subunits as "connected by hydrogen bonds".

# Known limitations

- The deposited heme propionate/vinyl distances noted above are shown as deposited.
- α1/β1 naming is a convention derived from contact size; the PDB itself does not label subunits.
- Exact pixel comparisons in the browser scripts depend on scroll position; the β-Sheet script now scrolls the canvas
  to the same place before each capture (the new sixth navigation button moves that canvas partly below the 1100 px
  test viewport; its reset was verified to restore the exact image at equal scroll).
- Chromium (SwiftShader WebGL) only; real mobile hardware and Safari/Firefox not tested.
- Vite's >500 kB advisory for the shared three.js chunk remains (509.84 kB, unchanged); the new lazy chunk is ~38 kB and
  the 825 kB PDB asset is not part of any JavaScript chunk.

"""One-off reference SASA for tests/fixtures/1ubq-biopython-sasa.json.

Independent implementation: Biopython Bio.PDB.SASA.ShrakeRupley (not a project dependency).
Same parameters as the app: probe 1.40 A, 960 golden-spiral points, Bondi C/N/O/S radii,
chain A ATOM records of the bundled, unmodified 1UBQ.pdb (waters removed).

    python scripts/sasa-reference.py
"""
import json
import warnings

import Bio
from Bio.PDB import PDBParser
from Bio.PDB.SASA import ShrakeRupley

warnings.filterwarnings("ignore")
structure = PDBParser(QUIET=True).get_structure("1UBQ", "src/data/structures/1UBQ.pdb")
chain = structure[0]["A"]
for residue in list(chain):
    if residue.id[0] != " ":
        chain.detach_child(residue.id)
radii = {"C": 1.70, "N": 1.55, "O": 1.52, "S": 1.80}
ShrakeRupley(probe_radius=1.40, n_points=960, radii_dict=radii).compute(chain, level="A")
rows = [
    {"resSeq": r.id[1], "resName": r.get_resname(), "sasa": round(sum(a.sasa for a in r), 4)}
    for r in chain
]
with open("tests/fixtures/1ubq-biopython-sasa.json", "w", encoding="utf-8") as f:
    json.dump({"tool": f"Biopython {Bio.__version__} ShrakeRupley", "probe": 1.4, "points": 960,
               "radii": radii, "residues": rows}, f, indent=1)
    f.write("\n")
print(len(rows), "residues; total", round(sum(r["sasa"] for r in rows), 2))

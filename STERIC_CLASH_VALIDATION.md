# Phase 1.1 — Steric Clash Validation

검증일: 2026-09-09. 기준 commit: `6bfebe7`. 대상: Ac–(L-Ala)₅–NHMe의 중앙 Ala 3.

## 기존 detector

- 대상: cap과 explicit amide H를 포함한 36개 표현 원자의 모든 무순서 쌍.
- 제외: 결합 그래프 최단거리 1 또는 2인 1–2, 1–3 쌍.
- 포함: 1–4 쌍, 같은 residue 쌍, cap 관련 쌍, 네 결합 이상 떨어진 모든 쌍.
- 반지름: Bondi H 1.20, C 1.70, N 1.55, O 1.52 Å.
- 판정: `rA + rB − distance > 0.40 Å`.
- H: carbon-bound H는 모델에 없고 amide H만 생성·검사.

## α-like의 기존 6쌍

φ = −60°, ψ = −45°에서 아래 여섯 쌍이 전부였습니다. 각 쌍은
`O(i)–C(i)–N(i+1)–Cα(i+1)`의 세 결합을 사이에 둔 **1–4 쌍**입니다.
따라서 일반적인 nonbonded clash로 분류할 수 없습니다.

| Atom A | A residue / type | Atom B | B residue / type | topology | distance (Å) | radii (Å) | overlap (Å) | 분류 |
|---|---|---|---|---:|---:|---:|---:|---|
| 0:O | Ac / O | 1:CA | Ala 1 / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B + C: cap 경계 topology artifact |
| 1:O | Ala 1 / O | 2:CA | Ala 2 / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B: topology artifact |
| 2:O | Ala 2 / O | 3:CA | Ala 3 / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B: topology artifact |
| 3:O | Ala 3 / O | 4:CA | Ala 4 / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B: topology artifact |
| 4:O | Ala 4 / O | 5:CA | Ala 5 / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B: topology artifact |
| 5:O | Ala 5 / O | 6:CA | NHMe / C | 1–4 | 2.773 | 1.52 + 1.70 | 0.447 | B + C: cap 경계 topology artifact |

이 여섯 거리는 φ/ψ와 무관한 고정 peptide geometry에서 정해져 α-like와 β-like 모두에 똑같이
나타났습니다. 1–2/1–3 false positive는 0쌍, H 관련은 0쌍, 같은 residue pair는 0쌍입니다.
두 cap 경계 쌍도 cap 모양이 잘못되어 생긴 별도 충돌이 아니라 나머지 네 쌍과 동일한 1–4 관계입니다.

기존 식에서 clash 경계는 `1.52 + 1.70 − 0.40 = 2.82 Å`였습니다. 이상적 내부 geometry가
만든 2.773 Å는 이를 0.047 Å 넘어, 0.447 Å overlap으로 모두 보고됐습니다. 즉 0.40 Å threshold가
홀로 지나치게 엄격해서라기보다 **threshold 전에 1–4를 거르지 않은 것이 직접 원인**입니다.

## 최종 정책

1. 1–2, 1–3, 1–4를 모두 제외합니다. Richardson Lab의 Reduce/Probe 접촉 계산 기본값도
   세 결합 이내의 contact를 제거합니다(`NBonds=3`).
2. heavy atom Bondi 반지름과 serious-overlap 기준 `> 0.40 Å`는 유지합니다. 이 기준은
   MolProbity가 severe/serious clash를 보고하는 기준과 같습니다.
3. 명시적 amide H는 검사하되 polar-H 반지름 1.00 Å를 사용합니다. carbon-bound H는 여전히
   implicit이며 검사하지 않습니다. 이 변경은 Extended에서 O₃···H₃의 경계성 0.414 Å overlap을
   심한 clash로 과대 표시하지 않게 합니다(1.00 Å 사용 시 overlap 0.214 Å).
4. cap은 일괄 제외하지 않습니다. local covalent neighbors만 topology 규칙으로 제외하고,
   비국소 cap contact는 계속 검사합니다.

이는 MolProbity를 구현했다는 뜻이 아닙니다. MolProbity는 complete optimized H, hydrogen-bond
분류와 rolling-probe contact surface를 사용합니다. 이 앱은 그 검증 관례 중 topology 범위,
polar-H 반지름, 0.40 Å serious-overlap 기준만 교육용 pairwise detector에 적용합니다.

## 대표·대조 구조 결과

| 구조 | φ / ψ | 기존 | 최종 | 해석 |
|---|---:|---:|---:|---|
| α-like | −60° / −45° | 6 | 0 | 기존 6쌍은 모두 1–4 artifact |
| β-like | −135° / +135° | 6 | 0 | 같은 1–4 artifact 제거 |
| Extended | −180° / +180° | 8 | 0 | 7개 topology artifact + polar-H 경계 contact 제거 |
| 불리한 대조 1 | 0° / 0° | 17 | 8 | O···H 0.310 Å 등 심한 비국소 overlap 유지 |
| 불리한 대조 2 | +60° / 0° | 13 | 3 | C···H, C···N, O···N 비국소 overlap 유지 |
| 불리한 대조 3 | −180° / 0° | 11 | 1 | polar-H radius 적용 후 심한 H···H overlap 하나 유지 |

0°/0° 최종 pair는 `2:O–4:H`, `2:O–4:N`, `2:C–4:H`, `2:C–4:N`,
`2:O–4:CA`, `2:O–3:C`, `2:O–4:O`, `2:O–4:C`의 8쌍입니다. 모두 네 결합 이상
떨어져 있으며 overlap 0.512–2.210 Å 범위입니다.

## 질문에 대한 결론

- **Q1. 원인:** 여섯 peptide group마다 반복되는 고정 O(i)–Cα(i+1) 1–4 geometry.
- **Q2. 의미 있는 nonbonded close contact / clash:** 기존 여섯 쌍 중 0쌍.
- **Q3. false positive / topology artifact:** 6쌍 전부. 그중 2쌍은 cap 경계에도 해당.
- **Q4. 최종 규칙:** 1–2/1–3/1–4 제외, heavy atom Bondi radii, polar H 1.00 Å,
  overlap >0.40 Å, cap의 비국소 접촉 포함.
- **Q5. α-like 최종 표시:** `심한 비결합 겹침 0쌍`.
- **Q6. 교육적 이유:** 고정 covalent geometry를 φ/ψ가 만든 충돌로 오해하지 않게 하면서,
  0°/0°처럼 실제로 원자가 관통하는 불리한 구조는 분명히 검출합니다. Ramachandran 개념도와
  현재 모델의 거리 지표가 서로 다른 정보라는 설명도 유지합니다.

## 근거

- [Word et al. (1999), Visualizing and quantifying molecular goodness-of-fit](https://doi.org/10.1006/jmbi.1998.2400)
- [Chen et al. (2010), MolProbity all-atom structure validation](https://doi.org/10.1107/S0907444909042073)
- [Richardson Lab Reduce documentation](https://github.com/rlabduke/reduce/blob/master/README.usingReduce.txt) — `NBonds=3`, `BADBumpcut=0.4` defaults.
- [Bondi (1964), van der Waals Volumes and Radii](https://doi.org/10.1021/j100785a001)

## 검증 범위

이 결론은 현재 고정 geometry와 표시 원자 집합에 대한 deterministic audit입니다. 외부 force-field
또는 MolProbity 실행 결과와 수치적으로 대조한 것이 아니며, carbon-bound H가 빠진 모델이라
full all-atom clashscore로 사용할 수 없습니다.

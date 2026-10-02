import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./hbs-polymerization-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/hbs-polymerization-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const check=n=>{checks.push(n);console.log('✓',n);},settle=()=>page.waitForTimeout(160);
// Several controls share a label with a camera preset ("변이 자리") or with each other ("둘 다"), so every
// segmented control is addressed through its own group.
const group=(label,name)=>page.getByRole('group',{name:label,exact:true}).getByRole('button',{name,exact:true});
const preset=name=>page.locator('.camera-presets').getByRole('button',{name,exact:true});
const tid=id=>page.getByTestId(id),text=async id=>(await tid(id).innerText()).replace(/\s+/g,' ').trim(),main=()=>page.locator('main');
const viewer=()=>tid('hbs-viewer'),vdata=k=>viewer().getAttribute(`data-${k}`);
const step=async id=>{await tid(`step-${id}`).click();await settle();await settle();};
const labels=()=>page.locator('.molecule-label:visible, .distance-label:visible').allInnerTexts();
const near=(txt,v,tol=2e-3)=>{const got=txt.split(',').map(Number);got.forEach((x,k)=>assert.ok(Math.abs(x-v[k])<tol,`${txt} vs ${v}`));};
const P=audit.contacts.primary,pocket=Object.fromEntries(P.pocket.map(q=>[q.residue,q]));
const fx=(v,n=2)=>v.toFixed(n);

try{
 await page.goto(((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/'),{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});
 assert.equal(await nav.getByRole('button').count(),11);
 assert.deepEqual((await nav.getByRole('button').allInnerTexts()).slice(-5),['헤모글로빈의 4차 구조\nHemoglobin Quaternary Structure','T ↔ R 구조 전환\nHemoglobin T ↔ R Structural Transition','협동성과 알로스테리\nHemoglobin Cooperativity & Allostery','돌연변이 허용성\nMutation Tolerance','HbS의 중합\nHbA → HbS → Polymerization']);
 assert.doesNotMatch(await nav.innerText(),/Bohr|2,3-BPG|AlphaFold|vaso|anemia|빈혈/i);
 assert.equal(requests.some(u=>/HbsPolymerizationLab|2HBS/.test(u)),false,'the module chunk and 2HBS must not load at start');
 check('Eleven completed modules; Chapter 3 ends with HbA → HbS → Polymerization; no Bohr / 2,3-BPG / clinical wording in the nav; module chunk and 2HBS not requested at start');

 await nav.getByRole('button',{name:/HbA → HbS → Polymerization/}).click();
 await viewer().locator('canvas').waitFor();await settle();
 assert.ok(requests.some(u=>/HbsPolymerizationLab/.test(u))&&requests.some(u=>/2HBS.*\.pdb/.test(u))&&requests.some(u=>/2DN2.*\.pdb/.test(u)));
 assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.getByRole('alert').count(),0);
 assert.match(await page.locator('.module-heading').innerText(),/HbA → HbS → 중합[\s\S]*amino acid 하나가 바뀌면/);
 assert.match(await page.locator('.model-tag').innerText(),new RegExp(`PDB 2HBS \\(deoxy HbS, ${audit.sources.hbs.resolution} Å\\)`));
 assert.equal(await tid('hbs-observation').evaluate(e=>e.open),false);
 assert.equal(await tid('hbs-steps').getByRole('button').count(),4);
 for(const [k,v] of [['step','mutation'],['representation','sticks'],['structure','both'],['highlight','both'],['instance-count','0'],['heme','off']])assert.equal(await vdata(k),v,k);
 near(await vdata('hbs-sample'),audit.samples.hbs.position);near(await vdata('hba-sample'),audit.samples.hba.aligned);
 assert.deepEqual(await labels(),['HbA · β2 Glu6','HbS · βS Val6']);
 check(`Step 1 opens by default: both β chains as sticks, HbA Glu6 and HbS Val6 labelled, deposited HbS coordinates (${audit.samples.hbs.atom}) and the rigidly aligned HbA copy drawn; 2HBS and 2DN2 fetched only now`);

 assert.match(await text('hbs-tip'),/1단계 · residue 하나가 바뀐다.*HbA의 β6는 Glu, HbS의 β6는 Val/);
 assert.match(await text('hbs-tip'),new RegExp(`matched Cα ${audit.mutation.alignment.matched}개.*Cα RMSD ${fx(audit.mutation.alignment.rmsd)} Å`));
 assert.match(await text('hbs-prediction'),/Glu를 Val로 바꾸면 이 자리의 단백질 표면에서 어떤 물리화학적 성질이 달라질까요\?/);
 assert.equal(await text('hba-residue'),'Glutamate (Glu)');assert.equal(await text('hbs-residue'),'Valine (Val)');
 const chem=await text('chemistry-table');
 assert.match(chem,/Acidic · 산성/);assert.match(chem,/Nonpolar · 비극성/);
 assert.match(chem,/carboxylate 곁사슬이 대체로 음전하를 띤 상태로 존재/);assert.match(chem,/전하 없음 · 소수성 side chain/);
 assert.match(await text('chemistry-caveat'),/“Glu는 언제나 −1”은 아닙니다.*생리적 조건에서 우세한 상태/);
 assert.equal(await tid('align-rmsd').locator('strong').innerText(),`${fx(audit.mutation.alignment.rmsd)} Å`);
 assert.equal(await tid('align-differences').locator('strong').innerText(),`${audit.mutation.differences.length}개`);
 assert.match(await text('align-differences'),/β6 Glu → Val/);
 assert.match(await text('neighbourhood-count'),new RegExp(`HbA ${audit.mutation.neighbourhood.hba}개 · HbS ${audit.mutation.neighbourhood.hbs}개`));
 check(`Step 1 side panel: Glu (acidic, 음전하 우세) vs Val (nonpolar), protonation caveat, β-chain alignment ${fx(audit.mutation.alignment.rmsd)} Å over ${audit.mutation.alignment.matched} Cα with exactly ${audit.mutation.differences.length} differing residue (β6)`);

 await group('구조','HbA').click();await settle();
 assert.equal(await vdata('structure'),'hba');
 assert.deepEqual(await labels(),['HbA · β2 Glu6']);
 assert.match(await text('hbs-legend'),/HbA β chain · 2DN2 \(aligned\)/);
 assert.doesNotMatch(await text('hbs-legend'),/HbS βS chain/);
 await page.screenshot({path:'artifacts/phase4d-hba-glu6.png'});
 await group('구조','HbS').click();await settle();
 assert.equal(await vdata('structure'),'hbs');
 assert.deepEqual(await labels(),['HbS · βS Val6']);
 await page.screenshot({path:'artifacts/phase4d-hbs-val6.png'});
 const hbsOnly=await vdata('hbs-sample');
 await group('구조','둘 다').click();await settle();
 assert.equal(await vdata('structure'),'both');assert.equal(await vdata('hbs-sample'),hbsOnly,'switching structures never moves coordinates');
 check('Structure switch HbA / HbS / Both changes only what is drawn (legend and labels follow); the displayed coordinates are unchanged');

 await step('surface');
 assert.equal(await vdata('step'),'surface');assert.equal(await vdata('representation'),'spacefill');
 assert.match(await text('hbs-tip'),new RegExp(`2단계 · 표면 화학.*β6 side chain에서 ${audit.mutation.neighbourhood.radius} Å 안의 residue를 space filling`));
 assert.match(await text('hbs-tip'),/계산된 molecular surface가 아니라 van der Waals 반지름의 원자 구체/);
 assert.equal(await vdata('hbs-sample'),hbsOnly);
 await page.screenshot({path:'artifacts/phase4d-surface.png'});
 check('Step 2 uses space filling of the local patch and states in the UI that it is atoms at van der Waals radii, not a computed molecular surface');

 await step('contact');
 assert.equal(await vdata('step'),'contact');assert.equal(await vdata('instance-count'),'2');
 assert.equal(await vdata('instances'),'M1,M2');assert.equal(await vdata('contacts'),'1');
 assert.equal(await vdata('donor-molecule'),P.donor.molecule);assert.equal(await vdata('acceptor-molecule'),P.acceptor.molecule);
 assert.equal(await vdata('donor-residue'),`${P.donor.molecule}/${P.donor.chain}:6:VAL`);
 assert.equal(await vdata('guides'),String(audit.contacts.guides.length));
 const shown=await labels();
 assert.ok(shown.includes('Molecule 2 · donor βVal6')&&shown.includes('Molecule 1 · acceptor pocket'),`molecule labels: ${shown}`);
 for(const g of audit.contacts.guides)assert.ok(shown.includes(`${fx(g.distance)} Å`),`distance ${fx(g.distance)} Å missing from ${shown}`);
 const donorRow=await text('donor-row'),acceptorRow=await text('acceptor-row');
 assert.match(donorRow,new RegExp(`Donor Molecule 2 chain ${P.donor.chain} \\(βS\\) Val6`));
 assert.match(acceptorRow,new RegExp(`Acceptor Molecule 1 chain ${P.acceptor.chain} \\(βS\\) pocket Ala70 / Phe85 / Leu88`));
 assert.match(await text('intermolecular-note'),/서로 다른 hemoglobin 분자에 속합니다.*same deposited asymmetric unit.*같은 tetramer 안의 접촉이 아닙니다/);
 check(`Step 3: two labelled molecules (donor ${P.donor.molecule} chain ${P.donor.chain} βVal6 → acceptor ${P.acceptor.molecule} chain ${P.acceptor.chain} pocket), ${audit.contacts.guides.length} dashed distance guides drawn and named as different molecules`);

 for(const q of P.pocket){
  const row=await text(`pocket-${q.residue.replace(/\D/g,'')}`);
  assert.match(row,new RegExp(`${q.residue[0]}${q.residue.slice(1,3).toLowerCase()}${q.residue.replace(/\D/g,'')}`));
  assert.ok(row.includes(`${fx(q.minDistance)} Å`),`${row} should contain ${fx(q.minDistance)} Å`);
  assert.ok(row.includes(`${q.atoms.split(' … ')[0]} ↔ ${q.atoms.split(' … ')[1]}`),row);
 }
 assert.match(await text('pocket-70'),/pocket core.*Nonpolar/);assert.match(await text('pocket-73'),/pocket 주변.*Acidic/);
 assert.match(await text('secondary-contact'),new RegExp(`Asp73.*donor Thr4.*${fx(audit.contacts.primary.secondary.minDistance)} Å`));
 const caveat=await text('contact-caveat');
 assert.match(caveat,/거리만으로 상호작용의 종류가 정해지지는 않습니다/);
 assert.match(caveat,/모두 비극성 곁사슬이고.*hydrophobic contact로 설명됩니다\. 공유결합이 아닙니다/);
 const cutoffNote=await text('cutoff-note');
 const detected=P.neighboursWithinCutoff.map(n=>{const [r]=n.split(' ');return `${r[0]}${r.slice(1,3).toLowerCase()}${r.replace(/\D/g,'')}`;}).join(' · ');
 assert.ok(cutoffNote.includes(`4.5 Å 거리 기준을 적용하면 이 acceptor chain에서 βVal6 주변에 검출되는 residue는 ${detected}입니다`),cutoffNote);
 assert.match(cutoffNote,/분석을 위해 정한 operational cutoff/);
 assert.doesNotMatch(caveat+cutoffNote,/cherry|exactly|정확히/);
 assert.match(await text('distance-note'),/근접을 표시하는 보조선이며 화학 결합이 아닙니다/);
 await preset('접촉 pocket').click();await settle();
 await page.screenshot({path:'artifacts/phase4d-contact.png'});
 check(`Measured pocket distances shown exactly as the audit: Ala70 ${fx(pocket.ALA70.minDistance)} Å, Phe85 ${fx(pocket.PHE85.minDistance)} Å, Leu88 ${fx(pocket.LEU88.minDistance)} Å, plus the polar rim Thr84 ${fx(pocket.THR84.minDistance)} Å / Asp73 ${fx(pocket.ASP73.minDistance)} Å and the Thr4–Asp73 secondary interaction; wording is "hydrophobic contact", never a bond`);

 await group('강조','받는 쪽 pocket').click();await settle();
 assert.equal(await vdata('highlight'),'pocket');
 await group('강조','변이 자리').click();await settle();
 assert.equal(await vdata('highlight'),'mutation');
 await group('강조','둘 다').click();await settle();
 assert.equal(await vdata('highlight'),'both');
 await page.getByRole('checkbox',{name:'이웃 분자'}).uncheck();await settle();
 assert.equal(await vdata('instance-count'),'1');assert.equal(await vdata('instances'),P.donor.molecule);
 assert.equal(await vdata('contacts'),'0','with one molecule on screen there is no intermolecular contact to draw');
 await page.getByRole('checkbox',{name:'이웃 분자'}).check();await settle();
 assert.equal(await vdata('instance-count'),'2');
 await page.getByRole('checkbox',{name:'Heme'}).check();await settle();
 assert.equal(await vdata('heme'),'on');
 assert.match(await text('hbs-legend'),/Heme/);
 await page.screenshot({path:'artifacts/phase4d-pocket.png'});
 await page.getByRole('checkbox',{name:'Heme'}).uncheck();
 await page.getByRole('checkbox',{name:'접촉 거리'}).uncheck();await settle();
 assert.equal(await vdata('guides'),'0');assert.equal((await labels()).filter(t=>t.includes('Å')).length,0);
 await page.getByRole('checkbox',{name:'접촉 거리'}).check();await settle();
 assert.equal(await vdata('guides'),String(audit.contacts.guides.length));
 check('Highlight (mutation / pocket / both), 이웃 분자 (removing it leaves one molecule and no contact), Heme and 접촉 거리 toggles all work');

 await step('polymer');
 assert.equal(await vdata('step'),'polymer');assert.equal(await vdata('representation'),'ribbon');
 assert.equal(await vdata('instance-count'),'4');assert.equal(await vdata('contacts'),'3');
 assert.match(await text('hbs-tip'),new RegExp(`4단계 · 반복되는 접촉.*unit cell 병진\\(${audit.sources.hbs.spaceGroup}\\).*세포 안 fiber 전체의 원자 모델이 아닙니다`));
 assert.equal(await tid('segment-count').locator('strong').innerText(),'4 tetramers');
 assert.equal(await tid('segment-operation').locator('strong').innerText(),'x ± a');
 assert.match(await text('segment-operation'),new RegExp(`unit cell a = ${audit.sources.hbs.cell.a.toFixed(3)} Å 병진 \\(회전 없음\\)`));
 assert.equal(await tid('segment-contacts').locator('strong').innerText(),`${audit.contacts.all.length}곳`);
 assert.equal(await tid('segment-packing').locator('strong').innerText(),`${fx(audit.segment.packing.closestBetweenMolecules)} Å`);
 assert.match(await text('segment-packing'),new RegExp(`${audit.segment.packing.overlapCutoff} Å 미만으로 겹치는 원자쌍 ${audit.segment.packing.overlappingPairs}개`));
 const polymerLabels=await labels();
 for(const name of ['Molecule 1','Molecule 2','Molecule 1 −a','Molecule 2 −a'])assert.ok(polymerLabels.includes(name),`${name} missing from ${polymerLabels}`);
 for(const value of [...new Set(audit.contacts.segmentJunctions.map(j=>fx(j.closest)))])assert.ok(polymerLabels.some(t=>t===`${value} Å`),`junction ${value} Å missing`);
 await group('Segment','6 tetramers').click();await settle();await settle();
 assert.equal(await vdata('instance-count'),'6');assert.equal(await vdata('contacts'),String(audit.contacts.all.length));
 await page.screenshot({path:'artifacts/phase4d-polymer.png'});
 await group('Segment','2 tetramers').click();await settle();
 assert.equal(await vdata('instance-count'),'2');
 await group('Segment','4 tetramers').click();await settle();
 check(`Step 4: the segment is built by unit-cell translation only (a = ${audit.sources.hbs.cell.a} Å, no rotation); 2 / 4 / 6 tetramers show ${audit.contacts.all.length} junctions at most, each molecule is labelled, and the measured junction distances repeat exactly`);

 const schematic=tid('fiber-schematic');
 assert.equal(await schematic.count(),1);
 assert.match(await schematic.innerText(),/모식도.*원자 좌표가 아닙니다/s);
 assert.match(await schematic.innerText(),/7 double strands = 14 strands/);
 assert.match(await schematic.innerText(),/전자현미경 3차원 재구성과 섬유 회절로 추론된 상위 구조를 개념적으로만 나타냅니다/);
 assert.match(await text('evidence-note'),/근거 수준이 다릅니다.*직접 관측된 원자 좌표와 그 격자 병진.*schematic.*원자 좌표가 아닙니다/);
 assert.equal(await page.locator('[data-testid="fiber-schematic"] svg').count(),1);
 check('Step 4 fiber schematic is present, tagged SCHEMATIC, states it is not atomic coordinates, and the panel separates the two evidence levels');

 const science=await text('hbs-science');
 assert.match(science,/HbS mutation이 있다고 해서 항상 polymer가 만들어지는 것은 아닙니다/);
 assert.match(science,/deoxy 상태의 polymer-compatible한 conformation에서 크게 촉진됩니다/);
 assert.match(science,/HbS 농도, 산소화 정도, nucleation, 세포 내 환경 등에도 함께 좌우되며 이 모듈에서는 그 속도론을 계산하지 않습니다/);
 const net=audit.contacts.contactNetwork;
 assert.match(await text('network-established'),/실험 구조로 잘 확립된, polymerization의 특징적인 pathological lateral contact/);
 assert.match(await text('network-established'),/HbS fiber는 βVal6 접촉 하나만으로 안정화되지 않으며, 여러 axial · lateral intermolecular interaction이 함께 존재합니다/);
 assert.match(await text('network-measured'),/6-tetramer crystal segment.*접촉 기준\(서로 다른 분자의 heavy atom ≤ 4\.0 Å\)으로 검출한/);
 assert.match(await text('network-measured'),/이 시각화에서 계산한 값이며, 실제 HbS fiber에 고정된 접촉 개수가 아닙니다/);
 assert.equal(await tid('network-total').innerText(),`${net.lateral+net.axial}곳`);
 assert.match(await text('network-note'),new RegExp(`lateral 접촉이 ${net.lateral}곳, 같은 strand를 따라가는 axial 접촉이 ${net.axial}곳`));
 assert.match(await text('network-note'),new RegExp(`βVal6이 직접 관여하는 것은 그중 ${net.involvingMutation}곳`));
 assert.match(await text('rbc-note'),/적혈구 내부의 기계적 성질을 바꾸어.*구조 수준까지만 다루며 세포·임상 수준은 모델링하지 않습니다/);
 await tid('tr-link').click();await settle();
 await page.getByTestId('tr-viewer').locator('canvas').waitFor();
 assert.match(await page.locator('.module-heading').innerText(),/헤모글로빈 T ↔ R 구조 전환/);
 await nav.getByRole('button',{name:/HbA → HbS → Polymerization/}).click();await viewer().locator('canvas').waitFor();await settle();
 assert.equal(await vdata('step'),'mutation','returning to the module starts again at step 1');
 check(`Science note: deoxy dependence without "deoxy = always polymer", explicit non-simulation list, established βVal6 pocket contact kept separate from the contact network measured in the displayed 6-tetramer segment (${net.lateral} lateral + ${net.axial} axial interfaces, only ${net.involvingMutation} involving βVal6), short RBC consequence with a scope limit; the T ↔ R link opens the existing Phase 4B module and coming back resets to step 1`);

 await step('contact');await tid('hbs-observation').locator('summary').click();
 const obs=await text('hbs-observation');
 assert.match(obs,/β6 Glu → Val.*HbS의 β chain 두 개 모두가 이 치환을 가집니다.*βS chain 4개 전부에서 확인/);
 assert.match(obs,/charged\/polar → nonpolar.*단백질 접힘 자체는 거의 그대로입니다/);
 assert.match(obs,new RegExp(`Cα RMSD ${fx(Math.min(...audit.mutation.chainFits.map(f=>f.rmsd)))}–${fx(Math.max(...audit.mutation.chainFits.map(f=>f.rmsd)))} Å`));
 assert.match(obs,new RegExp(`tetramer 전체로도 ${audit.mutation.tetramerFits.map(f=>fx(f.rmsd)).join(' / ')} Å`));
 assert.match(obs,/이웃 β chain의 pocket.*Ala70 · Phe85 · Leu88 \(모두 비극성\)/);
 assert.match(obs,/intermolecular contact.*한 tetramer의 두 βS 중 하나만 이 접촉의 donor이고/);
 for(const u of audit.contacts.unengagedDonors)assert.ok(obs.includes(`chain ${u.chain}`),`unengaged chain ${u.chain} missing`);
 for(const f of audit.mutation.chainFits){
  const cells=await page.getByTestId(`chain-fit-${f.chain}`).locator('th,td').allInnerTexts();
  assert.deepEqual(cells.map(t=>t.replace(/\s+/g,' ').trim()),
   [`${f.chain} (${f.label})`,audit.segment.instances.find(i=>i.id===f.molecule).label,f.type==='alpha'?'α-globin':'β-globin',f.reference,`${fx(f.rmsd)} Å Cα ${f.matched}`]);
 }
 check(`Observation panel connects β6 Glu → Val → nonpolar surface → neighbouring β-chain pocket → intermolecular contact → deoxy HbS polymerization, with the per-chain fits (${audit.mutation.chainFits.map(f=>f.chain+' '+fx(f.rmsd)).join(', ')} Å) shown against their HbA counterparts`);

 await page.locator('details:has(summary:text("구조 출처와 처리 방법 보기"))').locator('summary').click();await settle();
 assert.match(await text('hbs-source'),/RCSB PDB 2HBS, human deoxyhemoglobin S, X-ray diffraction, 2\.05 Å, space group P 1 21 1\. Harrington, Adachi & Royer Jr \(1997\) J\. Mol\. Biol\. 272:398–407\./);
 assert.match(await text('hbs-source'),/HbA: RCSB PDB 2DN2, human deoxyhemoglobin A, X-ray diffraction, 1\.25 Å/);
 assert.match(await text('assembly-note'),/asymmetric unit에는 완전한 α2βS2 tetramer가 두 개.*biomolecule 1 = chains A, B, C, D, biomolecule 2 = chains E, F, G, H.*둘 다 identity operator.*대칭 조작 없이.*deposited 좌표에서 그대로 관찰/);
 assert.match(await text('assembly-note'),/βS chain 네 개 모두 SEQRES 6번이 VAL임을 확인했습니다/);
 assert.match(await text('lattice-note'),/격자 병진은 모든 space group에 포함되는 정확한 결정학적 대칭 조작이며 회전 성분이 없으므로 복사본 내부의 거리는 전혀 변하지 않습니다/);
 assert.match(await text('lattice-note'),/임의로 이동·회전시킨 좌표는 없습니다/);
 assert.ok((await text('identity-note')).includes(P.donor.key),'the molecule-instance-aware key is shown');
 assert.match(await text('bond-note'),/분자 사이 근접은 점선 guide와 측정값으로만 표시합니다/);
 assert.match(await text('ligand-note'),/deoxy 구조이며 heme Fe에 결합한 ligand가 deposited되어 있지 않습니다.*없는 O₂를 그려 넣지 않았습니다/);
 const all=await main().innerText();
 assert.doesNotMatch(all,/공유결합으로|Val끼리|hydrophobic bond|소수성 결합|변성|denature|Bohr|2,3-BPG|vaso|혈관 폐쇄|용혈/i);
 assert.doesNotMatch(all,/전체 구조가 무너|fold가 붕괴|14가닥 원자 모델|fiber 전체 구조를 계산/);
 check('Sources panel documents the two deposited files, the two identity-operator biomolecules, the lattice-translation-only repeat, the molecule-instance-aware residue keys, the per-molecule bond policy and the absent ligand; no "covalent" / "Val sticks to Val" / "hydrophobic bond" / denaturation / clinical wording anywhere');

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(320);
  await step('contact');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  const v=await viewer().boundingBox();
  assert.ok(v.height>=300&&v.x>=0&&v.x+v.width<=width+0.5,`viewer ${JSON.stringify(v)} at ${width}`);
  for(const sel of ['[data-testid="hbs-steps"]','.hbs-controls','[data-testid="hbs-legend"]','[data-testid="distance-table"]','.camera-presets']){
   const b=await page.locator(sel).first().boundingBox();
   assert.ok(b.x>=-0.5&&b.x+b.width<=width+0.5,`${sel} outside at ${width}`);
  }
  assert.equal(await vdata('instance-count'),'2');
  await step('polymer');
  const fig=await tid('fiber-schematic').boundingBox();
  assert.ok(fig.x>=-0.5&&fig.x+fig.width<=width+0.5,`schematic outside at ${width}`);
  assert.equal(await vdata('contacts'),'3');
  if(width===390){await page.screenshot({path:'artifacts/phase4d-mobile.png',fullPage:true});}
  check(`${width}px: no horizontal overflow; viewer ${Math.round(v.width)}×${Math.round(v.height)} px, step list, controls, legend, distance table, camera presets and the fiber schematic all inside; contact and polymer steps still work`);
 }
 await page.setViewportSize({width:1440,height:1100});await settle();

 for(let i=0;i<2;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await page.getByTestId('membrane-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/Hemoglobin Quaternary/}).click();await page.getByTestId('hb-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/T ↔ R/}).click();await page.getByTestId('tr-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/Cooperativity/}).click();await page.getByTestId('coop-graph').waitFor();
  assert.equal(await page.locator('canvas').count(),0);
  await nav.getByRole('button',{name:/HbA → HbS → Polymerization/}).click();await viewer().locator('canvas').waitFor();await settle();
  assert.equal(await page.locator('canvas').count(),1);
  near(await vdata('hbs-sample'),audit.samples.hbs.position);
  await step('contact');
  assert.equal(await vdata('contacts'),'1');assert.equal(await vdata('donor-molecule'),P.donor.molecule);
 }
 check('Repeated navigation through all nine modules keeps each working and disposes viewers; the HbS contact is identical every time');

 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase4d-browser-results.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

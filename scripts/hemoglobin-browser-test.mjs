import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./hemoglobin-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/hemoglobin-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const check=n=>{checks.push(n);console.log('✓',n);},button=name=>page.getByRole('button',{name,exact:true}),settle=()=>page.waitForTimeout(150);
const hv=()=>page.getByTestId('hb-viewer'),shot=()=>hv().locator('canvas').screenshot(),data=key=>hv().getAttribute(`data-${key}`);
const main=()=>page.locator('main'),checkbox=name=>page.getByRole('checkbox',{name,exact:true});
const byLabel=label=>audit.subunits.find(s=>s.label===label);
const pairFor=(a,b)=>audit.interfaces.pairs.find(p=>p.chains===`${a}-${b}`||p.chains===`${b}-${a}`);

try{
 await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});
 assert.equal(await nav.getByRole('button').count(),7);
 assert.deepEqual((await nav.getByRole('button').allInnerTexts()).slice(-3),['Chapter 2 · From Sequence to Structure\nSoluble vs Membrane Protein','Chapter 3 · From Structure to Function\nHemoglobin Quaternary Structure','Chapter 3 · From Structure to Function\nHemoglobin T ↔ R Structural Transition']);
 assert.equal(requests.some(u=>/HemoglobinQuaternaryLab|2DN2/.test(u)),false,'hemoglobin chunk and structure must not load initially');
 assert.doesNotMatch(await nav.innerText(),/cooperativ|sickle|HbS|Bohr|Hill|2,3-BPG/i);
 check('Seven completed modules with Chapter 3 · Hemoglobin Quaternary Structure; its chunk and 2DN2 asset are not requested at start');

 await nav.getByRole('button',{name:/Hemoglobin Quaternary/}).click();await hv().locator('canvas').waitFor();await settle();
 const loaded=requests.filter(u=>/HemoglobinQuaternaryLab|2DN2/.test(u));
 assert.ok(loaded.some(u=>/HemoglobinQuaternaryLab/.test(u))&&loaded.some(u=>/2DN2.*\.pdb/.test(u)),'chunk + asset on demand');
 assert.equal(requests.some(u=>/rcsb|wwpdb|ebi\.ac\.uk/i.test(u)),false,'no external structure server');
 assert.ok(loaded.every(u=>u.startsWith('http://127.0.0.1:4173/')));
 assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('canvas').count(),1);
 for(const [k,v] of [['representation','ribbon'],['color','default'],['focus','all'],['heme','on'],['visible-hemes','4'],['interfaces','off'],['exploded','off'],['camera-preset','reset']])assert.equal(await data(k),v,k);
 assert.match(await page.locator('.module-heading').innerText(),/이 단백질은 몇 개의 polypeptide chain으로 이루어져 있을까\?/);
 assert.equal(await page.getByTestId('observation').evaluate(e=>e.open),false);
 assert.doesNotMatch(await main().innerText(),/총 4개의 polypeptide chain|α2β2/,'answer stays collapsed');
 assert.equal(await hv().locator('.heme-label:not([hidden])').count(),4);
 assert.deepEqual(await hv().locator('.heme-label').allInnerTexts(),['Heme 1','Heme 2','Heme 3','Heme 4']);
 assert.ok(await button('Focus heme').isDisabled());
 assert.match(await page.getByTestId('structure-source').textContent(),/2DN2, X-ray diffraction, 1\.25 Å[\s\S]*identity operator; no chains were copied/);
 assert.match(await page.getByTestId('structure-source').textContent(),new RegExp(`${audit.polymerHeavyAtoms} protein heavy atoms, 4 × HEM \\(${audit.heteroAtoms} atoms\\)`));
 assert.match(await main().innerText(),/한 실험 구조 상태\(deoxy[\s\S]*T↔R 구조 변화는 다음 모듈에서 비교/);
 check('Module loads on demand from the bundled asset (no RCSB request): ribbon/default whole tetramer, 4 heme labels, question first, answer collapsed, one-state note');
 const init=await shot();

 let before=init;
 for(const [label,value] of [['Atoms / sticks','atoms'],['Space filling','spacefill'],['Ribbon','ribbon']]){await button(label).click();await settle();assert.equal(await data('representation'),value);const now=await shot();assert.notDeepEqual(now,before,label);before=now;}
 check('Ribbon / Atoms-sticks / Space filling each render differently');

 await button('By subunit').click();await settle();assert.equal(await data('color'),'subunit');
 for(const s of audit.subunits)assert.equal(await page.getByTestId(`legend-${s.chain}`).innerText(),`${s.label} — Chain ${s.chain}`);
 assert.match(await page.getByTestId('color-legend').innerText(),/Heme \(non-protein prosthetic group\)[\s\S]*Fe/);
 assert.match(await page.getByTestId('hb-tip').innerText(),/색 하나 = polypeptide chain 하나[\s\S]*subunit 수에 넣지 않습니다/);
 const bySubunit=await shot();assert.notDeepEqual(bySubunit,init);
 await hv().screenshot({path:'artifacts/phase4a-hb-subunits.png'});
 await page.screenshot({path:'artifacts/phase4a-hb-tetramer.png',fullPage:true});
 await button('By chain type').click();await settle();assert.equal(await data('color'),'type');
 const legend=await page.getByTestId('color-legend').innerText(),alphas=audit.subunits.filter(s=>s.type==='alpha'),betas=audit.subunits.filter(s=>s.type==='beta');
 assert.ok(legend.includes(`α chains — ${alphas.map(s=>`${s.label} (Chain ${s.chain})`).join(', ')}`),legend);assert.ok(legend.includes(`β chains — ${betas.map(s=>`${s.label} (Chain ${s.chain})`).join(', ')}`),legend);
 assert.notDeepEqual(await shot(),bySubunit);
 check(`Color by subunit legend = audit mapping (${audit.subunits.map(s=>`${s.label}–${s.chain}`).join(', ')}); by chain type groups ${alphas.length} α and ${betas.length} β chains`);

 await button('By subunit').click();
 for(const s of audit.subunits){
  await button(s.label).click();await settle();
  assert.equal(await data('focus'),s.label);assert.equal(await page.getByTestId('view-badge').innerText(),`${s.label} · CHAIN ${s.chain}`);
  assert.equal(await page.getByTestId('subunit-type').innerText(),`${s.type==='alpha'?'α-type · α-globin':'β-type · β-globin'} UniProt ${s.uniprot} (${s.entry})`);
  assert.equal(await page.getByTestId('subunit-residues').innerText(),`sequence ${s.sequenceLength} · modeled ${s.modeledResidues} (residue ${s.range[0]}–${s.range[1]})`);
  assert.equal(await page.getByTestId('subunit-heme').innerText(),`present — Heme ${s.heme.number} / 4 (HEM ${s.heme.record.split(' ')[2]})`);
  const contacts=await page.getByTestId('subunit-contacts').innerText();
  for(const o of audit.subunits.filter(x=>x.chain!==s.chain)){const p=pairFor(s.chain,o.chain);const mine=p?(p.chains.startsWith(s.chain)?p.residues[0]:p.residues[1]):null;assert.ok(contacts.includes(`${o.label}: ${mine===null?'접촉 없음':`${mine} residues`}`),`${s.label} vs ${o.label}: ${contacts}`);}
  assert.equal(await button('Focus heme').isDisabled(),false);
 }
 check('View α1/β1/α2/β2: badge, globin type + UniProt, sequence vs modeled residues, own heme number and per-partner contact counts all equal the audit');

 for(const s of audit.subunits){
  await page.getByRole('button',{name:`Heme ${s.heme.number} / 4 · ${s.label} · Chain ${s.chain}`}).click();await settle();
  assert.equal(await data('focus'),s.label);assert.equal(await data('camera-preset'),'heme');
  assert.equal(await data('camera-target'),s.heme.iron.map(v=>v.toFixed(3)).join(','));
  const info=await page.getByTestId('heme-info').innerText();
  assert.match(info,new RegExp(`Heme ${s.heme.number} / 4`));assert.match(info,/Non-protein prosthetic group/);
  assert.equal(await page.getByTestId('heme-proximal').locator('strong').innerText(),`${s.heme.feLigandDistance.toFixed(2)} Å`);
  assert.match(await page.getByTestId('heme-proximal').innerText(),new RegExp(s.heme.proximal.split(' (')[0]));
  assert.equal(await data('selected'),`heme:${574+s.heme.number-1}`);
  if(s.label==='β1'){await hv().screenshot({path:'artifacts/phase4a-hb-hemes.png'});}
 }
 check(`Heme 1–4 buttons focus each subunit's own heme: camera target = Fe coordinates, Fe–proximal His ${audit.subunits.map(s=>s.heme.feLigandDistance.toFixed(2)).join(' / ')} Å as measured`);

 await button('Whole tetramer').click();await button('Reset camera').click();await settle();
 const withHeme=await shot();
 await checkbox('Heme').uncheck();await settle();
 assert.equal(await data('heme'),'off');assert.equal(await data('visible-hemes'),'0');assert.equal(await hv().locator('.heme-label:not([hidden])').count(),0);
 assert.doesNotMatch(await page.getByTestId('color-legend').innerText(),/Heme/);assert.notDeepEqual(await shot(),withHeme);
 await checkbox('Heme').check();await settle();assert.equal(await data('visible-hemes'),'4');assert.deepEqual(await shot(),withHeme);
 check('Heme toggle hides all four hemes (and labels/legend) and restores the identical image');

 await checkbox('Interfaces').check();await settle();
 assert.equal(await data('interfaces'),String(audit.interfaces.interfaceResidues));
 assert.match(await page.getByTestId('hb-tip').innerText(),/4\.0 Å[\s\S]*기하학적 접촉[\s\S]*수소결합 하나로 연결되었다는 뜻이 아니며/);
 const ifaceImage=await shot();assert.notDeepEqual(ifaceImage,withHeme);
 for(const p of audit.interfaces.pairs){
  const [a,b]=p.chains.split('-');const text=await page.getByTestId(`pair-${p.chains}`).innerText();
  assert.equal(text,`${p.labels} · Chain ${a}–${b} · ${p.residues[0]} + ${p.residues[1]}`);
  await page.getByTestId(`pair-${p.chains}`).click();await settle();assert.equal(await data('interfaces'),String(p.residues[0]+p.residues[1]));
 }
 assert.equal(await page.getByTestId('interface-list').getByRole('button').count(),audit.interfaces.pairs.length+1);
 await page.getByRole('button',{name:/^All contacts/}).click();await settle();assert.deepEqual(await shot(),ifaceImage);
 await checkbox('Interfaces').uncheck();await settle();assert.deepEqual(await shot(),withHeme);
 check(`Interfaces: ${audit.interfaces.interfaceResidues} residues at ≤4.0 Å; pair buttons and counts equal audit (${audit.interfaces.pairs.map(p=>`${p.labels} ${p.residues.join('+')}`).join(', ')}); off restores image`);

 await checkbox('Separate subunits').check();await settle();
 assert.equal(await data('exploded'),'on');
 const offsets=Object.fromEntries((await data('chain-offsets')).split(';').map(s=>{const [c,v]=s.split(':');return [c,v.split(',').map(Number)];}));
 for(const [c,v] of Object.entries(audit.exploded.offsets)){offsets[c].forEach((x,k)=>assert.ok(Math.abs(x-v[k])<0.001,`${c} offset`));assert.ok(Math.abs(Math.hypot(...offsets[c])-audit.exploded.distance)<0.002);}
 assert.match(await page.getByTestId('hb-tip').innerText(),/Subunits are visually separated for explanation\. This is not an experimentally observed conformation\./);
 await button('Fit structure').click();await settle();await hv().screenshot({path:'artifacts/phase4a-hb-exploded.png'});
 await checkbox('Separate subunits').uncheck();await settle();
 assert.equal(await data('chain-offsets'),audit.chains.map(c=>`${c}:0.000,0.000,0.000`).join(';'));
 await button('Reset camera').click();await settle();assert.deepEqual(await shot(),withHeme);
 check(`Separate subunits: each chain translated ${audit.exploded.distance} Å outward exactly as audited, disclaimer shown; off + reset restores the deposited image`);

 await hv().scrollIntoViewIfNeeded();const box=await hv().locator('canvas').boundingBox();
 let picked='';for(const [dx,dy] of [[0,0],[-40,0],[40,0],[0,-40],[0,40],[-80,20],[80,-20]]){await page.mouse.click(box.x+box.width/2+dx,box.y+box.height/2+dy);await settle();picked=await data('selected');if(picked)break;}
 assert.ok(picked,'3D click selects something');
 if(picked.startsWith('residue:')){
  const title=await page.getByTestId('residue-info').innerText(),chain=title.match(/PDB chain ([A-D])/)[1],s=audit.subunits.find(x=>x.chain===chain);
  assert.match(await page.getByTestId('residue-subunit').innerText(),new RegExp(`^${s.label} · Chain ${chain}`));
  assert.match(title,new RegExp(`${chain}:\\d+:[A-Z]{3}`));
 }
 check(`3D click selects ${picked}; inspector shows the real PDB chain, its subunit label and the chain-aware residue key`);

 const dir=async()=>(await data('camera-direction')).split(',').map(Number);
 await hv().locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await settle();const moved=await dir(),dist=await data('camera-distance');
 await button('Fit structure').click();await settle();const fitted=await dir();assert.ok(moved.every((v,i)=>Math.abs(v-fitted[i])<1e-5));assert.notEqual(await data('camera-distance'),dist);
 check('Keyboard rotate/zoom; Fit keeps the view direction and refits');

 await button('Space filling').click();await button('β2').click();await checkbox('Interfaces').check();await checkbox('Separate subunits').check();await settle();
 await button('전체 초기화').click();await settle();
 assert.deepEqual(await shot(),init);for(const [k,v] of [['representation','ribbon'],['color','default'],['focus','all'],['heme','on'],['interfaces','off'],['exploded','off']])assert.equal(await data(k),v);
 await page.getByText('관찰 후 확인하기').click();
 assert.equal(await page.getByTestId('chain-count').innerText(),'4');assert.equal(await page.getByTestId('alpha-count').innerText(),'2');assert.equal(await page.getByTestId('beta-count').innerText(),'2');assert.equal(await page.getByTestId('heme-count').innerText(),'4');
 for(const s of audit.subunits){const cells=await page.getByTestId(`mapping-${s.chain}`).locator('th,td').allInnerTexts();assert.deepEqual(cells,[s.label,s.chain,s.type==='alpha'?'α-globin':'β-globin',String(s.sequenceLength),String(s.modeledResidues),`Heme ${s.heme.number} (${s.heme.record.split(' ')[0]} ${s.heme.record.split(' ')[2]})`]);}
 const text=await main().innerText();
 assert.match(text,/네 polypeptide subunit이 조립되어 하나의 hemoglobin tetramer를 형성합니다/);assert.match(text,/4 chains \+ 4 hemes ≠ 8 subunits/);
 assert.doesNotMatch(text,/4개의 단백질|cooperativ|Hill|Bohr|2,3-BPG|sickle|Glu6Val|HbS|oxygen-binding curve/i);
 check('Full reset restores the exact initial rendering; collapsed check lists 4 chains, α 2, β 2, 4 hemes and the audited chain table; no out-of-scope topics');

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(300);
  await button('By subunit').click();await button('α2').click();await checkbox('Interfaces').check();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  const v=await hv().boundingBox();assert.ok(v.width>=width-60&&v.height>=300,`viewer ${v.width}x${v.height} at ${width}`);
  for(const sel of ['.hb-controls','.hb-panel','.levels']){const c=await page.locator(sel).boundingBox();assert.ok(c.y>=v.y+v.height-1||c.y+c.height<=v.y+1,`${sel} overlaps viewer at ${width}`);assert.ok(c.x>=0&&c.x+c.width<=width+0.5,`${sel} wider than ${width}`);}
  for(const b of await page.getByRole('group',{name:'View'}).getByRole('button').all()){const r=await b.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width,`View button outside at ${width}`);}
  await hv().scrollIntoViewIfNeeded();const mb=await hv().boundingBox();
  let tapped='';for(const dx of [0,-25,25,-50,50]){await page.mouse.click(mb.x+mb.width/2+dx,mb.y+mb.height/2);await settle();tapped=await data('selected');if(tapped)break;}
  assert.ok(tapped,`tap at ${width}`);
  if(width===390)await page.screenshot({path:'artifacts/phase4a-hb-mobile.png',fullPage:true});
  await button('전체 초기화').click();
  check(`${width}px: no horizontal overflow, View selector buttons inside the screen, viewer ≥300 px tall and full width, panels outside the viewer, tap selection works`);
 }
 await page.setViewportSize({width:1440,height:1100});
 for(let i=0;i<3;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);
  await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await page.getByTestId('membrane-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),2);
  await nav.getByRole('button',{name:/Hemoglobin Quaternary/}).click();await hv().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);assert.equal(await data('visible-hemes'),'4');
 }
 check('Repeated navigation through all six modules keeps each working and disposes viewers');
 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase4a-browser-results.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

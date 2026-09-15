import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./hemoglobin-transition-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/hemoglobin-transition-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const check=n=>{checks.push(n);console.log('✓',n);},button=name=>page.getByRole('button',{name,exact:true}),settle=()=>page.waitForTimeout(150);
const tv=()=>page.getByTestId('tr-viewer'),shot=()=>tv().locator('canvas').screenshot(),data=key=>tv().getAttribute(`data-${key}`);
const checkbox=name=>page.getByRole('checkbox',{name,exact:true}),main=()=>page.locator('main');
const near=(text,v,tol=0.0006)=>{const got=text.split(',').map(Number);assert.equal(got.length,3);got.forEach((x,k)=>assert.ok(Math.abs(x-v[k])<tol,`${text} vs ${v}`));};
const camera=async()=>({direction:await data('camera-direction'),distance:await data('camera-distance'),target:await data('camera-target')});
const morph=async value=>{await page.locator('#morph').fill(String(value));await settle();};

try{
 await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});
 assert.equal(await nav.getByRole('button').count(),7);
 assert.deepEqual((await nav.getByRole('button').allInnerTexts()).slice(-2),['Chapter 3 · From Structure to Function\nHemoglobin Quaternary Structure','Chapter 3 · From Structure to Function\nHemoglobin T ↔ R Structural Transition']);
 assert.doesNotMatch(await nav.innerText(),/cooperativ|sickle|HbS|Bohr|Hill|2,3-BPG/i);
 assert.equal(requests.some(u=>/HemoglobinTransitionLab|2DN1|2DN2/.test(u)),false,'T↔R chunk and structures must not load at start');
 check('Seven completed modules; Chapter 3 lists Quaternary Structure and T ↔ R; the T↔R chunk, 2DN2 and 2DN1 are not requested at start');

 await nav.getByRole('button',{name:/T ↔ R Structural Transition/}).click();await tv().locator('canvas').waitFor();await settle();
 const loaded=requests.filter(u=>/HemoglobinTransitionLab|2DN1|2DN2/.test(u));
 assert.ok(loaded.some(u=>/HemoglobinTransitionLab/.test(u))&&loaded.some(u=>/2DN2.*\.pdb/.test(u))&&loaded.some(u=>/2DN1.*\.pdb/.test(u)),'chunk + both assets on demand');
 assert.ok(loaded.every(u=>u.startsWith('http://127.0.0.1:4173/')));assert.equal(requests.some(u=>/rcsb|wwpdb|ebi\.ac\.uk/i.test(u)),false);
 assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('canvas').count(),1);
 for(const [k,v] of [['state','overlay'],['layers','T,R'],['highlight','all'],['heme','on'],['ligand','on'],['interface','off'],['guide','off'],['camera-preset','tetramer']])assert.equal(await data(k),v,k);
 assert.equal(await page.getByTestId('reference-rmsd').locator('strong').innerText(),`${audit.reference.rmsd.toFixed(2)} Å`);
 assert.equal(await page.getByTestId('moving-rotation').locator('strong').innerText(),`${audit.moving.angle.toFixed(1)}°`);
 assert.match(await page.getByTestId('reference-rmsd').innerText(),new RegExp(`Cα ${audit.reference.matched}개`));
 assert.match(await page.locator('.module-heading').innerText(),/O₂가 결합한 hemoglobin은 같은 구조에 O₂만 더해진 것일까/);
 assert.match(await page.getByTestId('science-note').innerText(),/T와 R은 hemoglobin의 주요 quaternary conformational states를 설명하는 유용한 모델입니다[\s\S]*여러 conformational states를 점유할 수 있습니다[\s\S]*O₂를 전혀 결합하지 못한다거나/);
 assert.ok(await page.getByTestId('morph-warning').isVisible());
 assert.match(await page.getByTestId('morph-warning').innerText(),/Morph = visual interpolation, not a molecular trajectory\.[\s\S]*두 실험 구조 사이의 시각적 보간입니다\. 실제 원자 이동 경로나 반응속도를 의미하지 않습니다\./);
 assert.equal(await page.getByTestId('tr-observation').evaluate(e=>e.open),false);
 assert.match(await page.getByTestId('tr-tip').innerText(),/Overlay: one αβ dimer \(α1β1\) is aligned so the quaternary rearrangement of the other \(α2β2\) can be seen/);
 assert.equal(await tv().locator('.dimer-label:not([hidden])').count(),2);
 check(`Loads on demand (same-origin assets only): Overlay default, RMSD ${audit.reference.rmsd.toFixed(2)} Å and rotation ${audit.moving.angle.toFixed(1)}° equal the audit; scientific note and morph disclaimer visible; answers collapsed`);
 const init=await shot();await page.screenshot({path:'artifacts/phase4b-hb-overlay.png',fullPage:false});

 await tv().locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');await settle();
 const cam=await camera(),images={};
 for(const [label,state,layers] of [['T state','T','T'],['R state','R','R'],['Overlay','overlay','T,R'],['Morph','morph','morph']]){
  await button(label).click();await settle();
  assert.equal(await data('state'),state);assert.equal(await data('layers'),layers);assert.deepEqual(await camera(),cam,`camera kept for ${state}`);
  images[state]=await shot();
 }
 assert.notDeepEqual(images.T,images.R);assert.notDeepEqual(images.T,images.overlay);assert.notDeepEqual(images.R,images.overlay);
 check('T / R / Overlay / Morph switch the drawn layers while the camera direction, distance and target stay exactly the same');

 await button('T state').click();await settle();
 near(await data('sample-position'),audit.samples.T.position);assert.equal(await data('sample-atom'),audit.samples.T.atom);
 assert.equal(await data('visible-ligands'),'0');assert.match(await page.getByTestId('tr-tip').innerText(),/T-like state \(PDB 2DN2, deoxy\): subunits are arranged in one quaternary configuration[\s\S]*deposited O₂가 없으므로 ligand를 그리지 않습니다/);
 assert.match(await page.getByTestId('tr-legend').innerText(),/T-like · 2DN2 \(deoxy\)/);assert.doesNotMatch(await page.getByTestId('tr-legend').innerText(),/R-like|O₂/);
 await button('Tetramer view').click();await settle();await page.screenshot({path:'artifacts/phase4b-hb-t.png'});
 await button('R state').click();await settle();
 near(await data('sample-position'),audit.samples.R.position);assert.equal(await data('sample-atom'),audit.samples.R.atom);
 assert.equal(await data('visible-ligands'),'4');assert.match(await page.getByTestId('tr-tip').innerText(),/R-like state \(PDB 2DN1, O₂ bound\): the relative arrangement of the αβ dimers is different/);
 assert.match(await page.getByTestId('tr-legend').innerText(),/R-like · 2DN1 \(O₂ bound, aligned on α1β1\)[\s\S]*O₂ \(deposited in 2DN1\)/);
 await page.screenshot({path:'artifacts/phase4b-hb-r.png'});
 const withLigand=await shot();await checkbox('Ligand (O₂)').uncheck();await settle();assert.equal(await data('visible-ligands'),'0');assert.notDeepEqual(await shot(),withLigand);
 await checkbox('Ligand (O₂)').check();await settle();assert.deepEqual(await shot(),withLigand);
 check(`T endpoint draws deposited 2DN2 coordinates (${audit.samples.T.atom}) with no ligand; R endpoint draws 2DN1 aligned coordinates with 4 deposited O₂; ligand toggle removes and restores them exactly`);

 await button('Overlay').click();await settle();
 const overlay=await shot();
 for(const [label,value] of [['Reference αβ dimer','reference'],['Moving αβ dimer','moving']]){
  await button(label).click();await settle();assert.equal(await data('highlight'),value);assert.notDeepEqual(await shot(),overlay);
  const faded=await tv().locator('.dimer-label.faded').allInnerTexts();assert.deepEqual(faded,[value==='reference'?'α2β2 · moving dimer':'α1β1 · reference dimer']);
 }
 await checkbox('Rearrangement guide').check();await settle();assert.equal(await data('guide'),'on');
 assert.match(await page.getByTestId('guide-note').innerText(),/relative structural difference after alignment[\s\S]*원자 궤적이 아닙니다/);
 assert.match(await page.getByTestId('guide-note').innerText(),new RegExp(`${audit.moving.angle.toFixed(1)}°[\\s\\S]*${audit.moving.centroidDisplacement.toFixed(1)} Å`));
 await button('Dimer comparison view').click();await settle();
 assert.equal(await data('camera-preset'),'dimer');near(await data('camera-direction'),audit.camera.dimerDirection,2e-4);
 await page.screenshot({path:'artifacts/phase4b-hb-moving-dimer.png'});
 await button('Whole tetramer').click();await checkbox('Rearrangement guide').uncheck();await settle();
 check(`Reference / moving dimer highlight fade the other dimer (3D labels follow); guide shows the calculated ${audit.moving.angle.toFixed(1)}° and ${audit.moving.centroidDisplacement.toFixed(1)} Å with its "not a trajectory" note; Dimer comparison view looks down the calculated rotation axis`);

 await checkbox('Interface').check();await settle();assert.equal(await data('interface'),'on');assert.match(await page.getByTestId('tr-tip').innerText(),/heavy atom ≤ 4\.0 Å/);
 const ifImage=await shot();await checkbox('Interface').uncheck();await settle();assert.notDeepEqual(ifImage,await shot());
 await checkbox('Heme').uncheck();await settle();assert.equal(await data('heme'),'off');assert.doesNotMatch(await page.getByTestId('tr-legend').innerText(),/Heme/);
 await checkbox('Heme').check();await button('Tetramer view').click();await settle();
 check('Interface emphasis and Heme toggle change the rendering and legend');

 await button('Morph').click();await morph(0);const m0=await shot();
 assert.equal(await data('fraction'),'0.00');near(await data('sample-position'),audit.samples.morph.t);
 await morph(50);assert.equal(await data('state'),'morph');assert.equal(await data('fraction'),'0.50');assert.equal(await page.getByTestId('morph-value').innerText(),'50%');
 near(await data('sample-position'),audit.samples.morph.mid);assert.equal(await data('visible-ligands'),'0');
 assert.match(await page.getByTestId('state-badge').innerText(),/MORPH 50%/);
 await button('Moving αβ dimer').click();await settle();await page.screenshot({path:'artifacts/phase4b-hb-morph-midpoint.png'});await button('Whole tetramer').click();await settle();
 await morph(100);near(await data('sample-position'),audit.samples.morph.r);assert.equal(await data('visible-ligands'),'4');
 await morph(37);await morph(0);assert.deepEqual(await shot(),m0);near(await data('sample-position'),audit.samples.morph.t);
 assert.ok(await page.getByTestId('morph-warning').isVisible());
 await button('R state').click();await settle();assert.equal(await page.getByTestId('morph-value').innerText(),'100%');
 await morph(20);assert.equal(await data('state'),'morph');
 check('Morph slider: 0% = T coordinates, 50% = pair midpoint, 100% = aligned R coordinates (O₂ only at 100%); back to 0% restores the identical image; disclaimer always visible');

 for(const h of audit.hemes.t){
  const r=audit.hemes.r.find(x=>x.number===h.number);
  await page.getByTestId('tr-heme-list').getByRole('button',{name:new RegExp(`^Heme ${h.number} · ${h.label}`)}).click();await settle();
  assert.equal(await data('camera-preset'),'heme');assert.equal(await data('heme-focus'),String(h.number));
  assert.equal(await page.getByTestId('fe-his-t').innerText(),`${h.feHis.toFixed(2)} Å`);assert.equal(await page.getByTestId('fe-his-r').innerText(),`${r.feHis.toFixed(2)} Å`);
  const s=v=>`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)} Å`;
  assert.equal(await page.getByTestId('fe-plane-t').innerText(),s(h.feFromPorphyrin));assert.equal(await page.getByTestId('fe-plane-r').innerText(),s(r.feFromPorphyrin));
  assert.equal(await page.getByTestId('ligand-r').innerText(),`O₂ · Fe–O1 ${r.ligand.feDistance.toFixed(2)} Å`);
 }
 const feTarget=audit.endpoints.T.subunits.find(s=>s.heme.number===4);assert.ok(feTarget);
 check(`Heme 1–4: Fe–His NE2 (T ${audit.hemes.t.map(h=>h.feHis.toFixed(2)).join('/')}; R ${audit.hemes.r.map(h=>h.feHis.toFixed(2)).join('/')} Å), Fe–porphyrin plane and Fe–O₂ equal the audit`);

 const dirBefore=await data('camera-direction');await tv().locator('canvas').focus();await page.keyboard.press('ArrowLeft');await settle();const turned=await data('camera-direction');assert.notEqual(turned,dirBefore);
 await button('Fit').click();await settle();near(await data('camera-direction'),turned.split(',').map(Number),2e-5);
 check('Keyboard rotation; Fit refits while keeping the view direction');

 await button('전체 초기화').click();await settle();
 for(const [k,v] of [['state','overlay'],['highlight','all'],['heme','on'],['ligand','on'],['interface','off'],['guide','off'],['camera-preset','tetramer'],['heme-focus','']])assert.equal(await data(k),v,k);
 assert.deepEqual(await shot(),init);
 await page.getByText('관찰 후 확인하기').click();
 assert.equal(await page.getByTestId('contacts-t').innerText(),String(audit.contacts.t));assert.equal(await page.getByTestId('contacts-r').innerText(),String(audit.contacts.r));
 assert.equal(await page.getByTestId('moving-displacement').innerText(),`${audit.moving.centroidDisplacement.toFixed(1)} Å`);
 for(const c of audit.correspondence){const cells=await page.getByTestId(`tr-mapping-${c.label}`).locator('th,td').allInnerTexts();assert.deepEqual(cells,[c.label,c.tChain,c.rChain===c.rSourceChain?c.rChain:`${c.rChain} (copy of ${c.rSourceChain})`,c.type==='alpha'?'α-globin':'β-globin',`${c.tModeled} / ${c.rModeled}`]);}
 const text=await main().innerText();
 assert.doesNotMatch(text,/cooperativ|Hill coefficient|Bohr|2,3-BPG|sickle|Glu6Val|HbS|oxygen-binding curve|saturation curve/i);
 assert.doesNotMatch(text,/O₂-bound structure.*2DN3|carbonmonoxy|CO-bound/i);
 check(`Full reset restores the exact initial rendering and defaults; collapsed check shows contacts T ${audit.contacts.t} / R ${audit.contacts.r}, displacement and the audited T↔R chain table; no out-of-scope topics`);

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(300);
  await button('Moving αβ dimer').click();await checkbox('Rearrangement guide').check();await morph(50);await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  const v=await tv().boundingBox();assert.ok(v.width>=width-60&&v.height>=300,`viewer ${v.width}x${v.height} at ${width}`);
  for(const sel of ['.tr-controls','.tr-panel','[data-testid="morph-control"]','[data-testid="tr-legend"]','#morph']){const c=await page.locator(sel).boundingBox();assert.ok(c.x>=0&&c.x+c.width<=width+0.5,`${sel} wider than ${width}`);}
  for(const group of ['State','Highlight'])for(const b of await page.getByRole('group',{name:group}).getByRole('button').all()){const r=await b.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width,`${group} button outside at ${width}`);}
  const slider=await page.locator('#morph').boundingBox();assert.ok(slider.width>=(width-48)*0.9,`slider width ${slider.width} at ${width}`);
  await page.locator('#morph').fill('80');await settle();assert.equal(await data('fraction'),'0.80');
  if(width===390)await page.screenshot({path:'artifacts/phase4b-hb-mobile.png',fullPage:true});
  await button('전체 초기화').click();
  check(`${width}px: no horizontal overflow; State/Highlight buttons, legend and morph slider inside the screen; viewer ≥300 px tall; slider operable`);
 }
 await page.setViewportSize({width:1440,height:1100});
 for(let i=0;i<3;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);
  await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await page.getByTestId('membrane-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),2);
  await nav.getByRole('button',{name:/Hemoglobin Quaternary/}).click();await page.getByTestId('hb-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);
  await nav.getByRole('button',{name:/T ↔ R/}).click();await tv().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);assert.equal(await data('layers'),'T,R');
 }
 check('Repeated navigation through all seven modules keeps each working and disposes viewers');
 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase4b-browser-results.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

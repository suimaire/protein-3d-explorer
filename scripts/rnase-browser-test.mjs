import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import './rnase-audit.mjs';import {openLab} from './additions-browser-utils.mjs';
const audit=JSON.parse(await readFile('artifacts/protein-additions/rnase-audit.json','utf8'));
const {browser,page,nav,errors,failedRequests,check,settle,save}=await openLab(null);
const button=name=>page.getByRole('button',{name,exact:true}),viewer=()=>page.getByTestId('rnase-viewer'),schematic=()=>page.getByTestId('rnase-schematic');
try{
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('7RSA'))),false);
 const names=await nav.getByRole('button').allInnerTexts();assert.equal(names.length,11);assert.match(names[3],/Hydrophobic Core/);assert.match(names[4],/Disulfide Bonds/);assert.match(names[5],/Soluble vs Membrane/);
 await nav.getByRole('button',{name:/Disulfide Bonds/}).click();await viewer().locator('canvas').waitFor();await settle();
 assert.match(await page.getByTestId('rnase-evidence').innerText(),/실험 구조/);assert.equal(await viewer().getAttribute('data-representation'),'ribbon');
 check('Only B adds a chapter entry; 7RSA lazy loads as the experimental ribbon');
 for(const [i,p] of audit.disulfides.entries()){
  await page.getByRole('button',{name:new RegExp('^'+(i+1)+' · '+p.label)}).click();await settle();
  assert.match(await page.getByTestId('rnase-distance').innerText(),new RegExp(p.distance.toFixed(3)));
  assert.equal(await page.locator('.sequence-strip [data-mark="A"]').getAttribute('data-residue-index'),String(p.a));
  assert.equal(await page.locator('.sequence-strip [data-mark="B"]').getAttribute('data-residue-index'),String(p.b));
 }
 await button('선택한 결합 확대').click();await settle();await page.screenshot({path:'artifacts/protein-additions/b-native-bond.png',fullPage:true});
 check('Four measured native S–S pairs, actual SG labels, A/B sequence synchronization and focus');
 const toggle=page.getByRole('checkbox',{name:'이황화 결합 표시'});
 await toggle.uncheck();await settle();assert.equal(await viewer().getAttribute('data-guide-atoms'),'');assert.equal(await page.locator('main').getAttribute('data-condition'),'native');
 await toggle.check();check('Visibility alone does not reduce bonds');
 await button('2 · 변성·환원과 조건 복원').click();await button('변성제 + 환원제 처리').click();await schematic().locator('canvas').waitFor();await settle();
 assert.match(await page.getByTestId('rnase-evidence').innerText(),/SCHEMATIC/);assert.equal(await schematic().getAttribute('data-peptide-edges'),'123');assert.equal((await schematic().getAttribute('data-sequence-order')).split(',').length,124);
 assert.equal(await schematic().getAttribute('data-crosslinks'),'');assert.doesNotMatch(await page.getByTestId('rnase-facts').innerText(),/Å|%/);assert.equal(await page.getByTestId('rnase-distance').count(),0);
 await schematic().scrollIntoViewIfNeeded();const before=await schematic().getAttribute('data-camera-direction');await schematic().locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await schematic().getAttribute('data-camera-direction'),before);
 check('Reduced state is a rotatable unitless residue schematic with complete sequence and peptide edges');
 await button('변성 조건에서 먼저 산화').click();await settle();const links=await schematic().getAttribute('data-crosslinks');assert.equal(links.split(',').length,4);
 await toggle.uncheck();assert.equal(await schematic().getAttribute('data-crosslinks'),links);assert.equal(await schematic().getAttribute('data-bonds-visible'),'false');
 await toggle.check();await page.screenshot({path:'artifacts/protein-additions/b-scrambled.png',fullPage:true});
 await button('요소 제거 후 이황화 교환 조건 제공').click();await viewer().locator('canvas').waitFor();await settle();assert.match(await page.getByTestId('rnase-evidence').innerText(),/기준 좌표 재사용/);assert.equal(await page.locator('main').getAttribute('data-condition'),'exchanged');
 await button('재접힘 조건에서 재산화').click();assert.match(await page.getByTestId('rnase-evidence').innerText(),/기준 좌표 재사용/);
 check('Scrambled topology, independent visibility, exchange recovery and explicit reference-coordinate reuse');
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});await button('변성 조건에서 먼저 산화').click();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok((await schematic().boundingBox()).height>=300);
  await page.screenshot({path:'artifacts/protein-additions/b-'+width+'.png',fullPage:true});
  await button('천연 상태').click();await viewer().locator('canvas').waitFor();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);check(width+'px experimental/schematic layout and full canvas');
 }
 await button('전체 초기화').click();await settle();assert.equal(await page.locator('main').getAttribute('data-condition'),'native');assert.equal(await toggle.isChecked(),true);assert.equal(await button('1 · 천연 구조에서 연결 찾기').getAttribute('aria-pressed'),'true');
 for(let i=0;i<3;i++){await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();await nav.getByRole('button',{name:/Disulfide Bonds/}).click();await viewer().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);}
 check('Reset and repeated mounting dispose old native/schematic scenes');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);check('No console, page or asset errors');await save('b-browser-results');
}finally{await browser.close();}

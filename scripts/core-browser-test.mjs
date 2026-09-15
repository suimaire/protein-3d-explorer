import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./core-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/core-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=n=>checks.push(n),button=name=>page.getByRole('button',{name,exact:true}),viewer=()=>page.getByTestId('protein-viewer'),canvas=()=>page.locator('canvas'),shot=()=>canvas().screenshot();
const data=async key=>viewer().getAttribute(`data-${key}`),settle=()=>page.waitForTimeout(120);
const byNumber=n=>audit.residues.find(r=>r.resSeq===n);
const pct=r=>r.relative>=1?'≥100%':`${Math.round(r.relative*100)}%`;
const numbers=g=>audit.groups[g].residues.map(s=>Number(s.replace(/^[A-Z]+/,''))).sort((a,b)=>a-b).join(',');
try{
 await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});assert.equal(await nav.getByRole('button').count(),5);
 assert.deepEqual(await nav.getByRole('button').allInnerTexts(),['Chapter 1 · Amino Acid & Peptide\nPeptide Geometry','Chapter 2 · From Sequence to Structure\nα-Helix','Chapter 2 · From Sequence to Structure\nβ-Sheet','Chapter 2 · From Sequence to Structure\nHydrophobic Core','Chapter 2 · From Sequence to Structure\nSoluble vs Membrane Protein']);
 await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await canvas().waitFor();await settle();assert.equal(await page.getByRole('alert').count(),0);
 assert.equal(await data('representation'),'ribbon');assert.equal(await data('color'),'default');assert.equal(await data('clip'),'off');assert.equal((await data('highlighted')).split(',').length,76);
 assert.match(await page.getByTestId('structure-source').textContent(),/1UBQ, X-ray diffraction, 1\.8 Å, chain A, 602 heavy atoms/);
 check('Five completed modules; Hydrophobic Core loads 1UBQ chain A in WebGL (ribbon, default, all 76)');
 const initial=await shot();
 await page.getByText('관찰 후 확인하기 · 이 구조에서 관찰된 분포').waitFor();assert.equal(await page.getByTestId('composition').evaluate(e=>e.open),false);check('Observed composition is collapsed until the student opens it');

 let before=initial;
 for(const [label,value] of [['Atoms / sticks','atoms'],['Space filling','spacefill'],['Ribbon','ribbon']]){await button(label).click();await settle();assert.equal(await data('representation'),value);const now=await shot();assert.notDeepEqual(now,before);before=now;}
 check('Ribbon, Atoms / sticks and Space filling each change rendering');
 await button('Chemistry').click();await settle();assert.equal(await data('color'),'chemistry');assert.notDeepEqual(await shot(),before);
 const legend=await page.getByTestId('color-legend').innerText();for(const t of ['■ Nonpolar','● Polar, uncharged','▲ Acidic','◆ Basic'])assert.ok(legend.includes(t),t);
 await page.screenshot({path:'artifacts/phase3a-hydrophobic-core.png',fullPage:true});
 const chem=await shot();await button('Exposure').click();await settle();assert.notDeepEqual(await shot(),chem);assert.match(await page.getByTestId('color-legend').innerText(),/more buried[\s\S]*more exposed/);
 await button('Chemistry').click();check('Color by chemistry (label + color + symbol legend) and color by exposure');

 await button('Space filling').click();await button('More buried 25%').click();await settle();
 assert.equal(await data('highlighted'),numbers('buried'));assert.equal(await page.locator('main').getAttribute('data-group'),'buried');
 await page.screenshot({path:'artifacts/phase3a-buried.png',fullPage:true});check('More buried 25% highlights exactly the audit rank group');
 await canvas().scrollIntoViewIfNeeded();const box=await canvas().boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await settle();
 const picked=Number(await data('selected-residue'));assert.ok(numbers('buried').split(',').map(Number).includes(picked),`picked ${picked}`);
 const pr=byNumber(picked),title=pr.resName[0]+pr.resName.slice(1).toLowerCase()+' '+picked;
 assert.equal(await page.locator('.residue-title').innerText(),title);assert.equal(await page.getByRole('combobox',{name:'Select residue'}).inputValue(),String(pr.index));
 assert.match(await page.getByTestId('residue-location').innerText(),/가장 묻힌 19개/);check(`3D click picks a rendered buried residue (${title}) and syncs panel/selector`);

 await button('More exposed 25%').click();await settle();assert.equal(await data('highlighted'),numbers('exposed'));
 await page.getByRole('combobox',{name:'Select residue'}).selectOption('');await button('Ribbon').click();await settle();
 await page.screenshot({path:'artifacts/phase3a-exposed.png',fullPage:true});check('More exposed 25% highlights exactly the audit rank group');
 await button('All').click();

 for(const n of [8,41,43,16,68,76]){
  const r=byNumber(n);await page.getByRole('combobox',{name:'Select residue'}).selectOption(String(r.index));await settle();
  assert.equal(await data('selected-residue'),String(n));
  assert.equal(await page.getByTestId('residue-exposure').locator('strong').innerText(),pct(r));
  const cls={nonpolar:'Nonpolar',polar:'Polar, uncharged',acidic:'Acidic',basic:'Basic'}[r.chemical];assert.ok((await page.getByTestId('residue-class').innerText()).includes(cls));
  assert.ok((await page.getByTestId('residue-location').innerText()).includes(`노출 순위 ${r.rank} / 76`));
  const colors={nonpolar:'#c98e1c',polar:'#23927f',acidic:'#c8382b',basic:'#2f64c0'};assert.equal(await data('selected-color'),colors[r.chemical]);
 }
 assert.match(await page.getByTestId('residue-info').innerText(),/100%를 넘을 수 있습니다[\s\S]*Occupancy 0\.25/);
 await page.getByRole('combobox',{name:'Select residue'}).selectOption(String(byNumber(68).index));assert.match(await page.getByTestId('residue-info').innerText(),/항상 \+1은 아닙니다/);
 check('Residue info (name, class, exposure %, rank, caveats) and chemistry color mapping match audit for Leu8/Gln41/Leu43/Glu16/His68/Gly76');

 const toggle=page.getByRole('checkbox',{name:'단면 보기'}),slider=page.getByRole('slider',{name:'Clipping depth'});
 await button('Space filling').click();await settle();const unclipped=await shot();
 assert.equal(await slider.isDisabled(),true);await toggle.check();await settle();assert.equal(await data('clip'),'0.50');const half=await shot();assert.notDeepEqual(half,unclipped);
 await page.screenshot({path:'artifacts/phase3a-cross-section.png',fullPage:true});
 await slider.fill('80');await settle();assert.equal(await data('clip'),'0.80');assert.notDeepEqual(await shot(),half);
 await button('단면 초기화').click();await settle();assert.equal(await data('clip'),'off');assert.equal(await toggle.isChecked(),false);assert.deepEqual(await shot(),unclipped);
 check('Visual clipping toggle, depth slider and reset (rendering restored exactly)');

 await page.getByText('관찰 후 확인하기 · 이 구조에서 관찰된 분포').click();
 for(const g of ['buried','exposed']){const c=audit.groups[g].composition,cells=await page.getByTestId(`composition-${g}`).locator('td').allInnerTexts();assert.deepEqual(cells.map(t=>Number(t.split(' ')[0])),[c.nonpolar,c.polar,c.acidic,c.basic]);}
 assert.match(await page.getByTestId('composition').innerText(),/보편적 비율이 아닙니다[\s\S]*예외가 존재합니다/);
 await page.getByRole('button',{name:/표면의 nonpolar · Leu 8/}).click();await settle();assert.equal(await data('selected-residue'),'8');assert.equal(await page.locator('main').getAttribute('data-group'),'exposed');assert.equal(await data('color'),'chemistry');
 await page.getByRole('button',{name:/내부의 polar · Gln 41/}).click();await settle();assert.equal(await data('selected-residue'),'41');assert.equal(await page.locator('main').getAttribute('data-group'),'buried');
 assert.match(await page.getByTestId('polar-contacts').innerText(),/Ile 36 O 2\.97 Å · Lys 27 O 3\.04 Å[\s\S]*H-bond로 판정하지 않습니다/);
 check('Composition table matches audit; exposed-nonpolar (Leu8) and buried-polar (Gln41) exceptions navigate correctly');

 await button('전체 초기화').click();await settle();assert.deepEqual(await shot(),initial);check('Full reset restores all state and exact initial rendering');
 await canvas().focus();await page.keyboard.press('ArrowRight');await settle();assert.notDeepEqual(await shot(),initial);
 await page.keyboard.press('+');const zoom=await data('camera-distance'),dir=await data('camera-direction');
 await button('Fit structure').click();await settle();assert.notEqual(await data('camera-distance'),zoom);const fitted=(await data('camera-direction')).split(',').map(Number);assert.ok(dir.split(',').every((v,i)=>Math.abs(Number(v)-fitted[i])<1e-5));
 check('Keyboard rotation/zoom; Fit preserves viewing direction');
 await button('Reset camera').click();await settle();assert.deepEqual(await shot(),initial);
 await canvas().scrollIntoViewIfNeeded();const drag=await canvas().boundingBox();await page.mouse.move(drag.x+drag.width/2,drag.y+drag.height/2);await page.mouse.down();await page.mouse.move(drag.x+drag.width/2+80,drag.y+drag.height/2+40,{steps:8});await page.mouse.up();await settle();
 assert.notDeepEqual(await shot(),initial);assert.equal(await data('selected-residue'),'');
 const beforeWheel=await data('camera-distance');await canvas().hover();await page.mouse.wheel(0,-300);await page.waitForTimeout(150);assert.notEqual(await data('camera-distance'),beforeWheel);
 await button('Reset camera').click();await settle();assert.deepEqual(await shot(),initial);
 check('Mouse orbit (drag does not select), wheel zoom and Reset camera');

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(200);
  await button('Space filling').click();await button('Chemistry').click();await button('More buried 25%').click();await page.getByRole('combobox',{name:'Select residue'}).selectOption(String(byNumber(41).index));await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const v=await viewer().boundingBox();assert.ok(v.width>=width-60&&v.height>=300);
  for(const sel of ['.camera-presets','.viewer-footer','.core-controls']){const b=await page.locator(sel).boundingBox();assert.ok(b.y>=v.y+v.height||b.y+b.height<=v.y,`${sel} overlaps viewer at ${width}`);}
  for(const sel of ['[data-testid=residue-info]','.residue-panel','.core-controls']){const b=await page.locator(sel).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width,`${sel} wider than ${width}px`);}
  await page.mouse.click(v.x+v.width/2,v.y+v.height/2);await settle();assert.notEqual(await data('selected-residue'),'');
  await page.screenshot({path:`artifacts/phase3a-mobile-${width}.png`,fullPage:true});
  await button('전체 초기화').click();
  check(`${width}px: no horizontal overflow, controls outside viewer, residue info readable, tap selection works`);
 }
 await page.setViewportSize({width:1440,height:1100});
 for(let i=0;i<3;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await canvas().waitFor();assert.equal(await data('representation'),'ribbon');
 }
 assert.equal(await canvas().count(),1);check('Repeated navigation retains Peptide/α-Helix/β-Sheet functionality and disposes viewers');
 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase3a-browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

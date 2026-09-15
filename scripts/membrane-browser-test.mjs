import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./membrane-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/membrane-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const check=n=>checks.push(n),button=name=>page.getByRole('button',{name,exact:true}),settle=()=>page.waitForTimeout(150);
const sv=()=>page.getByTestId('soluble-viewer'),mv=()=>page.getByTestId('membrane-viewer'),shot=v=>v.locator('canvas').screenshot();
const data=async(v,key)=>v.getAttribute(`data-${key}`);
const byNumber=n=>audit.residues.find(r=>r.resSeq===n);
const pct=r=>r.relative>=1?'≥100%':`${Math.round(r.relative*100)}%`;
const depth=z=>`${z>=0?'+':'−'}${Math.abs(z).toFixed(1)} Å`;
const numbers=list=>list.map(s=>Number(s.replace(/^[A-Za-z]+/,''))).sort((a,b)=>a-b).join(',');

const select=page.getByRole('combobox',{name:'Select residue'});
try{
 await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
 assert.equal(requests.some(u=>/SolubleMembraneLab|ubiquitin/.test(u)),false,'membrane module must not load initially');
 const nav=page.getByRole('navigation',{name:'학습 모듈'});assert.equal(await nav.getByRole('button').count(),5);
 assert.deepEqual(await nav.getByRole('button').allInnerTexts(),['Chapter 1 · Amino Acid & Peptide\nPeptide Geometry','Chapter 2 · From Sequence to Structure\nα-Helix','Chapter 2 · From Sequence to Structure\nβ-Sheet','Chapter 2 · From Sequence to Structure\nHydrophobic Core','Chapter 2 · From Sequence to Structure\nSoluble vs Membrane Protein']);
 check('Initial Peptide Geometry load does not request the membrane module chunk (lazy); five completed modules');
 await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await mv().locator('canvas').waitFor();await sv().locator('canvas').waitFor();await settle();
 assert.ok(requests.some(u=>/SolubleMembraneLab/.test(u)),'chunk loaded on demand');assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('canvas').count(),2);
 for(const v of [sv(),mv()]){assert.equal(await data(v,'representation'),'ribbon');assert.equal(await data(v,'color'),'default');}
 assert.equal(await data(mv(),'membrane'),'off');assert.equal(await data(sv(),'membrane'),null);assert.equal(await data(mv(),'slab-half-thickness'),'11.80');
 assert.equal((await data(sv(),'highlighted')).split(',').length,76);assert.equal((await data(mv(),'highlighted')).split(',').length,148);
 assert.match(await page.getByTestId('structure-source').textContent(),/1QJ8, X-ray diffraction, 1\.9 Å, chain A, 1158 heavy atoms/);
 assert.equal(await page.getByTestId('composition').evaluate(e=>e.open),false);
 assert.doesNotMatch(await page.locator('main').innerText(),/Hydrophobic residues can face the lipid bilayer/,'conclusion must stay hidden until opened');
 check('Module loads on demand: ubiquitin + OmpX viewers in WebGL, ribbon/default, membrane hidden, slab ±11.80 Å; conclusion collapsed');
 const init={s:await shot(sv()),m:await shot(mv())};

 let before=init.m;
 for(const [label,value] of [['Atoms / sticks','atoms'],['Space filling','spacefill'],['Ribbon','ribbon']]){await button(label).click();await settle();for(const v of [sv(),mv()])assert.equal(await data(v,'representation'),value);const now=await shot(mv());assert.notDeepEqual(now,before);before=now;}
 check('Representation control switches both viewers together (ribbon / atoms / space filling)');
 await button('Chemistry').click();await settle();for(const v of [sv(),mv()])assert.equal(await data(v,'color'),'chemistry');
 const legend=await page.getByTestId('color-legend').innerText();for(const t of ['■ Nonpolar','● Polar, uncharged','▲ Acidic','◆ Basic','두 구조 같은 색 기준'])assert.ok(legend.includes(t),t);
 check('One Chemistry control colors both proteins with one shared legend');

 const noSlab=await shot(mv());const toggle=page.getByRole('checkbox',{name:'Show membrane'});
 await toggle.check();await settle();assert.equal(await data(mv(),'membrane'),'on');const withSlab=await shot(mv());assert.notDeepEqual(withSlab,noSlab);
 assert.equal(await mv().locator('.slab-label:not([hidden])').count(),3);assert.match(await mv().locator('.slab-label').allInnerTexts().then(t=>t.join('|')),/Side A \(\+z\)[\s\S]*Hydrophobic region 23\.6 Å[\s\S]*Side B/);
 await toggle.uncheck();await settle();assert.equal(await data(mv(),'membrane'),'off');assert.deepEqual(await shot(mv()),noSlab);await toggle.check();await settle();
 check('Show membrane draws the OPM slab (labels Side A / 23.6 Å / Side B) and hiding restores the exact image');
 await button('Space filling').click();await settle();
 await page.screenshot({path:'artifacts/phase3b-soluble-vs-membrane.png',fullPage:true});
 await mv().screenshot({path:'artifacts/phase3b-membrane-chemistry.png'});

 const modes=[['Surface','surface',audit.groups.surface.residues,audit.ubiquitin.surfaceResidues],['Buried','buried',audit.groups.buried.residues,null],['Lipid-facing','lipid',audit.groups.lipidFacing.residues,[]],['Aqueous-facing','aqueous',audit.groups.aqueousFacing.residues,audit.ubiquitin.surfaceResidues]];
 for(const [label,mode,membraneList,ubqList] of modes){
  await button(label).click();await settle();assert.equal(await page.locator('main').getAttribute('data-highlight'),mode);
  assert.equal(await data(mv(),'highlighted'),numbers(membraneList));
  if(ubqList)assert.equal(await data(sv(),'highlighted'),numbers(ubqList));
  assert.equal(await page.getByTestId('membrane-count').innerText(),`${membraneList.length} / 148 RESIDUES`);
  if(mode==='lipid'){assert.equal(await page.getByTestId('soluble-count').innerText(),'0 / 76 RESIDUES');await page.screenshot({path:'artifacts/phase3b-lipid-facing.png',fullPage:true});}
  if(mode==='aqueous')await page.screenshot({path:'artifacts/phase3b-aqueous-facing.png',fullPage:true});
 }
 check('Surface / Buried / Lipid-facing / Aqueous-facing highlight exactly the audit sets in both viewers (ubiquitin lipid-facing = 0)');

 await button('Lipid-facing').click();await button('Side view').click();await settle();
 await mv().scrollIntoViewIfNeeded();const box=await mv().locator('canvas').boundingBox();
 let picked='';for(const [dx,dy] of [[0,0],[-30,0],[30,0],[0,-30],[0,30],[-60,10],[60,-10]]){await page.mouse.click(box.x+box.width/2+dx,box.y+box.height/2+dy);await settle();picked=await data(mv(),'selected-residue');if(picked)break;}
 assert.ok(picked,'3D click selects an OmpX residue');const pr=byNumber(Number(picked));
 assert.equal(await page.getByTestId('residue-depth').locator('strong').innerText(),depth(pr.depth));assert.equal(await select.inputValue(),`membrane:${pr.index}`);
 check(`3D click on OmpX selects ${pr.resName}${pr.resSeq}; panel depth ${depth(pr.depth)} and selector sync`);

 const colors={nonpolar:'#c98e1c',polar:'#23927f',acidic:'#c8382b',basic:'#2f64c0'},cats={'lipid-facing':'Lipid-facing candidate','aqueous-facing':'Aqueous-facing surface',buried:'Buried (surface accessibility < 25%)'};
 await button('All').click();
 for(const n of [125,75,146,27,100,28]){
  const r=byNumber(n);await select.selectOption(`membrane:${r.index}`);await settle();
  assert.equal(await data(mv(),'selected-residue'),String(n));assert.equal(await data(sv(),'selected-residue'),'');
  assert.equal(await page.getByTestId('residue-accessibility').locator('strong').innerText(),pct(r));
  assert.equal(await page.getByTestId('residue-depth').locator('strong').innerText(),depth(r.depth));
  assert.ok((await page.getByTestId('residue-zone').innerText()).includes(r.zone==='membrane'?'region 안':r.zone==='sideA'?'Side A':'Side B'));
  assert.ok((await page.getByTestId('residue-category').innerText()).includes(cats[r.category]));
  assert.match(await page.getByTestId('residue-category').innerText(),/실제 지질 결합을 관찰한 것이 아닙니다/);
  assert.equal(await data(mv(),'selected-color'),colors[r.chemical]);
 }
 assert.match(await page.getByTestId('residue-info').innerText(),/Occupancy 0\.65/);
 await select.selectOption(`membrane:${byNumber(100).index}`);assert.match(await page.getByTestId('residue-info').innerText(),/His→Asn/);
 await select.selectOption(`membrane:${byNumber(146).index}`);assert.match(await page.getByTestId('residue-info').innerText(),/방향족 고리는 비극성/);
 await select.selectOption('soluble:7');await settle();assert.equal(await data(sv(),'selected-residue'),'8');assert.equal(await data(mv(),'selected-residue'),'');assert.match(await page.getByTestId('residue-zone').innerText(),/막 영역 없음/);
 assert.equal(await page.getByTestId('residue-depth').count(),0);
 assert.doesNotMatch(await page.locator('main').innerText(),/water exposure|물 노출도/i);
 check('Residue panel (class, surface accessibility, depth, region, lipid-facing criterion, caveats, altloc/mutation notes) matches audit for Phe125/Asp75/Tyr146/Lys27/Asn100/Tyr28; ubiquitin shows no membrane data');

 const dir=async v=>(await data(v,'camera-direction')).split(',').map(Number);
 await button('Top view').click();await settle();await mv().screenshot({path:'artifacts/phase3b-top-view.png'});let d=await dir(mv());assert.ok(d[1]>0.999,`top ${d}`);assert.equal(await mv().locator('.slab-label:not([hidden])').count(),0);assert.equal(await data(mv(),'camera-preset'),'top');
 await button('Side view').click();await settle();d=await dir(mv());assert.ok(Math.abs(d[1])<1e-6,`side ${d}`);
 await mv().locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await settle();const moved=await dir(mv()),dist=await data(mv(),'camera-distance');
 await page.getByRole('region',{name:'Membrane protein: OmpX'}).getByRole('button',{name:'Fit structure'}).click();await settle();const fitted=await dir(mv());assert.ok(moved.every((v,i)=>Math.abs(v-fitted[i])<1e-5));assert.notEqual(await data(mv(),'camera-distance'),dist);

 check('OmpX Side view (normal vertical), Top view (down the normal), Fit keeps direction; keyboard rotate/zoom');

 await page.getByText('관찰 후 확인하기 · 두 구조에서 관찰된 표면 chemistry').click();
 const rows={'ompx-lipid':audit.groups.lipidFacing.composition,'ompx-aqueous':audit.groups.aqueousFacing.composition,'ompx-buried':audit.groups.buried.composition,'ubq-surface':audit.ubiquitin.surface,'ubq-buried':audit.ubiquitin.buried};
 for(const [key,c] of Object.entries(rows)){const cells=await page.getByTestId(`composition-${key}`).locator('td').allInnerTexts();assert.deepEqual(cells.map(t=>Number(t.split(' ')[0])),[c.nonpolar,c.polar,c.acidic,c.basic,c.total]);}
 assert.match(await page.getByTestId('composition').innerText(),/Environment changes which surfaces are favorable/);
 await page.getByRole('button',{name:/막을 향한 polar \(예외\) · Tyr 146/}).click();await settle();assert.equal(await data(mv(),'selected-residue'),'146');assert.equal(await page.locator('main').getAttribute('data-highlight'),'lipid');assert.equal(await data(mv(),'membrane'),'on');
 await page.getByRole('button',{name:/barrel 안쪽을 향한 charged · Lys 27/}).click();await settle();assert.equal(await data(mv(),'selected-residue'),'27');assert.equal(await page.locator('main').getAttribute('data-highlight'),'buried');
 await page.getByRole('button',{name:/물 쪽 표면의 charged · Asp 75/}).click();await settle();assert.equal(await data(mv(),'selected-residue'),'75');
 await page.getByRole('button',{name:/막을 향한 nonpolar · Phe 125/}).click();await settle();assert.equal(await data(mv(),'selected-residue'),'125');
 check('Collapsed composition table equals audit for all five groups; data-derived residue buttons (Phe125, Asp75, Tyr146, Lys27) navigate');

 await button('전체 초기화').click();await settle();
 assert.deepEqual(await shot(sv()),init.s);assert.deepEqual(await shot(mv()),init.m);assert.equal(await data(mv(),'membrane'),'off');assert.equal(await page.getByTestId('composition').evaluate(e=>e.open),true);
 await sv().locator('canvas').focus();await page.keyboard.press('ArrowLeft');await settle();assert.notDeepEqual(await shot(sv()),init.s);
 await page.getByRole('region',{name:'Soluble protein: ubiquitin'}).getByRole('button',{name:'Reset camera'}).click();await settle();assert.deepEqual(await shot(sv()),init.s);
 check('Full reset restores both exact initial renderings; ubiquitin keeps its Reset camera behaviour');

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(250);
  await button('Space filling').click();await button('Chemistry').click();await page.getByRole('checkbox',{name:'Show membrane'}).check();await button('Lipid-facing').click();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  const a=await sv().boundingBox(),b=await mv().boundingBox();assert.ok(b.y>=a.y+a.height-1,'viewers stacked');assert.ok(a.width>=width-60&&b.width>=width-60&&b.height>=300);
  for(const sel of ['.compare-controls','.compare-legend','.residue-panel']){const c=await page.locator(sel).boundingBox();for(const v of [a,b])assert.ok(c.y>=v.y+v.height-1||c.y+c.height<=v.y+1,`${sel} overlaps viewer at ${width}`);assert.ok(c.x>=0&&c.x+c.width<=width,`${sel} wider than ${width}`);}
  await mv().scrollIntoViewIfNeeded();const mb=await mv().boundingBox();
  let tapped='';for(const dx of [0,-25,25,-50,50]){await page.mouse.click(mb.x+mb.width/2+dx,mb.y+mb.height/2);await settle();tapped=await data(mv(),'selected-residue');if(tapped)break;}
  assert.ok(tapped,`tap at ${width}`);
  if(width===390)await page.screenshot({path:'artifacts/phase3b-mobile.png',fullPage:true});
  await button('전체 초기화').click();
  check(`${width}px: viewers stacked vertically, no horizontal overflow, controls/legend/panel outside viewers, tap selection works`);
 }
 await page.setViewportSize({width:1440,height:1100});
 for(let i=0;i<3;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);
  await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await mv().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),2);assert.equal(await data(mv(),'representation'),'ribbon');
 }
 check('Repeated navigation through all five modules keeps them working and disposes viewers (1 or 2 canvases)');
 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase3b-browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

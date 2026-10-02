import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './sequence-space-audit.mjs';
import {openLab} from './additions-browser-utils.mjs';
const {examples}=JSON.parse(await readFile('artifacts/protein-additions/sequence-space-audit.json','utf8'));
const {browser,page,errors,failedRequests,check,settle,save}=await openLab(/Hydrophobic Core/);
const viewer=page.getByTestId('protein-viewer'),explorer=page.getByTestId('sequence-exploration'),button=name=>page.getByRole('button',{name,exact:true});
try{
 await viewer.locator('canvas').waitFor();await settle();
 assert.equal(await explorer.evaluate(e=>e.open),false);
 const initialHeight=(await viewer.boundingBox()).height;
 await explorer.locator('summary').first().click();await settle();
 assert.equal((await viewer.boundingBox()).height,initialHeight);check('Initially collapsed; expansion preserves original canvas height');
 for(const [i,p] of examples.entries()){
  const dir=await viewer.getAttribute('data-camera-direction'),target=await viewer.getAttribute('data-camera-target');
  await page.getByRole('button',{name:new RegExp('^예시 '+(i+1)+' ·')}).click();await settle();
  assert.equal(await page.getByTestId('pair-distance').innerText(),p.distance.toFixed(2)+' Å');
  assert.equal(await page.getByTestId('sequence-gap').locator('strong').innerText(),String(p.sequenceGap));
  assert.ok((await page.getByTestId('pair-atoms').innerText()).includes(p.atomLabelA));
  assert.ok((await page.getByTestId('pair-atoms').innerText()).includes(p.atomLabelB));
  assert.equal(await viewer.getAttribute('data-guide-atoms'),p.atomA+','+p.atomB);
  assert.equal(await page.getByRole('combobox',{name:'잔기 선택',exact:true}).inputValue(),String(p.a));
  assert.equal(await page.getByRole('combobox',{name:'B 비교 잔기',exact:true}).inputValue(),String(p.b));
  assert.equal(await viewer.getAttribute('data-camera-direction'),dir);assert.equal(await viewer.getAttribute('data-camera-target'),target);
 }
 check('All three examples match independently recorded coordinate/atom audit, selector and 3D guide; selection preserves camera');
 await button('두 잔기 함께 보기').click();await settle();
 await viewer.scrollIntoViewIfNeeded();const distance=await page.getByTestId('pair-distance').innerText();
 await viewer.locator('canvas').focus();await page.keyboard.press('ArrowRight');await settle();assert.equal(await page.getByTestId('pair-distance').innerText(),distance);
 await page.screenshot({path:'artifacts/protein-additions/a-desktop.png',fullPage:true});
 check('Explicit pair focus and rotation preserve measured distance');
 await button('B · 비교 상대').click();await explorer.locator('[data-residue-index="12"]').click();await settle();
 assert.equal(await page.getByRole('combobox',{name:'B 비교 잔기',exact:true}).inputValue(),'12');
 await page.getByRole('combobox',{name:'잔기 선택',exact:true}).selectOption('40');await settle();
 assert.equal(await explorer.locator('[data-residue-index="40"]').getAttribute('data-mark'),'A');
 assert.equal(await explorer.locator('[data-residue-index="12"]').getAttribute('data-mark'),'B');check('Sequence and existing dropdown share distinct A/B state');
 await button('공간 채움').click();await button('시점 초기화').click();await viewer.scrollIntoViewIfNeeded();await settle();
 const b=await viewer.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await settle();
 assert.notEqual(await page.getByRole('combobox',{name:'B 비교 잔기',exact:true}).inputValue(),'12');check('3D picking updates the active comparison target');
 await button('리본').click();
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.ok((await viewer.boundingBox()).height>=300);
  const strip=explorer.locator('.sequence-strip');await strip.locator('button').first().focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await settle();
  assert.equal(await page.getByRole('combobox',{name:'B 비교 잔기',exact:true}).inputValue(),'75');
  await page.screenshot({path:'artifacts/protein-additions/a-'+width+'.png',fullPage:true});
  check(width+'px no overflow, full canvas, keyboard sequence selection');
 }
 await button('전체 초기화').click();await settle();assert.equal(await explorer.evaluate(e=>e.open),false);assert.equal(await viewer.getAttribute('data-guide-atoms'),'');
 assert.equal(await viewer.getAttribute('data-selected-residue'),'');check('Whole reset clears comparison and closes exploration');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);check('No console, page or asset errors');await save('a-browser-results');
}finally{await browser.close();}

import assert from 'node:assert/strict';import {openLab} from './additions-browser-utils.mjs';
const {browser,page,nav,errors,failedRequests,check,settle,save}=await openLab(null,{viewport:{width:1024,height:1000},hasTouch:true});
const button=name=>page.getByRole('button',{name,exact:true});
async function touchRotate(viewer){
 await viewer.scrollIntoViewIfNeeded();await settle();const c=viewer.locator('canvas'),b=await c.boundingBox(),x=b.x+b.width*.5,y=b.y+b.height*.5,cdp=await page.context().newCDPSession(page);
 const dir=await viewer.getAttribute('data-camera-direction'),selection=await viewer.getAttribute('data-selected-residue');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+65,y:y+28}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notEqual(await viewer.getAttribute('data-camera-direction'),dir);assert.equal(await viewer.getAttribute('data-selected-residue'),selection);
 const distance=Number(await viewer.getAttribute('data-camera-distance'));await c.focus();await page.keyboard.press('+');assert.ok(Number(await viewer.getAttribute('data-camera-distance'))<distance);await cdp.detach();
}
try{
 await nav.getByRole('button',{name:/Hydrophobic Core/}).click();const a=page.getByTestId('protein-viewer');await a.locator('canvas').waitFor();
 await page.getByTestId('sequence-exploration').locator('summary').first().tap();await page.locator('.sequence-strip [data-residue-index="4"]').tap();
 assert.equal(await a.getAttribute('data-selected-residue'),'5');await touchRotate(a);
 check('A: touch sequence selection, touch rotation without accidental selection, keyboard zoom');
 await nav.getByRole('button',{name:/Disulfide Bonds/}).click();const b=page.getByTestId('rnase-viewer');await b.locator('canvas').waitFor();
 await page.locator('.sequence-strip [data-residue-index="25"]').tap();assert.equal(await b.getAttribute('data-selected-residue'),'26');await touchRotate(b);
 await button('2 · 변성·환원과 조건 복원').tap();await button('변성제 + 환원제 처리').tap();const schematic=page.getByTestId('rnase-schematic');await schematic.locator('canvas').waitFor();await touchRotate(schematic);
 check('B: native and unitless schematic touch rotation and keyboard zoom; Cys tap maps to native bond');
 await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await button('아쿠아포린의 물 통로').click();const c=page.getByTestId('aquaporin-viewer');await c.locator('canvas').waitFor();
 await button('물 이동 예시 보기').click();await c.scrollIntoViewIfNeeded();await page.waitForTimeout(250);assert.equal(await c.getAttribute('data-animating'),'true');
 const detached=await c.elementHandle();await button('표면 성질 비교').click();const stopped=await detached.evaluate(e=>({...e.dataset}));await page.waitForTimeout(300);
 assert.equal(stopped.animating,'false');assert.equal(await detached.evaluate(e=>e.dataset.animationFrames),stopped.animationFrames);assert.equal(await detached.evaluate(e=>e.querySelectorAll('canvas').length),0);await detached.dispose();
 check('C: a detached formerly playing scene cancels RAF and removes its renderer canvas');
 for(const [asset,module,viewer] of [['7RSA',/Disulfide Bonds/,'rnase-viewer'],['1J4N',/Soluble vs Membrane/,'aquaporin-viewer']]){
  const fresh=await browser.newPage({viewport:{width:1024,height:900}});fresh.on('pageerror',e=>errors.push(e.message));
  let release,requested;const requestSeen=new Promise(r=>requested=r),hold=new Promise(r=>release=r);
  await fresh.route('**/'+asset+'-*.pdb',async route=>{requested();await hold;await route.continue();});
  await fresh.goto((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/');
  const n=fresh.getByRole('navigation',{name:'학습 모듈'});await n.getByRole('button',{name:module}).click();
  if(asset==='1J4N')await fresh.getByRole('button',{name:'아쿠아포린의 물 통로',exact:true}).click();
  await requestSeen;await n.getByRole('button',{name:/Peptide Geometry/}).click();release();await fresh.waitForLoadState('networkidle');
  assert.equal(await fresh.getByTestId(viewer).count(),0);assert.equal(await fresh.locator('canvas').count(),1);await fresh.close();
 }
 check('Late 7RSA and 1J4N responses cannot remount or overwrite a newly selected module');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);await save('inputs-lifecycle-browser-results');
}finally{await browser.close();}

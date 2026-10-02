import assert from 'node:assert/strict';import {openLab} from './additions-browser-utils.mjs';
const {browser,page,nav,errors,failedRequests,check,settle,save}=await openLab(/Soluble vs Membrane/,{hasTouch:true});
const button=name=>page.getByRole('button',{name,exact:true}),v=()=>page.getByTestId('aquaporin-viewer'),data=key=>v().getAttribute('data-'+key);
async function input(name,value){const l=page.getByRole('slider',{name,exact:true});await l.fill(String(value));await l.dispatchEvent('input');await l.dispatchEvent('change');await settle();}
try{
 assert.equal(await button('표면 성질 비교').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('canvas').count(),2);assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('1J4N'))),false);
 const original=await page.getByTestId('membrane-count').innerText();
 await button('아쿠아포린의 물 통로').click();await v().locator('canvas').waitFor();await settle();
 assert.equal(await page.locator('canvas').count(),1);assert.equal(await data('assembly'),'1');assert.equal(await data('subunits'),'4');
 assert.equal(await data('water-count'),'16');assert.equal(await data('particles'),'4');assert.equal(await data('animating'),'false');
 check('Surface comparison remains default; AQP1 is lazy and shows four distinct monomer pores');
 const paths=(await data('path-centers')).split(';');assert.equal(new Set(paths).size,4);
 await page.screenshot({path:'artifacts/protein-additions/c-tetramer.png',fullPage:true});
 for(let unit=0;unit<4;unit++){
  await page.getByRole('group',{name:'소단위 선택',exact:true}).getByRole('button',{name:String(unit+1),exact:true}).click();
  const before=await data('camera-direction');await page.getByLabel('AQP1 잔기 선택',{exact:true}).selectOption('77');
  assert.equal(await data('selected'),'1J4N|assembly1|op'+(unit+1)+'|A:78');assert.match(await page.getByTestId('aqp-selected').innerText(),/ASN 78/);assert.equal(await data('camera-direction'),before);
 }
 check('Residue and operator identities remain unique across all four source-chain-A instances, selection preserves camera');
 await button('아쿠아포린 전체 초기화').click();await v().scrollIntoViewIfNeeded();await settle();
 const c=v().locator('canvas');const dir=await data('camera-direction');await c.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await data('camera-direction'),dir);
 const dist=Number(await data('camera-distance'));await page.keyboard.press('+');assert.ok(Number(await data('camera-distance'))<dist);
 const b=await c.boundingBox();const beforeDrag=await data('camera-direction');await page.mouse.move(b.x+b.width*.45,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.62,b.y+b.height*.55,{steps:8});await page.mouse.up();assert.notEqual(await data('camera-direction'),beforeDrag);assert.equal(await data('selected'),'');
 await button('위에서 보기').click();await settle();
 const picked=new Set();
 // Hit actual rendered ribbons in the four screen quadrants, not a test-only selection API.
 for(const y of [.22,.34,.46,.58,.70,.82]){for(const x of [.22,.34,.46,.58,.70,.82]){await c.click({position:{x:b.width*x,y:b.height*y}});if(await data('selected'))picked.add(await data('unit'));if(picked.size===4)break;}if(picked.size===4)break;}
 assert.equal(picked.size,4);check('Mouse and keyboard rotate/zoom; real ribbon picking reaches four non-duplicated subunits; drag does not select');
 await button('2 · 소단위 하나').click();await input('다른 소단위 불투명도',0);
 assert.equal(await data('opacity'),'0');assert.equal(await data('water-count'),'4');assert.equal(await data('particles'),'1');
 await button('3 · 물 통로 단면').click();assert.equal(await data('clip'),'on');
 await v().scrollIntoViewIfNeeded();await settle();await page.screenshot({path:'artifacts/protein-additions/c-section.png',fullPage:true});
 const cutBefore=await c.screenshot();await input('AQP1 절단 위치',8);const cutAfter=await c.screenshot();assert.notEqual(Buffer.compare(cutBefore,cutAfter),0);
 await page.getByRole('checkbox',{name:'막 위치 표시',exact:true}).uncheck();assert.equal(await data('membrane'),'false');
 check('Single-monomer isolation, actual space-fill clipping and independent membrane boundaries');
 await button('4 · 선택성 부위').click();assert.equal(await data('clip'),'off');
 await button('NPA 확대').click();assert.equal(await data('npa'),'true');assert.match(await v().innerText(),/NPA 78–80/);
 const npaTarget=await data('camera-target');await button('ar/R 확대').click();assert.notEqual(await data('camera-target'),npaTarget);assert.match(await v().innerText(),/F58 H182 C191 R197/);
 await page.getByRole('checkbox',{name:'NPA motif',exact:true}).uncheck();assert.equal(await data('npa'),'false');await page.getByRole('checkbox',{name:'NPA motif',exact:true}).check();
 await button('통로 안쪽').click();assert.match(await page.getByTestId('aqp-region-count').innerText(),/23.*26/);
 await button('바깥 지질 쪽').click();await button('전체').click();
 await button('아쿠아포린 전체 초기화').click();await button('4 · 선택성 부위').click();await v().scrollIntoViewIfNeeded();await settle();await page.screenshot({path:'artifacts/protein-additions/c-selectivity.png',fullPage:true});
 check('Verified bovine NPA/ar-R labels and focus, region candidates and independent feature visibility');
 await button('아쿠아포린 전체 초기화').click();await v().scrollIntoViewIfNeeded();await settle();
 assert.match(await page.getByTestId('aqp-water-legend').innerText(),/원본.*설명용/s);await page.getByRole('checkbox',{name:'원본의 통로 물',exact:true}).uncheck();assert.equal(await data('water-count'),'0');assert.equal(await data('particles'),'4');
 const still=await data('particle-phase');await page.waitForTimeout(300);assert.equal(await data('particle-phase'),still);
 await button('입자 한 단계 이동').click();assert.notEqual(await data('particle-phase'),still);
 await button('물 이동 예시 보기').click();await v().scrollIntoViewIfNeeded();await page.waitForTimeout(500);assert.equal(await data('animating'),'true');const moving=await data('particle-phase');await page.waitForTimeout(300);assert.notEqual(await data('particle-phase'),moving);
 await button('물 이동 예시 정지').click();const stopped=await data('particle-phase');await page.waitForTimeout(250);assert.equal(await data('particle-phase'),stopped);
 check('Default pause, visible experimental waters versus explanatory glyphs, single step, play and stop');
 await page.emulateMedia({reducedMotion:'reduce'});await settle();assert.equal(await button('물 이동 예시 보기').isDisabled(),true);assert.equal(await data('animating'),'false');
 const reducedPhase=await data('particle-phase');await button('입자 한 단계 이동').click();assert.notEqual(await data('particle-phase'),reducedPhase);await page.emulateMedia({reducedMotion:'no-preference'});await settle();
 await button('물 이동 예시 보기').click();await v().scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.setViewportSize({width:1440,height:650});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);assert.equal(await v().evaluate(e=>e.getBoundingClientRect().top>innerHeight),true);assert.equal(await data('animating'),'false');await page.setViewportSize({width:1440,height:1100});
 check('Reduced motion disables autoplay but keeps manual steps; offscreen scene suspends animation');
 for(let i=0;i<3;i++){
  await button('표면 성질 비교').click();await page.getByTestId('soluble-viewer').locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),2);assert.equal(await page.getByTestId('membrane-count').innerText(),original);
  await button('아쿠아포린의 물 통로').click();await v().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);assert.equal(await data('animating'),'false');assert.equal(await data('particle-phase'),'0.000000');
 }
 check('Repeated internal tab switches dispose animation/canvases and restore original comparison defaults');
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});await button('아쿠아포린 전체 초기화').click();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok((await v().boundingBox()).height>=400);
  await page.screenshot({path:'artifacts/protein-additions/c-'+width+'.png',fullPage:true});check(width+'px: no page overflow, readable controls and full canvas');
 }
 await page.setViewportSize({width:1024,height:1100});await v().scrollIntoViewIfNeeded();const tb=await c.boundingBox(),cdp=await page.context().newCDPSession(page),tx=tb.x+tb.width*.5,ty=tb.y+tb.height*.5;
 const oldDir=await data('camera-direction');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+70,y:ty+35}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await data('camera-direction'),oldDir);assert.equal(await data('selected'),'');
 const beforePinch=Number(await data('camera-distance'));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx-35,y:ty},{x:tx+35,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx-65,y:ty},{x:tx+65,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(Number(await data('camera-distance'))<beforePinch);assert.equal(await data('selected'),'');await cdp.detach();
 check('1024px touch emulation: one-finger rotation and two-finger zoom do not accidentally pick');
 await button('아쿠아포린 전체 초기화').click();assert.equal(await data('clip'),'off');assert.equal(await data('selected'),'');assert.equal(await data('particle-phase'),'0.000000');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);check('Reset, no console/page errors, no failed assets');await save('c-browser-results');
}finally{await browser.close();}

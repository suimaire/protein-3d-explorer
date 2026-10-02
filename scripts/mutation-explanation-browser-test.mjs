import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
const {chromium}=await import('@playwright/test');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir('artifacts',{recursive:true});
const origin=process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:5174';
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const main=()=>page.locator('main'),viewer=()=>page.getByTestId('mutation-viewer'),canvas=()=>viewer().locator('canvas');
const button=name=>main().getByRole('button',{name,exact:true});
const settle=()=>page.waitForTimeout(480);
const layers=()=>viewer().getAttribute('data-comparison-layers');
const choose=async(name,mode)=>{await button(name).click();await settle();assert.equal(await main().getAttribute('data-explanation'),mode);};
const check=name=>{checks.push(name);console.log('✓ '+name);};
const start=async()=>{
 await page.getByRole('navigation',{name:'학습 모듈'}).getByRole('button',{name:/Mutation Tolerance/}).click();
 await canvas().waitFor();await settle();
};
try{
 await page.goto(origin+'/protein-3d-explorer/',{waitUntil:'networkidle'});await start();
 assert.equal(await button('활성 중심과 함께 해석 →').count(),0);
 await main().getByRole('button',{name:/M182T 변이 적용/}).click();
 assert.equal(await button('활성 중심과 함께 해석 →').count(),0);
 await button('실제 실험 결과 확인 →').click();
 await canvas().evaluate(e=>e.dataset.identity='phase2-original');
 const labelCount=await viewer().locator('.mutation-label').count();
 const leaderCount=await viewer().locator('.mutation-label-leader').count();
 assert.equal(await page.getByTestId('mutation-integrated').count(),0);
 check('Explanation gated until result reveal; final question still locked');
 await button('활성 중심과 함께 해석 →').focus();await page.keyboard.press('Enter');await settle();
 assert.equal(await main().getAttribute('data-explanation'),'activity');
 assert.equal(await button('활성 중심과 함께 해석 →').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.mutation-result-card[data-active=true]').count(),1);
 assert.match(await layers(),/active-wt,active-mutant/);
 const activeTarget=await viewer().getAttribute('data-camera-target');
 for(const [name,expected] of [['WT active site','active-wt'],['M182T active site','active-mutant'],['중첩 비교','active-wt,active-mutant']]){
  await button(name).click();assert.ok((await layers()).includes(expected));
 }
 await page.getByText('효소 활성은 어떻게 측정했을까?',{exact:true}).click();
 const graph=page.getByTestId('activity-explanation').getByRole('img');
 const series=await graph.locator('[data-series]').evaluateAll(lines=>Object.fromEntries(lines.map(line=>{
  const start=line.getPointAtLength(0),end=line.getPointAtLength(line.getTotalLength());
  return [line.dataset.series,{start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},slope:(start.y-end.y)/(end.x-start.x),dash:getComputedStyle(line).strokeDasharray}];
 })));
 assert.deepEqual(Object.keys(series).sort(),['M182T','WT']);
 assert.deepEqual(series.WT.start,series.M182T.start,'conceptual lines share the same origin');
 assert.equal(series.WT.end.x,series.M182T.end.x,'same conceptual time span');
 for(const line of Object.values(series)){
  assert.ok(line.end.x>line.start.x);assert.ok(line.end.y<line.start.y);
 }
 assert.ok(series.M182T.slope>series.WT.slope);
 assert.ok((series.M182T.slope-series.WT.slope)/series.WT.slope<0.1,'only a small illustrative slope difference');
 assert.equal(series.WT.dash,'none');assert.notEqual(series.M182T.dash,'none');
 assert.match(await graph.textContent(),/WT · 실선/);assert.match(await graph.textContent(),/M182T · 점선/);
 assert.match(await page.getByTestId('activity-explanation').innerText(),/측정 원리를 설명하는 개념도/);
 assert.match(await page.getByTestId('activity-explanation').innerText(),/측정값으로 시간별 흡광도를 계산한 곡선이 아닙니다/);
 check('Conceptual activity lines share an origin, differ slightly in slope, retain line styles and raw-data limitation');
 assert.match(await page.getByTestId('activity-explanation').innerText(),/실제 raw time-series 아님/);
 assert.match(await page.getByTestId('activity-explanation').innerText(),/32 μM/);
 await page.screenshot({path:'artifacts/mutation-phase2-activity.png',fullPage:true});
 check('Keyboard result CTA, active-site camera, WT/M182T/overlay and assay concept');
 await choose('500 mg/L의 의미 확인 →','mic');
 assert.equal(await canvas().isVisible(),false);assert.equal(await layers(),'');
 await button('250 mg/L').click();
 assert.equal(await page.locator('.mutation-agar-row[data-growth=growth]').count(),2);
 const concentration=page.getByRole('slider',{name:'Amoxicillin 농도'});
 await concentration.focus();await page.keyboard.press('ArrowRight');
 assert.equal(await concentration.getAttribute('aria-valuetext'),'500 mg/L');
 assert.equal(await page.locator('.mutation-agar-row[data-growth=inhibited]').count(),2);
 assert.match(await page.locator('.mutation-endpoint').innerText(),/처음으로/);
 await button('꼭 그렇지는 않다').click();
 assert.match(await page.getByTestId('mic-explanation').innerText(),/protein abundance/);
 await page.screenshot({path:'artifacts/mutation-phase2-mic.png',fullPage:true});
 check('Discrete MIC 250→500 via keyboard; both strains inhibited; composite explanation');
 await choose('안정화 구조 모델 확인 →','thermal');
 assert.equal(await page.locator('#mutation-observation-title .mutation-mode-title').innerText(),'열안정성 · M182T의 안정화 모델을 확인해 보세요');
 assert.equal(await canvas().isVisible(),true);
 assert.notEqual(await viewer().getAttribute('data-camera-target'),activeTarget);
 for(let i=0;i<3;i++){
  await button('WT Met182').click();assert.match(await layers(),/thermal-wt/);
  await button('M182T Thr182').click();assert.match(await layers(),/thermal-mutant/);
 }
 await button('안정화에 기여하는 상호작용 보기').click();assert.match(await layers(),/ncap-contact/);
 await button('WT Met182').click();assert.doesNotMatch(await layers(),/interaction-atoms|ncap-contact/);
 await button('M182T Thr182').click();assert.match(await layers(),/ncap-contact/);
 assert.match(await page.locator('.mutation-contact-evidence').innerText(),/2.920 Å/);
 await button('49.5°C').click();
 assert.equal(await page.locator('.mutation-tm-rows [data-position=midpoint]').count(),1);
 assert.match(await page.locator('.mutation-tm-rows [data-position=midpoint]').innerText(),/^WT/);
 const temperature=page.getByRole('slider',{name:'온도'});
 await temperature.focus();for(let i=0;i<15;i++)await page.keyboard.press('ArrowRight');
 assert.equal(await temperature.getAttribute('aria-valuetext'),'57°C');
 assert.match(await page.locator('.mutation-tm-rows [data-position=midpoint]').innerText(),/^M182T/);
 assert.match(await page.locator('.mutation-tm-rows [data-position=above]').innerText(),/^WT/);
 await page.getByText('Tm은 어떻게 측정했을까?',{exact:true}).click();
 await page.screenshot({path:'artifacts/mutation-phase2-thermal.png',fullPage:true});
 check('Thermal WT/Thr comparison, conditional measured contact, 49.5/57°C and assay method');
 await page.getByTestId('mutation-integrated').waitFor();
 await button('이 자료만으로는 확정할 수 없다').click();
 assert.match(await page.getByTestId('mutation-integrated').innerText(),/assay ≠ 개체 전체의 fitness ≠ population-level selection coefficient/);
 check('Three unique visits unlock integrated levels and bounded neutrality answer');
 for(let i=0;i<4;i++){
  await choose('활성 중심과 함께 해석 →','activity');await choose('500 mg/L의 의미 확인 →','mic');
  await choose('안정화 구조 모델 확인 →','thermal');await button('전체 구조 요약으로 돌아가기').click();
 }
 assert.equal(await canvas().getAttribute('data-identity'),'phase2-original');
 assert.equal(await viewer().locator('.mutation-label').count(),labelCount);
 assert.equal(await viewer().locator('.mutation-label-leader').count(),leaderCount);
 assert.equal(await viewer().getAttribute('data-camera-animating'),'false');
 assert.equal(await page.locator('canvas').count(),1);
 check('Repeated result/summary cycles retain one canvas and fixed cached label count');
 await page.emulateMedia({reducedMotion:'reduce'});
 await button('활성 중심과 함께 해석 →').click();assert.equal(await viewer().getAttribute('data-camera-animating'),'false');
 await button('안정화 구조 모델 확인 →').click();assert.equal(await viewer().getAttribute('data-camera-animating'),'false');
 check('Reduced motion switches camera immediately');
 for(const width of [1024,768,390,320]){
  await page.setViewportSize({width,height:900});await settle();
  for(const [name,mode] of [['활성 중심과 함께 해석 →','activity'],['500 mg/L의 의미 확인 →','mic'],['안정화 구조 모델 확인 →','thermal']]){
   await choose(name,mode);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width+' '+mode);
   if(mode!=='mic')assert.ok((await canvas().boundingBox()).height>=390);
  }
  const y=await main().locator('.mutation-workspace>section').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));
  assert.ok(y[0]<y[2]&&y[2]<y[1],'cause → results → visualization '+width);
  assert.ok((await temperature.boundingBox()).height>=44);
  if(width===390)await page.screenshot({path:'artifacts/mutation-phase2-mobile.png',fullPage:true});
 }
 check('1024/768/390/320: cause → cards → visualization, no overflow, 44px controls');
 await button('안정화에 기여하는 상호작용 보기').click();
 await button('A36D 반례 확인 →').click();await settle();
 assert.equal(await main().getAttribute('data-explanation'),'summary');
 assert.equal(await layers(),'wt,ala,ser-wt');
 assert.equal(await page.getByTestId('thermal-explanation').count(),0);
 await button('A36D 실험 결과 확인 →').click();
 assert.match(await page.getByTestId('mutation-results').innerText(),/0.14 ± 0.01/);
 await button('HbS 중합 모듈에서 이어 보기 →').click();
 await page.getByTestId('hbs-viewer').locator('canvas').waitFor();
 assert.equal(await viewer().count(),0);assert.equal(await page.locator('.mutation-label').count(),0);assert.equal(await page.locator('.mutation-label-leader').count(),0);
 check('A36 transition clears explanations; original measurements and HbS navigation remain');
 for(let i=0;i<2;i++){
  await start();await main().getByRole('button',{name:/M182T 변이 적용/}).click();await button('실제 실험 결과 확인 →').click();
  await button('안정화 구조 모델 확인 →').click();await button('안정화에 기여하는 상호작용 보기').click();
  await page.getByRole('navigation',{name:'학습 모듈'}).getByRole('button',{name:/Peptide Geometry/}).click();
  assert.equal(await page.locator('.mutation-label').count(),0);assert.equal(await page.locator('.mutation-label-leader').count(),0);
 }
 assert.equal(await page.locator('canvas').count(),1);check('Module unmount clears contact labels and canvases repeatedly');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const touch=await mobile.newPage();touch.on('pageerror',e=>errors.push(e.message));
 await touch.goto(origin+'/protein-3d-explorer/');
 await touch.getByRole('navigation',{name:'학습 모듈'}).getByRole('button',{name:/Mutation Tolerance/}).tap();
 await touch.getByRole('button',{name:/M182T 변이 적용/}).tap();
 await touch.getByRole('button',{name:'실제 실험 결과 확인 →',exact:true}).tap();
 await touch.getByRole('button',{name:'500 mg/L의 의미 확인 →',exact:true}).tap();
 await touch.getByRole('button',{name:'500 mg/L',exact:true}).tap();
 assert.equal(await touch.locator('.mutation-agar-row[data-growth=inhibited]').count(),2);
 await touch.getByRole('button',{name:'안정화 구조 모델 확인 →',exact:true}).tap();
 await touch.getByRole('button',{name:'57°C',exact:true}).tap();
 assert.match(await touch.locator('.mutation-tm-rows [data-position=midpoint]').innerText(),/^M182T/);
 await mobile.close();check('Touch context: result cards and concentration/temperature steps');
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/mutation-explanation-browser-results.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

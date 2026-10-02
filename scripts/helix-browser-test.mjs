import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=n=>checks.push(n),canvas=()=>page.locator('canvas'),shot=()=>canvas().screenshot(),viewer=()=>page.getByTestId('helix-viewer');
const button=name=>page.getByRole('button',{name,exact:true});
const changed=(a,b)=>assert.notDeepEqual(a,b);
try{
  await page.goto(((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/'),{waitUntil:'networkidle'});
  const nav=page.getByRole('navigation',{name:'학습 모듈'});
  assert.equal(await nav.getByRole('button').count(),10);
  await nav.getByRole('button',{name:/α-Helix/}).click();await canvas().waitFor();assert.equal(await page.getByRole('alert').count(),0);check('Ten completed modules; alpha helix WebGL loads');
  assert.equal(await viewer().getAttribute('data-pan-enabled'),'false');{const before=await viewer().getAttribute('data-camera-target'),b=await canvas().boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down({button:'right'});await page.mouse.move(b.x+b.width/2+100,b.y+b.height/2+50,{steps:8});await page.mouse.up({button:'right'});assert.equal(await viewer().getAttribute('data-camera-target'),before);}check('Shared PeptideScene: helix viewer keeps pan disabled (right-drag does not move target)');
  assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');assert.equal(await viewer().getAttribute('data-hbond-pairs'),'1-5,2-6,3-7,4-8,5-9,6-10,7-11,8-12');check('Displayed count and rendered pair mapping agree');
  await page.getByText('대표 수치와 모델 검증 보기',{exact:true}).click();
  assert.match(await page.getByTestId('helix-clashes').innerText(),/심한 불리한 입체 충돌: 0쌍/);
  assert.ok((await page.getByTestId('helix-clashes').innerText()).includes('유효한 H-bond 10쌍(내부 8, cap 관련 2)'));
  for(const pair of ['0:O ··· 4:H','9:O ··· 13:H'])assert.ok((await page.getByTestId('cap-hbonds').innerText()).includes(pair));
  check('Valid backbone and cap H-bonds excluded from serious unfavorable clashes');
  await page.screenshot({path:'artifacts/phase2a-alpha-helix.png',fullPage:true});
  const initial=await shot();
  for(const name of ['Backbone','Side chains','원자','H-bond 표시','helix 축 표시']){const before=await shot(),box=page.getByRole('checkbox',{name,exact:true});await box.click();changed(before,await shot());if(name==='H-bond 표시'){assert.equal(await page.getByTestId('hbond-count').innerText(),'0 / 8 표시');assert.equal(await viewer().getAttribute('data-hbond-pairs'),'');assert.equal(await viewer().getAttribute('data-focus-atoms'),'');}await box.click();check(`${name}: visible toggle effect`);}
  await button('위에서 보기').click();changed(initial,await shot());
  const top=(await viewer().getAttribute('data-camera-direction')).split(',').map(Number),axis=[0.6250711528085243,0.5038836700864056,0.5961436915265286];assert.ok(top.reduce((sum,v,i)=>sum+v*axis[i],0)>0.999999);check('Top camera looks along measured helix axis');
  await page.getByRole('checkbox',{name:'helix 축 표시',exact:true}).check();await page.screenshot({path:'artifacts/phase2a-alpha-helix-top.png',fullPage:true});
  await button('backbone만').click();assert.equal(await page.getByRole('checkbox',{name:'Side chains',exact:true}).isChecked(),false);const backOnly=await shot();await button('backbone + side chain').click();changed(backOnly,await shot());check('Backbone-only and backbone-plus-sidechains comparison');
  await page.getByRole('combobox',{name:'H-bond 고르기',exact:true}).selectOption('2');assert.equal(await viewer().getAttribute('data-focus-atoms'),'2:C,2:O,6:H,6:N');assert.match(await page.getByTestId('hbond-detail').innerText(),/Acceptor Ala 2 C=O/);assert.match(await page.getByTestId('hbond-detail').innerText(),/Donor Ala 6 N–H/);assert.match(await page.getByTestId('hbond-detail').innerText(),/3.06 Å/);assert.match(await page.getByTestId('hbond-detail').innerText(),/162.3°/);check('Focus selection highlights correct carbonyl/amide and reports measured geometry');
  await page.getByRole('checkbox',{name:'H-bond 표시',exact:true}).uncheck();await page.getByRole('combobox',{name:'H-bond 고르기',exact:true}).selectOption('8');assert.equal(await page.getByRole('checkbox',{name:'H-bond 표시',exact:true}).isChecked(),true);assert.equal(await viewer().getAttribute('data-focus-atoms'),'8:C,8:O,12:H,12:N');check('Selecting final pair restores visible focus');
  for(const r of ['1','6','12']){await page.getByRole('combobox',{name:'잔기 고르기',exact:true}).selectOption(r);assert.equal(await viewer().getAttribute('data-selected-residue'),r);const marker=page.getByTestId('rama-marker');assert.ok(Math.abs(Number(await marker.getAttribute('data-phi'))+60)<1e-8);assert.ok(Math.abs(Number(await marker.getAttribute('data-psi'))+45)<1e-8);assert.match(await page.getByTestId('helix-measured').innerText(),/φ -60.0°/);}check('Residue selector, renderer highlight, measured phi/psi and plot synchronize');
  const rama=page.locator('.rama svg');await rama.click({position:{x:100,y:100}});assert.equal(await page.getByRole('combobox',{name:'잔기 고르기',exact:true}).inputValue(),'12');check('Helix plot is read-only');
  await button('전체 초기화').click();assert.deepEqual(await shot(),initial);check('Full reset restores initial camera, representation, residue and focus');
  const box=await canvas().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+40,{steps:10});await page.mouse.up();changed(initial,await shot());check('Drag orbit changes rendered helix');
  const direction=await viewer().getAttribute('data-camera-direction');await canvas().hover();await page.mouse.wheel(0,-240);await page.waitForTimeout(100);const zoomed=await shot();await button('화면에 맞추기').click();changed(zoomed,await shot());const fitDirection=await viewer().getAttribute('data-camera-direction');assert.ok(direction.split(',').every((v,i)=>Math.abs(Number(v)-Number(fitDirection.split(',')[i]))<1e-8));check('Wheel zoom and fit, preserving orbit direction');
  await button('시점 초기화').click();assert.deepEqual(await shot(),initial);await canvas().focus();await page.keyboard.press('+');changed(initial,await shot());await button('옆에서 보기').click();assert.deepEqual(await shot(),initial);check('Reset, keyboard zoom and 옆에서 보기 restore initial side camera');
  for(const width of [768,390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await button('위에서 보기').click();await page.getByRole('combobox',{name:'H-bond 고르기',exact:true}).selectOption('4');await page.screenshot({path:`artifacts/phase2a-mobile-${width}.png`,fullPage:true});check(`Responsive ${width}px layout and controls`);}
  await page.getByRole('button',{name:'펩타이드 결합 모듈에서 φ/ψ 바꿔 보기 →',exact:true}).click();await page.locator('#phi').waitFor();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');check('Return link restores functioning Peptide Geometry');
  for(let i=0;i<3;i++){await nav.getByRole('button',{name:/α-Helix/}).click();await canvas().waitFor();await nav.getByRole('button',{name:/Peptide Geometry/}).click();await canvas().waitFor();}assert.equal(await canvas().count(),1);check('Repeated navigation disposes and rebuilds viewers');
  assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
  await writeFile('artifacts/phase2a-browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
const { chromium }=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const checks=[];
const check=(name)=>checks.push(name);
const marker=()=>page.getByTestId('rama-marker');
const canvas=()=>page.locator('canvas');
// Always capture the full canvas at the same viewport alignment. Auto-scroll can leave
// its fractional top edge clipped after the navigation wraps onto an extra row.
const shot=async()=>{await canvas().evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));return canvas().screenshot();};
const changed=(a,b)=>assert.notDeepEqual(a,b,'Rendered model should change');
const viewer=()=>page.getByTestId('viewer');
const nums=async name=>(await viewer().getAttribute(name)).split(',').map(Number);
const near=(a,b,tol=1e-6)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=tol);
const geometry=async()=>({measured:await page.getByTestId('measured').innerText(),phi:await marker().getAttribute('data-phi'),psi:await marker().getAttribute('data-psi'),clashes:await page.getByTestId('clash-count').innerText()});
const drag=async(dx,dy,opts={})=>{const box=await canvas().boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;if(opts.shift)await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down({button:opts.button??'left'});await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up({button:opts.button??'left'});if(opts.shift)await page.keyboard.up('Shift');};
try{
  await page.goto(((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/'),{waitUntil:'networkidle'});
  await canvas().waitFor();assert.equal(await page.getByRole('alert').count(),0);check('Production base path loads; WebGL ready');
  assert.equal(await page.getByTestId('clash-count').innerText(),'0');assert.equal(await page.getByTestId('clash-focus').count(),0);check('0 clashes: no clickable clash focus control');
  await page.getByRole('checkbox',{name:'steric clash 표시',exact:true}).check();
  await page.screenshot({path:'artifacts/phase1-1-alpha-like.png',fullPage:true});
  await page.getByRole('checkbox',{name:'steric clash 표시',exact:true}).uncheck();check('Alpha-like preset has 0 severe nonbonded overlaps with clash display enabled');
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  const initial=await shot();
  await page.getByRole('slider',{name:'φ (phi)',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#phi').inputValue(),'-59');assert.ok(Math.abs(Number(await marker().getAttribute('data-phi'))+59)<1e-8);assert.ok(Math.abs(Number(await marker().getAttribute('data-psi'))+45)<1e-8);changed(initial,await shot());check('Phi keyboard slider updates actual geometry, marker; psi stable');
  await page.getByRole('slider',{name:'ψ (psi)',exact:true}).focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#psi').inputValue(),'180');assert.equal(Number(await marker().getAttribute('data-psi')),180);check('Psi slider, +180 seam synchronization');
  await page.getByRole('button',{name:'전체 초기화',exact:true}).click();assert.equal(await page.locator('#phi').inputValue(),'-60');assert.equal(await page.locator('#psi').inputValue(),'-45');
  for(const label of ['Backbone','Side chains','원자','van der Waals 구','peptide 평면','원자 이름','φ / ψ 회전축']){
    const before=await shot(),box=page.getByRole('checkbox',{name:label,exact:true});const previous=await box.isChecked();await box.click();assert.equal(await box.isChecked(),!previous);changed(before,await shot());await box.click();check(`${label} toggles visible geometry`);
  }
  await page.getByRole('button',{name:'β-like',exact:true}).click();assert.equal(await page.locator('#phi').inputValue(),'-135');assert.equal(await page.locator('#psi').inputValue(),'135');assert.equal(await page.getByTestId('clash-count').innerText(),'0');
  await page.getByRole('button',{name:'Extended',exact:true}).click();assert.equal(await page.getByTestId('clash-count').innerText(),'0');check('Beta-like and Extended presets each have 0 severe nonbonded overlaps');
  // Click the center of the plot (0,0), using SVG geometry rather than screenshot coordinates.
  const center=await page.locator('.rama svg').evaluate(svg=>{const p=svg.createSVGPoint();p.x=200;p.y=170;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};});
  await page.mouse.click(center.x,center.y);assert.ok(Math.abs(Number(await page.locator('#phi').inputValue()))<=1);assert.ok(Math.abs(Number(await page.locator('#psi').inputValue()))<=1);assert.ok(Number(await page.getByTestId('clash-count').innerText())>0);check('Plot click updates both sliders and clash computation (1° pixel tolerance)');
  for(const id of ['phi','psi'])await page.locator(`#${id}`).evaluate(el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'0');el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#phi').inputValue(),'0');assert.equal(await page.locator('#psi').inputValue(),'0');assert.equal(await page.getByTestId('clash-count').innerText(),'8');check('Deliberately unfavorable 0°/0° geometry has 8 audited severe overlaps');
  {
    const focusButton=page.getByRole('button',{name:/심한 비결합 겹침 8쌍/});assert.equal(await focusButton.count(),1);assert.equal(await focusButton.isEnabled(),true);
    const clashBox=page.getByRole('checkbox',{name:'steric clash 표시',exact:true});assert.equal(await clashBox.isChecked(),false);
    await page.getByRole('button',{name:'시점 초기화',exact:true}).click();
    const beforeGeometry=await geometry(),beforeTarget=await nums('data-camera-target'),beforeFocusShot=await shot();
    await focusButton.focus();await page.keyboard.press('Enter');await page.waitForTimeout(700);
    assert.equal(await clashBox.isChecked(),true);
    const [first,second]=(await page.locator('.clash-summary li').first().textContent()).split(' · ')[0].split(' ↔ ');
    assert.equal(await viewer().getAttribute('data-focus-pair'),`${first}|${second}`,'Focused pair = largest-overlap pair listed by detector');
    const pos=await nums('data-focus-pair-positions'),a=pos.slice(0,3),b=pos.slice(3),mid=a.map((v,i)=>(v+b[i])/2),target=await nums('data-camera-target');
    assert.ok(near(target,mid,1e-6),`target ${target} should equal midpoint ${mid}`);assert.ok(!near(target,beforeTarget,1e-3));
    const distance=Number(await viewer().getAttribute('data-camera-distance')),dir=await nums('data-camera-direction'),vb=await canvas().boundingBox(),reach=distance*Math.tan(18*Math.PI/180)*Math.min(1,vb.width/vb.height);
    for(const p of [a,b]){const v=p.map((x,i)=>x-target[i]),along=v.reduce((s,x,i)=>s+x*dir[i],0),lateral=Math.hypot(...v.map((x,i)=>x-along*dir[i]));assert.ok(lateral+0.39<reach*0.9,'clash atom and highlight inside viewport');assert.ok(distance-along>1,'no near clipping');}
    assert.deepEqual(await geometry(),beforeGeometry,'Focus must not change geometry, φ/ψ or clash count');changed(beforeFocusShot,await shot());
    await page.screenshot({path:'artifacts/peptide-clash-focus.png',fullPage:true});check("Clash result button (keyboard Enter) turns on clash display and centres camera on the detector's largest-overlap pair; geometry unchanged");
    const focusShot=await shot();await drag(60,0);changed(focusShot,await shot());const t1=await nums('data-camera-target');await drag(40,30,{button:'right'});assert.ok(!near(t1,await nums('data-camera-target'),1e-3));await canvas().hover();await page.mouse.wheel(0,-120);await page.waitForTimeout(100);
    await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.ok(near(await nums('data-camera-target'),beforeTarget,1e-6));check('After focus: rotate, pan, zoom and camera reset still work');
    await clashBox.uncheck();await focusButton.click();await page.waitForTimeout(700);assert.equal(await clashBox.isChecked(),true);assert.ok(near(await nums('data-camera-target'),mid,1e-6));await page.getByRole('button',{name:'시점 초기화',exact:true}).click();await clashBox.uncheck();check('Mouse click on clash result focuses again');
  }
  const beforeClash=await shot();await page.getByRole('checkbox',{name:'steric clash 표시',exact:true}).check();changed(beforeClash,await shot());await page.screenshot({path:'artifacts/phase1-1-clash-validation.png',fullPage:true});check('Clashes displayed for unfavorable geometry');
  await page.getByRole('checkbox',{name:'van der Waals 구',exact:true}).check();await page.screenshot({path:'artifacts/phase1-1-vdw.png',fullPage:true});
  await page.getByRole('button',{name:'전체 초기화',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'steric clash 표시',exact:true}).isChecked(),false);check('Full reset restores geometry and options');
  const beforeCamera=await shot(),box=await canvas().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+45,{steps:10});await page.mouse.up();changed(beforeCamera,await shot());
  await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.deepEqual(await shot(),beforeCamera);check('Mouse orbit and camera reset');
  await canvas().focus();await page.keyboard.press('+');changed(beforeCamera,await shot());await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.deepEqual(await shot(),beforeCamera);check('Keyboard zoom and reset');
  await canvas().hover();await page.mouse.wheel(0,240);await page.waitForTimeout(100);changed(beforeCamera,await shot());await page.getByRole('button',{name:'시점 초기화',exact:true}).click();check('Wheel zoom');
  {
    assert.equal(await viewer().getAttribute('data-pan-enabled'),'true');
    const homeTarget=await nums('data-camera-target'),homeDir=await nums('data-camera-direction'),homeDist=Number(await viewer().getAttribute('data-camera-distance')),beforeGeometry=await geometry();
    await drag(120,-60,{button:'right'});const panned=await nums('data-camera-target');
    assert.ok(!near(panned,homeTarget,0.5),'right drag moves controls target');assert.ok(near(await nums('data-camera-direction'),homeDir,1e-6),'pan keeps view direction');assert.ok(Math.abs(Number(await viewer().getAttribute('data-camera-distance'))-homeDist)<1e-6);changed(beforeCamera,await shot());
    assert.deepEqual(await geometry(),beforeGeometry);check('Right-drag pans camera + target (direction/distance kept); φ/ψ and model unchanged');
    await drag(-80,40,{shift:true});assert.ok(!near(await nums('data-camera-target'),panned,0.5));assert.ok(near(await nums('data-camera-direction'),homeDir,1e-6));check('Shift + left-drag pans');
    await drag(80,0);assert.ok(!near(await nums('data-camera-direction'),homeDir,1e-3));check('Left-drag still rotates after pan');
    await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.ok(near(await nums('data-camera-target'),homeTarget,1e-9));assert.deepEqual(await shot(),beforeCamera);check('Camera reset restores target after pan');
    assert.equal(await page.locator('.hint-mouse').isVisible(),true);assert.equal(await page.locator('.hint-touch').isVisible(),false);check('Desktop hint shows mouse controls');
  }
  for(const width of [768,390,320]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow at ${width}`);await page.screenshot({path:`artifacts/mobile-${width}.png`,fullPage:true});check(`Responsive layout at ${width}px, no horizontal overflow`);
  }
  await page.getByRole('slider',{name:'φ (phi)',exact:true}).focus();await page.keyboard.press('Home');assert.equal(await page.locator('#phi').inputValue(),'-180');check('Mobile slider keyboard operation');
  for(const id of ['phi','psi'])await page.locator(`#${id}`).evaluate(el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'0');el.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(100);const b=await page.getByTestId('clash-focus').boundingBox();
    assert.ok(b.x>=0&&b.x+b.width<=width,`clash button fits at ${width}`);for(const sel of ['.viewer-footer','.clash-summary'])assert.equal(await page.locator(sel).evaluate(el=>el.scrollWidth<=el.clientWidth),true,`${sel} no overflow at ${width}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.getByTestId('clash-focus').screenshot({path:`artifacts/clash-focus-${width}.png`});check(`Clash button and control hint fit at ${width}px`);
  }
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const mobile=await ctx.newPage();
    mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await mobile.goto(((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/'),{waitUntil:'networkidle'});const mv=mobile.getByTestId('viewer'),mc=mobile.locator('canvas');await mc.waitFor();
    assert.equal(await mobile.locator('.hint-touch').isVisible(),true);assert.equal(await mobile.locator('.hint-mouse').isVisible(),false);assert.equal(await mobile.locator('.hint-touch').innerText(),'한 손가락 회전 · 두 손가락 이동/확대');check('Touch emulation shows touch hint');
    const mnums=async n=>(await mv.getAttribute(n)).split(',').map(Number),cdp=await ctx.newCDPSession(mobile);await mc.scrollIntoViewIfNeeded();const box=await mc.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
    const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],id)=>({x,y,id}))});
    const home=await mnums('data-camera-target'),homeDir=await mnums('data-camera-direction'),homeDist=Number(await mv.getAttribute('data-camera-distance')),measured=await mobile.getByTestId('measured').innerText();
    await touch('touchStart',[[cx,cy]]);for(let i=1;i<=8;i++)await touch('touchMove',[[cx+i*8,cy]]);await touch('touchEnd',[]);
    assert.ok(!near(await mnums('data-camera-direction'),homeDir,1e-3));assert.ok(near(await mnums('data-camera-target'),home,1e-9));check('Touch: one-finger drag rotates without panning');
    await mobile.getByRole('button',{name:'시점 초기화',exact:true}).click();
    await touch('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let i=1;i<=8;i++)await touch('touchMove',[[cx-40+i*6,cy+i*5],[cx+40+i*6,cy+i*5]]);await touch('touchEnd',[]);
    assert.ok(!near(await mnums('data-camera-target'),home,0.3),'two-finger drag pans');assert.ok(near(await mnums('data-camera-direction'),homeDir,1e-6));check('Touch: two-finger parallel drag pans (target moves, direction kept)');
    await mobile.getByRole('button',{name:'시점 초기화',exact:true}).click();
    await touch('touchStart',[[cx-30,cy],[cx+30,cy]]);for(let i=1;i<=8;i++)await touch('touchMove',[[cx-30-i*8,cy],[cx+30+i*8,cy]]);await touch('touchEnd',[]);
    assert.ok(Number(await mv.getAttribute('data-camera-distance'))<homeDist-0.5,'pinch out zooms in');check('Touch: pinch zoom still works');
    assert.equal(await mobile.getByTestId('measured').innerText(),measured);await mobile.locator('.viewer-panel').screenshot({path:'artifacts/peptide-touch-390.png'}); // element shot: fullPage capture drops pointer:coarse emulationawait ctx.close();
  }
  assert.deepEqual(errors,[]);check('No browser console errors or uncaught exceptions');
  await writeFile('artifacts/browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

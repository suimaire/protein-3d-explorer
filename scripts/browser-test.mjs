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
const shot=()=>canvas().screenshot();
const changed=(a,b)=>assert.notDeepEqual(a,b,'Rendered model should change');
try{
  await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
  await canvas().waitFor();assert.equal(await page.getByRole('alert').count(),0);check('Production base path loads; WebGL ready');
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  const initial=await shot();
  await page.getByRole('slider',{name:'φ (phi)',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#phi').inputValue(),'-59');assert.ok(Math.abs(Number(await marker().getAttribute('data-phi'))+59)<1e-8);assert.ok(Math.abs(Number(await marker().getAttribute('data-psi'))+45)<1e-8);changed(initial,await shot());check('Phi keyboard slider updates actual geometry, marker; psi stable');
  await page.getByRole('slider',{name:'ψ (psi)',exact:true}).focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#psi').inputValue(),'180');assert.equal(Number(await marker().getAttribute('data-psi')),180);check('Psi slider, +180 seam synchronization');
  await page.getByRole('button',{name:'전체 초기화',exact:true}).click();assert.equal(await page.locator('#phi').inputValue(),'-60');assert.equal(await page.locator('#psi').inputValue(),'-45');
  for(const label of ['Backbone','Side chains','Atoms','van der Waals spheres','Show peptide plane','Atom labels','φ / ψ axes']){
    const before=await shot(),box=page.getByRole('checkbox',{name:label,exact:true});const previous=await box.isChecked();await box.click();assert.equal(await box.isChecked(),!previous);changed(before,await shot());await box.click();check(`${label} toggles visible geometry`);
  }
  await page.getByRole('button',{name:'β-like',exact:true}).click();assert.equal(await page.locator('#phi').inputValue(),'-135');assert.equal(await page.locator('#psi').inputValue(),'135');check('Representative preset');
  // Click the center of the plot (0,0), using SVG geometry rather than screenshot coordinates.
  const center=await page.locator('.rama svg').evaluate(svg=>{const p=svg.createSVGPoint();p.x=200;p.y=170;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};});
  await page.mouse.click(center.x,center.y);assert.ok(Math.abs(Number(await page.locator('#phi').inputValue()))<=1);assert.ok(Math.abs(Number(await page.locator('#psi').inputValue()))<=1);assert.ok(Number(await page.getByTestId('clash-count').innerText())>0);check('Plot click updates both sliders and clash computation (1° pixel tolerance)');
  const beforeClash=await shot();await page.getByRole('checkbox',{name:'Show steric clashes',exact:true}).check();changed(beforeClash,await shot());await page.screenshot({path:'artifacts/clashes.png',fullPage:true});check('Clashes displayed for unfavorable geometry');
  await page.getByRole('checkbox',{name:'van der Waals spheres',exact:true}).check();await page.screenshot({path:'artifacts/vdw.png',fullPage:true});
  await page.getByRole('button',{name:'전체 초기화',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Show steric clashes',exact:true}).isChecked(),false);check('Full reset restores geometry and options');
  const beforeCamera=await shot(),box=await canvas().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+45,{steps:10});await page.mouse.up();changed(beforeCamera,await shot());
  await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.deepEqual(await shot(),beforeCamera);check('Mouse orbit and camera reset');
  await canvas().focus();await page.keyboard.press('+');changed(beforeCamera,await shot());await page.getByRole('button',{name:'시점 초기화',exact:true}).click();assert.deepEqual(await shot(),beforeCamera);check('Keyboard zoom and reset');
  await canvas().hover();await page.mouse.wheel(0,240);await page.waitForTimeout(100);changed(beforeCamera,await shot());await page.getByRole('button',{name:'시점 초기화',exact:true}).click();check('Wheel zoom');
  for(const width of [768,390,320]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow at ${width}`);await page.screenshot({path:`artifacts/mobile-${width}.png`,fullPage:true});check(`Responsive layout at ${width}px, no horizontal overflow`);
  }
  await page.getByRole('slider',{name:'φ (phi)',exact:true}).focus();await page.keyboard.press('Home');assert.equal(await page.locator('#phi').inputValue(),'-180');check('Mobile slider keyboard operation');
  assert.deepEqual(errors,[]);check('No browser console errors or uncaught exceptions');
  await writeFile('artifacts/browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

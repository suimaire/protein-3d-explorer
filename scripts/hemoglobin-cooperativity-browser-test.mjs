import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
await import('./hemoglobin-cooperativity-audit.mjs');
if(!existsSync('artifacts/hemoglobin-transition-audit.json'))await import('./hemoglobin-transition-audit.mjs');
const audit=JSON.parse(await readFile('artifacts/hemoglobin-cooperativity-audit.json','utf8'));
const trAudit=JSON.parse(await readFile('artifacts/hemoglobin-transition-audit.json','utf8'));
const {chromium}=await import('@playwright/test');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const check=n=>{checks.push(n);console.log('✓',n);},button=name=>page.getByRole('button',{name,exact:true}),settle=()=>page.waitForTimeout(120);
const tid=id=>page.getByTestId(id),text=async id=>(await tid(id).innerText()).replace(/\s+/g,' ').trim(),main=()=>page.locator('main');
const pct=(v,n=1)=>`${(v*100).toFixed(n)}%`,popPct=v=>v>0&&v<0.001?`${(v*100).toPrecision(2)}%`:v<1&&v>0.999?`${(v*100).toFixed(3)}%`:pct(v);
const setU=async u=>{await page.locator('#po2').fill(String(u));await settle();};
const marker=async()=>({cx:Number(await tid('coop-marker').getAttribute('cx')),cy:Number(await tid('coop-marker').getAttribute('cy')),u:await tid('coop-marker').getAttribute('data-u'),y:await tid('coop-marker').getAttribute('data-y')});
const expectPoint=async p=>{
 assert.equal(await tid('u-value').innerText(),p.u.toFixed(2));
 assert.match(await text('y-value'),new RegExp(`^${pct(p.Y).replace('.','\\.')} `));
 assert.match(await text('ref-y-value'),new RegExp(`^${pct(p.reference).replace('.','\\.')} `));
 assert.match(await text('avg-o2'),new RegExp(`^${p.meanBound.toFixed(2)} / tetramer ensemble average = 4Y`));
 assert.equal(await tid('pop-t').locator('b').innerText(),popPct(p.PT));assert.equal(await tid('pop-r').locator('b').innerText(),popPct(p.PR));
 const wT=await tid('pop-t').locator('.pop-track>div').evaluate(e=>e.style.width),wR=await tid('pop-r').locator('.pop-track>div').evaluate(e=>e.style.width);
 assert.ok(Math.abs(parseFloat(wT)+parseFloat(wR)-100)<0.01,`bars ${wT} + ${wR}`);
 assert.ok(Math.abs(Number((await marker()).y)-p.Y)<6e-5);
};
const viewer=()=>tid('coop-viewer'),vdata=k=>viewer().getAttribute(`data-${k}`);

try{
 await page.goto('http://127.0.0.1:4173/protein-3d-explorer/',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});
 assert.equal(await nav.getByRole('button').count(),8);
 assert.deepEqual((await nav.getByRole('button').allInnerTexts()).slice(-3),['Chapter 3 · From Structure to Function\nHemoglobin Quaternary Structure','Chapter 3 · From Structure to Function\nHemoglobin T ↔ R Structural Transition','Chapter 3 · From Structure to Function\nHemoglobin Cooperativity & Allostery']);
 assert.doesNotMatch(await nav.innerText(),/sickle|HbS|Bohr|2,3-BPG|AlphaFold/i);
 assert.equal(requests.some(u=>/HemoglobinCooperativityLab|CooperativityStructurePanel|2DN1|2DN2/.test(u)),false,'module chunk and structures must not load at start');
 check('Eight completed modules; Chapter 3 = Quaternary, T ↔ R, Cooperativity & Allostery; no HbS/Bohr/BPG/AlphaFold; cooperativity chunk and structures not requested at start');

 await nav.getByRole('button',{name:/Cooperativity & Allostery/}).click();await tid('coop-graph').waitFor();await settle();
 assert.ok(requests.some(u=>/HemoglobinCooperativityLab/.test(u)));
 assert.equal(requests.some(u=>/\.pdb|CooperativityStructurePanel|transitionAssets/.test(u)),false,'structures are loaded only on inspection');
 assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.getByRole('alert').count(),0);
 assert.match(await page.locator('.module-heading').innerText(),/Hemoglobin Cooperativity & Allostery[\s\S]*sigmoid 모양일까/);
 assert.match(await text('coop-prompt'),/4개의 heme가 서로 독립적으로 O₂를 결합한다면 곡선은 어떤 모양일까요\?.*왜 모양이 다를까요\?/);
 assert.equal(await tid('coop-observation').evaluate(e=>e.open),false);assert.equal(await tid('occupancy-panel').evaluate(e=>e.open),false);assert.equal(await tid('advanced-panel').evaluate(e=>e.open),false);
 assert.equal(await tid('hb-curve').count(),1);assert.equal(await tid('reference-curve').count(),1);assert.equal(await tid('state-curves').count(),0);
 assert.match(await text('coop-legend'),/Hemoglobin — cooperative MWC model \(solid, ● marker\).*One-site noncooperative reference, same P50 \(dashed, ◇ marker\)/);
 assert.equal(await tid('hb-curve').getAttribute('stroke-dasharray'),null);assert.equal(await tid('reference-curve').getAttribute('stroke-dasharray'),'8 5');
 assert.match(await text('coop-science-note'),/MWC는 hemoglobin cooperativity를 설명하는 대표적인 two-state allosteric model입니다\. 실제 hemoglobin은 추가적인 tertiary\/intermediate states와 여러 조절 인자의 영향을 받습니다\..*mmHg가 아니라 모델 P50에 대한 상대 압력/);
 assert.match(await page.locator('svg[data-testid="coop-graph"] .axis-label').first().textContent(),/pO₂ \/ P50/);
 await expectPoint(audit.points['0.5']??{...audit.points[0.5]});
 check(`Opens with graph only (no canvas, no .pdb request): prediction prompt, both curves (solid vs dashed + legend), u = 0.50 → Y ${pct(audit.points['0.5'].Y)} vs reference ${pct(audit.points['0.5'].reference)}; answers, occupancy and advanced panels collapsed; MWC limitation note visible`);

 const m05=await marker();
 for(const [u,shotName] of [[0.3,'phase4c-low-o2'],[1,'phase4c-p50'],[3,'phase4c-high-o2'],[0,null],[4,null]]){
  await setU(u);const p=audit.points[String(u)];if(p)await expectPoint(p);
  const mk=await marker();assert.equal(mk.u,u.toFixed(2));
  if(u>0.5){assert.ok(mk.cx>m05.cx&&mk.cy<m05.cy,`marker moves right/up at ${u}`);}else{assert.ok(mk.cx<m05.cx,`marker moves left at ${u}`);}
  if(shotName)await page.screenshot({path:`artifacts/${shotName}.png`});
 }
 await setU(1);assert.equal(await text('y-value').then(t=>t.split(' ')[0]),'50.0%');assert.equal(await text('ref-y-value').then(t=>t.split(' ')[0]),'50.0%');
 const p1=await marker(),refBox=await tid('reference-marker').boundingBox(),hbBox=await tid('coop-marker').boundingBox();
 assert.ok(Math.abs((refBox.y+refBox.height/2)-(hbBox.y+hbBox.height/2))<1.5,'both markers meet at P50');
 await setU(0);assert.equal(await tid('pop-t').locator('b').innerText(),popPct(audit.lowLimit.PT));assert.equal(await tid('avg-o2').locator('strong').innerText(),'0.00 / tetramer');
 await page.locator('#po2').focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await settle();assert.equal(await tid('u-value').innerText(),'0.05');
 await setU(3);await expectPoint(audit.points['3']);
 check(`pO₂/P50 slider moves the graph marker and updates Y, 4Y and T/R bars (sum 100%) at 0 / 0.3 / 1 / 3 / 4 exactly as the audit: P50 → Y 50.0% both curves, T ${popPct(audit.points['1'].PT)} / R ${popPct(audit.points['1'].PR)}; u = 3 → Y ${pct(audit.points['3'].Y)}, T ${popPct(audit.points['3'].PT)}; keyboard arrows step 0.01`);

 for(const [name,value] of [['Low O₂ · 0.3','0.30'],['P50 · 1.0','1.00'],['High O₂ · 3.0','3.00']]){await button(name).click();await settle();assert.equal(await tid('u-value').innerText(),value);assert.equal(await button(name).getAttribute('aria-pressed'),'true');}
 await button('Hemoglobin (MWC)').click();await settle();assert.equal(await tid('reference-curve').count(),0);assert.equal(await tid('reference-marker').count(),0);assert.equal(await tid('hb-curve').count(),1);assert.doesNotMatch(await text('coop-legend'),/reference/);
 await button('One-site reference').click();await settle();assert.equal(await tid('hb-curve').count(),0);assert.equal(await tid('coop-marker').count(),0);assert.equal(await tid('reference-curve').count(),1);
 assert.match(await text('y-value'),/^94\.1%/,'readout still shows both values');
 await button('Both curves').click();await page.getByRole('checkbox',{name:'Pure T-state / R-state curves'}).check();await settle();
 assert.equal(await tid('state-curves').locator('path').count(),2);assert.match(await text('coop-legend'),/If every molecule stayed R-like.*If every molecule stayed T-like/);
 assert.match(await text('state-curve-note'),/T-like도 O₂를 결합하지만 affinity가 낮습니다/);
 await setU(1);assert.match(await text('state-site-sat'),new RegExp(`T-like 안에서 ${pct(audit.points['1'].yT).replace('.','\\.')}, R-like 안에서 ${pct(audit.points['1'].yR).replace('.','\\.')}`));
 await page.screenshot({path:'artifacts/phase4c-cooperativity.png'});
 await button('Reset').click();await settle();assert.equal(await tid('u-value').innerText(),'0.50');assert.equal(await tid('state-curves').count(),0);assert.equal(await button('Both curves').getAttribute('aria-pressed'),'true');
 check('Presets (0.3 / 1.0 / 3.0), curve selector (both / Hb only / reference only), pure T/R state curves with "T also binds" note and per-state site saturation; Reset restores defaults');

 await tid('occupancy-panel').locator('summary').click();await setU(1);
 for(let k=0;k<=4;k++){const cells=await tid(`occupancy-${k}`).locator('b').innerText();assert.match(cells.replace(/\s+/g,' '),new RegExp(`^${pct(audit.points['1'].occupancy[k]).replace('.','\\.')} ?${pct(audit.points['1'].referenceOccupancy[k]).replace('.','\\.')}$`));}
 assert.equal(await tid('occupancy-sum').innerText(),'1.000');assert.equal(await tid('occupancy-mean').innerText(),'2.00');
 await setU(3);assert.equal(await tid('occupancy-mean').innerText(),audit.points['3'].fourY.toFixed(2));assert.equal(await tid('occupancy-sum').innerText(),'1.000');
 assert.match(await tid('occupancy-panel').innerText(),/0→1→2→3→4 순서로 같이 움직이는 것이 아니라/);
 await tid('advanced-panel').locator('summary').click();
 assert.equal(await tid('param-L0').innerText(),'9054');assert.equal(await tid('param-c').innerText(),'0.014');assert.equal(await tid('model-p50').innerText(),`${audit.x50.toFixed(2)} K_R`);
 assert.equal(await tid('hill-p50').locator('strong').innerText(),audit.hillAtP50.toFixed(2));assert.equal(await tid('hill-current').locator('strong').innerText(),audit.points['3'].hill.toFixed(2));
 assert.match(await tid('advanced-panel').innerText(),/empirical measure이며, “동시에 결합하는 O₂의 개수”가 아닙니다[\s\S]*n_H ≤ n/);assert.match(await tid('advanced-panel').innerText(),/T affinity가 아님/);
 check(`Occupancy distribution (P50: ${audit.points['1'].occupancy.map(v=>pct(v)).join(' / ')} vs binomial ${audit.points['1'].referenceOccupancy.map(v=>pct(v)).join(' / ')}; ΣP = 1.000, ΣkP = 4Y); advanced panel L0 9054, c 0.014, P50 ${audit.x50.toFixed(2)} K_R, n_H(P50) ${audit.hillAtP50.toFixed(2)} with caveats`);

 await setU(0.4);
 await page.getByRole('button',{name:/^Inspect T-like structure/}).click();await viewer().locator('canvas').waitFor();await settle();
 assert.ok(requests.some(u=>/CooperativityStructurePanel/.test(u))&&requests.some(u=>/2DN2.*\.pdb/.test(u))&&requests.some(u=>/2DN1.*\.pdb/.test(u)));
 assert.equal(await page.locator('canvas').count(),1);
 const near=(txt,v,tol=6e-4)=>{const got=txt.split(',').map(Number);got.forEach((x,k)=>assert.ok(Math.abs(x-v[k])<tol,`${txt} vs ${v}`));};
 for(const [k,v] of [['state','T'],['layers','T'],['fraction','0.00'],['guide','off'],['visible-ligands','0']])assert.equal(await vdata(k),v,k);
 near(await vdata('sample-position'),trAudit.samples.T.position);near(await vdata('moving-sample-position'),trAudit.samples.motion.g0);
 const tSample=[await vdata('sample-position'),await vdata('moving-sample-position')],tShot=await viewer().locator('canvas').screenshot();
 for(const u of [0,1.37,3.9]){await setU(u);assert.deepEqual([await vdata('sample-position'),await vdata('moving-sample-position'),await vdata('state'),await vdata('fraction')],[...tSample,'T','0.00'],`T coordinates unchanged at u=${u}`);}
 await setU(0.4);assert.ok((await viewer().locator('canvas').screenshot()).equals(tShot),'T rendering identical after slider moves');
 assert.equal(await viewer().locator('.dimer-label:visible').count(),0);
 assert.match(await text('coop-structure-note'),/PDB 2DN2 · X-ray diffraction 1\.25 Å.*deposited O₂가 없습니다/);
 await page.getByRole('button',{name:/^Inspect R-like structure/}).click();await settle();
 for(const [k,v] of [['state','R'],['layers','R'],['fraction','0.00'],['visible-ligands','4']])assert.equal(await vdata(k),v,k);
 near(await vdata('sample-position'),trAudit.samples.R.position);
 const rSample=await vdata('sample-position');
 for(const u of [0.1,1,3]){await setU(u);assert.equal(await vdata('sample-position'),rSample);assert.equal(await vdata('visible-ligands'),'4','deposited O₂ never removed to match Y');}
 assert.match(await text('coop-structure-legend'),/R-like · 2DN1 \(O₂ bound, aligned on α1β1\).*O₂ \(4, as deposited in 2DN1\)/);
 assert.equal(await tid('coop-structure-badge').innerText(),'EXPERIMENTAL · NOT pO₂-DEPENDENT');
 await page.screenshot({path:'artifacts/phase4c-structure-r.png'});
 await button('Close structure').click();await settle();assert.equal(await page.locator('canvas').count(),0);
 check(`Inspect T-like (2DN2 deposited coordinates, no O₂) / R-like (2DN1 aligned, 4 deposited O₂) reuse the Phase 4B scene; structures fetched only now; moving the slider leaves coordinates, ligands, state and the rendered image unchanged (fraction 0.00, no motion guide); Close disposes the viewer`);

 await tid('coop-observation').locator('summary').click();
 const obs=await tid('coop-observation').innerText();
 assert.match(obs,/Positive cooperativity[\s\S]*higher-affinity conformational state를 더 많이 차지/);
 assert.match(obs,/Allostery[\s\S]*conformational equilibrium과 연결되어[\s\S]*직접 접촉하거나 서로 당기는 것이 아닙니다/);
 assert.match(obs,/Myoglobin은 하나의 heme-binding site[\s\S]*실제 myoglobin 곡선이 아닙니다/);
 assert.match(obs,/첫 O₂가 나머지 site를 직접 켜는 것이 아니라[\s\S]*T-like도 O₂를 결합합니다/);
 assert.match(obs,new RegExp(`u = 1 T ${popPct(audit.points['1'].PT).replace('.','\\.')} · R ${popPct(audit.points['1'].PR).replace('.','\\.')}`));
 const all=await main().innerText();
 assert.doesNotMatch(all,/Bohr|2,3-BPG|sickle|HbS|Glu6Val|torr|AlphaFold|morph/i);
 assert.doesNotMatch(all,/R만 O₂|T는 O₂를 결합하지 못|O₂끼리 서로 끌어|첫 번째 site affinity =/);
 check('Observation panel: positive cooperativity, allostery (ensemble/equilibrium, no direct heme contact), myoglobin caveat, T also binds, populations from the model; no Bohr / 2,3-BPG / HbS / torr / morph wording anywhere');

 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(300);await setU(0.8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  const g=await tid('coop-graph').boundingBox();assert.ok(g.width>=width-90&&g.height>=250&&g.x>=0&&g.x+g.width<=width,`graph ${g.width}x${g.height} at ${width}`);
  for(const sel of ['#po2','[data-testid="pop-t"]','[data-testid="pop-r"]','[data-testid="coop-legend"]','.coop-controls','[data-testid="coop-structure"]']){const c=await page.locator(sel).first().boundingBox();assert.ok(c.x>=0&&c.x+c.width<=width+0.5,`${sel} outside at ${width}`);}
  // Axis labels and tick labels do not overlap and stay inside the SVG.
  const boxes=await tid('coop-graph').evaluate(svg=>{const r=e=>{const b=e.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom};};return {svg:r(svg),axes:[...svg.querySelectorAll('.axis-label')].map(r),yt:[...svg.querySelectorAll('.plot-grid g text')].slice(0,5).map(r),xt:[...svg.querySelectorAll('.plot-grid g text')].slice(5).map(r)};});
  for(const t of boxes.yt)assert.ok(boxes.axes[1].r<=t.l+0.5,`y axis label overlaps ticks at ${width}`);
  for(const t of boxes.xt)assert.ok(t.b<=boxes.axes[0].t+0.5,`x axis label overlaps ticks at ${width}`);
  for(const b of [...boxes.axes,...boxes.yt,...boxes.xt])assert.ok(b.l>=boxes.svg.l-0.5&&b.r<=boxes.svg.r+0.5&&b.b<=boxes.svg.b+0.5,`label outside svg at ${width}`);
  const before=await marker();await page.locator('#po2').fill('2');await settle();assert.ok((await marker()).cx>before.cx);
  if(width===390){await page.getByRole('button',{name:/^Inspect R-like structure/}).click();await viewer().locator('canvas').waitFor();const v=await viewer().boundingBox();assert.ok(v.height>=300&&v.x+v.width<=width);await button('Close structure').click();await page.screenshot({path:'artifacts/phase4c-mobile.png',fullPage:true});}
  assert.equal(await tid('advanced-panel').evaluate(e=>e.open),true);// opened earlier in this session; default is collapsed (checked above)
  check(`${width}px: no horizontal overflow; graph ${Math.round(g.width)}×${Math.round(g.height)} px, axis/tick labels not overlapping; slider, T/R bars, legend and structure buttons inside; slider moves marker`);
 }
 await page.setViewportSize({width:1440,height:1100});
 for(let i=0;i<2;i++){
  await nav.getByRole('button',{name:/Peptide Geometry/}).click();await page.locator('#phi').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#phi').inputValue(),'-59');
  await nav.getByRole('button',{name:/α-Helix/}).click();assert.equal(await page.getByTestId('hbond-count').innerText(),'8 / 8 표시');
  await nav.getByRole('button',{name:/β-Sheet/}).click();assert.equal(await page.getByTestId('sheet-hbond-count').innerText(),'14 / 14 표시');
  await nav.getByRole('button',{name:/Hydrophobic Core/}).click();await page.getByTestId('protein-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/Soluble vs Membrane/}).click();await page.getByTestId('membrane-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/Hemoglobin Quaternary/}).click();await page.getByTestId('hb-viewer').locator('canvas').waitFor();
  await nav.getByRole('button',{name:/T ↔ R/}).click();await page.getByTestId('tr-viewer').locator('canvas').waitFor();
  assert.equal(await page.getByTestId('reference-rmsd').locator('strong').innerText(),`${trAudit.reference.rmsd.toFixed(2)} Å`);assert.equal(await page.getByTestId('moving-rotation').locator('strong').innerText(),`${trAudit.moving.angle.toFixed(1)}°`);
  await nav.getByRole('button',{name:/Cooperativity/}).click();await tid('coop-graph').waitFor();assert.equal(await page.locator('canvas').count(),0);assert.equal(await tid('u-value').innerText(),'0.50');
  await page.getByRole('button',{name:/^Inspect T-like structure/}).click();await viewer().locator('canvas').waitFor();assert.equal(await page.locator('canvas').count(),1);
 }
 check('Repeated navigation through all eight modules keeps each working (T ↔ R still 0.93 Å / 14.1°) and disposes viewers');
 assert.deepEqual(errors,[]);check('Zero console errors and uncaught exceptions');
 await writeFile('artifacts/phase4c-browser-results.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

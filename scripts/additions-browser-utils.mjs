import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
if(existsSync('.browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browser-cache');
const {chromium}=await import('@playwright/test');
export async function openLab(name,options={}){
 await mkdir('artifacts/protein-additions',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1,...options}),errors=[],failedRequests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failedRequests.push(r.status()+' '+r.url());});
 await page.goto((process.env.PROTEIN_PREVIEW_ORIGIN??'http://127.0.0.1:4173')+'/protein-3d-explorer/',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'학습 모듈'});
 if(name)await nav.getByRole('button',{name}).click();
 return {browser,page,nav,errors,failedRequests,checks,check:n=>checks.push(n),settle:()=>page.waitForTimeout(160),
  save:async file=>{await writeFile('artifacts/protein-additions/'+file+'.json',JSON.stringify({checks,errors,failedRequests},null,2));console.log(JSON.stringify({checks,errors,failedRequests},null,2));}};
}

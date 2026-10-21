import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
// Evaluate only the project data, so broken translations or local paths fail before deployment.
const projectSource = script.slice(script.indexOf('const projectsData = [') + 'const projectsData = '.length, script.indexOf('    const staticTexts = {', script.indexOf('const projectsData = ['))).trim().replace(/;$/, '');
const projects = vm.runInNewContext('(' + projectSource + ')');
assert.equal(projects.length, 13);
assert.equal(projects[0].id, 'summvia');
assert.equal(projects[0].url, 'https://summvia-vert.vercel.app/');
for (const p of projects) {
  assert.ok(fs.existsSync(new URL('../' + p.img, import.meta.url)), p.img);
  for (const lang of ['ar', 'en']) for (const key of ['title','cat','year','tech','problem']) assert.ok(p[lang][key], `${p.id}.${lang}.${key}`);
}
assert.ok(!html.includes('?raw=true'));
assert.ok(!html.includes('renderProjLoop'));
assert.ok(!html.includes("heroSection.style.filter"));
assert.ok(!html.includes('rSvg.getBoundingClientRect().width'));
assert.ok(html.includes('#projects-sticky { position: sticky;'));
const draw = script.slice(script.indexOf('function drawProjects()'), script.indexOf('function scheduleProjectDraw()'));
assert.ok(!draw.includes('getBoundingClientRect'));
// Exercise scroll boundaries, RTL, resize and reduced-motion without an idle RAF loop.
const pending = [];
let layoutReads = 0, desktop = true, reduced = false;
const wrapper = {style:{}, getBoundingClientRect:()=> { layoutReads++; return {top: 2000 - context.window.scrollY}; }};
const track = {style:{}, scrollWidth:5000};
const context = vm.createContext({
  wrapper, track, sticky:{}, projectFrame:0, measureFrame:0, projectTop:0, projectDistance:0, desktopProjects:false,
  window:{scrollY:0,innerHeight:800,matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:desktop})},
  document:{documentElement:{clientWidth:1200,dir:'ltr'}},
  requestAnimationFrame:fn=>{pending.push(fn);return pending.length;}
});
vm.runInContext(script.slice(script.indexOf('function drawProjects()'),script.indexOf('function initHorizontalScroll()')),context);
const flush = ()=>{while(pending.length) pending.shift()();};
context.updateProjHeight(); flush();
assert.equal(wrapper.style.height,'4600px');
assert.equal(track.style.transform,'translate3d(0px, 0, 0)');
context.window.scrollY = 2700;
context.scheduleProjectDraw(); context.scheduleProjectDraw();
assert.equal(pending.length,1); flush();
assert.equal(track.style.transform,'translate3d(-700px, 0, 0)');
assert.equal(layoutReads,1);
context.window.scrollY = 9000; context.scheduleProjectDraw(); flush();
assert.equal(track.style.transform,'translate3d(-3800px, 0, 0)');
context.document.documentElement.dir='rtl'; context.scheduleProjectDraw(); flush();
assert.equal(track.style.transform,'translate3d(3800px, 0, 0)');
desktop=false; context.updateProjHeight(); flush();
assert.equal(wrapper.style.height,'auto');
assert.equal(track.style.transform,'translate3d(0px, 0, 0)');
desktop=true; reduced=true; context.updateProjHeight(); flush();
assert.equal(wrapper.style.height,'auto');
assert.equal(pending.length,0);
assert.ok(html.includes('role="dialog"'));
assert.ok(html.includes('modal.inert = true'));
const assets = fs.readdirSync(new URL('../assets/', import.meta.url));
console.log(JSON.stringify({status: 'passed', projects: projects.length, translations: ['en','ar'], optimizedAssets: assets.length, assetBytes: assets.reduce((n,f) => n + fs.statSync(new URL('../assets/' + f, import.meta.url)).size,0)}, null, 2));

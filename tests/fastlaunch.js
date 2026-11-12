const assert=require('assert'),fs=require('fs'),Module=require('module');
const ol=Module._load;let zipCount=0;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){zipCount++;this.f=f}getEntries(){return[{isDirectory:false,entryName:'lwjgl.dll'},{isDirectory:false,entryName:'META-INF/x'},{isDirectory:true,entryName:'d/'}]}extractEntryTo(e,d){fs.writeFileSync(d+'/'+e.entryName,'x')}};return ol.call(this,r,...a)};
require('../src/ui/skin.js');const {_t:t}=require('../src/game.js'),Game=require('../src/game.js');
// --- анимации: каждая ≤ 4 с, конечные значения, плавное начало/конец
const K=Skin._t;assert(Object.keys(K.EM).length>=8);
for(const [n,e] of Object.entries(K.EM)){assert(e.d<=4,n+' длиннее 4 с');for(const f of [0,.1,.5,.9,1]){const P=K.newPose(),tt=e.d*f,env=Math.max(0,Math.min(1,Math.min(tt,e.d-tt)/.35));e.f(tt,env,P);for(const part of Object.values(P))for(const v of Object.values(part))assert(Number.isFinite(v)&&Math.abs(v)<12,n+' '+f)}
 const P0=K.newPose();e.f(0,0,P0);assert(Math.abs(P0.rarm.z)<1e-9&&Math.abs(P0.head.z)<1e-9,n+' старт из нейтрали');}
// --- тонкие руки и вид спереди
const d=new Uint8ClampedArray(64*64*4);const fill=(x0,y0,w,h)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)d.set([200,150,120,255],(y*64+x)*4)};
fill(44,20,4,12);fill(36,52,4,12);assert.equal(Skin.isSlim(d),false,'классика');d.fill(0);fill(44,20,3,12);fill(36,52,3,12);assert.equal(Skin.isSlim(d),true,'slim');assert.equal(Skin.isSlim(new Uint8ClampedArray(64*64*4)),false,'пустой');
let calls=0;Skin.drawFront({clearRect(){},drawImage(){calls++}},{},true);assert.equal(calls,12);
// --- быстрый запуск без сети: всё есть локально -> нет задач; не хватает файла -> ошибка (тогда обычный путь)
global.fetch=async()=>{throw new Error('сеть недоступна')};
const R='/tmp/tn';fs.rmSync(R,{recursive:true,force:true});const D=Object.fromEntries(['versions','libraries','assets','runtime','game'].map(k=>[k,R+'/'+k]));const w=(p,c='x')=>{fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,c)};
const vj={id:'1.16.5',type:'release',mainClass:'M',javaVersion:{component:'jre-legacy',majorVersion:8},downloads:{client:{url:'u',sha1:'a'.repeat(40),size:1}},assetIndex:{id:'1.16',url:'u',sha1:'b',size:1},
 arguments:{jvm:['-cp','${classpath}'],game:[]},libraries:[{name:'a:b:1',downloads:{artifact:{path:'a/b/1/b-1.jar',url:'u',sha1:'c',size:1}}},{name:'org.lwjgl:lwjgl:3',natives:{windows:'natives-windows'},downloads:{artifact:{path:'l/l.jar',url:'u',sha1:'d',size:1},classifiers:{'natives-windows':{path:'l/n.jar',url:'u',sha1:'e',size:1}}}}]};
w(D.versions+'/1.16.5/1.16.5.json',JSON.stringify(vj));w(D.versions+'/1.16.5/1.16.5.jar');w(D.libraries+'/a/b/1/b-1.jar');w(D.libraries+'/l/l.jar');w(D.libraries+'/l/n.jar');w(D.assets+'/indexes/1.16.json','{"objects":{}}');w(D.runtime+'/jre-legacy/bin/java.exe');
(async()=>{const p=await t.plan('1.16.5',D,{},new AbortController().signal,true);assert.equal(p.tasks.length,0);assert(p.javaBin.endsWith('java.exe')&&p.cp.length===3&&p.natives.length===1);
 fs.unlinkSync(D.libraries+'/a/b/1/b-1.jar');await assert.rejects(t.plan('1.16.5',D,{},new AbortController().signal,true),/не хватает файлов/);
 fs.rmSync(D.versions+'/1.16.5/1.16.5.json');await assert.rejects(t.plan('1.16.5',D,{},new AbortController().signal,true));
 // распаковка natives: один экземпляр zip на архив, служебные записи пропущены
 fs.mkdirSync(R+'/nat',{recursive:true});zipCount=0;t.extractNatives([{jar:'x.jar',exclude:['META-INF/']}],R+'/nat');assert.equal(zipCount,1);assert(fs.existsSync(R+'/nat/lwjgl.dll')&&!fs.existsSync(R+'/nat/META-INF'));
 // остановка игры не считается ошибкой
 const g=new Game(R+'/mc',()=>({}),()=>{},()=>{});let killed=false;g.proc={kill(){killed=true}};g.stop();assert(killed&&g.stopping===true);
 console.log('stage9-tests-ok')})();

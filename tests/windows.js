// Несколько окон игры: деление памяти, независимые процессы, остановка по одному, скин и ник на окно, ошибки
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module');
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(){this.f={}}addFile(n,b){this.f[n]=b}writeZip(p){fs.writeFileSync(p,JSON.stringify(Object.keys(this.f)))}};return ol.call(this,r,...a)};
const Game=require('../src/game.js'),{_t:t}=Game,{optionsText}=require('../src/skinpack.js');
// --- деление памяти
assert.equal(t.splitRam(4096,1),4096);assert.equal(t.splitRam(4096,2),2048);assert.equal(t.splitRam(4096,3),1365);assert.equal(t.splitRam(2048,3),1024,'не меньше 1 ГБ');
// --- options.txt: основной пак и паки окон не накапливаются
let o=optionsText('resourcePacks:["vanilla","file/TotemSkin.zip","file/TotemSkin-2.zip","mine"]\n','1.20.1',true,'TotemSkin-3');
assert.equal(o.trim(),'resourcePacks:["vanilla","mine","file/TotemSkin-3.zip"]');
assert.equal(optionsText(o,'1.20.1',false,'TotemSkin-3').trim(),'resourcePacks:["vanilla","mine"]');
assert.equal(optionsText('resourcePacks:["TotemSkin-2.zip"]\n','1.12.2',true).trim(),'resourcePacks:["TotemSkin.zip"]');
// --- заготовка: установленная версия и «java» — скрипт, который просто ждёт
global.fetch=async()=>{throw new Error('нет сети')};
const R='/tmp/tw';fs.rmSync(R,{recursive:true,force:true});const w=(p,c='x')=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c)};
const V=R+'/mc/versions/1.16.5';w(V+'/1.16.5.json',JSON.stringify({id:'1.16.5',type:'release',mainClass:'M',javaVersion:{component:'jre-legacy',majorVersion:8},downloads:{client:{url:'u',sha1:'a'.repeat(40),size:1}},assetIndex:{id:'1.16',url:'u',sha1:'b',size:1},
 arguments:{jvm:['-cp','${classpath}'],game:['--username','${auth_player_name}']},libraries:[{name:'a:b:1',downloads:{artifact:{path:'a/b/1/b-1.jar',url:'u',sha1:'c',size:1}}}]}));
w(V+'/1.16.5.jar');w(V+'/.installed','1');w(V+'/natives/lwjgl.dll');w(R+'/mc/libraries/a/b/1/b-1.jar');w(R+'/mc/assets/indexes/1.16.json','{"objects":{}}');
const JAVA=R+'/java.sh';w(JAVA,'#!/bin/sh\nexec sleep 20\n');fs.chmodSync(JAVA,0o755);
const logs=[],evs=[];let S={ram:4096,maxRam:16000,playerName:'Host',javaPath:JAVA,skinInGame:true};
const g=new Game(R+'/mc',()=>S,()=>{},(m)=>logs.push(m),null,(l)=>evs.push(l));
const until=async(f,ms=6000)=>{const t0=Date.now();while(!f()){if(Date.now()-t0>ms)throw new Error('timeout: '+JSON.stringify(g.list()));await new Promise(r=>setTimeout(r,20))}};
const png=Buffer.from('89504e470d0a1a0a','hex');
(async()=>{
 await until(()=>true);g.start('1.16.5',true);await until(()=>g.state==='playing');
 assert(g.running&&g.active&&g.list().length===1&&g.list()[0].id==='main');
 let ri=g.ramInfo();assert.equal(ri.windows,2);assert.equal(ri.share,2048);assert.equal(ri.used,4096);assert(!ri.over,'4096+2048 < 16000');
 S={...S,maxRam:5000};assert(g.ramInfo().over,'сумма больше памяти компьютера — предупреждение');S={...S,maxRam:16000};
 // второе окно: свой ник, своя память, свой скин
 const a=g.openWindow({id:'1.16.5',name:'Bob',title:'Тест',getAuth:async()=>null,skin:{wide:png,slim:png}});assert.equal(a.ram,2048);
 await until(()=>g.list().some((x)=>x.id===a.id&&x.state==='playing'));
 const cmd=logs.filter((m)=>m.startsWith('launch')).pop();assert(/-Xmx2048M/.test(cmd)&&/--username Bob/.test(cmd),cmd);assert(/-Xmx4096M/.test(logs.find((m)=>m.startsWith('launch'))),'основное окно сохранило свою память');
 assert(fs.existsSync(R+'/mc/game/resourcepacks/TotemSkin-2.zip')&&/file\/TotemSkin-2\.zip/.test(fs.readFileSync(R+'/mc/game/options.txt','utf8')));
 assert.equal(g.ramInfo().windows,3);assert.equal(g.ramInfo().share,1365);
 // третье окно без скина и с ошибкой запуска (нет такой версии) — не мешает остальным
 const bad=g.openWindow({id:'9.9.9',name:'X',getAuth:async()=>null,skin:null});await until(()=>evs.some((l)=>l.some((x)=>x.id===bad.id&&x.state==='error')));await until(()=>!g.list().some((x)=>x.id===bad.id));
 assert(evs.flat().find((x)=>x.id===bad.id&&x.state==='error').error,'у окна с ошибкой есть текст');
 assert(g.list().length===2&&g.state==='playing','остальные окна работают');
 // закрыть одно окно: второе живёт, скин-пак убран
 assert(g.stopWin(a.id));await until(()=>!g.list().some((x)=>x.id===a.id));assert(g.state==='playing'&&g.proc);
 assert(!fs.existsSync(R+'/mc/game/resourcepacks/TotemSkin-2.zip'),'пак скина закрытого окна удалён');
 // ещё окно, затем «закрыть все»
 const b=g.openWindow({id:'1.16.5',name:'Eve',getAuth:async()=>null,skin:null});await until(()=>g.list().some((x)=>x.id===b.id&&x.state==='playing'));
 assert.equal(g.list().length,2);g.stopAll();await until(()=>!g.running&&g.list().length===0);assert(!g.active);
 // основное окно можно закрыть, пока работает дополнительное
 g.start('1.16.5',true);await until(()=>g.state==='playing');const c=g.openWindow({id:'1.16.5',name:'Zed',getAuth:async()=>null,skin:null});await until(()=>g.list().some((x)=>x.id===c.id&&x.state==='playing'));
 g.stopWin('main');await until(()=>!g.proc);
 g.start('1.16.5',true);await until(()=>g.state==='playing');assert(/-Xmx2048M/.test(logs.filter((m)=>m.startsWith('launch')).pop()),'основное окно при работающем втором получает половину памяти');g.stopWin('main');await until(()=>!g.proc);assert(g.running&&g.list().length===1&&g.list()[0].id===c.id);g.stopAll();await until(()=>!g.running);
 console.log('windows-tests-ok');
})().catch((e)=>{console.error(e);process.exit(1)});

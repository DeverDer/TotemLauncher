const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module');
let zips=[];const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(){this.e={}}addFile(n,b){this.e[n]=b}writeZip(p){zips.push(Object.keys(this.e));fs.writeFileSync(p,JSON.stringify(this.e))}};return ol.call(this,r,...a)};
require('../src/ui/skin.js');const SP=require('../src/skinpack.js'),{_t:t}=require('../src/game.js'),Shots=require('../src/shots.js');
// --- pack_format и options.txt
assert.equal(SP.packFormat('1.16.5'),6);assert.equal(SP.packFormat('1.12.2'),3);assert.equal(SP.packFormat('1.21.1'),34);assert.equal(SP.packFormat('1.20.1'),15);assert.equal(SP.packFormat('26.1'),64);
assert.equal(SP.optionsText('','1.16.5',true),'resourcePacks:["vanilla","file/TotemSkin.zip"]\n');assert.equal(SP.optionsText('','1.12.2',true),'resourcePacks:["TotemSkin.zip"]\n');
assert.equal(SP.optionsText('fov:0.5\nresourcePacks:["vanilla","file/A.zip"]\nlang:ru','1.20.1',true),'fov:0.5\nresourcePacks:["vanilla","file/A.zip","file/TotemSkin.zip"]\nlang:ru');
assert.equal(SP.optionsText('resourcePacks:["vanilla","file/TotemSkin.zip","file/A.zip"]','1.20.1',true),'resourcePacks:["vanilla","file/A.zip","file/TotemSkin.zip"]','наш пак всегда сверху, без дублей');
assert.equal(SP.optionsText('resourcePacks:["vanilla","file/TotemSkin.zip"]','1.20.1',false),'resourcePacks:["vanilla"]');assert.equal(SP.optionsText('resourcePacks:мусор','1.20.1',true),'resourcePacks:мусор','чужой формат не ломаем');
const R='/tmp/tp';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R+'/act',{recursive:true});fs.writeFileSync(R+'/act/wide.png','W');fs.writeFileSync(R+'/act/slim.png','S');
SP.applySkin(R+'/g','1.16.5',R+'/act',true);assert(zips[0].includes('pack.mcmeta')&&zips[0].includes('assets/minecraft/textures/entity/alex.png')&&zips[0].includes('assets/minecraft/textures/entity/player/slim/zuri.png')&&zips[0].length===21);
const pk=JSON.parse(fs.readFileSync(R+'/g/resourcepacks/TotemSkin.zip','utf8'));assert.deepEqual(pk['assets/minecraft/textures/entity/steve.png'].data,[87]);assert.deepEqual(pk['assets/minecraft/textures/entity/alex.png'].data,[83]);assert.deepEqual(pk['assets/minecraft/textures/entity/player/slim/noor.png'].data,[83]);
assert(fs.readFileSync(R+'/g/options.txt','utf8').includes('file/TotemSkin.zip'));SP.applySkin(R+'/g','1.16.5',R+'/nonexistent',true);assert(!fs.readFileSync(R+'/g/options.txt','utf8').includes('TotemSkin'),'нет активного скина — пак отключается');
// --- Classic <-> Slim
const d=new Uint8ClampedArray(64*64*4);for(let j=0;j<12;j++)for(let i=0;i<3;i++)d.set([10+i,20+j,30,255],((20+j)*64+44+i)*4);
const cl=Skin.convertArms(d,true,false);assert.deepEqual([...cl.slice((20*64+47)*4,(20*64+47)*4+3)],[12,20,30],'4-й столбец дублирует 3-й');assert.deepEqual([...cl.slice((20*64+44)*4,(20*64+44)*4+3)],[10,20,30]);
const back=Skin.convertArms(cl,false,true);assert.deepEqual([...back.slice((25*64+46)*4,(25*64+46)*4+3)],[12,25,30]);assert.equal(back[(20*64+47)*4+3],0,'у slim последний столбец прозрачен');
// --- 1.16: основной jar и natives одной записью с тем же именем (раньше natives пропадали)
global.fetch=async()=>{throw new Error('offline')};const w=(p,c='x')=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c)};
const D=Object.fromEntries(['versions','libraries','assets','runtime','game'].map(k=>[k,R+'/mc/'+k]));
const vj={id:'1.16.5',type:'release',mainClass:'M',downloads:{client:{url:'u',sha1:'a'.repeat(40),size:1}},assetIndex:{id:'1.16',url:'u',sha1:'b',size:1},arguments:{jvm:['-cp','${classpath}'],game:[]},libraries:[
 {name:'org.lwjgl:lwjgl:3.2.2',downloads:{artifact:{path:'l/l.jar',url:'u',sha1:'d',size:1}}},{name:'org.lwjgl:lwjgl:3.2.2',natives:{windows:'natives-windows'},downloads:{classifiers:{'natives-windows':{path:'l/n.jar',url:'u',sha1:'e',size:1}}}},
 {name:'com.mojang:text2speech:1.11.3',downloads:{artifact:{path:'t/t.jar',url:'u',sha1:'f',size:1}}},{name:'com.mojang:text2speech:1.11.3',natives:{windows:'natives-windows'},downloads:{classifiers:{'natives-windows':{path:'t/n.jar',url:'u',sha1:'g',size:1}}}}]};
w(D.versions+'/1.16.5/1.16.5.json',JSON.stringify(vj));w(D.versions+'/1.16.5/1.16.5.jar');for(const f of ['l/l.jar','l/n.jar','t/t.jar','t/n.jar'])w(D.libraries+'/'+f);w(D.assets+'/indexes/1.16.json','{"objects":{}}');w(D.runtime+'/jre-legacy/bin/java.exe');
(async()=>{const p=await t.plan('1.16.5',D,{},new AbortController().signal,true);assert.equal(p.natives.length,2,'natives обеих библиотек');assert.equal(p.cp.length,3,'основные jar без дублей + клиент');
 // --- сводка краша
fs.writeFileSync(R+'/crash.txt','---- Minecraft Crash Report ----\nTime: x\nDescription: Initializing game\n\njava.lang.UnsatisfiedLinkError: Failed to locate library: lwjgl.dll\n\tat org.lwjgl');assert.equal(t.crashSummary(R+'/crash.txt'),'Description: Initializing game | java.lang.UnsatisfiedLinkError: Failed to locate library: lwjgl.dll');assert.equal(t.crashSummary(R+'/no'),'');
 // --- скриншоты
 const S=R+'/ud';for(const f of ['minecraft/game/screenshots/2026-11-07_15.00.37.png','instances/abc/screenshots/b.png','minecraft/game/screenshots/note.txt'])w(S+'/'+f);
 const sh=new Shots(S,{all:()=>[{id:'abc',name:'Моя сборка'}]}),L=sh.list();assert.equal(L.length,2);assert(L.some(x=>x.src==='Моя сборка'));
 for(const bad of ['../x.png','minecraft/game/screenshots/../../x.png','minecraft/game/screenshots/sub/a.png','minecraft/game/screenshots/note.txt','instances/zzz/screenshots/b.png','/etc/passwd'])assert.throws(()=>sh.abs(bad),/Недопустимый/,bad);
 sh.rename('instances/abc/screenshots/b.png','красивый вид');assert(fs.existsSync(S+'/instances/abc/screenshots/красивый вид.png'));assert.throws(()=>sh.rename('minecraft/game/screenshots/2026-11-07_15.00.37.png','../x'),/Недопустимое/);w(S+'/minecraft/game/screenshots/x.png');assert.throws(()=>sh.rename('minecraft/game/screenshots/2026-11-07_15.00.37.png','x'),/занято/);
 console.log('stage10-tests-ok')})();

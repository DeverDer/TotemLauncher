// Диагностика сборок: статический анализ и разбор логов ошибок
const assert=require('assert'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const D=require('../src/diagnose.js'),ErrLog=require('../src/errlog.js');
const R='/tmp/tdiag';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R+'/mods',{recursive:true});
const row=(name,o={})=>({name,enabled:true,modId:name.replace(/\.jar$/,''),title:name,loader:'fabric',deps:[],provides:[],breaks:[],...o});
const inst={loader:'fabric',mc:'1.20.1',name:'T'};
const has=(F,code,pred=()=>true)=>F.some((f)=>f.code===code&&pred(f));
// --- статический анализ
let F=D.analyzeStatic([row('iris.jar',{deps:[{id:'fabric-api',req:true},{id:'sodium',req:true,range:'>=0.5.8'}]}),row('sodium.jar',{version:'0.5.3'})],inst);
assert(has(F,'missing-dep',(f)=>f.ids[0]==='fabric-api'&&f.fix==='install'&&f.search==='fabric-api'),'нет fabric-api');
assert(has(F,'dep-version',(f)=>f.files.includes('sodium.jar')),'версия sodium ниже требуемой');
F=D.analyzeStatic([row('iris.jar',{deps:[{id:'fabric-api',req:true},{id:'fabric-resource-loader-v0',req:true},{id:'fabricloader',req:true,range:'>=0.14'},{id:'minecraft',req:true},{id:'java',req:true}]}),row('fabric-api.jar',{modId:'fabric-api'})],inst);
assert(!has(F,'missing-dep'),'fabric-api закрывает fabric-*-модули, loader/java/minecraft встроены');
F=D.analyzeStatic([row('a-1.jar',{modId:'a',version:'1'}),row('a-2.jar',{modId:'a',version:'2'})],inst);assert(has(F,'duplicate',(f)=>f.files.length===2&&f.fix==='disable'));
F=D.analyzeStatic([row('forgemod.jar',{loader:'forge',warn:'Мод для forge, а в сборке fabric'}),row('old.jar',{warn:'Мод рассчитан на Minecraft 1.19.2, а сборка на 1.20.1'}),row('srv.jar',{env:'server'})],inst);
assert(has(F,'wrong-loader')&&has(F,'wrong-mc')&&has(F,'server-only'));assert.equal(F[0].level,'error','ошибки выше предупреждений');
F=D.analyzeStatic([row('optifine_HD_U_I9.jar',{modId:'optifine'}),row('sodium-fabric.jar',{modId:'sodium'})],inst);assert(has(F,'optifine-clash'));
F=D.analyzeStatic([row('x.jar',{breaks:['y']}),row('y.jar')],inst);assert(has(F,'conflict'));
F=D.analyzeStatic([row('a.jar')],{loader:'vanilla',mc:'1.20.1'});assert(has(F,'no-loader'));
F=D.analyzeStatic(Array.from({length:260},(_,i)=>row('m'+i+'.jar')),inst,{ram:4096});assert(has(F,'ram'),'много модов, мало памяти');
F=D.analyzeStatic(Array.from({length:260},(_,i)=>row('m'+i+'.jar')),inst,{ram:8192});assert(!has(F,'ram'));
F=D.analyzeStatic([row('old.jar',{loose:true,deps:[{id:'codechickencore',req:true}]})],{loader:'forge',mc:'1.12.2'});assert(F.find((f)=>f.code==='missing-dep').level==='warn','для старых Forge-модов имена зависимостей ненадёжны: только предупреждение');
F=D.analyzeStatic([row('off.jar',{enabled:false,deps:[{id:'zzz',req:true}]})],inst);assert(F.length===0,'выключенные моды не проверяются');
// --- лог: Fabric
const fabricLog=`[main/ERROR]: Incompatible mods found!
net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the game or each other!
A potential solution has been determined, this may resolve your problem:
\t - Install fabric-api, any version.
\t - Replace mod 'Sodium Extra' (sodium-extra) 0.5.0 with any version that is compatible with sodium, 0.5.8 or later.
Unmet dependency listing:
\t - Mod 'Iris Shaders' (iris) 1.6.0 requires any version of fabric-api, which is missing!
\t - Mod 'Sodium Extra' (sodium-extra) 0.5.0 requires version 0.5.8 or later of sodium, which is missing!
More details:
\t - Mod 'Iris Shaders' (iris) 1.6.0 requires any version of fabric-api, which is missing!
`;
const rows=[row('iris.jar',{modId:'iris',title:'Iris Shaders'}),row('sodium-extra.jar',{modId:'sodium-extra',title:'Sodium Extra'})];
F=D.analyzeLog(fabricLog,{rows});
assert(has(F,'missing-dep',(f)=>f.ids[0]==='iris'&&f.files[0]==='iris.jar'&&f.search==='fabric-api'),'Iris требует fabric-api: '+JSON.stringify(F.map((f)=>f.title)));
assert(has(F,'missing-dep',(f)=>f.search==='sodium'&&f.files[0]==='sodium-extra.jar'));assert(!F.some((f)=>f.code==='missing-dep'&&!f.files.length&&f.search==='fabric-api'),'общий «Install fabric-api» не дублирует конкретное требование Iris');assert(has(D.analyzeLog('Incompatible mods found!\nA potential solution has been determined, this may resolve your problem:\n\t - Install fabric-api, any version.\n',{rows:[]}),'missing-dep',(f)=>f.search==='fabric-api'&&f.fix==='install'),'«Install X» остаётся, если ни один мод не назван');assert(has(F,'replace-mod',(f)=>f.files[0]==='sodium-extra.jar'));assert(!has(F,'incompatible-set'));
assert.equal(F.filter((f)=>f.code==='missing-dep'&&f.ids[0]==='iris').length,1,'повторы строк не плодят находки');
assert(has(D.analyzeLog('Incompatible mods found!\nnothing useful',{rows}),'incompatible-set'));
// --- лог: Forge (FML 1.18+) и 1.12.2
F=D.analyzeLog(`Missing or unsupported mandatory dependencies:\n\tMod ID: 'geckolib', Requested by: 'alexsmobs', Expected range: '[4.2,)', Actual version: 'MISSING'\n\tMod ID: 'citadel', Requested by: 'alexsmobs', Expected range: '[2.5,)', Actual version: '2.1.0'\n`,{rows:[row('alexsmobs.jar',{loader:'forge'})]});
assert(has(F,'missing-dep',(f)=>f.ids[0]==='geckolib'&&f.fix==='install'&&f.files[0]==='alexsmobs.jar'));assert(has(F,'missing-dep',(f)=>f.ids[0]==='citadel'&&f.fix==='update'));
F=D.analyzeLog(`-- Mod loading issue for: create --\nDetails:\n\tMod file: /mods/create.jar\n\tFailure message: Mod create requires flywheel 0.6.9 or above\n\tMod version: 0.5.1\n`,{rows:[row('create.jar',{modId:'create'})]});assert(has(F,'mod-load',(f)=>f.files[0]==='create.jar'&&/flywheel/.test(f.detail)));
F=D.analyzeLog(`net.minecraftforge.fml.common.DuplicateModsFoundException: Found a duplicate mod jei at [mods/jei-1.jar, mods/jei-2.jar]`,{rows:[row('jei-1.jar'),row('jei-2.jar')]});assert(has(F,'duplicate',(f)=>f.files.length===2));
F=D.analyzeLog(`---- Minecraft Crash Report ----\n-- System Details --\n\tSuspected Mods: \n\t\tSomeMod (somemod), Version: 1.0\n`,{rows:[row('somemod.jar',{modId:'somemod'})]});assert(has(F,'suspect',(f)=>f.files[0]==='somemod.jar'));
assert(!has(D.analyzeLog('Suspected Mods: None\n',{rows}),'suspect'));
// --- Mixin / entrypoint / исключение
F=D.analyzeLog(`Mixin apply for mod sodium failed sodium.mixins.json:core.GameRendererMixin from mod sodium -> net.minecraft.client.render.GameRenderer: InjectionError`,{rows:[row('sodium.jar',{modId:'sodium',title:'Sodium'})]});assert(has(F,'mixin',(f)=>f.files[0]==='sodium.jar'&&f.fix==='disable'));
F=D.analyzeLog(`Could not execute entrypoint stage 'main' due to errors, provided by 'badmod'`,{rows:[row('badmod.jar',{modId:'badmod'})]});assert(has(F,'entrypoint',(f)=>f.files[0]==='badmod.jar'));
// --- память, Java, аргументы
F=D.analyzeLog('Exception in thread "main" java.lang.OutOfMemoryError: Java heap space',{ram:2048});assert(has(F,'oom',(f)=>/2048/.test(f.detail)&&f.fix==='ram'));
F=D.analyzeLog('Could not reserve enough space for 4194304KB object heap',{});assert(has(F,'heap-reserve'));
F=D.analyzeLog("Unrecognized VM option 'UseFancyGC'\nError: Could not create the Java Virtual Machine.",{});assert(has(F,'jvm-arg',(f)=>/UseFancyGC/.test(f.title)));assert(!has(F,'jvm'),'общий текст не дублирует точную находку');
F=D.analyzeLog('java.lang.UnsupportedClassVersionError: com/foo/Bar has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0',{});assert(has(F,'java-version',(f)=>/Java 21/.test(f.title)&&/Java 17/.test(f.title)));
F=D.analyzeLog('Caused by: java.lang.NoClassDefFoundError: dev/architectury/event/Event',{rows});assert(has(F,'missing-class',(f)=>/Architectury/.test(f.detail)&&f.search==='Architectury API'));
F=D.analyzeLog('java.lang.NoClassDefFoundError: java/util/Foo',{rows});assert(!has(F,'missing-class'),'классы JDK пропускаем');
// --- стек вызовов → мод по пакетам классов (реальный zip)
const crc=(b)=>{let c,r=0xffffffff;for(const x of b){c=(r^x)&255;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;r=(r>>>8)^c}return(r^0xffffffff)>>>0};
function makeZip(es){const loc=[],cen=[];let off=0;for(const e of es){const n=Buffer.from(e.name),raw=Buffer.from(e.data||''),data=zlib.deflateRawSync(raw);const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc(raw),14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(n.length,26);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc(raw),16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(n.length,28);ch.writeUInt32LE(off,42);loc.push(lh,n,data);cen.push(ch,n);off+=30+n.length+data.length}const cd=Buffer.concat(cen),eo=Buffer.alloc(22);eo.writeUInt32LE(0x06054b50,0);eo.writeUInt16LE(es.length,8);eo.writeUInt16LE(es.length,10);eo.writeUInt32LE(cd.length,12);eo.writeUInt32LE(off,16);return Buffer.concat([...loc,cd,eo])}
fs.writeFileSync(R+'/mods/sodium.jar',makeZip([{name:'me/jellysquid/mods/sodium/client/Foo.class'},{name:'me/jellysquid/mods/sodium/Bar.class'}]));fs.writeFileSync(R+'/mods/other.jar',makeZip([{name:'com/other/mod/Main.class'}]));
(async()=>{
 const rr=[row('sodium.jar',{modId:'sodium',title:'Sodium'}),row('other.jar',{modId:'other'})];
 const idx=await D.classIndex(rr,R+'/mods');assert.equal(D.fileOfClass('me.jellysquid.mods.sodium.client.Foo',idx),'sodium.jar');assert.equal(D.fileOfClass('com.other.mod.Main$Inner',idx),'other.jar');assert.equal(D.fileOfClass('net.minecraft.Foo',idx),null);
 const crash=`java.lang.RuntimeException: boom\n\tat me.jellysquid.mods.sodium.client.Foo.render(Foo.java:10)\n\tat me.jellysquid.mods.sodium.Bar.tick(Bar.java:5)\n\tat net.minecraft.client.Minecraft.run(Minecraft.java:1)\n`;
 F=await D.analyzeFailure({text:crash,rows:rr,inst,ram:4096,modsDir:R+'/mods',code:1});assert(has(F,'stack',(f)=>f.files[0]==='sodium.jar'),JSON.stringify(F.map((f)=>f.code)));
 F=await D.analyzeFailure({text:'',rows:[row('a.jar')],inst,ram:4096,modsDir:R+'/mods',code:1});assert(F.length===1&&F[0].code==='unknown'&&F[0].level==='info','без причин — понятная подсказка');
 F=await D.analyzeFailure({text:'',rows:[row('a.jar',{deps:[{id:'zzz',req:true}]})],inst,ram:4096,modsDir:R+'/mods',code:1});assert(has(F,'missing-dep'),'причину берём из статического анализа, если лог пуст');
 // --- журнал ошибок
 const L=new ErrLog(R+'/errors.json');assert.deepEqual(L.list(),[]);const e1=L.add({title:'Сборка не запустилась',message:'код 1',build:{id:'abc',name:'Моя',mc:'1.20.1',loader:'fabric'},findings:F,raw:'x'.repeat(50000)});assert(e1.raw.length<=24000&&e1.id);
 for(let i=0;i<45;i++)L.add({title:'e'+i});assert.equal(L.list().length,40,'не больше 40');assert.equal(L.list()[0].title,'e44','новые сверху');L.remove(L.list()[0].id);assert.equal(L.list().length,39);L.clear();assert.deepEqual(L.list(),[]);fs.writeFileSync(R+'/errors.json','мусор');assert.deepEqual(L.list(),[],'повреждённый файл не ломает');
 console.log('diagnose-tests-ok');
})().catch((e)=>{console.error(e);process.exit(1)});

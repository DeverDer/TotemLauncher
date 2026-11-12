// Безопасность: обход путей, небезопасные ссылки, раздутые/подменённые файлы, опасные флаги JVM, имена Windows, проверка Ely.by
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip'&&global.ZIPS)return class{constructor(p){this.p=p;this.f=global.ZIPS[p]||[]}getEntries(){return this.f.map(([n,d])=>({entryName:n,isDirectory:false,header:{size:d.length},getData:()=>Buffer.from(d),toString(){return n}}))}getEntry(n){return this.getEntries().find(e=>e.entryName===n)||null}readAsText(e){return e.getData().toString()}addFile(){}writeZip(p){fs.writeFileSync(p,'zip')}};return ol.call(this,r,...a)};
const G=require('../src/game.js'),{_t:t}=G,C=require('../src/catalog.js'),I=require('../src/instances.js'),FM=require('../src/fm.js'),Ely=require('../src/ely.js'),{optionsText}=require('../src/skinpack.js');
const R='/tmp/tsec';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R,{recursive:true});
// --- пути: «libraries-evil» не внутри «libraries», id версий без «..» и слэшей
assert(t.within('/a/libraries','/a/libraries/x/y.jar')&&!t.within('/a/libraries','/a/libraries-evil/x.jar')&&!t.within('/a/libraries','/a/libraries/../x'));
for(const ok of ['1.20.1','24w14a','1.RV-Pre1','3D Shareware v1.34','fabric-loader-0.15.11-1.20.1','1.12.2-forge-14.23.5.2860'])assert(t.SAFE_ID.test(ok),ok);
for(const bad of ['..','../x','a/b','a\\b','.hidden','a..b','','x'.repeat(61),'a\0b'])assert(!t.SAFE_ID.test(bad),JSON.stringify(bad));
// --- ссылки: только https (и localhost для тестов)
assert.throws(()=>t.httpsOnly('http://evil.example/a.jar'),/HTTPS/);assert.throws(()=>t.httpsOnly('ftp://x/a'),/HTTPS/);assert.throws(()=>t.httpsOnly('not a url'),/Некоррект/);t.httpsOnly('https://libraries.minecraft.net/a.jar');t.httpsOnly('http://127.0.0.1:8080/a');
// --- флаги JVM, подключающие чужой код
for(const f of ['-javaagent:/x.jar','-agentlib:jdwp=transport=dt_socket','-agentpath:/x.dll','-Xbootclasspath/a:x.jar','-XX:OnError=calc.exe','-XX:OnOutOfMemoryError=x','-cp','-classpath','--class-path','-jar','@args.txt','-Djava.library.path=C:\\evil','-XX:Flags=x','-XX:VMOptionsFile=x','--patch-module','-Xrunjdwp:x'])assert(G.badJvm('-Xms1G '+f),f);
for(const f of ['-Xmx4G','-XX:+UseG1GC','-Dfile.encoding=UTF-8','-XX:MaxGCPauseMillis=50','--add-opens=java.base/java.lang=ALL-UNNAMED'])assert.equal(G.badJvm(f),'',f);
const args=t.buildArgs({id:'1',name:'x',ram:1024,cp:['a'],ndir:'n',gameDir:'g',assetsRoot:'as',jvmArgs:'-javaagent:/evil.jar -XX:+UseG1GC -cp /evil',vj:{type:'release',mainClass:'M',assetIndex:{id:'1'},minecraftArguments:'--username ${auth_player_name}'}});
assert(!args.some(a=>/javaagent|\/evil|UseG1GC/.test(a)),'при опасном флаге пользовательские JVM-аргументы не применяются целиком');
assert(t.buildArgs({id:'1',name:'x',ram:1024,cp:['a'],ndir:'n',gameDir:'g',assetsRoot:'as',jvmArgs:'-XX:+UseG1GC',vj:{type:'release',mainClass:'M',assetIndex:{id:'1'},minecraftArguments:''}}).includes('-XX:+UseG1GC'),'обычные флаги работают');
// --- относительные пути из модпаков и архивов
for(const bad of ['../x','a/../../x','/abs/x','\\abs','C:\\x','C:x','file.txt:stream','CON','dir/nul.txt','COM1.dat','x.','x /y','.totem-catalog.json','a\0b'])assert(C.badRel(bad),bad);
for(const ok of ['mods/a.jar','config/sodium-options.json','overrides/x/y.txt','shaderpacks/Complementary Reimagined.zip'])assert(!C.badRel(ok),ok);
// --- имена на Windows: устройства и точка/пробел в конце
const fm=new FM(R+'/fm');fs.mkdirSync(R+'/fm',{recursive:true});for(const n of ['con','NUL','com1.txt','lpt2','a.','..','a/b','a:b'])assert.throws(()=>fm.name(n),/Недопустимое/,n);fm.name('Мир 1');
assert.throws(()=>fm.abs('../outside'),/вне папки/);assert.throws(()=>fm.item(''),/Корнев/);
fs.mkdirSync(R+'/outside',{recursive:true});try{fs.symlinkSync(R+'/outside',R+'/fm/link','dir');assert.throws(()=>fm.abs('link/x'),/вне папки/,'симлинк наружу');}catch(e){if(e.code!=='EPERM')throw e}
// --- сборки: id и версия, имена файлов
const inst=new I(R+'/inst',R+'/inst.json');assert.throws(()=>inst.create({name:'x',mc:'..',loader:'vanilla'}),/версия/);assert.throws(()=>inst.create({name:'x',mc:'../../etc',loader:'vanilla'}),/версия/);assert.throws(()=>inst.dir({id:'../x'}),/Повреждённая/);
const a=inst.create({name:'  A\u202e\u0001B ',mc:'1.20.1',loader:'vanilla'});assert.equal(a.name,'AB','управляющие и bidi-символы убраны');
for(const bad of ['..','../x','a/b','.hid','CON','nul.jar','a:b.jar'])assert.throws(()=>inst.safe(a.id,'mods',bad),/Недопустимое/,bad);
fs.writeFileSync(R+'/CON.jar','x');assert.throws(()=>inst.add(a.id,'mods',[R+'/CON.jar']),/недопустимое имя/);
// --- zip-бомба в метаданных мода: огромный fabric.mod.json не читаем
global.ZIPS={};fs.writeFileSync(R+'/big.jar','x');global.ZIPS[R+'/big.jar']=[['fabric.mod.json','x'.repeat(5*1048576)]];
// (jarInfo с мок-архивом: размер считается по header.size)
const rows=(()=>{fs.copyFileSync(R+'/big.jar',R+'/inst/'+a.id+'/mods/big.jar');return inst.list(a.id,'mods')})();assert(rows.length===1&&!rows[0].title,'метаданные >4 МБ не разбираются');
// --- options.txt: «$» в имени чужого пака не ломает строку
assert.equal(optionsText('resourcePacks:["a$&b","x$1"]\n','1.20.1',true).trim(),'resourcePacks:["a$&b","x$1","file/TotemSkin.zip"]');
// --- загрузка: перенаправление на http, раздутый ответ, неверный хэш
const body=(n)=>new Response(Buffer.alloc(n,7)).body;
(async()=>{
 const T=(over)=>({url:'https://piston-data.mojang.com/x',dest:R+'/dl/f.bin',label:'f',...over});
 global.fetch=async()=>({ok:true,url:'http://evil.example/x',body:body(10)});await assert.rejects(t.download(T({}),null,()=>{}),/небезопасн|Перенаправлен/i);
 global.fetch=async()=>({ok:true,url:'https://piston-data.mojang.com/x',body:body(5000)});await assert.rejects(t.download(T({size:10}),null,()=>{}),/больше ожидаемого/);assert(!fs.existsSync(R+'/dl/f.bin')&&!fs.existsSync(R+'/dl/f.bin.part'),'мусор не остаётся');
 global.fetch=async()=>({ok:true,url:'https://piston-data.mojang.com/x',body:body(10)});await assert.rejects(t.download(T({size:10,sha1:'0'.repeat(40)}),null,()=>{}),/sha1/);
 global.fetch=async()=>({ok:true,url:'https://piston-data.mojang.com/x',body:body(10)});await t.download(T({size:10,sha1:crypto.createHash('sha1').update(Buffer.alloc(10,7)).digest('hex')}),null,()=>{});assert(fs.existsSync(R+'/dl/f.bin'));
 await assert.rejects(t.download(T({url:'http://evil.example/x'}),null,()=>{}),/HTTPS/);
 // --- версия: вредные пути в библиотеках и индексе ресурсов не попадают в список загрузки
 const vd=R+'/mc/versions/9.9';fs.mkdirSync(vd,{recursive:true});fs.mkdirSync(R+'/mc/assets/indexes',{recursive:true});
 fs.writeFileSync(vd+'/9.9.json',JSON.stringify({id:'9.9',type:'release',mainClass:'M',downloads:{client:{url:'https://x/c.jar',sha1:'a'.repeat(40),size:1}},assetIndex:{id:'i',url:'https://x/i.json',sha1:'b',size:1},javaVersion:{component:'jre-legacy',majorVersion:8},
  libraries:[{name:'a:b:1',downloads:{artifact:{path:'../../evil.jar',url:'https://x/e.jar',sha1:'c'.repeat(40),size:1}}},{name:'a:c:1',downloads:{artifact:{path:'../libraries-evil/e.jar',url:'https://x/e2.jar',sha1:'c'.repeat(40),size:1}}},{name:'a:d:1',downloads:{artifact:{path:'ok/d.jar',url:'https://x/d.jar',sha1:'c'.repeat(40),size:1}}}]}));
 fs.writeFileSync(R+'/mc/assets/indexes/i.json',JSON.stringify({objects:{'a.png':{hash:'ab'.repeat(20),size:1}}}));
 const dirs={versions:R+'/mc/versions',libraries:R+'/mc/libraries',assets:R+'/mc/assets',runtime:R+'/mc/runtime',game:R+'/mc/game'};
 const h40='ab'.repeat(20);for(const f of [vd+'/9.9.jar',dirs.libraries+'/ok/d.jar',dirs.assets+'/objects/ab/'+h40]){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'x')}
 const p=await t.plan('9.9',dirs,{javaPath:process.execPath},null,true);
 assert(p.cp.some((x)=>x.endsWith(path.join('ok','d.jar'))),'нормальная библиотека есть');assert(!p.cp.some((x)=>/evil/.test(x)),'библиотеки с выходом за папку отброшены');
 await assert.rejects(t.plan('../9.9',dirs,{},null,true),/Недопустимый идентификатор/);
 fs.writeFileSync(R+'/mc/assets/indexes/i.json',JSON.stringify({objects:{'a.png':{hash:'../../etc/passwd',size:1}}}));await assert.rejects(t.plan('9.9',dirs,{javaPath:process.execPath},null,true),/Повреждённый индекс/);
 // --- Ely.by: authlib-injector обязан иметь sha256, https и известный хост
 const jarB=Buffer.concat([Buffer.from('PK'),Buffer.from('agent')]),sum=crypto.createHash('sha256').update(jarB).digest('hex');let meta;
 global.fetch=async(u)=>/latest\.json/.test(u)?Response.json(meta):new Response(jarB);
 meta={version:'9',download_url:'https://github.com/a.jar'};await assert.rejects(Ely.ensureAgent(R+'/ely1'),/контрольной суммы/);
 meta={version:'9',download_url:'https://evil.example/a.jar',checksums:{sha256:sum}};await assert.rejects(Ely.ensureAgent(R+'/ely2'),/Небезопасная/);
 meta={version:'9',download_url:'http://github.com/a.jar',checksums:{sha256:sum}};await assert.rejects(Ely.ensureAgent(R+'/ely3'),/Небезопасная/);
 meta={version:'9',download_url:'https://github.com/a.jar',checksums:{sha256:'0'.repeat(64)}};await assert.rejects(Ely.ensureAgent(R+'/ely4'),/не совпала/);
 meta={version:'9',download_url:'https://github.com/a.jar',checksums:{sha256:sum}};const jar=await Ely.ensureAgent(R+'/ely5');assert(fs.existsSync(jar));
 fs.writeFileSync(jar,Buffer.concat([Buffer.from('PK'),Buffer.from('EVIL')]));assert.equal(fs.readFileSync(await Ely.ensureAgent(R+'/ely5')).toString(),jarB.toString(),'подменённый кэш перекачан');
 console.log('security-tests-ok');
})().catch((e)=>{console.error(e);process.exit(1)});

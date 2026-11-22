// Список модов сборки: версия Minecraft (ложные предупреждения), доверие к каталогу, иконки, дубликаты, статистика, переименование, избранное
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module');
global.ZIPS={};const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.f=f;this.es=(global.ZIPS[f]||[]).map(([n,d])=>({entryName:n,isDirectory:false,header:{size:d.length},getData:()=>Buffer.from(d)}))}getEntry(n){return this.es.find(e=>e.entryName===n)||null}getEntries(){return this.es}readAsText(e){return (typeof e==='string'?this.getEntry(e):e).getData().toString()}};return ol.call(this,r,...a)};
const Inst=require('../src/instances.js');
const R='/tmp/tmr';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R,{recursive:true});
const I=new Inst(R+'/inst',R+'/inst.json');
const a=I.create({name:'Старая сборка',mc:'1.12.2',loader:'forge',loaderVersion:'14.23.5.2860'});const md=I.dir(a)+'/mods';
const jar=(name,entries)=>{fs.mkdirSync(md,{recursive:true});fs.writeFileSync(md+'/'+name,'x');global.ZIPS[md+'/'+name]=entries};
const info=(o)=>['mcmod.info',JSON.stringify([{modid:o.id,name:o.name||o.id,version:'1.0',mcversion:o.mc,requiredMods:o.req||[]}])];
jar('jei.jar',[info({id:'jei',mc:'1.12'})]);jar('waila.jar',[info({id:'waila',mc:'1.12.2'})]);jar('ic2.jar',[info({id:'ic2',mc:'1.11.2'})]);jar('placeholder.jar',[info({id:'ph',mc:'${mcversion}'})]);
jar('hand-added.jar',[info({id:'hand',mc:'1.7.10'})]);jar('fabricmod.jar',[['fabric.mod.json',JSON.stringify({id:'fm',name:'Fabric Mod',version:'1',depends:{minecraft:'1.20.1',fabricloader:'>=0.14','fabric-api':'*'},environment:'server',breaks:{jei:'*'}})]]);
const rows=I.list(a.id,'mods'),W=(n)=>rows.find((r)=>r.name===n);
assert(!W('jei.jar').warn,'«1.12» подходит сборке 1.12.2 (раньше было ложное предупреждение): '+W('jei.jar').warn);assert(!W('waila.jar').warn);
assert(/1\.11\.2/.test(W('ic2.jar').warn),'настоящее несовпадение остаётся');assert(!W('placeholder.jar').warn,'${mcversion} — не ошибка');
assert(/Мод для fabric/.test(W('fabricmod.jar').warn),'загрузчик проверяется отдельно');assert.equal(W('fabricmod.jar').env,'server');assert.deepEqual(W('fabricmod.jar').breaks,['jei']);assert(W('fabricmod.jar').deps.some((d)=>d.id==='fabric-api'&&d.req));
// мод из каталога, выбранный под версию сборки: доверяем, даже если метаданные «врут»
fs.writeFileSync(I.dir(a)+'/.totem-catalog.json',JSON.stringify({'mr:XYZ':{folder:'mods',files:['hand-added.jar'],title:'Красивый мод',icon:'https://cdn.modrinth.com/x/icon.png',mc:'1.12.2',loader:'forge',src:'mr'},'mr:OLD':{folder:'mods',files:['ic2.jar'],title:'IC2',icon:'',mc:'1.7.10',src:'mr'}}));
const r2=I.list(a.id,'mods'),W2=(n)=>r2.find((r)=>r.name===n);
assert(!W2('hand-added.jar').warn,'установлен каталогом под 1.12.2 — предупреждения о версии нет');assert.equal(W2('hand-added.jar').title,'Красивый мод');assert.equal(W2('hand-added.jar').icon,'https://cdn.modrinth.com/x/icon.png');assert(W2('hand-added.jar').cat);
assert(/1\.11\.2/.test(W2('ic2.jar').warn),'каталог под ДРУГУЮ версию не отменяет предупреждение');assert(!W2('jei.jar').cat&&W2('jei.jar').icon==='','самостоятельно добавленный мод: без иконки и без пометки каталога');
// выключенный и дубликаты
fs.renameSync(md+'/waila.jar',md+'/waila.jar.disabled');global.ZIPS[md+'/waila.jar.disabled']=global.ZIPS[md+'/waila.jar'];
jar('jei2.jar',[info({id:'jei',mc:'1.12.2'})]);const r3=I.list(a.id,'mods');assert(r3.filter((r)=>/Дубликат/.test(r.warn||'')).length===2,'два файла одного мода помечены');assert.equal(r3.find((r)=>r.name==='waila.jar.disabled').enabled,false);
// асинхронный список = синхронный
(async()=>{
 const ra=await I.listAsync(a.id,'mods');assert.deepEqual(ra.map((r)=>[r.name,r.warn||'',r.size]),r3.map((r)=>[r.name,r.warn||'',r.size]));
 fs.mkdirSync(I.dir(a)+'/saves/Мир/region',{recursive:true});fs.writeFileSync(I.dir(a)+'/saves/Мир/region/r.mca','x'.repeat(1000));const sv=await I.listAsync(a.id,'saves');assert.equal(sv[0].size,1000);assert(sv[0].isDir);
 const st=I.stats(a.id);assert.equal(st.mods,6);assert.equal(st.off,1);assert(st.last>Date.now()-60000,'время последнего изменения');
 // переименование и избранное
 assert.equal(I.rename(a.id,'  Новое\u202e имя ').name,'Новое имя');assert.throws(()=>I.rename(a.id,'   '),/Введите/);assert.equal(I.get(a.id).name,'Новое имя');
 assert.equal(I.setFav(a.id,true).fav,true);assert.equal(I.all()[0].fav,true);I.setFav(a.id,false);assert.equal(I.all()[0].fav,false);
 // добавление файла: проверка версии тоже мягкая
 fs.writeFileSync(R+'/new.jar','x');global.ZIPS[R+'/new.jar']=[info({id:'newmod',mc:'1.12'})];const add=I.checkCompat?I.checkCompat(a.id,'mods',[R+'/new.jar']):{ok:true};assert(!add||!add.warnings||add.warnings.length===0||!/1\.12/.test(JSON.stringify(add.warnings)),'при добавлении «1.12» не считается несовпадением: '+JSON.stringify(add));
 console.log('modrows-tests-ok');
})().catch((e)=>{console.error(e);process.exit(1)});

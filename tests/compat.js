const assert=require('assert'),fs=require('fs'),path=require('path'),zlib=require('zlib'),Module=require('module');
global.ZIPS={};const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.es=(global.ZIPS[f]||[]).map(([n,d])=>({entryName:n,isDirectory:false,getData:()=>Buffer.from(d)}))}getEntry(n){return this.es.find(e=>e.entryName===n)||null}getEntries(){return this.es}readAsText(e){return (typeof e==='string'?this.getEntry(e):e).getData().toString()}};return ol.call(this,r,...a)};
const C=require('../src/compat.js'),Inst=require('../src/instances.js'),S=C.mcSatisfies;
// --- диапазоны версий: Fabric (semver) и Forge/NeoForge (maven)
const T=(r,mc,exp)=>assert.strictEqual(S(r,mc),exp,`${JSON.stringify(r)} vs ${mc}`);
T('1.20.1','1.20.1',true);T('1.20.1','1.19.2',false);T('~1.20','1.20.4',true);T('~1.20','1.21',false);T('~1.20.1','1.20.4',true);T('~1.20.1','1.20.0',false);T('>=1.20 <1.21','1.20.2',true);T('>=1.20 <1.21','1.21',false);T('>= 1.19.4','1.20.1',true);
T('^1.20','1.21.3',true);T('^1.20','2.0',false);T('1.20.x','1.20.6',true);T('1.20.x','1.19.4',false);T('*','1.7.10',true);T('>=1.16 || 1.12.2','1.12.2',true);T(['1.19.2','1.20.1'],'1.20.1',true);T(['1.19.2','1.19.3'],'1.20.1',false);
T('[1.20,1.21)','1.20.1',true);T('[1.20,1.21)','1.21',false);T('[1.20.1]','1.20.1',true);T('[1.20.1]','1.20.2',false);T('(,1.19]','1.18.2',true);T('[1.19,1.20),[1.20.2,)','1.20.1',false);T('[1.19,1.20),[1.20.2,)','1.20.4',true);T('1.16.5','1.20.1',false);
T('1.12.2','1.12.2',true);T('???','1.20.1',null);T(null,'1.20.1',null);T('>=1.20','23w31a',null);
// --- формат ресурс-пака (zip, папка, supported_formats)
const mc=(o)=>JSON.stringify({pack:o});global.ZIPS['/p/a.zip']=[['pack.mcmeta',mc({pack_format:6})]];global.ZIPS['/p/b.zip']=[['pack.mcmeta',mc({pack_format:6,supported_formats:{min_inclusive:6,max_inclusive:15}})]];global.ZIPS['/p/c.zip']=[['Pack/pack.mcmeta','\uFEFF'+mc({pack_format:34})]];global.ZIPS['/p/n.zip']=[['x.txt','x']];
// файлы на диске нужны для statSync: создадим реальные заглушки
const R='/tmp/tv';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R+'/p',{recursive:true});for(const f of ['a.zip','b.zip','c.zip','n.zip'])fs.writeFileSync(R+'/p/'+f,'x');
for(const k of Object.keys(global.ZIPS))global.ZIPS[R+k]=global.ZIPS[k];
assert(/1\.16\.2–1\.16\.5/.test(C.packProblem(R+'/p/a.zip','1.20.1',15))&&/1\.20\.1/.test(C.packProblem(R+'/p/a.zip','1.20.1',15)));assert.equal(C.packProblem(R+'/p/b.zip','1.20.1',15),null,'supported_formats включает формат сборки');assert.equal(C.packProblem(R+'/p/c.zip','1.21',34),null,'pack.mcmeta в папке внутри архива + BOM');assert.equal(C.packProblem(R+'/p/n.zip','1.20.1',15),null,'без pack.mcmeta не спорим');
fs.mkdirSync(R+'/dir',{recursive:true});fs.writeFileSync(R+'/dir/pack.mcmeta',mc({pack_format:15}));assert.equal(C.packProblem(R+'/dir','1.20.1',15),null);assert(C.packProblem(R+'/dir','1.16.5',6));
// --- версия мира из level.dat (NBT)
const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b},nm=s=>Buffer.concat([u16(Buffer.byteLength(s)),Buffer.from(s)]),tg=(t,n,p)=>Buffer.concat([Buffer.from([t]),nm(n),p]),i4=n=>{const b=Buffer.alloc(4);b.writeInt32BE(n);return b},comp=(...c)=>Buffer.concat([...c,Buffer.from([0])]);
const nbt=ver=>zlib.gzipSync(tg(10,'',comp(tg(10,'Data',comp(tg(3,'DataVersion',i4(3465)),tg(9,'Pad',Buffer.concat([Buffer.from([3]),i4(2),i4(1),i4(2)])),tg(10,'Version',comp(tg(3,'Id',i4(1)),tg(8,'Name',nm(ver)),tg(1,'Snapshot',Buffer.from([0])))))))));
fs.mkdirSync(R+'/w1',{recursive:true});fs.writeFileSync(R+'/w1/level.dat',nbt('1.20.4'));assert.equal(C.worldVersion(R+'/w1'),'1.20.4');
global.ZIPS[R+'/w.zip']=[['World/level.dat',nbt('1.19.2')]];fs.writeFileSync(R+'/w.zip','x');assert.equal(C.worldVersion(R+'/w.zip'),'1.19.2');assert.equal(C.worldVersion(R+'/nope'),null);
// --- checkCompat в сборке 1.20.1 Fabric
const I=new Inst(R+'/ud/i',R+'/ud/i.json'),f=I.create({name:'F',mc:'1.20.1',loader:'fabric',loaderVersion:'0.15'});
const jar=(n,files)=>{fs.writeFileSync(R+'/'+n,'x');global.ZIPS[R+'/'+n]=files};
jar('ok.jar',[['fabric.mod.json',JSON.stringify({id:'ok',name:'Ok',depends:{minecraft:'~1.20'}})]]);jar('old.jar',[['fabric.mod.json',JSON.stringify({id:'old',name:'Старый мод',depends:{minecraft:['1.19.2','1.19.3']}})]]);
jar('forge.jar',[['META-INF/mods.toml','modId="x"\ndisplayName="FM"\n[[dependencies.x]]\nmodId="minecraft"\nversionRange="[1.20,1.21)"']]);jar('forge119.jar',[['META-INF/mods.toml','modId="x"\n[[dependencies.x]]\nmodId="forge"\nversionRange="[47,)"\n[[dependencies.x]]\nmodId="minecraft"\nversionRange="[1.19,1.20)"']]);
jar('lib.jar',[['x.txt','x']]);
assert.deepEqual(I.checkCompat(f.id,'mods',[R+'/ok.jar',R+'/lib.jar']),[],'подходящие моды и неопознанные jar без ошибок');
let r=I.checkCompat(f.id,'mods',[R+'/old.jar']);assert(r.length===1&&/Старый мод/.test(r[0].msg)&&/1\.19\.2 или 1\.19\.3/.test(r[0].msg)&&/1\.20\.1/.test(r[0].msg));
r=I.checkCompat(f.id,'mods',[R+'/forge.jar']);assert(/forge/.test(r[0].msg)&&/fabric/.test(r[0].msg),'чужой загрузчик');
const g=I.create({name:'G',mc:'1.20.1',loader:'forge',loaderVersion:'47.3.0'});assert.deepEqual(I.checkCompat(g.id,'mods',[R+'/forge.jar']),[]);r=I.checkCompat(g.id,'mods',[R+'/forge119.jar']);assert(r.length===1&&/1\.19/.test(r[0].msg)&&/1\.20\.1/.test(r[0].msg));
r=I.checkCompat(f.id,'resourcepacks',[R+'/p/a.zip']);assert(r.length===1&&/Ресурс-пак/.test(r[0].msg));assert.deepEqual(I.checkCompat(f.id,'resourcepacks',[R+'/p/b.zip']),[]);assert.deepEqual(I.checkCompat(f.id,'shaderpacks',[R+'/p/a.zip']),[],'у шейдеров версии не проверяем');
r=I.checkCompat(f.id,'saves',[R+'/w1']);assert(r.length===1&&/1\.20\.4/.test(r[0].msg));assert.deepEqual(I.checkCompat(f.id,'saves',[R+'/w.zip']),[],'старый мир откроется');
// предупреждения в списке модов используют диапазоны, а не точное равенство
I.add(f.id,'mods',[R+'/ok.jar',R+'/old.jar']);for(const n of ['ok.jar','old.jar'])global.ZIPS[I.dir(f)+'/mods/'+n]=global.ZIPS[R+'/'+n];const L=I.list(f.id,'mods');assert(!L.find(x=>x.name==='ok.jar').warn&&/рассчитан на Minecraft/.test(L.find(x=>x.name==='old.jar').warn));
console.log('stage12-tests-ok');

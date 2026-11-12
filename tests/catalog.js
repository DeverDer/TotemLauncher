const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.f=f;this.es=global.ZIPS?.[f]||[]}getEntries(){return this.es}readAsText(n){return String(this.es.find(e=>e.entryName===n)?.getData()||'')}};return ol.call(this,r,...a)};
const sha1=b=>crypto.createHash('sha1').update(b).digest('hex');const Cat=require('../src/catalog.js'),Ely=require('../src/ely.js');
const R='/tmp/tq';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R,{recursive:true});
const FILES={'https://cdn.modrinth.com/data/sod/sodium.jar':Buffer.from('SODIUM'),'https://cdn.modrinth.com/data/api/fapi.jar':Buffer.from('FAPI'),'https://cdn.modrinth.com/data/fc/ferrite.jar':Buffer.from('FERRITE'),'https://cdn.modrinth.com/data/ec/ec.jar':Buffer.from('EC'),'https://cdn.modrinth.com/data/pack/p.zip':Buffer.from('RESPACK')};
const ver=(pid,url,n,gv,ld,deps=[],type='release')=>({id:'v-'+pid,name:n,version_number:n,game_versions:gv,loaders:ld,version_type:type,dependencies:deps,files:[{url,filename:path.basename(url),primary:true,size:FILES[url].length,hashes:{sha1:sha1(FILES[url])}}]});
const DB={sodium:[ver('sodium','https://cdn.modrinth.com/data/sod/sodium.jar','0.5.8',['1.20.1'],['fabric'],[{project_id:'fabric-api',dependency_type:'required'},{project_id:'x',dependency_type:'optional'}])],
 'fabric-api':[ver('fabric-api','https://cdn.modrinth.com/data/api/fapi.jar','0.92',['1.20.1'],['fabric'])],lithium:[ver('lithium','https://cdn.modrinth.com/data/sod/sodium.jar','0.11',['1.19.2'],['fabric'])],
 'ferrite-core':[ver('ferrite-core','https://cdn.modrinth.com/data/fc/ferrite.jar','6.0',['1.20.1'],['fabric','forge'])],entityculling:[ver('entityculling','https://cdn.modrinth.com/data/ec/ec.jar','1.6',['1.20.1'],['fabric','forge'])],
 starlight:[],'some-pack':[ver('some-pack','https://cdn.modrinth.com/data/pack/p.zip','1.0',['1.20.1'],['minecraft'])]};
let urls=[];global.fetch=async(u,o)=>{urls.push(u);if(FILES[u])return new Response(FILES[u]);if(/optifine\.net/.test(u))throw new TypeError('fetch failed');
 if(/api\.curseforge\.com/.test(u)){assert.equal(o.headers['x-api-key'],'KEY');if(/categories/.test(u))return Response.json({data:[{id:5,name:'Adventure and RPG'},{id:6,name:'Parkour'}]});if(/\/files/.test(u))return Response.json({data:[{id:7,fileName:'map.zip',downloadUrl:'https://edge.forgecdn.net/files/map.zip',gameVersions:['1.20.1'],fileLength:3,hashes:[]}]});if(/\/mods\/\d+$/.test(u))return Response.json({data:{id:1,name:'Cool Map',links:{websiteUrl:'https://www.curseforge.com/x'}}});return Response.json({pagination:{totalCount:1},data:[{id:1,slug:'m',name:'Cool Map',summary:'s',authors:[{name:'A'}],downloadCount:5,latestFilesIndexes:[{gameVersion:'1.20.1'}]}]})}
 let m;if((m=/\/project\/([\w-]+)\/version(?:\?(.*))?$/.exec(u))){const q=new URLSearchParams(m[2]||''),gv=q.get('game_versions')&&JSON.parse(q.get('game_versions'))[0],ld=q.get('loaders')&&JSON.parse(q.get('loaders'))[0];return Response.json((DB[m[1]]||[]).filter(v=>(!gv||v.game_versions.includes(gv))&&(!ld||v.loaders.includes(ld))))}
 if(/\/projects\?ids=/.test(u))return Response.json(JSON.parse(new URL(u).searchParams.get('ids')).map(id=>({id,title:id.toUpperCase()})));
 if(/\/search\?/.test(u))return Response.json({total_hits:1,hits:[{project_id:'sodium',slug:'sodium',project_type:'mod',title:'Sodium',description:'fast',author:'jellysquid3',icon_url:'i.png',gallery:['g1','g2'],downloads:99,categories:['fabric','optimization'],versions:['1.19','1.20','1.20.1']}]});
 throw new Error('unexpected '+u)};
(async()=>{
 // поиск: фасады, сортировка
 const s=await Cat.search({type:'mod',q:'sod',mc:'1.20.1',loader:'fabric',sort:'new'});const su=decodeURIComponent(urls.at(-1));assert(su.includes('project_type:mod')&&su.includes('versions:1.20.1')&&su.includes('categories:fabric')&&su.includes('index=newest')&&su.includes('query=sod'));assert(s.hits[0].loaders.join()==='fabric'&&s.hits[0].downloads===99&&s.hits[0].images.length===2);
 await Cat.search({type:'shader',loader:'fabric',sort:'pop'});assert(!decodeURIComponent(urls.at(-1)).includes('categories:fabric')&&urls.at(-1).includes('index=downloads'),'у шейдеров загрузчик не фильтруем');
 // версии: точная и «ближайшая» + предупреждение, зависимости
 let pl=await Cat.plan({src:'mr',id:'sodium',type:'mod',mc:'1.20.1',loader:'fabric'});assert(pl.exact&&pl.warn===''&&pl.deps.length===1&&pl.deps[0].title==='FABRIC-API','обязательные зависимости, optional игнорируем');
 pl=await Cat.plan({src:'mr',id:'lithium',type:'mod',mc:'1.20.1',loader:'fabric'});assert(!pl.exact&&/1\.19\.2/.test(pl.warn)&&/1\.20\.1/.test(pl.warn));
 await assert.rejects(Cat.plan({src:'mr',id:'starlight',type:'mod',mc:'1.20.1',loader:'fabric'}),/нет подходящих версий/);
 // установка с зависимостями / без, проверка sha1
 const inst={mc:'1.20.1',loader:'fabric',dir:R+'/i'};let r=await Cat.install({src:'mr',id:'sodium',type:'mod',mc:'1.20.1',loader:'fabric',deps:false},inst.dir);assert.deepEqual(r.installed,['sodium.jar']);assert(!fs.existsSync(inst.dir+'/mods/fapi.jar'));
 r=await Cat.install({src:'mr',id:'sodium',type:'mod',mc:'1.20.1',loader:'fabric',deps:true},inst.dir);assert(fs.existsSync(inst.dir+'/mods/fapi.jar'));
 r=await Cat.install({src:'mr',id:'some-pack',type:'resourcepack',mc:'1.20.1',loader:'fabric'},inst.dir);assert(fs.existsSync(inst.dir+'/resourcepacks/p.zip'),'ресурс-пак в resourcepacks');
 FILES['https://cdn.modrinth.com/data/api/fapi.jar']=Buffer.from('TAMPERED');await assert.rejects(Cat.install({src:'mr',id:'sodium',type:'mod',mc:'1.20.1',loader:'fabric',deps:true},R+'/i2'),/sha1/);FILES['https://cdn.modrinth.com/data/api/fapi.jar']=Buffer.from('FAPI');
 assert(Cat.okHost('https://cdn.modrinth.com/x')&&!Cat.okHost('http://cdn.modrinth.com/x')&&!Cat.okHost('https://evil.com/x')&&!Cat.okHost('https://modrinth.com.evil.com/x'));
 // буст FPS: Fabric / Forge
 let b=await Cat.boost({mc:'1.20.1',loader:'fabric',dir:R+'/f'});assert.deepEqual(b.installed,['Sodium','FerriteCore','EntityCulling']);assert(b.warnings.some(w=>/Lithium/.test(w)&&/1\.20\.1/.test(w)),'Lithium не подходит — предупреждение');assert(b.warnings.some(w=>/Starlight/.test(w)));
 b=await Cat.boost({mc:'1.20.1',loader:'forge',dir:R+'/g'});assert.deepEqual(b.installed,['FerriteCore','EntityCulling']);assert(b.warnings.some(w=>/OptiFine/.test(w)),'OptiFine недоступен — предупреждение');assert(!b.warnings.some(w=>/Sodium|Lithium|Starlight/.test(w)),'Fabric-моды для Forge не ставим');
 b=await Cat.boost({mc:'1.20.1',loader:'vanilla',dir:R+'/v'});assert(b.installed.length===0&&b.warnings.length===1);
 // шейдеры: на не-Forge ставится Iris (его нет в моке) -> понятное предупреждение
 const sh=await Cat.shaderSupport({mc:'1.20.1',loader:'fabric',dir:R+'/s'});assert(/Iris|OptiFine/.test(sh.note));
 // CurseForge: нужен ключ, категории, ссылка запрещена
 await assert.rejects(Cat.search({type:'map'}),e=>e.needKey);const mp=await Cat.search({type:'map',cfKey:'KEY',mapCat:'parkour',q:'x'});assert(urls.at(-1).includes('categoryId=6')&&urls.at(-1).includes('classId=17')&&mp.hits[0].type==='map'&&mp.hits[0].mcs[0]==='1.20.1');
 // extractWorld: корневая папка мира, защита от выхода за пределы
 const E=(n,d='x')=>({entryName:n,isDirectory:n.endsWith('/'),header:{size:1},getData:()=>Buffer.from(d)});global.ZIPS={'a.zip':[E('MyWorld/level.dat'),E('MyWorld/region/r.0.0.mca','R'),E('MyWorld/../../evil.txt'),E('__MACOSX/x')],'b.zip':[E('readme.txt')]};
 fs.mkdirSync(R+'/sv',{recursive:true});const w1=Cat.extractWorld('a.zip',R+'/sv','a.zip');assert(path.basename(w1)==='MyWorld'&&fs.existsSync(w1+'/region/r.0.0.mca')&&!fs.existsSync(R+'/evil.txt')&&!fs.existsSync(R+'/sv/evil.txt'));assert.equal(path.basename(Cat.extractWorld('a.zip',R+'/sv','a.zip')),'MyWorld (2)');assert.throws(()=>Cat.extractWorld('b.zip',R+'/sv','b.zip'),/level\.dat/);
 // Ely.by
 let call=[];global.fetch=async(u,o)=>{call.push([u,o?.body&&JSON.parse(o.body)]);const b=o?.body&&JSON.parse(o.body);
  if(u.endsWith('authenticate'))return b.password==='pw'?Response.json({accessToken:'T1',clientToken:'C1',selectedProfile:{id:'u'.repeat(32),name:'Nick'}}):b.password==='pw:123456'?Response.json({accessToken:'T2',clientToken:'C2',selectedProfile:{id:'u'.repeat(32),name:'Nick'}}):Response.json({error:'ForbiddenOperationException',errorMessage:'Account protected with two factor auth.'},{status:401});
  if(u.endsWith('validate'))return b.accessToken==='GOOD'?new Response(null,{status:204}):Response.json({errorMessage:'bad'},{status:401});if(u.endsWith('refresh'))return b.clientToken==='C'?Response.json({accessToken:'NEW'}):Response.json({errorMessage:'x'},{status:401});
  if(/latest\.json/.test(u))return Response.json({version:'1.2.3',download_url:'https://github.com/a.jar',checksums:{sha256:crypto.createHash('sha256').update(Buffer.concat([Buffer.from('PK'),Buffer.from('zz')])).digest('hex')}});if(u==='https://github.com/a.jar')return new Response(Buffer.concat([Buffer.from('PK'),Buffer.from('zz')]));throw new Error('x '+u)};
 await assert.rejects(Ely.login('a','pw2'),e=>e.twofa===true);assert.equal((await Ely.login('a','pw','123456')).token,'T2','2FA: пароль уходит как «пароль:код»');assert.equal((await Ely.login('a','pw')).name,'Nick');
 assert.equal((await Ely.fresh({token:'GOOD',clientToken:'C'})).token,'GOOD');assert.equal((await Ely.fresh({token:'OLD',clientToken:'C'})).token,'NEW');await assert.rejects(Ely.fresh({token:'OLD',clientToken:'Z'}),/истекла/);
 const jar=await Ely.ensureAgent(R+'/lib');assert(fs.existsSync(jar)&&jar.endsWith('1.2.3.jar'));
 // buildArgs: javaagent для Ely.by
 const {_t:t}=require('../src/game.js');const a=t.buildArgs({id:'1',name:'x',ram:1024,cp:['a'],ndir:'n',gameDir:'g',assetsRoot:'as',auth:{name:'Nick',uuid:'u'.repeat(32),token:'TOK',agent:{jar:'/p/a.jar',url:'https://authserver.ely.by/api/authlib-injector'}},vj:{type:'release',mainClass:'M',assetIndex:{id:'1'},minecraftArguments:'--username ${auth_player_name} --accessToken ${auth_access_token} --userType ${user_type}'}});
 assert(a.indexOf('-javaagent:/p/a.jar=https://authserver.ely.by/api/authlib-injector')>=0&&a.indexOf('-javaagent:/p/a.jar=https://authserver.ely.by/api/authlib-injector')<a.indexOf('M'),'javaagent идёт до главного класса');assert(a.includes('Nick')&&a.includes('TOK')&&a.includes('mojang'));
 console.log('stage11-tests-ok')})().catch(e=>{console.error(e);process.exit(1)});

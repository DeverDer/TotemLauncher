// Каталог: чистка ключа CurseForge, понятные ошибки 403, повторы при сбоях сети, учёт уже скачанного
const assert=require('assert'),fs=require('fs'),path=require('path');
const C=require('../src/catalog.js');
assert.equal(C.cleanKey(' "$2a$10$abc.DEF/ghi"\n'),'$2a$10$abc.DEF/ghi');assert.equal(C.cleanKey('x-api-key: $2a$10$q'),'$2a$10$q');assert.equal(C.cleanKey('$2a$10$a\u200bb'),'$2a$10$ab');
// учёт скачанного: файл есть (в том числе отключённый или в архиве) — проект считается скачанным; удалён — нет
const D='/tmp/tc2';fs.rmSync(D,{recursive:true,force:true});fs.mkdirSync(D+'/mods',{recursive:true});fs.writeFileSync(D+'/mods/a.jar','x');
C.record(D,[{key:'mr:A',folder:'mods',file:'a.jar',title:'A'},{key:'mr:B',folder:'mods',file:'b.jar',title:'B'}]);
assert.deepEqual(C.installedKeys(D),['mr:A']);fs.renameSync(D+'/mods/a.jar',D+'/mods/a.jar.disabled');assert.deepEqual(C.installedKeys(D),['mr:A']);
fs.mkdirSync(D+'/mods-archive');fs.renameSync(D+'/mods/a.jar.disabled',D+'/mods-archive/a.jar');assert.deepEqual(C.installedKeys(D),['mr:A']);fs.unlinkSync(D+'/mods-archive/a.jar');assert.deepEqual(C.installedKeys(D),[]);
(async()=>{
 // 403 от CurseForge: пользователь видит, что делать с ключом; защита сайта — отдельное сообщение
 let n=0;global.fetch=async()=>{n++;return new Response('{"error":"forbidden"}',{status:403})};
 await assert.rejects(C.cfCheck('$2a$10$k'),(e)=>e.cfAuth===true&&/API Key/.test(e.message)&&n===1,'403 не повторяется');
 global.fetch=async()=>new Response('<html>Just a moment... cloudflare</html>',{status:403});
 await assert.rejects(C.cfCheck('$2a$10$k'),(e)=>!e.cfAuth&&/защищён|сети/.test(e.message));
 // сбой сети: 3 попытки, потом ошибка с кодом причины (а не голое «fetch failed»); одиночный сбой не ломает запрос
 n=0;global.fetch=async()=>{n++;const e=new TypeError('fetch failed');e.cause={code:'ECONNRESET'};throw e};
 await assert.rejects(C.cfCheck('$2a$10$k'),(e)=>e.net===true&&/ECONNRESET/.test(e.message)&&n===3);
 n=0;global.fetch=async()=>{if(++n===1)throw new TypeError('fetch failed');return new Response('{"data":{}}',{status:200})};
 assert.equal(await C.cfCheck('$2a$10$k'),true);assert.equal(n,2);
 // «нет интернета» — только если не отвечают оба сервера
 global.fetch=async()=>{throw new TypeError('fetch failed')};assert.equal(await C.online(),false);
 global.fetch=async(u)=>{if(/modrinth/.test(u))throw new Error('x');return new Response('')};assert.equal(await C.online(),true);
 console.log('catalog2-tests-ok');await part2();
})().catch((e)=>{console.error(e);process.exit(1)});

// датапак ставится внутрь выбранного мира; без мира — отказ; ключ учитывает мир
const part2=async()=>{
 const D2='/tmp/tc3';fs.rmSync(D2,{recursive:true,force:true});fs.mkdirSync(D2+'/saves/Мир1',{recursive:true});
 const JAR=Buffer.from('PKdata'),sha=require('crypto').createHash('sha1').update(JAR).digest('hex');
 global.fetch=async(u)=>{u=String(u);if(/\/version(\?|$)/.test(u))return Response.json([{version_type:'release',game_versions:['1.20.1'],loaders:[],dependencies:[],name:'dp',version_number:'1',files:[{primary:true,filename:'dp.zip',url:'https://cdn.modrinth.com/d/dp.zip',hashes:{sha1:sha},size:JAR.length}]}]);if(/cdn\.modrinth/.test(u))return new Response(JAR);throw new Error('x '+u)};
 const o={src:'mr',id:'DP1',type:'datapack',mc:'1.20.1',loader:''};
 await assert.rejects(C.install({...o},D2),/Выберите мир/);await assert.rejects(C.install({...o,world:'../x'},D2),/Выберите мир/);await assert.rejects(C.install({...o,world:'Нет такого'},D2),/Выберите мир/);
 const r=await C.install({...o,world:'Мир1'},D2);assert.deepEqual(r.installed,['dp.zip']);assert(fs.existsSync(D2+'/saves/Мир1/datapacks/dp.zip'),'файл лежит в мире');
 assert.deepEqual(C.installedKeys(D2),['mr:DP1@Мир1']);fs.unlinkSync(D2+'/saves/Мир1/datapacks/dp.zip');assert.deepEqual(C.installedKeys(D2),[]);
 console.log('catalog2-datapack-ok');
};

const assert=require('assert'),fs=require('fs'),path=require('path'),FM=require('../src/fm.js'),Inst=require('../src/instances.js');
const R='/tmp/tm';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R+'/root/a/b',{recursive:true});fs.mkdirSync(R+'/out',{recursive:true});fs.writeFileSync(R+'/root/f.txt','hi');fs.writeFileSync(R+'/out/secret','s');
fs.symlinkSync(R+'/out',R+'/root/link');const fm=new FM(R+'/root');
for(const bad of ['..','../out','a/../../out','/etc','link','link/secret'])assert.throws(()=>fm.list(bad),/вне папки/,bad);
assert.throws(()=>fm.remove(''),/Корневую/);for(const n of ['','..','a/b','a\\b','x:','con*','end.','x '.repeat(70)])assert.throws(()=>fm.mkdir('a',n),/Недопустимое/,n);
fm.mkdir('a','new');assert.throws(()=>fm.mkdir('a','new'));assert.deepEqual(fm.list('').map(x=>x.name),['a','f.txt','link']);
fm.copy('f.txt','a');fm.copy('f.txt','a');assert(fs.existsSync(R+'/root/a/f.txt')&&fs.existsSync(R+'/root/a/f (2).txt'));
assert.throws(()=>fm.copy('a','a/b'),/саму себя/);fm.move('a/f.txt','a/b');assert(fs.existsSync(R+'/root/a/b/f.txt')&&!fs.existsSync(R+'/root/a/f.txt'));
fm.rename('a/b/f.txt','g.txt');assert.throws(()=>fm.rename('a/b/g.txt','..'));fm.remove('a/b');assert(!fs.existsSync(R+'/root/a/b'));
assert.equal(fm.add('a',[R+'/out/secret',R+'/nope']),1);fm.remove('link');assert(fs.existsSync(R+'/out/secret'),'удаление симлинка не трогает цель');
// снимки/архив
const I=new Inst(R+'/ud/instances',R+'/ud/i.json'),x=I.create({name:'X',mc:'1.20.1',loader:'fabric',loaderVersion:'1'});
fs.writeFileSync(R+'/m1.jar','1');fs.writeFileSync(R+'/m2.jar','2');I.add(x.id,'mods',[R+'/m1.jar',R+'/m2.jar']);fs.writeFileSync(I.dir(x)+'/options.txt','fov:70');fs.mkdirSync(I.dir(x)+'/config');fs.writeFileSync(I.dir(x)+'/config/c.toml','a=1');
const s1=I.snapshot(x.id,'v1');assert.equal(I.snapshots(x.id)[0].mods,2);
I.removeFile(x.id,'mods','m1.jar');fs.writeFileSync(I.dir(x)+'/options.txt','fov:90');fs.writeFileSync(I.dir(x)+'/config/c.toml','a=2');
I.restore(x.id,s1);assert(fs.existsSync(I.dir(x)+'/mods/m1.jar')&&fs.readFileSync(I.dir(x)+'/options.txt','utf8')==='fov:70'&&fs.readFileSync(I.dir(x)+'/config/c.toml','utf8')==='a=1');
assert(I.snapshots(x.id).some(s=>s.label==='Перед восстановлением'));assert.throws(()=>I.restore(x.id,'../x'));assert.throws(()=>I.restore(x.id,'1234567890123'));
for(let k=0;k<12;k++){fs.writeFileSync(I.snapDir(x)+'/'+(1e12+k)+'.tmp','')}; // мусор не ломает
const t0=Date.now();for(let k=0;k<10;k++){const d=I.snapDir(x)+'/'+String(1700000000000+k);fs.mkdirSync(d,{recursive:true})}I.snapshot(x.id,'z');assert(I.snapshots(x.id).length<=8,'prune');
I.archive(x.id,'m2.jar');assert(!fs.existsSync(I.dir(x)+'/mods/m2.jar')&&I.list(x.id,'archive').length===1&&I.list(x.id,'mods').every(r=>r.name!=='m2.jar'));
assert.throws(()=>I.add(x.id,'archive',[R+'/m2.jar']));I.unarchive(x.id,'m2.jar');assert(fs.existsSync(I.dir(x)+'/mods/m2.jar'));assert.throws(()=>I.archive(x.id,'../x'));
I.remove(x.id);assert(!fs.existsSync(I.snapDir(x)));console.log('stage8-tests-ok');

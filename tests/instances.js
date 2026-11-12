const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
// заглушка adm-zip: «jar» = JSON-файл {entry:text}
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.m=JSON.parse(fs.readFileSync(f,'utf8'))}getEntry(n){return n in this.m?n:null}readAsText(n){return this.m[n]}};return ol.call(this,r,...a)};
const Instances=require('../src/instances.js'),{_t:t}=require('../src/game.js');
const R='/tmp/ti';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R+'/src',{recursive:true});
const I=new Instances(R+'/inst',R+'/i.json');
assert.throws(()=>I.create({name:'',mc:'1.20.1',loader:'vanilla'}));assert.throws(()=>I.create({name:'x',mc:'1.20.1',loader:'quilt'}));
const f=I.create({name:'Fab',mc:'1.20.1',loader:'fabric',loaderVersion:'0.15'}),v=I.create({name:'Van',mc:'1.20.1',loader:'vanilla'});
fs.writeFileSync(R+'/src/a.jar',JSON.stringify({'fabric.mod.json':JSON.stringify({id:'a',name:'A',version:'1'})}));
fs.writeFileSync(R+'/src/b.jar',JSON.stringify({'META-INF/mods.toml':'modId="b"\ndisplayName="B"\nversion="2"'}));
fs.writeFileSync(R+'/src/a2.jar',JSON.stringify({'fabric.mod.json':JSON.stringify({id:'a'})}));fs.writeFileSync(R+'/src/x.txt','x');
assert.throws(()=>I.add(f.id,'mods',[R+'/src/a.jar',R+'/src/b.jar',R+'/src/a2.jar',R+'/src/x.txt']),/Добавлено: 3.*x\.txt/);
let L=I.list(f.id,'mods');assert(L.find(r=>r.name==='b.jar').warn.includes('forge'));assert(L.filter(r=>/Дубликат/.test(r.warn||'')).length===2);
I.toggle(f.id,'a2.jar');L=I.list(f.id,'mods');assert(L.find(r=>r.name==='a2.jar.disabled').enabled===false&&!L.some(r=>/Дубликат/.test(r.warn||'')));
I.add(v.id,'mods',[R+'/src/a.jar']);assert(I.list(v.id,'mods')[0].warn.includes('Vanilla'));
assert.throws(()=>I.removeFile(f.id,'mods','../../i.json'));assert.throws(()=>I.folder(f,'../x'));
const c=I.copy(f.id);assert(fs.existsSync(I.dir(c)+'/mods/a.jar')&&c.id!==f.id);I.removeFile(f.id,'mods','a.jar');assert(fs.existsSync(I.dir(c)+'/mods/a.jar'));
I.remove(c.id);assert(!fs.existsSync(I.dir(c))&&I.all().length===2);
// plan() с профилем Fabric (inheritsFrom) на подмене сети
const sha=s=>crypto.createHash('sha1').update(s).digest('hex'),ROOT=R+'/mc',dirs=Object.fromEntries(['versions','libraries','assets','runtime','game'].map(k=>[k,ROOT+'/'+k]));
const vj=JSON.stringify({id:'1.20.1',type:'release',mainClass:'net.minecraft.client.main.Main',javaVersion:{component:'java-runtime-gamma',majorVersion:17},downloads:{client:{url:'http://m/c.jar',sha1:'a'.repeat(40),size:1}},
 assetIndex:{id:'5',url:'http://m/ai.json',sha1:sha('{"objects":{}}'),size:14},arguments:{jvm:['-cp','${classpath}'],game:['--username','${auth_player_name}']},
 libraries:[{name:'org.ow2.asm:asm:9.3',downloads:{artifact:{path:'org/ow2/asm/asm/9.3/asm-9.3.jar',url:'http://m/asm93',sha1:'b'.repeat(40),size:1}}},{name:'com.x:win:1',rules:[{action:'allow',os:{name:'linux'}}],downloads:{artifact:{path:'x',url:'u',sha1:'c',size:1}}}]});
const fab={id:'fabric-loader-0.15-1.20.1',inheritsFrom:'1.20.1',mainClass:'net.fabricmc.loader.impl.launch.knot.KnotClient',arguments:{jvm:['-DFabricMcEmu=true'],game:[]},libraries:[{name:'org.ow2.asm:asm:9.6',url:'http://maven/'},{name:'net.fabricmc:fabric-loader:0.15',url:'http://maven/'}]};
global.fetch=async u=>({ok:true,status:200,json:async()=>u.includes('version_manifest')?{versions:[{id:'1.20.1',url:'http://m/v.json',sha1:sha(vj)}]}:{},body:null,text:async()=>'',arrayBuffer:async()=>Buffer.from(u.endsWith('v.json')?vj:'{"objects":{}}')});
// простая подмена download: кладём файлы напрямую
const G=require('../src/game.js');
(async()=>{fs.mkdirSync(dirs.versions+'/'+fab.id,{recursive:true});fs.writeFileSync(dirs.versions+'/'+fab.id+'/'+fab.id+'.json',JSON.stringify(fab));
 fs.mkdirSync(dirs.versions+'/1.20.1',{recursive:true});fs.writeFileSync(dirs.versions+'/1.20.1/1.20.1.json',vj);fs.mkdirSync(dirs.assets+'/indexes',{recursive:true});fs.writeFileSync(dirs.assets+'/indexes/5.json','{"objects":{}}');
 const p=await t.plan(fab.id,dirs,{javaPath:process.execPath},new AbortController().signal);
 const names=p.tasks.map(x=>x.label);assert(names.includes('org.ow2.asm:asm:9.6')&&!names.includes('org.ow2.asm:asm:9.3'),'fabric asm побеждает');
 const fl=p.tasks.find(x=>x.label==='net.fabricmc:fabric-loader:0.15');assert.equal(fl.url,'https://maven/net/fabricmc/fabric-loader/0.15/fabric-loader-0.15.jar');
 assert(!names.includes('com.x:win:1')&&p.vj.mainClass.includes('Knot')&&p.vj.arguments.jvm.length===3&&p.cp.at(-1).endsWith('1.20.1.jar'));
 console.log('inst-tests-ok')})();

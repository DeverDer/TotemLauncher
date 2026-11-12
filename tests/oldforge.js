const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),Module=require('module');
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.m=JSON.parse(fs.readFileSync(f,'utf8'))}getEntry(n){return n in this.m?n:null}readAsText(n){return this.m[n]}};return ol.call(this,r,...a)};
const {_t:t}=require('../src/game.js'),Inst=require('../src/instances.js'),Skins=require('../src/skins.js');
require('../src/ui/skin.js');
// --- legacy 64x32 и фото
const src=new Uint8ClampedArray(64*32*4).fill(255);src.set([1,2,3,255],(16*64+4)*4);src.set([9,9,9,255],(20*64+44)*4);
const L=Skin.legacy(src);assert.equal(L.length,64*64*4);assert.deepEqual([...L.slice((48*64+23)*4,(48*64+23)*4+4)],[1,2,3,255]);
assert.deepEqual([...L.slice((52*64+(44-8+3))*4,(52*64+(44-8+3))*4+3)],[9,9,9]);assert.equal(L[(5*64+40)*4+3],0,'opaque hat cleared');
const P=new Uint8ClampedArray(16*32*4);for(let i=0;i<512;i++)P.set([100,100,100,255],i*4);P.set([7,8,9,255],(0*16+4)*4);
const F=Skin.photo(P);assert.deepEqual([...F.slice((8*64+8)*4,(8*64+8)*4+4)],[7,8,9,255]);assert.equal(F[(8*64+9)*4],100);assert.equal(F[(9*64+8)*4],100);assert.equal(F[(40*64+60)*4+3],0,'overlay transparent');
// --- sniff
const png=Buffer.from([0x89,0x50,0x4e,0x47,0,0,0,0]);assert.equal(Skins.sniff(png),'image/png');assert.equal(Skins.sniff(Buffer.concat([Buffer.from('RIFF....WEBP')])),'image/webp');assert.throws(()=>Skins.sniff(Buffer.from('MZ\x90\0')),/Неподдерживаемый/);
// --- jarInfo mcmod.info + предупреждение о версии MC
const R='/tmp/tf';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R,{recursive:true});
fs.writeFileSync(R+'/old.jar',JSON.stringify({'mcmod.info':'[{"modid":"jei","name":"JEI","version":"4.16","mcversion":"1.12.2"}]'}));fs.writeFileSync(R+'/bad.jar',JSON.stringify({'mcmod.info':'[{"modid":"x",}'}));
const I=new Inst(R+'/i',R+'/i.json'),f=I.create({name:'F',mc:'1.12.2',loader:'forge',loaderVersion:'14.23.5.2860'}),g=I.create({name:'G',mc:'1.16.5',loader:'forge',loaderVersion:'36.2.39'});
I.add(f.id,'mods',[R+'/old.jar',R+'/bad.jar']);I.add(g.id,'mods',[R+'/old.jar']);
let l=I.list(f.id,'mods');assert(l.find(r=>r.name==='old.jar').title==='JEI'&&!l.find(r=>r.name==='old.jar').warn&&l.find(r=>r.name==='bad.jar'));
assert(/1\.12\.2/.test(I.list(g.id,'mods')[0].warn));assert.equal(I.neededLoader([R+'/old.jar']),'forge');
// --- установщик Forge: пробуем оба варианта имени
const ok=h=>({ok:true,status:200,text:async()=>h,json:async()=>({})}),no={ok:false,status:404,text:async()=>'',json:async()=>({})};
global.fetch=async u=>u==='https://maven.minecraftforge.net/net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-installer.jar.sha1'?ok('a'.repeat(40)):no;
(async()=>{const fi=await t.forgeInstaller('1.7.10','10.13.4.1614');assert(fi.url.includes('1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-installer.jar')&&fi.sha1==='a'.repeat(40));
 await assert.rejects(t.forgeInstaller('1.2.3','1.0'),/не найден/);
 const dirs=Object.fromEntries(['versions','libraries','assets','runtime','game'].map(k=>[k,R+'/mc/'+k]));
 for(const n of ['1.12.2-forge1.12.2-14.23.5.2860','1.20.1-forge-47.3.0','neoforge-21.1.172','1.12.2'])fs.mkdirSync(dirs.versions+'/'+n,{recursive:true}),fs.writeFileSync(dirs.versions+'/'+n+'/'+n+'.json','{}');
 assert.equal(t.findLoaderVersion(dirs,'forge','1.12.2','14.23.5.2860'),'1.12.2-forge1.12.2-14.23.5.2860');assert.equal(t.findLoaderVersion(dirs,'forge','1.20.1','47.3.0'),'1.20.1-forge-47.3.0');
 assert.equal(t.findLoaderVersion(dirs,'neoforge','1.21.1','21.1.172'),'neoforge-21.1.172');assert.equal(t.findLoaderVersion(dirs,'forge','1.12.2','1.0'),null);
 // --- plan(): профиль Forge 1.12.2 поверх ванильной 1.12.2 (legacy-аргументы, библиотеки без downloads)
 const sha=s=>crypto.createHash('sha1').update(s).digest('hex');
 const vj=JSON.stringify({id:'1.12.2',type:'release',mainClass:'net.minecraft.client.main.Main',downloads:{client:{url:'http://m/c.jar',sha1:'a'.repeat(40),size:1}},assetIndex:{id:'1.12',url:'http://m/ai.json',sha1:sha('{"objects":{}}'),size:14},
  minecraftArguments:'--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory}',libraries:[{name:'org.lwjgl.lwjgl:lwjgl-platform:2.9.4',natives:{windows:'natives-windows'},downloads:{classifiers:{'natives-windows':{path:'n/n.jar',url:'http://m/n',sha1:'b'.repeat(40),size:1}}}}]});
 const fid='1.12.2-forge1.12.2-14.23.5.2860',fg={id:fid,inheritsFrom:'1.12.2',mainClass:'net.minecraft.launchwrapper.Launch',minecraftArguments:'--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker',
  libraries:[{name:'net.minecraftforge:forge:1.12.2-14.23.5.2860'},{name:'net.minecraft:launchwrapper:1.12'},{name:'org.ow2.asm:asm-all:5.2',url:'http://files.minecraftforge.net/maven/'}]};
 fs.writeFileSync(dirs.versions+'/'+fid+'/'+fid+'.json',JSON.stringify(fg));fs.writeFileSync(dirs.versions+'/1.12.2/1.12.2.json',vj);fs.mkdirSync(dirs.assets+'/indexes',{recursive:true});fs.writeFileSync(dirs.assets+'/indexes/1.12.json','{"objects":{}}');
 global.fetch=async u=>({ok:true,status:200,json:async()=>({versions:[{id:'1.12.2',url:'http://m/v.json',sha1:sha(vj)}]})});
 const p=await t.plan(fid,dirs,{javaPath:process.execPath},new AbortController().signal),url=n=>p.tasks.find(x=>x.label===n)?.url;
 assert.equal(url('net.minecraft:launchwrapper:1.12'),'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar');
 assert.equal(url('org.ow2.asm:asm-all:5.2'),'https://files.minecraftforge.net/maven/org/ow2/asm/asm-all/5.2/asm-all-5.2.jar');assert(url('net.minecraftforge:forge:1.12.2-14.23.5.2860').includes('/net/minecraftforge/forge/1.12.2-14.23.5.2860/forge-1.12.2-14.23.5.2860.jar'));
 assert(p.natives.length===1&&!p.vj.arguments&&p.vj.minecraftArguments.includes('--tweakClass')&&p.cp.at(-1).endsWith('1.12.2.jar'));
 const a=t.buildArgs({id:fid,name:'S',ram:1024,cp:p.cp,ndir:'n',gameDir:'g',assetsRoot:'as',vj:p.vj});
 assert(a.includes('net.minecraft.launchwrapper.Launch')&&a.includes('--tweakClass')&&a.includes('-Djava.library.path=n')&&a.includes(fid));
 console.log('stage7-tests-ok')})();

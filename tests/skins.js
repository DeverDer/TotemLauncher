const assert=require('assert'),fs=require('fs'),Module=require('module');
const ol=Module._load;Module._load=function(r,...a){if(r==='adm-zip')return class{constructor(f){this.m=JSON.parse(fs.readFileSync(f,'utf8'))}getEntry(n){return n in this.m?n:null}readAsText(n){return this.m[n]}};return ol.call(this,r,...a)};
require('../src/ui/skin.js');const {_t:K}=Skin;
for(const slim of[false,true]){ // UV: без перекрытий и в границах 64x64, база+внешний слой
 const g=Array.from({length:64},()=>Array(64).fill(0));let area=0;
 for(const o of[1,2])for(const [,,s,ub,uo] of K.PARTS(slim)){const [u,v]=o===1?ub:uo,R=K.faces(u,v,s[0],s[1],s[2]);for(const f in R){const [x,y,w,h]=R[f];assert(x>=0&&y>=0&&x+w<=64&&y+h<=64);for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){assert(!g[j][i]++,'overlap '+i+','+j);if(o===1)area++}}}
 assert.equal(area,slim?1632-2*(2*(12+4)*1):1632);
}
assert.equal(K.build(false,false).length,6*6*6*6);assert.equal(K.build(true,true).length,1296);
const Skins=require('../src/skins.js'),crypto=require('crypto');
const png=(w,h)=>{const b=Buffer.alloc(40);b.writeUInt32BE(0x89504e47,0);b.write('IHDR',12,'ascii');b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b};
Skins.check(png(64,64));assert.throws(()=>Skins.check(png(64,32)),/64×32/);assert.throws(()=>Skins.check(Buffer.from('hello world, not a png at all.....')),/PNG/);
const S=new Skins('/tmp/sk');fs.rmSync('/tmp/sk',{recursive:true,force:true});const e=S.put({name:'  Алекс ',model:'slim',data:png(64,64).toString('base64')});
assert(S.list()[0].name==='Алекс'&&S.list()[0].model==='slim');S.put({id:e.id,name:'B',model:'x',data:png(64,64).toString('base64')});assert(S.all().length===1&&S.all()[0].model==='classic');
assert.throws(()=>S.put({name:'x',data:png(10,10).toString('base64')}));assert.throws(()=>S.remove('../x'));S.remove(e.id);assert(S.all().length===0);
const {_t:t}=require('../src/game.js'),R=(b)=>({ok:true,status:200,json:async()=>b});
global.fetch=async u=>u.includes('promotions')?R({promos:{'1.20.1-recommended':'47.3.0','1.21-latest':'51.0.1'}}):R({versions:['20.4.237','21.1.9','21.1.172','21.1.172-beta','21.1.100','21.0.5','21.2.0-beta']});
(async()=>{assert.equal(await t.loaderLatest('forge','1.20.1'),'47.3.0');assert.equal(await t.loaderLatest('forge','1.21'),'51.0.1');await assert.rejects(t.loaderLatest('forge','1.2'),/не поддерживает/);
 assert.equal(await t.loaderLatest('neoforge','1.21.1'),'21.1.172');assert.equal(await t.loaderLatest('neoforge','1.21'),'21.0.5');assert.equal(await t.loaderLatest('neoforge','1.20.4'),'20.4.237');
 await assert.rejects(t.loaderLatest('neoforge','1.20.1'),/от 1.20.2/);await assert.rejects(t.loaderLatest('quilt','1.20'),/Неизвестный/);
 const a=t.buildArgs({id:'f',name:'S',ram:1,cp:['a'],ndir:'n',gameDir:'g',libDir:'LIB',assetsRoot:'as',vj:{type:'release',mainClass:'M',assetIndex:{id:'1'},arguments:{jvm:['-DlibraryDirectory=${library_directory}','-p','${library_directory}/x.jar${classpath_separator}${library_directory}/y.jar'],game:[]}}});
 assert(a.includes('-DlibraryDirectory=LIB')&&a.some(x=>x.startsWith('LIB/x.jar')&&x.includes(require('path').delimiter+'LIB/y.jar')));
 const I=new (require('../src/instances.js'))('/tmp/ti2/i','/tmp/ti2/i.json');fs.rmSync('/tmp/ti2',{recursive:true,force:true});
 const v=I.create({name:'V',mc:'1.20.1',loader:'vanilla'});fs.writeFileSync('/tmp/ti2/a.jar',JSON.stringify({'META-INF/mods.toml':'modId="a"'}));fs.writeFileSync('/tmp/ti2/b.jar',JSON.stringify({}));
 assert.equal(I.neededLoader(['/tmp/ti2/b.jar','/tmp/ti2/a.jar']),'forge');assert.equal(I.neededLoader(['/tmp/ti2/b.jar']),null);
 I.setLoader(v.id,'forge','47.3.0');assert.equal(I.get(v.id).loader,'forge');assert.throws(()=>I.setLoader(v.id,'fabric','1'),/только/);assert.throws(()=>I.setLoader(v.id,'forge','../x'));
 console.log('stage6-tests-ok')})();

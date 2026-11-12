// Ядро обновлений/установщика: версии, релизы GitHub (поддельный сервер), скачивание с SHA-256, распаковка zip, install.json
const assert=require('assert'),fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),zlib=require('zlib');
const U=require('../src/updater-core.js');
const R='/tmp/tupd';fs.rmSync(R,{recursive:true,force:true});fs.mkdirSync(R,{recursive:true});
// --- версии
assert.deepEqual(U.parseVer('v1.2.3'),[1,2,3]);assert.equal(U.parseVer('1.2'),null);assert.equal(U.parseVer('v1.2.3-beta'),null);assert.equal(U.parseVer('../x'),null);
assert.equal(U.cmp('0.15.0','0.14.9'),1);assert.equal(U.cmp('0.14.0','0.14.0'),0);assert.equal(U.cmp('0.9.0','0.10.0'),-1);assert.equal(U.cmp('1.0.0','0.99.99'),1);
assert(U.repoOk('Vasya/TotemLauncher')&&!U.repoOk('OWNER/REPO')&&!U.repoOk('a/b/c')&&!U.repoOk('')&&!U.repoOk('a b/c')&&!U.repoOk('../x/y'));
for(const b of ['../x','a/../../b','/abs','\\abs','C:\\x','a:stream','CON','x/nul.txt','end.','end ',''])assert(U.badRel(b),b);for(const ok of ['app.asar','resources/app.asar','locales/ru.pak','Каталог/файл.txt'])assert(!U.badRel(ok),ok);
// --- мини-писатель zip для тестов (хранение и deflate, произвольные имена, подделка размеров)
const crc=(b)=>{let c,r=0xffffffff;for(const x of b){c=(r^x)&255;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;r=(r>>>8)^c}return(r^0xffffffff)>>>0};
function makeZip(es){const loc=[],cen=[];let off=0;for(const e of es){const name=Buffer.from(e.name),raw=Buffer.from(e.data||''),m=e.method??8,data=m===8?zlib.deflateRawSync(raw):raw,us=e.usize??raw.length;
 const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x800,6);lh.writeUInt16LE(m,8);lh.writeUInt32LE(crc(raw),14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(us,22);lh.writeUInt16LE(name.length,26);
 const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x800,8);ch.writeUInt16LE(m,10);ch.writeUInt32LE(crc(raw),16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(us,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(e.attr||0,38);ch.writeUInt32LE(off,42);
 loc.push(lh,name,data);cen.push(ch,name);off+=30+name.length+data.length}
 const cd=Buffer.concat(cen),eo=Buffer.alloc(22);eo.writeUInt32LE(0x06054b50,0);eo.writeUInt16LE(es.length,8);eo.writeUInt16LE(es.length,10);eo.writeUInt32LE(cd.length,12);eo.writeUInt32LE(off,16);return Buffer.concat([...loc,cd,eo])}
const z=(name,es)=>{const p=path.join(R,name);fs.writeFileSync(p,makeZip(es));return p};
const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 // --- распаковка: обычный архив
 const good=z('good.zip',[{name:'TotemLauncher.exe',data:'MZ-fake'},{name:'resources/',data:''},{name:'resources/app.asar',data:'a'.repeat(100000)},{name:'locales/ru.pak',data:'ru',method:0},{name:'Каталог/файл.txt',data:'юникод'}]);
 const prog=[];await U.extractZip(good,R+'/out1/app-1.0.0',{onProgress:(d,t)=>prog.push([d,t])});
 assert.equal(fs.readFileSync(R+'/out1/app-1.0.0/resources/app.asar','utf8'),'a'.repeat(100000));assert.equal(fs.readFileSync(R+'/out1/app-1.0.0/Каталог/файл.txt','utf8'),'юникод');assert.equal(fs.readFileSync(R+'/out1/app-1.0.0/locales/ru.pak','utf8'),'ru');
 assert(prog.length>=3&&prog.at(-1)[0]===prog.at(-1)[1],'прогресс доходит до 100%');assert(!fs.existsSync(R+'/out1/app-1.0.0.tmp'),'временная папка убрана');
 await U.extractZip(good,R+'/out1/app-1.0.0'); // повторная распаковка поверх
 // --- распаковка: атаки
 const attacks={'../evil.txt':/Небезопасный/,'a/../../evil.txt':/Небезопасный/,'/abs.txt':/Небезопасный/,'C:\\evil.txt':/Небезопасный/,'x/CON':/Небезопасный/,'file.txt:stream':/Небезопасный/};
 for(const[n,re]of Object.entries(attacks)){const p=z('bad.zip',[{name:'ok.txt',data:'1'},{name:n,data:'pwn'}]);await assert.rejects(U.extractZip(p,R+'/out2/app'),re,n);assert(!fs.existsSync(R+'/out2/app')&&!fs.existsSync(R+'/out2/app.tmp'),'ничего не осталось: '+n);}
 assert(!fs.existsSync(R+'/evil.txt')&&!fs.existsSync('/tmp/evil.txt'),'файл вне папки не создан');
 await assert.rejects(U.extractZip(z('sym.zip',[{name:'link',data:'/etc/passwd',attr:(0xA1FF<<16)>>>0}]),R+'/out3/app'),/Символические/);
 await assert.rejects(U.extractZip(z('big.zip',[{name:'huge.bin',data:'x',method:0,usize:2*1024**3}]),R+'/out3/app'),/слишком большой/);
 await assert.rejects(U.extractZip(z('lie.zip',[{name:'a.bin',data:'abcdef',usize:3}]),R+'/out3/app'),/размер|Size|size|maxOutput|buffer/i,'заниженный размер в заголовке');
 await assert.rejects(U.extractZip(z('lie2.zip',[{name:'a.bin',data:'abc',method:0,usize:9}]),R+'/out3/app'),/Размер файла/,'завышенный размер');
 await assert.rejects(U.extractZip(R+'/good.zip.nope',R+'/out3/app'),/ENOENT/);fs.writeFileSync(R+'/junk.zip','not a zip at all');await assert.rejects(U.extractZip(R+'/junk.zip',R+'/out3/app'),/не zip/);
 // --- отмена в процессе
 const many=z('many.zip',Array.from({length:300},(_,i)=>({name:'f/'+i+'.bin',data:crypto.randomBytes(20000).toString('hex')})));const ac=new AbortController();let calls=0;
 await assert.rejects(U.extractZip(many,R+'/out4/app',{signal:ac.signal,onProgress:()=>{if(++calls===20)ac.abort()}}),/cancelled/);assert(!fs.existsSync(R+'/out4/app')&&!fs.existsSync(R+'/out4/app.tmp'),'после отмены ничего не осталось');
 // --- поддельный GitHub
 const payload=makeZip([{name:'TotemLauncher.exe',data:'MZ'}]),PSHA=sha(payload);let rel;const srv=http.createServer((q,s)=>{
  if(q.url==='/repos/me/Totem/releases/latest'){if(rel.status){s.statusCode=rel.status;return s.end('{}')}return s.end(JSON.stringify(rel.body))}
  if(q.url==='/dl/TotemLauncher-1.2.3-win-x64.zip'){s.setHeader('content-length',payload.length);return s.end(payload)}
  if(q.url==='/dl/bad.zip'){const b=Buffer.from(payload);b[10]^=1;s.setHeader('content-length',b.length);return s.end(b)}
  if(q.url==='/dl/short.zip'){s.setHeader('content-length',payload.length);s.write(payload.subarray(0,10));return s.destroy()}
  if(q.url==='/dl/redir'){s.statusCode=302;s.setHeader('location','/dl/TotemLauncher-1.2.3-win-x64.zip');return s.end()}
  if(q.url==='/dl/x.sha256')return s.end(PSHA+'  TotemLauncher-1.2.3-win-x64.zip\n');
  s.statusCode=404;s.end()});
 await new Promise((r)=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port,O={api:base,local:true};
 const asset=(over={})=>({name:'TotemLauncher-1.2.3-win-x64.zip',browser_download_url:base+'/dl/TotemLauncher-1.2.3-win-x64.zip',size:payload.length,digest:'sha256:'+PSHA,...over});
 rel={body:{tag_name:'v1.2.3',body:'Что нового',html_url:'https://github.com/me/Totem/releases/tag/v1.2.3',assets:[asset(),{name:'other.txt',browser_download_url:base+'/x'}]}};
 let L=await U.latest('me/Totem',O);assert.equal(L.version,'1.2.3');assert.equal(L.sha256,PSHA);assert.equal(L.notes,'Что нового');assert.equal(L.size,payload.length);
 rel.body.assets=[asset({digest:undefined}),{name:'TotemLauncher-1.2.3-win-x64.zip.sha256',browser_download_url:base+'/dl/x.sha256'}];L=await U.latest('me/Totem',O);assert.equal(L.sha256,PSHA,'sha256 из соседнего файла');
 rel.body.assets=[asset({digest:undefined})];L=await U.latest('me/Totem',O);assert.equal(L.sha256,null);await assert.rejects(U.download(L,R+'/d0/x.zip',O),/контрольной суммы/,'без суммы не скачиваем');
 rel.body.tag_name='release-7';await assert.rejects(U.latest('me/Totem',O),/v1\.2\.3/);rel.body.tag_name='v1.2.3';
 rel.body.assets=[asset({name:'TotemLauncher-9.9.9-win-x64.zip'})];await assert.rejects(U.latest('me/Totem',O),/нет файла/,'версия файла не совпадает с тегом');
 rel.body.assets=[asset({browser_download_url:'https://evil.example/TotemLauncher-1.2.3-win-x64.zip'})];await assert.rejects(U.latest('me/Totem',O),/Недопустимая ссылка/,'чужой хост');
 rel.body.assets=[asset({browser_download_url:'https://github.com.evil.example/me/Totem/releases/download/v1.2.3/TotemLauncher-1.2.3-win-x64.zip'})];await assert.rejects(U.latest('me/Totem',O),/Недопустимая ссылка/,'хост-двойник');
 rel.body.assets=[asset({browser_download_url:'https://github.com/other/repo/releases/download/v1.2.3/TotemLauncher-1.2.3-win-x64.zip'})];await assert.rejects(U.latest('me/Totem',O),/Недопустимая ссылка/,'чужой репозиторий');
 rel.body.assets=[asset({browser_download_url:'http://github.com/me/Totem/releases/download/v1.2.3/TotemLauncher-1.2.3-win-x64.zip'})];await assert.rejects(U.latest('me/Totem',{...O,local:false}),/Недопустимая ссылка/,'http вместо https');
 rel={status:404};await assert.rejects(U.latest('me/Totem',O),/нет опубликованных/);rel={status:403};await assert.rejects(U.latest('me/Totem',O),/ограничил/);rel={status:500};await assert.rejects(U.latest('me/Totem',O),/HTTP 500/);
 await assert.rejects(U.latest('OWNER/REPO',O),/не настроен/);await assert.rejects(U.latest('',O),/не настроен/);await assert.rejects(U.latest('me/Totem',{api:'http://127.0.0.1:1',local:true}),(e)=>e.net&&/Нет связи/.test(e.message));
 // --- скачивание
 const info={url:base+'/dl/TotemLauncher-1.2.3-win-x64.zip',size:payload.length,sha256:PSHA};const pr=[];
 await U.download(info,R+'/d1/ok.zip',{...O,onProgress:(a,b)=>pr.push([a,b])});assert(fs.readFileSync(R+'/d1/ok.zip').equals(payload));assert.equal(pr.at(-1)[0],payload.length);assert(!fs.existsSync(R+'/d1/ok.zip.part'));
 await U.download({...info,url:base+'/dl/redir'},R+'/d1/redir.zip',O);assert(fs.existsSync(R+'/d1/redir.zip'),'перенаправление внутри разрешённых хостов');
 await assert.rejects(U.download({...info,url:base+'/dl/bad.zip'},R+'/d1/bad.zip',O),/SHA-256/);assert(!fs.existsSync(R+'/d1/bad.zip')&&!fs.existsSync(R+'/d1/bad.zip.part'),'подменённый файл не остаётся');
 await assert.rejects(U.download({...info,sha256:'0'.repeat(64)},R+'/d1/s.zip',O),/SHA-256/);await assert.rejects(U.download({...info,size:5},R+'/d1/s2.zip',O),/размер|больше/);
 await assert.rejects(U.download({...info,size:payload.length+10},R+'/d1/s3.zip',O),/размер/);await assert.rejects(U.download({...info,url:base+'/dl/short.zip'},R+'/d1/s4.zip',O),/Не удалось скачать/);
 await assert.rejects(U.download({...info,url:base+'/nope'},R+'/d1/s5.zip',O),/HTTP 404/);
 const ac2=new AbortController();ac2.abort();await assert.rejects(U.download(info,R+'/d1/c.zip',{...O,signal:ac2.signal}),/cancelled/);
 const real=global.fetch;global.fetch=async()=>({ok:true,url:'https://evil.example/x',headers:new Headers(),body:new Response('x').body});await assert.rejects(U.download({url:'https://github.com/me/Totem/releases/download/v1/x.zip',size:1,sha256:'0'.repeat(64)},R+'/d1/e.zip',{}),/перенаправление/i);global.fetch=real;srv.close();
 // --- install.json
 const env={TOTEM_LOCALDATA:R+'/ld',TOTEM_DEFAULT_ROOT:R+'/root'};assert.equal(U.readInstall(env),null);
 const root=R+'/Programs/TotemLauncher';fs.mkdirSync(U.appDirOf(root,'1.0.0'),{recursive:true});fs.writeFileSync(path.join(U.appDirOf(root,'1.0.0'),U.EXE),'x');
 U.writeInstall(root,'1.0.0','me/Totem',env);let ri=U.readInstall(env);assert.equal(ri.dir,root);assert.equal(ri.version,'1.0.0');assert.equal(ri.repo,'me/Totem');assert(fs.existsSync(root+'/install.json'));
 fs.writeFileSync(R+'/ld/install.json','{"dir":"relative/x","version":"1.0.0"}');assert.equal(U.readInstall(env),null,'относительный путь отвергается');fs.writeFileSync(R+'/ld/install.json','не json');assert.equal(U.readInstall(env),null);
 U.writeInstall(root,'1.0.0','me/Totem',env);fs.rmSync(U.appDirOf(root,'1.0.0'),{recursive:true});assert.equal(U.readInstall(env),null,'файлов нет — не установлен');
 // --- папки
 fs.mkdirSync(R+'/pick/empty',{recursive:true});fs.mkdirSync(R+'/pick/full',{recursive:true});fs.writeFileSync(R+'/pick/full/doc.txt','x');fs.mkdirSync(R+'/pick/ours',{recursive:true});fs.writeFileSync(R+'/pick/ours/install.json','{}');
 assert.equal(U.pickRoot(R+'/pick/empty'),R+'/pick/empty');assert.equal(U.pickRoot(R+'/pick/new'),R+'/pick/new');assert.equal(U.pickRoot(R+'/pick/full'),R+'/pick/full/TotemLauncher','занятая папка → подпапка');assert.equal(U.pickRoot(R+'/pick/ours'),R+'/pick/ours');
 const cr=R+'/clean';for(const d of ['app-1.0.0','app-1.1.0','.app-1.2.0.tmp','app-1.2.0.tmp','userdata','app-x'])fs.mkdirSync(cr+'/'+d,{recursive:true});assert.equal(U.cleanupOld(cr,cr+'/app-1.1.0'),3);assert.deepEqual(fs.readdirSync(cr).sort(),['app-1.1.0','app-x','userdata']);
 assert(U.freeBytes(R)>0);assert.equal(U.fmtMb(104857600),'100 МБ');assert.equal(U.fmtMb(1572864),'1,5 МБ');
 console.log('updater-tests-ok');
})().catch((e)=>{console.error(e);process.exit(1)});

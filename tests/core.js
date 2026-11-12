const http=require('http'),fs=require('fs'),crypto=require('crypto'),assert=require('assert');const {_t:t}=require('../src/game.js');
const body=Buffer.alloc(300000,7),sha=crypto.createHash('sha1').update(body).digest('hex');let hits=0;
const srv=http.createServer((q,r)=>{hits++;if(q.url==='/flaky'&&hits<3){r.destroy();return}r.end(q.url==='/bad'?Buffer.from('x'):body)}).listen(0,async()=>{
 const u='http://127.0.0.1:'+srv.address().port,d='/tmp/tt';fs.rmSync(d,{recursive:true,force:true});
 await t.runTasks([{url:u+'/flaky',dest:d+'/a',sha1:sha,size:body.length}],new AbortController().signal,()=>{});assert(fs.existsSync(d+'/a'));
 await assert.rejects(t.runTasks([{url:u+'/bad',dest:d+'/b',sha1:sha,size:1}],new AbortController().signal,()=>{}));assert(!fs.existsSync(d+'/b')&&!fs.existsSync(d+'/b.part'));
 const ac=new AbortController();ac.abort();await assert.rejects(t.runTasks([{url:u+'/x',dest:d+'/c',sha1:sha}],ac.signal,()=>{}));
 assert(t.allowed([{action:'allow'},{action:'disallow',os:{name:'osx'}}])&&!t.allowed([{action:'allow',os:{name:'linux'}}])&&!t.allowed([{action:'allow',features:{demo:true}}]));
 assert.equal(t.offlineUuid('Notch'),'b50ad385-829d-3141-a216-7e7d7539ba7f');
 const a=t.buildArgs({id:'1.20.1',name:'Steve',ram:2048,cp:['a.jar','b.jar'],ndir:'n',gameDir:'g',assetsRoot:'as',vj:{type:'release',mainClass:'M',assetIndex:{id:'5'},arguments:{jvm:['-cp','${classpath}',{rules:[{action:'allow',os:{name:'osx'}}],value:'-X'}],game:['--username','${auth_player_name}']}}});
 assert.deepEqual(a.slice(0,3),['-Xmx2048M','-cp','a.jar;b.jar'.replace(';',require('path').delimiter)]);assert(a.includes('Steve')&&!a.includes('-X'));
 const o=t.buildArgs({id:'1.7.10',name:'S',ram:1024,cp:['a'],ndir:'n',gameDir:'g',assetsRoot:'as',vj:{type:'release',mainClass:'M',assetIndex:{id:'1.7.10'},minecraftArguments:'--username ${auth_player_name} --version ${version_name}'}});assert(o.includes('-Djava.library.path=n')&&o.includes('1.7.10'));
 console.log('tests-ok');srv.close()});

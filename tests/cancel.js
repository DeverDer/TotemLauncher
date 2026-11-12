const assert=require('assert'),http=require('http');require('../src/ui/skin.js');const {_t:t}=require('../src/game.js');
// Steve: все видимые грани базового слоя закрашены непрозрачно, внешний слой пуст
const px=new Set();const ctx={fillStyle:'',clearRect(){},fillRect(x,y,w,h){if(this.fillStyle)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)px.add(j*64+i)}};Skin.steve(ctx,false);assert.equal(px.size,1632);
// Отмена: после abort ни одного отчёта о прогрессе, все потоки завершены
const srv=http.createServer((q,r)=>{r.write(Buffer.alloc(1000));const iv=setInterval(()=>r.write(Buffer.alloc(1000)),20);r.on('close',()=>clearInterval(iv))}).listen(0,async()=>{
 const u='http://127.0.0.1:'+srv.address().port,ac=new AbortController();let reports=0;const tasks=[1,2,3].map(i=>({url:u+'/'+i,dest:'/tmp/tc/'+i,size:1e9}));
 await assert.rejects(t.runTasks(tasks,ac.signal,()=>{if(++reports===5)ac.abort()}),/cancelled/); /* отмена по числу отчётов, а не по таймеру: на загруженной машине таймер срабатывал до первого байта */const at=reports;await new Promise(r=>setTimeout(r,300));assert.equal(reports,at,'после отмены прогресс не приходит');assert(at>0);
 const fs=require('fs');assert(!fs.existsSync('/tmp/tc/1.part'),'временные файлы удалены');
 global.fetch=async u=>({ok:true,status:200,json:async()=>({versions:['26.1.5','26.1.9','25.9.1']})});
 assert.equal(await t.loaderLatest('neoforge','26.1'),'26.1.9');console.log('redesign-backend-ok');srv.close()});

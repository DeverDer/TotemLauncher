const assert=require('assert'),fs=require('fs');const Auth=require('../src/auth.js');
let mode='ok',calls=[];const R=(b,s=200)=>({ok:s<300,status:s,json:async()=>b});
global.fetch=async(u,o={})=>{calls.push(u);
 if(u.includes('devicecode'))return R({user_code:'ABC',verification_uri:'https://www.microsoft.com/link',device_code:'d',interval:0,expires_in:60});
 if(u.includes('/token')){const b=o.body.toString();if(b.includes('device_code=d')){global._p=(global._p||0)+1;return R(global._p<2?{error:'authorization_pending'}:{access_token:'ms',refresh_token:'rt1'})}return R({access_token:'ms2',refresh_token:'rt2'})}
 if(u.includes('user/authenticate'))return R({Token:'xbl',DisplayClaims:{xui:[{uhs:'u1'}]}});
 if(u.includes('xsts'))return mode==='child'?R({XErr:2148916238},401):R({Token:'xsts'});
 if(u.includes('login_with_xbox'))return R({access_token:'MC',expires_in:mode==='exp'?1:86400});
 if(u.includes('minecraft/profile'))return mode==='nogame'?R({},404):R({id:'abc123',name:'Steve'})};
const ss={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).reverse(),decryptString:b=>Buffer.from(b).reverse().toString()};
(async()=>{const f='/tmp/auth.bin';try{fs.unlinkSync(f)}catch{};const a=new Auth(f,ss);let codes=[];
 const s=await a.login('cid',c=>codes.push(c),new AbortController().signal);assert(s.loggedIn&&s.name==='Steve'&&codes[0].user_code==='ABC');
 assert(!fs.readFileSync(f,'utf8').includes('MC'),'token must not be plaintext');
 const b=new Auth(f,ss);assert.equal((await b.token('cid')).token,'MC');assert.equal(b.status().name,'Steve');
 mode='exp';await b.token('cid');await Promise.resolve();b.acc.expires=0;mode='ok';const r=await b.token('cid');assert.equal(r.refresh,'rt2');
 mode='child';await assert.rejects(new Auth('/tmp/x',ss).login('c',()=>{},new AbortController().signal),/Детский/);
 mode='nogame';global._p=0;await assert.rejects(new Auth('/tmp/x',ss).login('c',()=>{},new AbortController().signal),/нет Minecraft/);
 b.logout();assert(!fs.existsSync(f));console.log('auth-tests-ok')})();

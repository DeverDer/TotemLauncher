totem.onProgress(({percent,stage})=>{f.style.width=percent+'%';p.textContent=percent+'%';s.textContent=stage});totem.onError(t=>{m.textContent=t;a.style.display='block';s.textContent='Ошибка запуска'})
x1.onclick = x2.onclick = () => totem.close();
rt.onclick = () => { totem.retry(); a.style.display = 'none'; };
lg.onclick = () => totem.openLog();

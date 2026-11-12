go.onclick=async()=>{go.disabled=true;e.textContent='';const r=await totem.setupRun(cb.checked);if(!r.ok){e.textContent=r.error;go.disabled=false}}
x1.onclick = () => totem.close();

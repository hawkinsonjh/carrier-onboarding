(function(){
  const steps = [
    ['Welcome','Requirements'],
    ['Authority','MC / DOT / identity'],
    ['Contacts','Dispatch & billing'],
    ['Equipment','Lanes & tracking'],
    ['Insurance','Limits & COI'],
    ['Payment','W-9 & remit'],
    ['Documents','Uploads'],
    ['Agreement','Review & e-sign']
  ];
  const nav = document.getElementById('steps');
  steps.forEach((s,i)=>{
    const el = document.createElement('div');
    el.className = 'step'+(i===0?' on':'');
    el.dataset.go = i;
    el.innerHTML = '<span class="dot">'+(i+1)+'</span><span>'+s[0]+'<small>'+s[1]+'</small></span>';
    nav.appendChild(el);
  });
  let cur = 0;
  const form = document.getElementById('packet');
  const panels = [...document.querySelectorAll('.step-panel')];
  const bar = document.getElementById('bar');
  function show(n){
    cur = n;
    panels.forEach(p=>p.classList.toggle('hidden', Number(p.dataset.step)!==n));
    document.querySelectorAll('.step').forEach((el,i)=>{
      el.classList.toggle('on', i===Math.min(n, steps.length-1));
      el.classList.toggle('done', i<n && n<=7);
    });
    bar.style.width = Math.min(100, Math.round((n/7)*100)) + '%';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function requiredOk(panel){
    const fields = [...panel.querySelectorAll('[required]')].filter(el=>el.offsetParent!==null || el.type==='hidden' || el.type==='checkbox' || el.type==='file');
    for(const el of fields){
      if(el.type==='checkbox' && !el.checked){ el.focus(); return false; }
      if(el.type==='file' && el.files.length===0){ el.focus(); return false; }
      if(el.type!=='checkbox' && el.type!=='file' && !String(el.value||'').trim()){ el.reportValidity(); return false; }
    }
    if(panel.dataset.step==='3'){
      if(![...document.querySelectorAll('[name=equipment]:checked')].length){
        alert('Select at least one equipment type.'); return false;
      }
    }
    return true;
  }
  document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{
    const panel = panels.find(p=>Number(p.dataset.step)===cur);
    if(!requiredOk(panel)) return;
    show(cur+1);
  });
  document.querySelectorAll('[data-prev]').forEach(b=>b.onclick=()=>show(Math.max(0,cur-1)));
  nav.addEventListener('click', e=>{
    const s = e.target.closest('.step');
    if(!s) return;
    const go = Number(s.dataset.go);
    if(go<=cur) show(go);
  });
  document.getElementById('saferBtn').onclick=()=>{
    const dot = (form.usdot.value||'').replace(/\D/g,'');
    const url = dot
      ? 'https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string='+encodeURIComponent(dot)
      : 'https://safer.fmcsa.dot.gov/CompanySnapshot.aspx';
    window.open(url,'_blank','noopener');
  };
  const canvas = document.getElementById('sig');
  const ctx = canvas.getContext('2d');
  let draw=false, last=null, signed=false;
  function pos(e){
    const r = canvas.getBoundingClientRect();
    const t = e.touches? e.touches[0]: e;
    return {x:(t.clientX-r.left)*canvas.width/r.width, y:(t.clientY-r.top)*canvas.height/r.height};
  }
  function start(e){ e.preventDefault(); draw=true; last=pos(e); }
  function move(e){
    if(!draw) return; e.preventDefault();
    const p=pos(e); ctx.beginPath(); ctx.lineWidth=2.2; ctx.lineCap='round'; ctx.strokeStyle='#1D1160';
    ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; signed=true;
  }
  function end(){ draw=false; }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
  document.getElementById('clearSig').onclick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); signed=false; };
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!document.getElementById('c1').checked || !document.getElementById('c2').checked || !document.getElementById('c3').checked || !document.getElementById('c4').checked){
      alert('Confirm all agreement checkboxes.'); return;
    }
    if(!signed){ alert('Please draw your signature.'); return; }
    document.getElementById('signature_data').value = canvas.toDataURL('image/png');
    document.getElementById('signed_at').value = new Date().toISOString();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Submitting\u2026';
    const fd = new FormData(form);
    fd.set('equipment', [...document.querySelectorAll('[name=equipment]:checked')].map(x=>x.value).join(', '));
    try{
      const res = await fetch('https://formsubmit.co/ajax/joe@hawkinsonfreight.com', {
        method:'POST',
        headers:{'Accept':'application/json'},
        body: fd
      });
      if(!res.ok) throw new Error('send failed');
      show(8);
    }catch(err){
      const summary = buildSummary();
      try{ localStorage.setItem('hf_packet_'+Date.now(), summary); }catch(_){}
      const mail = 'mailto:joe@hawkinsonfreight.com?subject='+encodeURIComponent('Carrier packet \u2014 '+(form.legal_name.value||''))+'&body='+encodeURIComponent(summary.slice(0,1800)+'\n\n(Attach W-9, COI, and authority PDFs to this email if the web upload did not go through.)');
      window.location.href = mail;
      alert('If email did not open, send your packet files to joe@hawkinsonfreight.com.');
      show(8);
    }finally{
      btn.disabled=false; btn.textContent='Sign and submit packet';
    }
  });
  function buildSummary(){
    const data = new FormData(form);
    let out = 'HAWKINSON FREIGHT LLC \u2014 CARRIER PACKET\n'+new Date().toLocaleString()+' America/New_York\n\n';
    for(const [k,v] of data.entries()){
      if(v instanceof File){ out += k+': '+(v.name||'(file)')+'\n'; continue; }
      if(k.startsWith('_')||k==='signature_data') continue;
      out += k+': '+v+'\n';
    }
    out += 'equipment: '+[...document.querySelectorAll('[name=equipment]:checked')].map(x=>x.value).join(', ')+'\n';
    return out;
  }
  document.getElementById('printBtn').onclick=()=>{
    const w=window.open('','_blank');
    w.document.write('<pre style="font:14px/1.4 ui-monospace,monospace;white-space:pre-wrap;padding:24px">'+buildSummary().replace(/[<>]/g,'')+'</pre>');
    w.document.close(); w.focus(); w.print();
  };
})();

/* MENU — vanilla port Panel.tsx z cib-v1 (fáze pred → prichod / odchod-pred → odchod, dvojí rAF). */
(function(){
  var PRICHOD=1300, ODCHOD=800;
  var panel=document.getElementById('vp-menu'); if(!panel) return;
  var pozadi=panel.querySelector('.panel__pozadi');
  var zavrit=panel.querySelectorAll('[data-menu-close]');
  var spoustece=document.querySelectorAll('[data-menu-open]');
  var faze='pryc', timer=0, ulozOverflow='', ulozPad='', spoustec=null;
  var bezPohybu=function(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;};
  function pozadiPrvky(){return [document.querySelector('#main-wrapper'),document.querySelector('main'),document.querySelector('footer')].filter(Boolean);}
  function zamkni(){var b=document.body;ulozOverflow=b.style.overflow;ulozPad=b.style.paddingRight;var sb=window.innerWidth-document.documentElement.clientWidth;b.style.overflow='hidden';if(sb>0)b.style.paddingRight=sb+'px';b.classList.add('cib-menu-open');pozadiPrvky().forEach(function(e){e.setAttribute('inert','');});}
  function odemkni(){var b=document.body;b.style.overflow=ulozOverflow;b.style.paddingRight=ulozPad;b.classList.remove('cib-menu-open');pozadiPrvky().forEach(function(e){e.removeAttribute('inert');});}
  function nastav(f){
    faze=f;
    panel.className='panel panel--zprava panel--dve-tretiny '+((f==='pred'||f==='prichod')?'panel--prichod':'panel--odchod')+(f==='pred'?' panel--neaktivni':'')+(f==='odchod'?' panel--aktivni':'');
  }
  function otevri(btn){
    if(faze==='prichod'||faze==='pred') return;
    clearTimeout(timer); spoustec=btn||spoustec;
    var obsah=panel.querySelector('.panel__obsah');
    /* výchozí stav stěru natvrdo inline + vynucený reflow: prohlížeč ho musí vykreslit dřív, než přijde cílový stav, jinak stěr nejede */
    obsah.style.transition='none'; obsah.style.clipPath='polygon(100% 0,200% 0,220% 100%,120% 100%)'; pozadi.style.transition='none'; pozadi.style.opacity='0';
    panel.hidden=false; zamkni(); nastav('pred'); void obsah.offsetWidth;
    spoustece.forEach(function(b){b.setAttribute('aria-expanded','true');});
    requestAnimationFrame(function(){requestAnimationFrame(function(){ if(faze==='pred'){ obsah.style.transition=''; pozadi.style.transition=''; void obsah.offsetWidth; obsah.style.clipPath=''; pozadi.style.opacity=''; nastav('prichod'); var prvni=panel.querySelector('a[href],button:not([tabindex="-1"])'); if(prvni) prvni.focus(); } });});
  }
  function zavri(){
    if(faze==='pryc'||faze==='odchod'||faze==='odchod-pred') return;
    nastav('odchod-pred');
    requestAnimationFrame(function(){requestAnimationFrame(function(){ if(faze!=='odchod-pred') return; nastav('odchod');
      timer=setTimeout(function(){ panel.hidden=true; faze='pryc'; panel.className='panel panel--zprava panel--dve-tretiny'; odemkni(); spoustece.forEach(function(b){b.setAttribute('aria-expanded','false');}); if(spoustec&&spoustec.focus) spoustec.focus(); }, bezPohybu()?0:ODCHOD);
    });});
  }
  spoustece.forEach(function(b){ b.addEventListener('click',function(e){ e.preventDefault(); e.stopImmediatePropagation(); otevri(b); },true); });
  zavrit.forEach(function(b){ b.addEventListener('click',function(e){ e.preventDefault(); zavri(); }); });
  if(pozadi) pozadi.addEventListener('click',zavri);
  panel.querySelectorAll('a[href]').forEach(function(a){ a.addEventListener('click',function(){ spoustec=null; }); });
  document.addEventListener('keydown',function(e){
    if(panel.hidden) return;
    if(e.key==='Escape'){ e.preventDefault(); zavri(); return; }
    if(e.key!=='Tab') return;
    var prvky=Array.prototype.filter.call(panel.querySelectorAll('a[href],button:not([tabindex="-1"])'),function(el){return el.getClientRects().length>0;});
    if(!prvky.length){e.preventDefault();return;}
    var prvni=prvky[0],posledni=prvky[prvky.length-1],ted=document.activeElement,uvnitr=panel.contains(ted);
    if(e.shiftKey&&(!uvnitr||ted===prvni)){e.preventDefault();posledni.focus();}
    else if(!e.shiftKey&&(!uvnitr||ted===posledni)){e.preventDefault();prvni.focus();}
  });
})();

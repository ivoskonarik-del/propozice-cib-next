/* CIB GROUP – podstránky: formulář, mapa projektů, mozaika/lightbox, filtr karet */
(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var SVGNS='http://www.w3.org/2000/svg';

  /* ── formulář ─────────────────────────────────────────── */
  function initForm(f){
    $$('select',f).forEach(function(s){
      var up=function(){s.classList.toggle('is-set',!!s.value)}; s.addEventListener('change',up); up();
    });
    var setErr=function(field,msg){
      var wrap=field.closest('.cib-field')||field.closest('.cib-check');
      if(!wrap) return; wrap.classList.toggle('is-error',!!msg);
      var e=wrap.querySelector('.cib-field__err'); if(e) e.textContent=msg||'';
    };
    $$('input,textarea,select',f).forEach(function(el){el.addEventListener('input',function(){setErr(el,'')})});
    f.addEventListener('submit',function(ev){
      ev.preventDefault(); var ok=true;
      $$('[required]',f).forEach(function(el){
        var v=el.type==='checkbox'?el.checked:el.value.trim();
        var msg='';
        if(!v) msg=el.type==='checkbox'?'Bez souhlasu nemůžeme zprávu zpracovat.':(el.dataset.err||'Toto pole je povinné.');
        else if(el.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg='Zadejte platný e-mail.';
        if(msg) ok=false; setErr(el,msg);
      });
      if(!ok){var first=$('.is-error',f); if(first){var inp=first.querySelector('input,textarea,select'); inp&&inp.focus();} return;}
      f.classList.add('is-done');
      var done=$('.cib-form__done',f); if(done){done.setAttribute('tabindex','-1'); done.focus({preventScroll:true});}
    });
  }
  $$('form.cib-form').forEach(initForm);

  /* ── filtr projektových karet ─────────────────────────── */
  $$('[data-filter-for]').forEach(function(bar){
    var grid=$(bar.dataset.filterFor); if(!grid) return;
    bar.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return;
      $$('button',bar).forEach(function(x){x.classList.toggle('is-on',x===b)});
      var k=b.dataset.k;
      $$('.pg-card',grid).forEach(function(c){c.classList.toggle('is-hidden',!(k==='all'||c.dataset.k===k))});
    });
  });

  /* ── lightbox pro mozaiku ─────────────────────────────── */
  var lb=null, lbItems=[], lbIdx=0;
  function ensureLb(){
    if(lb) return lb;
    lb=document.createElement('div'); lb.className='pg-lb'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-label','Fotografie');
    lb.innerHTML='<img alt=""><button class="pg-lb__prev" aria-label="Předchozí">‹ Předchozí</button><button class="pg-lb__next" aria-label="Další">Další ›</button><button class="pg-lb__close" aria-label="Zavřít">Zavřít ×</button><span class="pg-lb__cnt"></span>';
    document.body.appendChild(lb);
    var show=function(i){lbIdx=(i+lbItems.length)%lbItems.length; var a=lbItems[lbIdx]; var im=$('img',lb); im.src=a.href; im.alt=a.querySelector('img')?a.querySelector('img').alt:''; $('.pg-lb__cnt',lb).textContent=(lbIdx+1)+' / '+lbItems.length;};
    lb.show=show;
    $('.pg-lb__prev',lb).addEventListener('click',function(){show(lbIdx-1)});
    $('.pg-lb__next',lb).addEventListener('click',function(){show(lbIdx+1)});
    var close=function(){lb.classList.remove('is-open'); document.body.style.overflow=''};
    $('.pg-lb__close',lb).addEventListener('click',close);
    lb.addEventListener('click',function(e){if(e.target===lb) close()});
    document.addEventListener('keydown',function(e){if(!lb.classList.contains('is-open')) return; if(e.key==='Escape') close(); if(e.key==='ArrowRight') show(lbIdx+1); if(e.key==='ArrowLeft') show(lbIdx-1);});
    return lb;
  }
  $$('.pg-mosaic__grid').forEach(function(g){
    g.addEventListener('click',function(e){
      var a=e.target.closest('a'); if(!a) return; e.preventDefault();
      lbItems=$$('a',g); ensureLb().show(lbItems.indexOf(a)); lb.classList.add('is-open'); document.body.style.overflow='hidden';
    });
  });

  /* ── mapa projektů ────────────────────────────────────── */
  var K=window.CIB_KRAJE, P=window.CIB_PROJEKTY;
  function proj(lat,lon){var s=K.fit; return [s[0][0]*lon+s[1][0]*lat+s[2][0], s[0][1]*lon+s[1][1]*lat+s[2][1]];}
  var PRAHA={lat:50.075,lon:14.45};
  function buildMap(sec){
    if(!K||!P) return;
    var mode=sec.dataset.mode||'all', only=sec.dataset.only||'';
    var stage=$('.pg-map__stage',sec); if(!stage) return;
    var withInset=mode==='all'||mode==='praha';
    var W=withInset?1930:1426, H=822;
    if(mode==='praha'){W=560;H=560;}
    var svg=document.createElementNS(SVGNS,'svg'); svg.setAttribute('viewBox',mode==='praha'?'0 0 560 560':('-7 -6 '+W+' '+H)); svg.setAttribute('class','pg-map__svg'); svg.setAttribute('aria-hidden','true');
    var gK=document.createElementNS(SVGNS,'g');
    if(mode!=='praha') K.kraje.forEach(function(k){var p=document.createElementNS(SVGNS,'path'); p.setAttribute('d',k.d); p.setAttribute('class','kraj'); p.dataset.id=k.id; gK.appendChild(p);});
    svg.appendChild(gK);
    // popisky vybraných krajů (jemně)
    var gl=document.createElementNS(SVGNS,'g');
    if(mode!=='praha') [['Čechy',380,470],['Morava',1000,560]].forEach(function(t){var x=document.createElementNS(SVGNS,'text'); x.setAttribute('x',t[1]); x.setAttribute('y',t[2]); x.setAttribute('class','region-label'); x.setAttribute('font-size','26'); x.textContent=t[0]; gl.appendChild(x);});
    svg.appendChild(gl);
    var onlyIds=only?only.split(','):null; var items=P.filter(function(p){return mode==='praha'?!!p.praha:(onlyIds?onlyIds.indexOf(p.id)>=0:true)});
    var gM=document.createElementNS(SVGNS,'g');
    var inset=null, cx=1660, cy=330, R=260;
    var SZ=mode==='praha'?{r:6,rh:4.5,fs:15,fsh:12,off:12,yb:24,yt:-12}:{r:11,rh:8,fs:30,fsh:24,off:22,yb:46,yt:-24};
    if(mode==='praha'){cx=280;cy=280;R=250;}
    if(withInset){
      // Praha: výřez vpravo, body podle zeměpisných souřadnic
      inset=document.createElementNS(SVGNS,'g');
      var pr=proj(PRAHA.lat,PRAHA.lon);
      if(mode!=='praha'){var lead=document.createElementNS(SVGNS,'path'); lead.setAttribute('class','inset-lead'); lead.setAttribute('d','M'+pr[0]+' '+pr[1]+' L'+(cx-R)+' '+cy); inset.appendChild(lead);}
      var ring=document.createElementNS(SVGNS,'circle'); ring.setAttribute('cx',cx); ring.setAttribute('cy',cy); ring.setAttribute('r',R); ring.setAttribute('class','inset-ring'); inset.appendChild(ring);
      var ring2=document.createElementNS(SVGNS,'circle'); ring2.setAttribute('cx',cx); ring2.setAttribute('cy',cy); ring2.setAttribute('r',R*.55); ring2.setAttribute('class','inset-ring'); ring2.setAttribute('style','stroke-dasharray:2 6;opacity:.6'); inset.appendChild(ring2);
      var lab=document.createElementNS(SVGNS,'text'); lab.setAttribute('x',cx); lab.setAttribute('y',cy-R-22); lab.setAttribute('text-anchor','middle'); lab.setAttribute('class','inset-label'); lab.setAttribute('font-size',mode==='praha'?'15':'26'); lab.textContent=mode==='praha'?'Praha':'Praha · detail'; inset.appendChild(lab);
      if(mode!=='praha'){var prm=document.createElementNS(SVGNS,'circle'); prm.setAttribute('cx',pr[0]); prm.setAttribute('cy',pr[1]); prm.setAttribute('r',14); prm.setAttribute('class','inset-ring'); inset.appendChild(prm);}
      svg.appendChild(inset);
    }
    function insetXY(lat,lon){ // ±0.10° lat, ±0.16° lon → kruh
      var sx=(lon-PRAHA.lon)/0.16*R*.86, sy=-(lat-PRAHA.lat)/0.10*R*.86; return [cx+sx,cy+sy];
    }
    items.forEach(function(p){
      var inPraha=p.praha&&withInset;
      var xy=inPraha?insetXY(p.lat,p.lon):proj(p.lat,p.lon);
      if(p.dx) xy[0]+=p.dx; if(p.dy) xy[1]+=p.dy;
      var g=document.createElementNS(SVGNS,'g'); g.setAttribute('class','mk mk--'+p.kind+(inPraha?' mk--in':'')); g.dataset.id=p.id; g.setAttribute('transform','translate('+xy[0]+' '+xy[1]+')');
      if(p.kind==='now'){var pu=document.createElementNS(SVGNS,'circle'); pu.setAttribute('r',SZ.r); pu.setAttribute('class','pulse'); g.appendChild(pu);}
      var c=document.createElementNS(SVGNS,'circle'); c.setAttribute('r',p.kind==='now'?SZ.r:SZ.rh); c.setAttribute('class','core'); g.appendChild(c);
      var t=document.createElementNS(SVGNS,'text'); var la=p.la||'r'; var off=SZ.off; t.setAttribute('font-size',p.kind==='now'?SZ.fs:SZ.fsh);
      t.setAttribute('x',la==='l'?-off:(la==='c'?0:off)); t.setAttribute('y',la==='b'?SZ.yb:(la==='t'?SZ.yt:Math.round(SZ.fs*.36))); t.setAttribute('text-anchor',la==='l'?'end':(la==='c'||la==='b'||la==='t'?'middle':'start'));
      t.textContent=p.label||p.name; g.appendChild(t);
      gM.appendChild(g);
      if(inPraha||!withInset||!p.praha){/* v ČR mapě Praha jen souhrnný kroužek */}
    });
    svg.appendChild(gM);
    stage.innerHTML=''; stage.appendChild(svg);
    var tip=document.createElement('div'); tip.className='pg-map__tip'; stage.appendChild(tip);
    var list=$('.pg-map__list',sec);
    function hot(id,on){
      $$('.mk',svg).forEach(function(m){m.classList.toggle('is-hot',on&&m.dataset.id===id)});
      if(list) $$('.pg-map__item',list).forEach(function(li){li.classList.toggle('is-hot',on&&li.dataset.id===id)});
      var p=P.filter(function(x){return x.id===id})[0];
      if(p&&p.kraj){$$('path.kraj',svg).forEach(function(k){k.classList.toggle('is-on',on&&k.dataset.id===p.kraj)});}
    }
    function openTip(id){
      var p=P.filter(function(x){return x.id===id})[0]; var m=$('.mk[data-id="'+id+'"]',svg); if(!p||!m) return;
      tip.innerHTML='<small>'+(p.kind==='now'?'Aktuální portfolio':'Historie skupiny')+' · '+p.years+'</small><b>'+p.name+'</b><p>'+p.place+(p.note?' · '+p.note:'')+'</p>'+(p.href?'<a href="'+p.href+'">Otevřít projekt</a>':'');
      var sr=stage.getBoundingClientRect(), mr=m.getBoundingClientRect();
      var x=mr.left-sr.left+mr.width/2, y=mr.top-sr.top;
      tip.style.left=Math.min(Math.max(x-110,0),sr.width-290)+'px'; tip.style.top=Math.max(y-tip.offsetHeight-18,0)+'px';
      tip.classList.add('is-open'); hot(id,true);
    }
    function closeTip(){tip.classList.remove('is-open'); hot(null,false);}
    svg.addEventListener('mouseover',function(e){var m=e.target.closest('.mk'); if(m) hot(m.dataset.id,true)});
    svg.addEventListener('mouseout',function(e){var m=e.target.closest('.mk'); if(m&&!tip.classList.contains('is-open')) hot(null,false)});
    svg.addEventListener('click',function(e){var m=e.target.closest('.mk'); if(m){e.stopPropagation(); if(tip.classList.contains('is-open')&&tip.dataset.id===m.dataset.id){closeTip();return;} tip.dataset.id=m.dataset.id; openTip(m.dataset.id);}});
    document.addEventListener('click',function(e){if(!e.target.closest('.pg-map__tip')&&!e.target.closest('.mk')) closeTip()});
    if(list){
      list.addEventListener('mouseover',function(e){var li=e.target.closest('.pg-map__item'); if(li) hot(li.dataset.id,true)});
      list.addEventListener('mouseout',function(){if(!tip.classList.contains('is-open')) hot(null,false)});
      list.addEventListener('click',function(e){var li=e.target.closest('.pg-map__item'); if(!li) return; if(li.dataset.href&&e.target.closest('b')){location.href=li.dataset.href;return;} e.stopPropagation(); tip.dataset.id=li.dataset.id; openTip(li.dataset.id);});
    }
    var tabs=$('.pg-map__tabs',sec);
    if(tabs){
      tabs.addEventListener('click',function(e){
        var b=e.target.closest('button'); if(!b) return; $$('button',tabs).forEach(function(x){x.classList.toggle('is-on',x===b)});
        var k=b.dataset.k; closeTip();
        $$('.mk',svg).forEach(function(m){var p=P.filter(function(x){return x.id===m.dataset.id})[0]; m.classList.toggle('is-hidden',!(k==='all'||(p&&p.kind===k)))});
        if(list) $$('.pg-map__item',list).forEach(function(li){li.classList.toggle('is-hidden',!(k==='all'||li.dataset.kind===k))});
      });
    }
    if(only){var ids=only.split(','); setTimeout(function(){ids.forEach(function(id){var m=$('.mk[data-id="'+id+'"]',svg); if(m) m.classList.add('is-hot'); if(mode==='praha'){$$('.mk',svg).forEach(function(x){x.classList.toggle('is-dim',ids.indexOf(x.dataset.id)<0)});}})},300);}
  }
  $$('.pg-map').forEach(buildMap);


  /* ── hero video: mobilní varianta a jistota přehrání ───── */
  $$('.pg-hero video').forEach(function(v){
    var m=v.dataset.mobil; if(m&&window.innerWidth<768){var s=v.querySelector('source'); if(s){s.src=m; v.load();}}
    var tryPlay=function(){var p=v.play(); if(p&&p.catch) p.catch(function(){});};
    tryPlay(); document.addEventListener('visibilitychange',function(){if(!document.hidden) tryPlay();});
  });
})();

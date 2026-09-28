/* CIB GROUP – podstránky v2: fotogalerie (lightbox), mapa projektů, filtr karet, hero videa */
(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

  /* lightbox pro galerie */
  var lb=null,items=[],idx=0;
  function ensure(){
    if(lb) return lb;
    lb=document.createElement('div'); lb.className='gl-lb'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-label','Fotografie');
    lb.innerHTML='<button class="gl-lb__prev" aria-label="Předchozí">‹ Předchozí</button><button class="gl-lb__next" aria-label="Další">Další ›</button><button class="gl-lb__close" aria-label="Zavřít">Zavřít ×</button><span class="gl-lb__cnt"></span>';
    var big=document.createElement('img'); big.alt=''; lb.insertBefore(big,lb.firstChild);
    document.body.appendChild(lb);
    var show=function(i){idx=(i+items.length)%items.length;var a=items[idx];var im=$('img',lb);im.src=a.href;var s=a.querySelector('img');im.alt=s?s.alt:'';$('.gl-lb__cnt',lb).textContent=(idx+1)+' / '+items.length;};
    lb.show=show;
    var close=function(){lb.classList.remove('is-open');document.body.style.overflow=''};
    $('.gl-lb__prev',lb).addEventListener('click',function(){show(idx-1)});
    $('.gl-lb__next',lb).addEventListener('click',function(){show(idx+1)});
    $('.gl-lb__close',lb).addEventListener('click',close);
    lb.addEventListener('click',function(e){if(e.target===lb)close()});
    document.addEventListener('keydown',function(e){if(!lb.classList.contains('is-open'))return;if(e.key==='Escape')close();if(e.key==='ArrowRight')show(idx+1);if(e.key==='ArrowLeft')show(idx-1)});
    return lb;
  }
  $$('.gal__grid').forEach(function(g){
    g.addEventListener('click',function(e){var a=e.target.closest('a.gal__item');if(!a)return;e.preventDefault();items=$$('a.gal__item',g).sort(function(x,y){return (+x.dataset.i)-(+y.dataset.i)});ensure().show(items.indexOf(a));lb.classList.add('is-open');document.body.style.overflow='hidden'});
  });

  /* filtr statické mřížky projektů */
  $$('[data-filter-for]').forEach(function(bar){
    var grid=$(bar.dataset.filterFor);if(!grid)return;
    bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;$$('button',bar).forEach(function(x){x.classList.toggle('is-on',x===b)});var k=b.dataset.k;$$('.fp-list',grid).forEach(function(c){c.classList.toggle('is-hidden',!(k==='all'||c.dataset.k===k))})});
  });

  /* mapa projektů: záložky, zvýraznění, karta detailu */
  $$('.m2').forEach(function(sec){
    var map=$('.m2__map',sec),list=$('.m2__list',sec),tabs=$('.m2__tabs',sec);if(!map)return;
    var card=document.createElement('div');card.className='m2__card';map.appendChild(card);
    var data={};$$('.m2__item',sec).forEach(function(li){data[li.dataset.id]={name:li.querySelector('b').childNodes[0].textContent.trim(),place:li.querySelector('small').textContent,years:li.querySelector('span').textContent,kind:li.dataset.kind,href:li.dataset.href||'',thumb:(li.querySelector('img')||{}).src||''}});
    function hot(id,on){$$('.m2__pin',map).forEach(function(p){p.classList.toggle('is-hot',on&&p.dataset.id===id)});if(list)$$('.m2__item',list).forEach(function(li){li.classList.toggle('is-hot',on&&li.dataset.id===id)})}
    function open(id){
      var d=data[id],pin=$('.m2__pin[data-id="'+id+'"]',map);if(!d||!pin)return;
      card.innerHTML='<button type="button" class="m2__close" aria-label="Zavřít">×</button>'+(d.thumb?'<img src="'+d.thumb+'" alt="">':'')+'<div><small>'+(d.kind==='now'?'Aktuální portfolio':'Historie skupiny')+' · '+d.years+'</small><b>'+d.name+'</b><p>'+d.place+'</p>'+(d.href?'<a href="'+d.href+'">Otevřít projekt</a>':'')+'</div>';
      var mr=map.getBoundingClientRect(),pr=pin.getBoundingClientRect();
      var x=pr.left-mr.left+pr.width/2,y=pr.top-mr.top;
      var left=Math.min(Math.max(x-140,0),mr.width-280);var top=y-card.offsetHeight-16;if(top<0)top=y+pr.height+14;
      card.style.left=left+'px';card.style.top=top+'px';card.classList.add('is-open');card.dataset.id=id;hot(id,true);
    }
    function close(){card.classList.remove('is-open');card.dataset.id='';hot(null,false)}
    map.addEventListener('mouseover',function(e){var p=e.target.closest('.m2__pin');if(p)hot(p.dataset.id,true)});
    map.addEventListener('mouseout',function(e){var p=e.target.closest('.m2__pin');if(p&&!card.classList.contains('is-open'))hot(null,false)});
    map.addEventListener('click',function(e){var p=e.target.closest('.m2__pin');if(!p)return;e.preventDefault();e.stopPropagation();if(card.dataset.id===p.dataset.id){close();return}open(p.dataset.id)});
    document.addEventListener('click',function(e){if(!e.target.closest('.m2__card')&&!e.target.closest('.m2__pin'))close()});
    card.addEventListener('click',function(e){if(e.target.closest('.m2__close')){e.stopPropagation();close()}});
    if(list){
      list.addEventListener('mouseover',function(e){var li=e.target.closest('.m2__item');if(li)hot(li.dataset.id,true)});
      list.addEventListener('mouseout',function(){if(!card.classList.contains('is-open'))hot(null,false)});
      list.addEventListener('click',function(e){var li=e.target.closest('.m2__item');if(!li)return;e.stopPropagation();var pin=$('.m2__pin[data-id="'+li.dataset.id+'"]',map);if(pin&&window.innerWidth<992)pin.scrollIntoView({block:'center',behavior:'smooth'});open(li.dataset.id)});
    }
    if(tabs) tabs.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;$$('button',tabs).forEach(function(x){x.classList.toggle('is-on',x===b)});var k=b.dataset.k;close();$$('.m2__pin',map).forEach(function(p){var d=data[p.dataset.id];p.classList.toggle('is-hidden',!(k==='all'||(d&&d.kind===k)))});if(list)$$('.m2__item',list).forEach(function(li){li.classList.toggle('is-hidden',!(k==='all'||li.dataset.kind===k))})});
  });


  /* masonry galerie: rozdělení do sloupců podle nejnižšího sloupce (rozměry z atributů) */
  function masonry(g){
    var all=$$('a.gal__item',g).sort(function(a,b){return (+a.dataset.i)-(+b.dataset.i)});
    var n=window.innerWidth<561?1:(window.innerWidth<992?2:3);
    if(+g.dataset.cols===n) return; g.dataset.cols=n;
    var cols=[],h=[];for(var i=0;i<n;i++){var c=document.createElement('div');c.className='gal__col';cols.push(c);h.push(0)}
    all.forEach(function(a){var im=a.querySelector('img'),r=(+im.getAttribute('height')||3)/(+im.getAttribute('width')||4);var k=0;for(var i=1;i<n;i++)if(h[i]<h[k]-0.001)k=i;cols[k].appendChild(a);h[k]+=r});
    g.innerHTML='';cols.forEach(function(c){g.appendChild(c)});
  }
  var gals=$$('.gal__grid');gals.forEach(masonry);
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){gals.forEach(masonry)},150)});

  /* sekce z domovské, které téma na podstránkách neinicializuje (řetězec tématu končí na počítadle);
     spouštět až po jQuery.ready tématu, aby nedošlo k dvojí inicializaci */
  function lateInit(){
    if(!(window.jQuery&&jQuery.fn.slick)) return;
    var ph=jQuery('.philantrophy-slick-slider');
    if(ph.length&&!ph.hasClass('slick-initialized')){
      ph.slick({dots:false,infinite:true,speed:1000,arrows:false,slidesToShow:1,slidesToScroll:1,autoplay:true,autoplaySpeed:5000});
      ph.slick('slickPause');var started=false;
      var chk=function(){if(started)return;var t=document.getElementById('content-philantrophy');if(!t)return;var r=t.getBoundingClientRect();if(r.top<window.innerHeight&&r.bottom>0){ph.slick('slickPlay');started=true}};
      window.addEventListener('scroll',chk,{passive:true});chk();
    }
    var mp=jQuery('#magazinePopup');
    if(mp.length&&!mp.data('cibBound')){mp.data('cibBound',1);jQuery('.magazine-click-to-read').on('click',function(e){e.preventDefault();mp.addClass('active')});jQuery('.magazinePopup-backdrop, .magazine-close').on('click',function(e){e.preventDefault();mp.removeClass('active')});jQuery('.magazine-photo-inner img').on('click',function(){mp.addClass('active')})}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(lateInit,0)}); else setTimeout(lateInit,0);

  /* videa: jistota přehrání */
  $$('video[autoplay]').forEach(function(v){var t=function(){var p=v.play();if(p&&p.catch)p.catch(function(){})};t();document.addEventListener('visibilitychange',function(){if(!document.hidden)t()})});
})();

/* ── slideshow s kategoriemi (slick + filtr + miniatury + lightbox) ── */
(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  function init(){
    if(!(window.jQuery&&jQuery.fn.slick)) return;
    $$('.ss').forEach(function(sec){
      var $sl=jQuery('.ss__slider',sec); if(!$sl.length||$sl.hasClass('slick-initialized')) return;
      var thumbs=$('.ss__thumbs',sec), cap=$('.ss__cap',sec), cnt=$('.ss__cnt',sec), tabs=$('.ss__tabs',sec);
      var opts={dots:false,arrows:true,infinite:true,speed:600,fade:true,cssEase:'ease',slidesToShow:1,slidesToScroll:1,prevArrow:jQuery('.ss__arr--prev',sec),nextArrow:jQuery('.ss__arr--next',sec),adaptiveHeight:false,accessibility:true,rows:0};
      function current(){var sk=$sl[0].slick;return sk?sk.$slides:jQuery('.ss__slide',$sl);}
      function buildThumbs(){
        var sl=current(); thumbs.innerHTML='';
        sl.each(function(i,el){var im=el.querySelector('img');var b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(el.dataset.cap||'')+' ('+(i+1)+')');b.innerHTML='<img src="'+(im.getAttribute('data-lazy')||im.src)+'" alt="" loading="lazy">';b.addEventListener('click',function(){$sl.slick('slickGoTo',i)});thumbs.appendChild(b)});
        cnt.querySelector('em').textContent=sl.length;
      }
      function update(i){
        var sl=current(); var el=sl.get(i); if(!el) return;
        cap.querySelector('small').textContent=el.dataset.cat||''; cap.querySelector('b').textContent=el.dataset.cap||'';
        cnt.querySelector('span').textContent=i+1;
        $$('button',thumbs).forEach(function(b,k){b.classList.toggle('is-on',k===i)});
        var tb=thumbs.children[i]; if(tb){var r=tb.getBoundingClientRect(),tr=thumbs.getBoundingClientRect();if(r.left<tr.left||r.right>tr.right)thumbs.scrollTo({left:tb.offsetLeft-thumbs.clientWidth/2+tb.offsetWidth/2,behavior:'smooth'})}
      }
      $sl.on('afterChange',function(e,sk,i){update(i)});
      $sl.slick(opts); buildThumbs(); update(0);
      if(tabs) tabs.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;$$('button',tabs).forEach(function(x){x.classList.toggle('is-on',x===b)});$sl.slick('slickUnfilter');if(b.dataset.k!=='all')$sl.slick('slickFilter','[data-k="'+b.dataset.k+'"]');buildThumbs();$sl.slick('slickGoTo',0,true);update(0)});
      /* lightbox: klik na fotku nebo tlačítko „Celá obrazovka“ */
      function openLb(){
        var sl=current(); var idx=$sl.slick('slickCurrentSlide');
        var lb=$('.gl-lb')||(function(){var d=document.createElement('div');d.className='gl-lb';d.setAttribute('role','dialog');d.innerHTML='<button class="gl-lb__prev" aria-label="Předchozí">‹ Předchozí</button><button class="gl-lb__next" aria-label="Další">Další ›</button><button class="gl-lb__close" aria-label="Zavřít">Zavřít ×</button><span class="gl-lb__cnt"></span>';var im=document.createElement('img');im.alt='';d.insertBefore(im,d.firstChild);document.body.appendChild(d);
          d.addEventListener('click',function(e){if(e.target===d||e.target.classList.contains('gl-lb__close')){d.classList.remove('is-open');document.body.style.overflow=''}});
          document.addEventListener('keydown',function(e){if(!d.classList.contains('is-open'))return;if(e.key==='Escape'){d.classList.remove('is-open');document.body.style.overflow=''}if(e.key==='ArrowRight'&&d._next)d._next();if(e.key==='ArrowLeft'&&d._prev)d._prev()});
          return d})();
        var srcs=[]; sl.each(function(i,el){var im=el.querySelector('img');srcs.push({src:im.getAttribute('data-lazy')||im.src,alt:el.dataset.cap||''})});
        var k=idx; var show=function(){var o=srcs[k];var im=lb.querySelector('img');im.src=o.src;im.alt=o.alt;lb.querySelector('.gl-lb__cnt').textContent=(k+1)+' / '+srcs.length};
        lb._next=function(){k=(k+1)%srcs.length;show()}; lb._prev=function(){k=(k-1+srcs.length)%srcs.length;show()};
        lb.querySelector('.gl-lb__next').onclick=lb._next; lb.querySelector('.gl-lb__prev').onclick=lb._prev;
        show(); lb.classList.add('is-open'); document.body.style.overflow='hidden';
        lb.querySelector('.gl-lb__close').onclick=function(){lb.classList.remove('is-open');document.body.style.overflow='';$sl.slick('slickGoTo',k,true)};
      }
      $sl.on('click','.ss__slide img',openLb); var fb=$('.ss__full',sec); if(fb) fb.addEventListener('click',openLb);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0)}); else setTimeout(init,0);
})();

/* ── časová osa: kliknutím na rok se rozbalí milníky (jeden otevřený), roky se objevují při scrollu ── */
(function(){
  var items=Array.prototype.slice.call(document.querySelectorAll('.tl2__item')); if(!items.length) return;
  function set(it,on){it.classList.toggle('is-active',on);var b=it.querySelector('.tl2__btn');if(b)b.setAttribute('aria-expanded',on?'true':'false');var p=it.querySelector('.tl2__panel');if(p){p.style.maxHeight=on?(p.scrollHeight+'px'):'0px'}}
  items.forEach(function(it){var b=it.querySelector('.tl2__btn');if(!b)return;b.addEventListener('click',function(){var on=!it.classList.contains('is-active');items.forEach(function(x){if(x!==it)set(x,false)});set(it,on)})});
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('is-visible',e.isIntersecting)})},{threshold:0.01,rootMargin:'0px 0px -40px 0px'});items.forEach(function(it){io.observe(it)})}else{items.forEach(function(it){it.classList.add('is-visible')})}
  window.addEventListener('resize',function(){items.forEach(function(it){if(it.classList.contains('is-active'))set(it,true)})});
  /* otevřít první (Současnost) po najetí do sekce */
  var first=items[0]; if(first&&'IntersectionObserver' in window){var o2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){set(first,true);o2.disconnect()}})},{threshold:0.5});o2.observe(first)}
})();

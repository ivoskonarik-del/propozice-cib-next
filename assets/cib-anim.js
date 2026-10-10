/* CIB – drobné interakce (7. 10. 2026): Portfolio v číslech, Before/After slider, dlaždice → kategorie galerie.
   Nezávislé na jQuery a na řetězci initů tématu (ten na domovské padá na statisticsCounter). */
(function(){
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function onReady(fn){document.readyState!=="loading"?fn():document.addEventListener("DOMContentLoaded",fn)}
  function inView(el,cb,thr){
    if(!("IntersectionObserver" in window)){cb();return}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.disconnect();cb()}})},{threshold:thr||.25});
    io.observe(el);
  }
  function fmt(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g," ")}
  function countUp(el,to,dur,delay){
    if(reduce){el.textContent=fmt(to);return}
    el.textContent="0";
    setTimeout(function(){
      var t0=null;
      function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/dur);p=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(to*p));if(p<1)requestAnimationFrame(step)}
      requestAnimationFrame(step);
    },delay);
  }

  /* 1) Portfolio v číslech – lišty se plní od 0 a čísla počítají, jednou při prvním zobrazení */
  function portfolio(){
    var ul=document.querySelector("#content-social .social-stats-wrap ul"); if(!ul)return;
    var lis=[].slice.call(ul.children), vals=lis.map(function(li){var i=li.querySelector(".counter-js");return i?parseInt(i.textContent.replace(/\D/g,""),10)||0:0});
    var max=Math.max.apply(null,vals)||1;
    lis.forEach(function(li,k){
      var p=Math.max(2,vals[k]/max*100);
      li.style.setProperty("--p",p.toFixed(2)+"%"); li.style.setProperty("--d",(k*140)+"ms");
      var i=li.querySelector(".counter-js"); if(i&&!reduce)i.textContent="0";
    });
    ul.classList.add("cib-bars");
    inView(ul,function(){
      ul.classList.add("is-in");
      lis.forEach(function(li,k){var i=li.querySelector(".counter-js");if(i)countUp(i,vals[k],1600,k*140+150)});
    },.3);
  }

  /* 2) Before / After – táhlo mezi dvěma fotkami (myš, dotyk, klávesnice) + přepínání dvojic */
  function beforeAfter(){
    [].forEach.call(document.querySelectorAll(".cib-ba"),function(box){
      var stage=box.querySelector(".cib-ba__stage"), range=box.querySelector(".cib-ba__range");
      function set(v){v=Math.max(0,Math.min(100,v));stage.style.setProperty("--pos",v+"%");range.value=v;range.setAttribute("aria-valuetext",Math.round(v)+" % před");stage.classList.toggle("is-pred-hidden",v<22);stage.classList.toggle("is-po-hidden",v>78)}
      function fromX(x){var r=stage.getBoundingClientRect();set((x-r.left)/r.width*100)}
      var drag=false;
      stage.addEventListener("pointerdown",function(e){drag=true;stage.setPointerCapture&&stage.setPointerCapture(e.pointerId);fromX(e.clientX);stage.classList.add("is-drag")});
      stage.addEventListener("pointermove",function(e){if(drag)fromX(e.clientX)});
      ["pointerup","pointercancel","lostpointercapture"].forEach(function(t){stage.addEventListener(t,function(){drag=false;stage.classList.remove("is-drag")})});
      range.addEventListener("input",function(){set(parseFloat(range.value))});
      [].forEach.call(box.querySelectorAll(".cib-ba__tabs button"),function(b){
        b.addEventListener("click",function(){
          [].forEach.call(box.querySelectorAll(".cib-ba__tabs button"),function(x){x.classList.toggle("is-on",x===b);x.setAttribute("aria-selected",x===b)});
          [].forEach.call(box.querySelectorAll(".cib-ba__pair"),function(p){p.classList.toggle("is-on",p.getAttribute("data-k")===b.getAttribute("data-k"))});
          box.querySelector(".cib-ba__cap").textContent=b.getAttribute("data-cap")||"";
          set(50);
        });
      });
      set(50);
      /* jemná nápověda při prvním zobrazení: táhlo se jednou pohne */
      if(!reduce)inView(box,function(){stage.classList.add("is-hint");set(38);setTimeout(function(){set(50);setTimeout(function(){stage.classList.remove("is-hint")},700)},700)},.5);
    });
  }

  /* 3) dlaždice s data-ss-k → posun na fotogalerii a otevření dané kategorie */
  function tilesToGallery(){
    document.addEventListener("click",function(e){
      var a=e.target.closest&&e.target.closest("a[data-ss-k]"); if(!a)return;
      var g=document.getElementById("galerie"); if(!g)return;
      e.preventDefault();
      var btn=g.querySelector('.ss__tabs button[data-k="'+a.getAttribute("data-ss-k")+'"]');
      if(btn)btn.click();
      g.scrollIntoView({block:"start"});
    });
  }

  /* 4) česká typografie: jednopísmenné předložky/spojky a čísla nezůstávají na konci řádku */
  function nbsp(){
    var sel=".global-site-title,h1,h2,h3,p,li,dd,dt,small,figcaption,.fp-address,.item-info,.m2l__addr,.oc__name,.cib-ba__cap,.testi-list,.csi";
    [].forEach.call(document.querySelectorAll(sel),function(el){
      if(el.closest("script,style,textarea"))return;
      var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),n;
      while((n=w.nextNode())){
        var t=n.nodeValue,u=t.replace(/(^|[\s(„])([AaIiKkOoSsUuVvZz])\s+(?=\S)/g,"$1$2\u00a0").replace(/(\d)\s+(?=[\d%]|m²|m2|minut|let|bytů|stání|podlaží|km|Kč|€)/g,"$1\u00a0").replace(/([A-Za-zÀ-žĚŠČŘŽÝÁÍÉŮÚ])\s+(?=\d{1,3}(?:\/\d+)?(?![\d\s]*\d{3}))/g,"$1\u00a0");
        if(u!==t)n.nodeValue=u;
      }
    });
  }

  /* 5) pevné ikony vlevo jen na první obrazovce */
  function sideIcons(){
    var on=false;function chk(){var v=window.scrollY>window.innerHeight*.7;if(v!==on){on=v;document.body.classList.toggle("cib-scrolled",v)}}
    window.addEventListener("scroll",chk,{passive:true});chk();
  }

  /* 6) smyčková videa v pozadí sekcí: načíst až u sekce, mimo obrazovku pozastavit (jen desktop) */
  function bgVideos(){
    var vs=[].slice.call(document.querySelectorAll("video.cib-bgvid[data-src]"));
    if(!vs.length||window.innerWidth<992||!("IntersectionObserver" in window))return;
    var io=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;
      if(e.isIntersecting){if(!v.src){v.src=v.getAttribute("data-src");v.load()}var p=v.play();if(p&&p.catch)p.catch(function(){})}
      else if(v.src)v.pause();
    })},{rootMargin:"200px 0px"});
    vs.forEach(function(v){if(!reduce)io.observe(v)});
  }

  /* 7) rámeček s fotkami jednoho místa: šipky, potažení prstem, automatické přepínání */
  function devShows(){
    [].forEach.call(document.querySelectorAll(".cds"),function(box){
      var sl=box.querySelectorAll(".cds__slide"),cp=box.querySelectorAll(".cds__cap"),cnt=box.querySelector(".cds__cnt b"),n=sl.length,i=0,t=null;
      if(n<2){[].forEach.call(box.querySelectorAll(".cds__arr"),function(a){a.hidden=true});return}
      function go(k){i=(k+n)%n;for(var j=0;j<n;j++){sl[j].classList.toggle("is-on",j===i);cp[j].classList.toggle("is-on",j===i)}cnt.textContent=i+1}
      function auto(){clearInterval(t);if(!reduce)t=setInterval(function(){go(i+1)},5000)}
      box.querySelector(".cds__arr--prev").addEventListener("click",function(){go(i-1);auto()});
      box.querySelector(".cds__arr--next").addEventListener("click",function(){go(i+1);auto()});
      var x0=null;box.addEventListener("touchstart",function(e){x0=e.touches[0].clientX},{passive:true});
      box.addEventListener("touchend",function(e){if(x0===null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>40){go(i+(d<0?1:-1));auto()}x0=null});
      box.addEventListener("mouseenter",function(){clearInterval(t)});box.addEventListener("mouseleave",auto);
      inView(box,auto,.3);
    });
  }

  onReady(function(){nbsp();portfolio();beforeAfter();tilesToGallery();sideIcons();bgVideos();devShows()});
})();

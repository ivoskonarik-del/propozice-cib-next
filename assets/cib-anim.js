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

  /* 8) odložené načítání (připravuje optimize.py při publikaci): img[data-lz], video.cib-lzv[data-src]
     – vlastní IntersectionObserver místo loading="lazy" (WebKit v iframu webhunter.cz lazy obrázky nenačítal),
     – po načtení stránky se zbylé obrázky postupně dotáhnou samy (slidery, skryté záložky). */
  function lazyMedia(){
    var imgs=[].slice.call(document.querySelectorAll("img[data-lz]")),vids=[].slice.call(document.querySelectorAll("video.cib-lzv[data-src]"));
    function loadImg(i,cb){if(!i.hasAttribute("data-lz")){cb&&cb();return}var u=i.getAttribute("data-lz");
      if(cb){i.addEventListener("load",cb,{once:true});i.addEventListener("error",cb,{once:true})}
      /* stejný obrázek i v kopiích, které si vytvořil slider (slick clones) */
      [].forEach.call(document.querySelectorAll('img[data-lz="'+u.replace(/"/g,'\\"')+'"]'),function(x){x.removeAttribute("data-lz");x.src=u});
      if(i.getAttribute("src")!==u){i.removeAttribute("data-lz");i.src=u}}
    if("IntersectionObserver" in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);loadImg(e.target)}})},{rootMargin:"1200px 1200px 1200px 1200px"});
      /* slideshow s prolínáním: všechny snímky leží na stejném místě → načítat jen aktuální a sousední */
      var inSlider=function(i){return i.closest&&i.closest(".ss__slider,.cds__stage")};
      imgs.forEach(function(i){if(!inSlider(i))io.observe(i)});
      var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){so.unobserve(e.target);
        var all=[].slice.call(e.target.querySelectorAll(".ss__slide:not(.slick-cloned) img[data-lz], .cds__slide img[data-lz]"));all.slice(0,2).concat(all.slice(-1)).forEach(function(i){loadImg(i)})}})},{rootMargin:"1200px 0px"});
      [].forEach.call(document.querySelectorAll(".ss__slider,.cds__stage"),function(s){so.observe(s.closest("section")||s)});
      if(window.jQuery)jQuery(document).on("beforeChange",".slick-slider",function(e,sk,cur,nx){[nx,nx+1,nx-1].forEach(function(k){var sl=sk.$slides&&sk.$slides[(k+sk.slideCount)%sk.slideCount];if(sl){var i=sl.querySelector("img[data-lz]");if(i)loadImg(i)}})});
      document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".cds__arr");if(b){[].forEach.call(b.closest(".cds").querySelectorAll("img[data-lz]"),function(i){loadImg(i)})}});
      var vo=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){if(!v.src){v.src=v.getAttribute("data-src");v.load()}var p=v.play();if(p&&p.catch)p.catch(function(){})}else if(v.src)v.pause()})},{rootMargin:"300px 0px"});
      vids.forEach(function(v){vo.observe(v)});
    }else{imgs.forEach(function(i){loadImg(i)});vids.forEach(function(v){v.src=v.getAttribute("data-src")})}
    function drain(){(function next(){var i=document.querySelector("img[data-lz]");if(i)loadImg(i,function(){setTimeout(next,20)})})()}
    if(document.readyState==="complete")setTimeout(drain,600);else window.addEventListener("load",function(){setTimeout(drain,600)});
  }

  /* 0) pojistka odkrývání sekcí: AOS si spočítá pozice jednou – po donačtení obrázků nesedí a sekce zůstávaly bílé.
        Vlastní IntersectionObserver přidá aos-animate vždy, když je prvek na obrazovce; při změně výšky stránky AOS.refresh(). */
  function revealGuard(){
    var els=[].slice.call(document.querySelectorAll("[data-aos]"));
    function show(e){e.classList.add("aos-animate")}
    if(!("IntersectionObserver" in window)){els.forEach(show);return}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){show(e.target);io.unobserve(e.target)}})},{rootMargin:"0px 0px -6% 0px",threshold:0});
    els.forEach(function(e){io.observe(e)});
    var t,lastH=0;function refresh(){clearTimeout(t);t=setTimeout(function(){var h=document.body.scrollHeight;if(h!==lastH){lastH=h;if(window.AOS&&AOS.refresh)AOS.refresh()}},150)}
    document.addEventListener("load",function(e){if(e.target&&e.target.tagName==="IMG")refresh()},true);
    window.addEventListener("load",refresh);
    /* nouzově: cokoli nad aktuální pozicí (skok kotvou, obnovení stránky uprostřed) odkrýt hned */
    window.addEventListener("scroll",function(){var y=window.innerHeight;els.forEach(function(e){if(!e.classList.contains("aos-animate")&&e.getBoundingClientRect().top<y)show(e)})},{passive:true});
  }


  /* 9) Historie holdingu (domovská) – interaktivní časová osa: tažení jezdce (myš/prst), vodorovné kolečko, šipky,
        klik na rok, automatická jízda po milnících (zastaví se při první interakci). Data = <script type=application/json>. */
  function timeline(){
    var box=document.querySelector(".cib-tl"); if(!box)return;
    var data; try{data=JSON.parse(box.querySelector(".cib-tl__data").textContent)}catch(e){return}
    var n=data.length; if(!n)return;
    var Y0=data[0].t,Y1=data[n-1].t,q=function(c){return box.querySelector(c)};
    var track=q(".cib-tl__track"),rail=q(".cib-tl__rail"),fill=q(".cib-tl__fill"),ticks=q(".cib-tl__ticks"),head=q(".cib-tl__head"),chip=q(".cib-tl__chip"),
        media=q(".cib-tl__media"),cap=q(".cib-tl__cap"),num=q(".cib-tl__num"),eyebrow=q(".cib-tl__eyebrow"),list=q(".cib-tl__items"),
        bPrev=q(".cib-tl__btn--prev"),bNext=q(".cib-tl__btn--next"),bPlay=q(".cib-tl__btn--play");
    var pos=0,cur=-1,anim=null,auto=null,autoOn=false,touched=false,layers={},z=0,wt=null;
    function p2y(p){return Y0+p*(Y1-Y0)} function y2p(y){return (y-Y0)/(Y1-Y0)}
    function nearest(p){var y=p2y(p),best=0,d=1e9;for(var i=0;i<n;i++){var dd=Math.abs(data[i].t-y);if(dd<=d){d=dd;best=i}}return best}
    function labels(){
      var w=rail.getBoundingClientRect().width||1,xs=data.map(function(d){return y2p(d.t)*w}),show=[],last=-1e9;
      for(var i=0;i<n;i++){show[i]=(xs[i]-last>=46);if(show[i])last=xs[i]}
      if(!show[n-1]){show[n-1]=true;for(var j=n-2;j>=0;j--){if(xs[n-1]-xs[j]<46)show[j]=false;else break}}
      data.forEach(function(d,i){d.el.classList.toggle("no-lbl",!show[i])});
    }
    function buildTicks(){
      for(var y=Y0;y<=Y1;y++){var t=document.createElement("i");t.className="cib-tl__tick";t.style.left=(y2p(y)*100)+"%";ticks.appendChild(t)}
      data.forEach(function(d,i){
        var b=document.createElement("button");b.type="button";b.className="cib-tl__dot";b.style.left=(y2p(d.t)*100)+"%";
        b.setAttribute("aria-label",(d.y==="Dnes"?"Současnost":d.y)+": "+d.items[0]);b.innerHTML="<span>"+d.y+"</span>";
        b.addEventListener("click",function(e){e.preventDefault();user();goTo(i,true)});
        ticks.appendChild(b);d.el=b;
      });
      labels();
    }
    function layer(i){
      var d=data[i]; if(layers[i])return layers[i];
      var el;
      if(d.img){el=document.createElement("img");el.src=d.img;el.alt=d.cap||"";el.decoding="async"}
      else{el=document.createElement("div");el.className="cib-tl__plate";el.innerHTML="<b>"+d.y+"</b><span>"+(d.cap||"")+"</span>"}
      el.classList.add("cib-tl__layer");media.insertBefore(el,cap);layers[i]=el;return el;
    }
    function render(i){
      if(i===cur)return; var prev=cur; cur=i; var d=data[i];
      var L=layer(i); if(prev>=0&&layers[prev])layers[prev].classList.remove("is-on");
      L.classList.remove("is-on"); void L.offsetWidth; L.style.zIndex=++z; L.classList.add("is-on");
      if(i+1<n)layer(i+1); if(i>0)layer(i-1);
      cap.textContent=d.cap||""; cap.hidden=!d.cap;
      eyebrow.textContent=(d.y==="Dnes"?"Současnost":"Rok "+d.y)+" · "+(i+1)+" / "+n;
      list.classList.remove("is-in"); void list.offsetWidth;
      list.innerHTML=d.items.map(function(t){return "<li>"+t+"</li>"}).join(""); list.classList.add("is-in");
      data.forEach(function(x,k){x.el.classList.toggle("is-on",k===i)});
      track.setAttribute("aria-valuenow",d.t); track.setAttribute("aria-valuetext",(d.y==="Dnes"?"Současnost":d.y)+": "+d.items.join(" "));
      bPrev.disabled=i===0; bNext.disabled=i===n-1;
    }
    function setPos(p,rolling){
      pos=Math.max(0,Math.min(1,p)); var pc=(pos*100)+"%"; head.style.left=pc; fill.style.width=pc;
      var i=nearest(pos),ry=Math.round(p2y(pos)),yr=ry>=Y1?"Dnes":String(ry);
      chip.textContent=yr; num.textContent=rolling?yr:data[i].y; render(i);
    }
    function stopAnim(){if(anim){cancelAnimationFrame(anim);anim=null}}
    function animTo(target,dur){
      stopAnim(); var p0=pos,t0=null,dp=target-p0;
      if(reduce||Math.abs(dp)<1e-4){setPos(target);return}
      function step(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/dur);k=1-Math.pow(1-k,3);setPos(p0+dp*k,k<1);if(k<1)anim=requestAnimationFrame(step);else anim=null}
      anim=requestAnimationFrame(step);
    }
    function goTo(i,animate){i=Math.max(0,Math.min(n-1,i));var t=y2p(data[i].t);if(animate)animTo(t,Math.min(900,260+Math.abs(t-pos)*1400));else setPos(t)}
    /* automatická jízda */
    function tick(){clearTimeout(auto);auto=setTimeout(function(){if(!autoOn)return;if(cur>=n-1){stopAuto();return}goTo(cur+1,true);tick()},3400)}
    function startAuto(){if(reduce||autoOn)return;autoOn=true;box.classList.add("is-auto");bPlay.setAttribute("aria-label","Pozastavit");tick()}
    function stopAuto(){autoOn=false;clearTimeout(auto);box.classList.remove("is-auto");bPlay.setAttribute("aria-label","Přehrát")}
    function user(){touched=true;stopAuto()}
    /* tažení */
    var drag=false;
    function fromX(x){var r=rail.getBoundingClientRect();setPos((x-r.left)/r.width,true)}
    track.addEventListener("pointerdown",function(e){
      if(e.target.closest&&e.target.closest(".cib-tl__dot"))return; if(e.pointerType==="mouse"&&e.button!==0)return;
      user();stopAnim();drag=true;box.classList.add("is-drag");if(track.setPointerCapture)try{track.setPointerCapture(e.pointerId)}catch(x){}
      fromX(e.clientX);if(e.pointerType==="mouse")e.preventDefault();
    });
    track.addEventListener("pointermove",function(e){if(drag)fromX(e.clientX)});
    function endDrag(){if(!drag)return;drag=false;box.classList.remove("is-drag");goTo(nearest(pos),true)}
    ["pointerup","pointercancel","lostpointercapture"].forEach(function(t){track.addEventListener(t,endDrag)});
    /* vodorovné kolečko / touchpad */
    track.addEventListener("wheel",function(e){
      var dx=e.deltaX; if(Math.abs(dx)<2||Math.abs(dx)<Math.abs(e.deltaY))return; e.preventDefault();user();stopAnim();
      var w=rail.getBoundingClientRect().width||1; setPos(pos+dx/w*.6,true);
      clearTimeout(wt); wt=setTimeout(function(){goTo(nearest(pos),true)},160);
    },{passive:false});
    /* klávesnice */
    track.addEventListener("keydown",function(e){
      var k=e.key,m={ArrowRight:cur+1,ArrowUp:cur+1,ArrowLeft:cur-1,ArrowDown:cur-1,Home:0,End:n-1};
      if(k in m){e.preventDefault();user();goTo(m[k],true)}
    });
    bPrev.addEventListener("click",function(){user();goTo(cur-1,true)});
    bNext.addEventListener("click",function(){user();goTo(cur+1,true)});
    bPlay.addEventListener("click",function(){if(autoOn){touched=true;stopAuto()}else{if(cur>=n-1)goTo(0,false);startAuto()}});
    box.addEventListener("mouseenter",function(){if(autoOn){clearTimeout(auto);box.classList.add("is-hold")}});
    box.addEventListener("mouseleave",function(){box.classList.remove("is-hold");if(autoOn)tick()});
    window.addEventListener("resize",labels);
    buildTicks(); setPos(0);
    var seen=false,vis=false;
    if("IntersectionObserver" in window){
      new IntersectionObserver(function(es){es.forEach(function(e){vis=e.isIntersecting;
        if(vis){box.classList.add("is-in");if(!seen){seen=true;labels();setTimeout(function(){if(vis&&!touched)startAuto()},1200)}else if(autoOn)tick()}
        else clearTimeout(auto);
      })},{threshold:.3}).observe(box);
    }else box.classList.add("is-in");
  }

  revealGuard();
  lazyMedia();
  onReady(function(){nbsp();portfolio();beforeAfter();tilesToGallery();sideIcons();bgVideos();devShows();timeline()});
})();

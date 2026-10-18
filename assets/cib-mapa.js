/* CIB – interaktivní mapa projektů (Nemovitosti, 17. 10. 2026)
   MapLibre GL + OpenFreeMap (bez klíče). Na celé ČR jsou pražské projekty „rozložené“ kolem Prahy jako fotky
   s linkou na přesné místo; při přiblížení se stáhnou na skutečné souřadnice. Klik = přelet k projektu + karta.
   Když se knihovna nebo podklad nenačte, zůstane statická mapa (.m2__stage) se starou logikou z cib-pages2.js. */
(function(){
  var root=document.querySelector('.m3');if(!root)return;
  var LIB='https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl';
  var STYLE='https://tiles.openfreemap.org/styles/'+(root.classList.contains('m2--dark')?'dark':'positron');
  var CZ=[[12.09,48.55],[18.86,51.06]],PRAHA=[[14.2,49.97],[14.58,50.2]];
  var started=false;
  function load(){
    if(started)return;started=true;
    var l=document.createElement('link');l.rel='stylesheet';l.href=LIB+'.css';document.head.appendChild(l);
    var s=document.createElement('script');s.src=LIB+'.js';s.onload=init;s.onerror=function(){};document.head.appendChild(s);
  }
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();load()}},{rootMargin:'900px 0px'});io.observe(root)}else load();
  // 18. 10.: knihovnu (≈ 800 kB) načíst v klidu po načtení stránky, ne až uprostřed scrollu – jinak se stránka na ~200 ms zasekne
  function idle(){(window.requestIdleCallback||function(f){setTimeout(f,1)})(load,{timeout:4000})}
  if(document.readyState==='complete')setTimeout(idle,1200);else window.addEventListener('load',function(){setTimeout(idle,1200)});

  function init(){
    if(!window.maplibregl)return;
    try{var t=document.createElement('canvas');if(!(t.getContext('webgl2')||t.getContext('webgl')))return}catch(e){return}
    var P=[].map.call(root.querySelectorAll('.m2__item'),function(li){
      var ll=li.dataset.ll.split(',').map(Number),co=(li.dataset.co||'0,0').split(',').map(Number),img=li.querySelector('img');
      return {id:li.dataset.id,kind:li.dataset.kind||'now',ll:[ll[1],ll[0]],co:co,side:li.dataset.side||'r',side2:li.dataset.side2||'',label:li.dataset.label,cat:li.dataset.cat||'',note:li.dataset.note||'',zoom:+(li.dataset.zoom||15),px:(li.dataset.px||'0,0').split(',').map(Number),
        name:li.querySelector('b').childNodes[0].textContent.trim(),place:li.querySelector('small').textContent,years:li.querySelector('span').textContent,
        href:li.dataset.href||'',thumb:img?(img.getAttribute('data-lz')||img.getAttribute('src')):''};
    });
    var obrys=JSON.parse(root.querySelector('.m3-obrys').textContent);
    var live=root.querySelector('.m3__live'),box=root.querySelector('.m3__map');
    root.classList.add('is-live');
    var map;
    try{
      map=new maplibregl.Map({container:box,style:STYLE,bounds:CZ,fitBoundsOptions:{padding:pad()},attributionControl:false,
        cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,touchPitch:false,maxZoom:17,minZoom:5.5,locale:{
        'CooperativeGesturesHandler.WindowsHelpText':'Mapu přiblížíte kolečkem se stisknutým Ctrl',
        'CooperativeGesturesHandler.MacHelpText':'Mapu přiblížíte kolečkem se stisknutým ⌘',
        'CooperativeGesturesHandler.MobileHelpText':'Mapou posunete dvěma prsty'}});
    }catch(e){root.classList.remove('is-live');return}
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    var failed=setTimeout(function(){if(!map.loaded())root.classList.remove('is-live')},12000);
    function pad(){var w=box.clientWidth||700;if(root.closest('.m3sec'))return w<640?{top:w*.16,bottom:w*.06,left:w*.05,right:w*.05}:{top:w*.07,bottom:w*.05,left:w*.12,right:w*.12};return w<640?{top:w*.16,bottom:w*.04,left:w*.06,right:w*.04}:{top:w*.1,bottom:w*.06,left:w*.2,right:w*.07}}

    map.on('load',function(){
      clearTimeout(failed);root.classList.add('is-ready');
      setTimeout(function(){[].forEach.call(root.querySelectorAll('.maplibregl-ctrl-attrib'),function(e){e.classList.remove('maplibregl-compact-show')})},50);
      // podklad: jen názvy měst (česky), od přiblížení i obce; bez ulic, štítů, letišť
      map.getStyle().layers.forEach(function(L){
        if(L.type!=='symbol')return;
        if(/^label_(city|city_capital|town|village)$/.test(L.id)){
          map.setLayoutProperty(L.id,'text-field',['coalesce',['get','name:cs'],['get','name']]);
          map.setLayerZoomRange(L.id,L.id==='label_village'?11:(L.id==='label_town'?8.5:6),24);
          map.setPaintProperty(L.id,'text-color',root.classList.contains('m2--dark')?'#9a9a9a':'#7a7a7a');
        }else map.setLayoutProperty(L.id,'visibility','none');
      });
      var dark=root.classList.contains('m2--dark'),world=[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]];
      map.addSource('cz',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[world,obrys]}}});
      map.addLayer({id:'cz-mask',type:'fill',source:'cz',paint:{'fill-color':dark?'#000':'#f3f3f3','fill-opacity':['interpolate',['linear'],['zoom'],7,.62,10,.25]}});
      map.addSource('czl',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:obrys}}});
      map.addLayer({id:'cz-line',type:'line',source:'czl',paint:{'line-color':'#a17652','line-width':['interpolate',['linear'],['zoom'],6,1.6,11,2.6],'line-opacity':.9}});
      map.addSource('leads',{type:'geojson',data:fc([])});
      map.addLayer({id:'leads',type:'line',source:'leads',paint:{'line-color':'#a17652','line-width':1.2,'line-dasharray':[2,2],'line-opacity':['get','o']}});
      map.addSource('spots',{type:'geojson',data:fc([])});
      map.addLayer({id:'spots',type:'circle',source:'spots',paint:{'circle-radius':4,'circle-color':'#a17652','circle-stroke-color':dark?'#000':'#fff','circle-stroke-width':2,'circle-opacity':['get','o'],'circle-stroke-opacity':['get','o']}});
      update();
    });
    map.on('error',function(e){if(!map.loaded()&&!root.classList.contains('is-ready')){clearTimeout(failed);root.classList.remove('is-live')}});

    function fc(f){return {type:'FeatureCollection',features:f}}
    // rozložení: na ČR (zoom ≤ 7,2) plný posun, od 8,5 (Praha a okolí) skutečná poloha
    function spread(){var z=map.getZoom();return Math.max(0,Math.min(1,(8.5-z)/1.3))}
    var markers={};
    P.forEach(function(p){
      var el=document.createElement('button');el.type='button';el.className='m3__pin m3__pin--'+p.side+(p.kind==='hist'?' m3__pin--hist':'');el.setAttribute('aria-label',p.name);
      el.innerHTML='<i>'+(p.thumb?'<img src="'+p.thumb+'" alt="">':'')+'</i><b>'+p.label+'</b>';
      el.addEventListener('click',function(e){e.stopPropagation();select(p.id,true)});
      el.addEventListener('mouseenter',function(){hot(p.id,true)});el.addEventListener('mouseleave',function(){hot(p.id,false)});
      markers[p.id]=new maplibregl.Marker({element:el,anchor:'center',offset:p.px}).setLngLat(p.ll).addTo(map);el.setAttribute('aria-label',p.name);el.dataset.id=p.id;
    });
    function update(){
      var f=spread(),L=[],S=[],g=(1-f)*Math.max(0,Math.min(1,(15-map.getZoom())/1.5));  // g: odsunutí sousedů (stejná budova / stejná obec), při detailu zmizí
      P.forEach(function(p){
        var pos=[p.ll[0]+p.co[0]*f,p.ll[1]+p.co[1]*f];if(p.side2){var e=markers[p.id].getElement(),sd=f>.5?p.side:p.side2;e.classList.toggle('m3__pin--l',sd==='l');e.classList.toggle('m3__pin--r',sd==='r')}markers[p.id].setLngLat(pos);markers[p.id].setOffset([p.px[0]*g,p.px[1]*g]);
        if(f>.03&&(p.co[0]||p.co[1])){L.push({type:'Feature',properties:{o:f},geometry:{type:'LineString',coordinates:[p.ll,pos]}});S.push({type:'Feature',properties:{o:f},geometry:{type:'Point',coordinates:p.ll}})}
      });
      if(map.getSource('leads')){map.getSource('leads').setData(fc(L));map.getSource('spots').setData(fc(S))}
      root.classList.toggle('m3--far',map.getZoom()<8.2);root.classList.toggle('m3--mid',map.getZoom()<12.8);
      views.forEach(function(b){b.classList.toggle('is-on',b.dataset.v===(map.getZoom()<8.2?'cz':(map.getZoom()<12?'praha':'')))});
    }
    map.on('move',update);

    // ovládání
    var views=[].slice.call(root.querySelectorAll('.m3__views button'));
    views.forEach(function(b){b.addEventListener('click',function(){close();map.setPadding({top:0,bottom:0,left:0,right:0});map.fitBounds(b.dataset.v==='cz'?CZ:PRAHA,{padding:pad(),duration:1600,essential:true})})});
    root.querySelector('.m3__zin').addEventListener('click',function(){map.zoomIn()});
    root.querySelector('.m3__zout').addEventListener('click',function(){map.zoomOut()});

    var card=root.querySelector('.m3__card'),strip=[].slice.call(root.querySelectorAll('.m3__strip button')),cur=null;
    strip.forEach(function(b){b.addEventListener('click',function(){select(b.dataset.id,true)});b.addEventListener('mouseenter',function(){hot(b.dataset.id,true)});b.addEventListener('mouseleave',function(){hot(b.dataset.id,false)})});
    function hot(id,on){var m=markers[id];if(m)m.getElement().classList.toggle('is-hot',on||cur===id);strip.forEach(function(b){b.classList.toggle('is-hot',on&&b.dataset.id===id)})}
    function nav(ll){var t=ll[1]+','+ll[0];return /iPhone|iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&'ontouchend' in document)?'https://maps.apple.com/?daddr='+t+'&dirflg=d':'https://www.google.com/maps/dir/?api=1&destination='+t}
    function select(id,fly){
      var p=P.filter(function(x){return x.id===id})[0];if(!p)return;cur=id;
      Object.keys(markers).forEach(function(k){markers[k].getElement().classList.toggle('is-on',k===id)});
      strip.forEach(function(b){b.classList.toggle('is-on',b.dataset.id===id)});
      card.innerHTML='<button type="button" class="m3__close" aria-label="Zavřít">×</button>'+(p.thumb?'<img src="'+p.thumb+'" alt="">':'')+
        '<div><small>'+(p.cat?p.cat+' · ':'')+p.years+'</small><b>'+p.name+'</b><p>'+p.place+'</p>'+(p.note?'<p class="m3__note">'+p.note+'</p>':'')+
        '<div class="m3__btns"><a class="m3__nav" href="'+nav(p.ll)+'" target="_blank" rel="noopener">Navigovat</a>'+(p.href?'<a href="'+p.href+'">Číst více</a>':'')+'</div></div>';
      card.classList.add('is-open');
      if(fly)map.flyTo({center:p.ll,zoom:p.zoom,speed:1.1,curve:1.5,essential:true,padding:cardPad()});
    }
    function cardPad(){var w=box.clientWidth;return w>640?{left:Math.min(330,w*.42),top:0,right:0,bottom:0}:{bottom:Math.min(260,box.clientHeight*.45),top:0,left:0,right:0}}
    function close(){cur=null;card.classList.remove('is-open');Object.keys(markers).forEach(function(k){markers[k].getElement().classList.remove('is-on')});strip.forEach(function(b){b.classList.remove('is-on')})}
    card.addEventListener('click',function(e){if(e.target.closest('.m3__close'))close()});
    // přepínač Vše / Aktuální / Historie (sekce .m3sec na O nás)
    var sec=root.closest('.m3sec'),kinds=sec?[].slice.call(sec.querySelectorAll('.m3__kinds button')):[];
    kinds.forEach(function(b){b.addEventListener('click',function(){
      var k=b.dataset.k;root.classList.toggle('m3--onlyhist',k==='hist');kinds.forEach(function(x){x.classList.toggle('is-on',x===b)});
      if(cur&&k!=='all'&&P.filter(function(x){return x.id===cur})[0].kind!==k)close();
      P.forEach(function(p){var off=k!=='all'&&p.kind!==k;markers[p.id].getElement().classList.toggle('is-off',off)});
      strip.forEach(function(x){x.parentNode.classList.toggle('is-off',k!=='all'&&x.parentNode.dataset.kind!==k)});
    })});
    window.addEventListener('resize',function(){map.resize()});
  }
})();

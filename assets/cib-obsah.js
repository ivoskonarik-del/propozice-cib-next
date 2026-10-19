/* Obsah z administrace (19. 10. 2026): kontakty, texty a fotky upravené v /admin/ se propíšou do stránky.
   Kontrakt: _admin/KONTRAKT.md. Bezpečnost: texty jen přes vlastní parser (strong/em/br, nic jiného),
   odkazy jen tel:/mailto: z ověřeného tvaru, fotky jen ze serveru administrace. Bez serveru web jede beze změn. */
(function () {
  "use strict";
  var API = "https://cib-admin-api.prodej-bytu-3-1-70-m2-172175436.workers.dev";
  var INLINE = { STRONG: 1, B: 1, EM: 1, BR: 1 };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, VIDEO: 1, SELECT: 1, OPTION: 1, TEXTAREA: 1, INPUT: 1, IFRAME: 1, CANVAS: 1, TEMPLATE: 1, HEAD: 1 };
  var origText = new WeakMap();   // prvek → {klic, html}
  var upraveno = new Set();       // prvky s přepsaným textem
  var origUzel = new WeakMap();   // textový uzel → původní hodnota (kvůli kontaktům)
  var origAttr = new WeakMap();   // prvek → {atribut: původní hodnota}

  function norm(s) { return String(s || "").replace(/[\s ]+/g, " ").trim(); }
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function jeObsah(n) { return n.nodeType === 3 || (n.nodeType === 1 && INLINE[n.tagName]); }
  function obsahoveUzly(el) { return Array.prototype.filter.call(el.childNodes, jeObsah); }
  function serializuj(nodes) {
    var out = "";
    nodes.forEach(function (n) {
      if (n.nodeType === 3) out += esc(n.nodeValue.replace(/[\s ]+/g, " "));
      else if (n.tagName === "BR") out += "<br>";
      else {
        var t = n.tagName === "EM" ? "em" : "strong";
        out += "<" + t + ">" + serializuj(Array.prototype.filter.call(n.childNodes, jeObsah)) + "</" + t + ">";
      }
    });
    return out;
  }
  /* bezpečný převod HTML z administrace na uzly: jen text, strong, em, br */
  function naUzly(html, doc) {
    var frag = doc.createDocumentFragment(), zas = [frag];
    String(html).split(/(<\/?(?:strong|em)>|<br>)/).forEach(function (c) {
      var top = zas[zas.length - 1];
      if (c === "<strong>" || c === "<em>") { var e = doc.createElement(c.slice(1, -1)); top.appendChild(e); zas.push(e); }
      else if (c === "</strong>" || c === "</em>") { if (zas.length > 1) zas.pop(); }
      else if (c === "<br>") top.appendChild(doc.createElement("br"));
      else if (c) {
        var t = doc.createElement("textarea"); t.innerHTML = c.replace(/</g, "&lt;"); // jen dekódování entit, textarea nic nespouští
        top.appendChild(doc.createTextNode(t.value));
      }
    });
    return frag;
  }
  function jeKontaktniOdkaz(el) { return el.tagName === "A" && /^(tel|mailto):/i.test(el.getAttribute("href") || ""); }
  function kandidat(el) {
    if (!el || el.nodeType !== 1 || SKIP[el.tagName] || el.closest("svg,[data-cms-skip],#cib-admin-overlay")) return false;
    if (INLINE[el.tagName] && el.parentElement && kandidat(el.parentElement)) return false;
    if (jeKontaktniOdkaz(el) || el.closest("a[href^='tel:'],a[href^='mailto:']")) return false;
    var hasText = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && /[A-Za-zÀ-ž0-9]/.test(n.nodeValue)) { hasText = true; break; }
    }
    if (!hasText) return false;
    return norm(obsahoveUzly(el).map(function (n) { return n.textContent; }).join("")).length >= 2;
  }
  function zapamatuj(el) {
    var o = origText.get(el);
    if (!o) {
      var nodes = obsahoveUzly(el);
      o = { klic: "t" + fnv(norm(nodes.map(function (n) { return n.textContent; }).join(""))), html: serializuj(nodes).trim() };
      origText.set(el, o);
    }
    return o;
  }
  function nastavText(el, html) {
    var doc = el.ownerDocument, nodes = obsahoveUzly(el), frag = naUzly(html, doc);
    if (nodes.length) el.insertBefore(frag, nodes[0]); else el.appendChild(frag);
    nodes.forEach(function (n) { n.remove(); });
  }
  function vsechnyKandidaty(root) {
    var out = [], all = (root || document).body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) if (kandidat(all[i])) out.push(all[i]);
    return out;
  }

  /* ---------- kontakty ---------- */
  function cislice(s) { return String(s).replace(/[^0-9]/g, ""); }
  function idKontaktu(typ, hodnota) {
    if (typ === "tel") { var d = cislice(hodnota); if (d.length === 9) d = "420" + d; return "tel:" + d; }
    return "mail:" + String(hodnota).trim().toLowerCase();
  }
  function telVzor(id) { // libovolné mezery, volitelná předvolba
    var d = id.slice(4), narodni = d.length === 12 && d.indexOf("420") === 0 ? d.slice(3) : d;
    return new RegExp("(?:\\+?420[\\s\\u00a0]*)?" + narodni.split("").join("[\\s\\u00a0]*") + "(?![0-9])", "g");
  }
  function mailVzor(id) { return new RegExp(id.slice(5).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); }
  function kontaktyNaStrance(doc) {
    doc = doc || document;
    var out = [];
    doc.querySelectorAll("a[href^='tel:'],a[href^='mailto:']").forEach(function (a) {
      var o = origAttr.get(a) || {}, href = o.href || a.getAttribute("href"), typ = /^tel:/i.test(href) ? "tel" : "mail";
      var hodnota = decodeURIComponent(href.replace(/^(tel|mailto):/i, "").split("?")[0]);
      var id = idKontaktu(typ, hodnota);
      out.push({ id: id, typ: typ, puvodni: hodnota, hodnota: (O.obsah && O.obsah.kontakty[id]) || hodnota, el: a });
    });
    return out;
  }
  function aplikujKontakty(doc, kontakty) {
    var ids = Object.keys(kontakty || {});
    doc.querySelectorAll("a[href^='tel:'],a[href^='mailto:']").forEach(function (a) {
      var o = origAttr.get(a);
      if (!o) { o = { href: a.getAttribute("href") }; origAttr.set(a, o); }
      var typ = /^tel:/i.test(o.href) ? "tel" : "mail";
      var id = idKontaktu(typ, decodeURIComponent(o.href.replace(/^(tel|mailto):/i, "").split("?")[0]));
      var nova = kontakty && kontakty[id];
      if (nova && typ === "tel" && /^\+?[0-9 ]{6,22}$/.test(nova)) a.setAttribute("href", "tel:" + nova.replace(/ /g, ""));
      else if (nova && typ === "mail" && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(nova)) a.setAttribute("href", "mailto:" + nova);
      else a.setAttribute("href", o.href);
    });
    var w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT), n, vzory = ids.map(function (id) {
      return [id.indexOf("tel:") === 0 ? telVzor(id) : mailVzor(id), kontakty[id]];
    });
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (!p || SKIP[p.nodeName]) continue;
      var puv = origUzel.has(n) ? origUzel.get(n) : n.nodeValue, v = puv;
      vzory.forEach(function (x) { v = v.replace(x[0], x[1]); });
      if (v !== puv && !origUzel.has(n)) origUzel.set(n, puv);
      if (n.nodeValue !== v) n.nodeValue = v;
    }
  }

  /* ---------- fotky ---------- */
  var FOTO_ATTR = ["src", "data-src", "srcset", "data-srcset", "poster", "data-bgset", "data-bg", "data-thumb", "data-mobil-poster", "style", "href"];
  function klicFotky(url) {
    var m = /\/assets\/(?:thumbs\/)?(cib-[a-z0-9-]+?)\.(?:jpe?g|png|webp|avif)(?:[?#)"' ,]|$)/i.exec(String(url || ""));
    return m ? m[1].toLowerCase() : null;
  }
  function urlSouboru(id) { return API + "/soubor/" + id; }
  function nahradUrl(text, fotky) {
    return String(text).replace(/[^\s"'(),]*\/assets\/(?:thumbs\/)?cib-[a-z0-9-]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'(),]*)?/gi, function (u) {
      var k = klicFotky(u);
      return k && fotky[k] && /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(fotky[k]) ? urlSouboru(fotky[k]) : u;
    });
  }
  function aplikujFotky(doc, fotky) {
    doc.querySelectorAll("img,source,video,[style*='/assets/'],[data-bgset],[data-bg],a[data-thumb],a.gal__a,[href*='/assets/cib-p-']").forEach(function (el) {
      var o = origAttr.get(el) || {};
      FOTO_ATTR.forEach(function (a) {
        if (!(a in o)) { if (!el.hasAttribute(a)) return; o[a] = el.getAttribute(a); }
        var v = o[a] == null ? null : nahradUrl(o[a], fotky || {});
        if (a === "srcset" || a === "data-srcset") { if (v !== o[a]) v = v.split(",")[0].trim().split(" ")[0]; }
        if (v != null && el.getAttribute(a) !== v) el.setAttribute(a, v);
      });
      origAttr.set(el, o);
    });
  }
  function fotkyNaStrance(doc) {
    doc = doc || document;
    var vid = {}, out = [];
    doc.querySelectorAll("img,video,[style*='/assets/'],[data-bgset],[data-bg]").forEach(function (el) {
      var o = origAttr.get(el) || {};
      ["data-src", "src", "poster", "data-bgset", "data-bg", "style"].some(function (a) {
        var v = a in o ? o[a] : el.getAttribute(a), k = klicFotky(v);
        if (k && /^cib-(logo|brand|ico|btn|listing|pin)-/.test(k)) return false; // loga a ikony nejsou fotky
        if (k && !vid[k]) {
          vid[k] = 1;
          var m = /[^\s"'(),]*\/assets\/[^\s"'(),]+/.exec(v);
          out.push({ klic: k, url: (O.obsah && O.obsah.fotky[k]) ? urlSouboru(O.obsah.fotky[k]) : (m ? m[0] : v), puvodni: m ? m[0] : v, el: el });
          return true;
        }
        return false;
      });
    });
    return out;
  }

  /* ---------- veřejné API ---------- */
  var O = {
    API: API,
    obsah: null,
    nacti: function () {
      return fetch(API + "/obsah", { credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (o) { O.obsah = o; return o; });
    },
    aplikuj: function (obsah, doc) {
      doc = doc || document;
      obsah = obsah || { kontakty: {}, texty: {}, fotky: {} };
      O.obsah = obsah;
      var texty = obsah.texty || {};
      vsechnyKandidaty(doc).forEach(zapamatuj); // originály dřív, než se cokoli změní
      vsechnyKandidaty(doc).forEach(function (el) {
        var o = origText.get(el);
        if (!o) return;
        if (texty[o.klic] != null) {
          if (serializuj(obsahoveUzly(el)).trim() !== texty[o.klic]) nastavText(el, texty[o.klic]);
          upraveno.add(el);
        } else if (upraveno.has(el)) { nastavText(el, o.html); upraveno.delete(el); }
      });
      aplikujKontakty(doc, obsah.kontakty || {});
      aplikujFotky(doc, obsah.fotky || {});
      return obsah;
    },
    editovatelny: function (node) {
      var el = node && (node.nodeType === 3 ? node.parentElement : node);
      while (el && el !== el.ownerDocument.body) {
        if (kandidat(el)) { zapamatuj(el); return el; }
        if (!INLINE[el.tagName] && el.tagName !== "SPAN" && el.tagName !== "A" && el.tagName !== "I") return null;
        el = el.parentElement;
      }
      return null;
    },
    klicTextu: function (el) { return kandidat(el) || origText.get(el) ? zapamatuj(el).klic : null; },
    puvodniHtml: function (el) { return zapamatuj(el).html; },
    aktualniHtml: function (el) { return serializuj(obsahoveUzly(el)).trim(); },
    kandidati: function (doc) { return vsechnyKandidaty(doc); },
    kontaktyNaStrance: kontaktyNaStrance,
    idKontaktu: idKontaktu,
    fotkyNaStrance: fotkyNaStrance,
    klicFotky: klicFotky,
    urlSouboru: urlSouboru,
  };
  window.CIBObsah = O;
  function start() {
    O.nacti().then(function (o) {
      if (Object.keys(o.kontakty || {}).length || Object.keys(o.texty || {}).length || Object.keys(o.fotky || {}).length) O.aplikuj(o);
    }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

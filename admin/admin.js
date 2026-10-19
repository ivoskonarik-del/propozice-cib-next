/* CIB GROUP – administrace webu (19. 10. 2026).
   Kontrakt: _admin/KONTRAKT.md. Bezpečnost: žádné innerHTML s daty, token jen v sessionStorage,
   odhlášení po 30 min nečinnosti, ochrana proti vložení do rámu, CSP v index.html. */
"use strict";
(function () {
  /* ochrana proti clickjackingu: v cizím rámu nic nevykreslit */
  if (window.top !== window.self) {
    try { window.top.location.replace(window.self.location.href); } catch (e) { /* cizí rám: zůstane prázdné */ }
    return;
  }
  document.documentElement.classList.add("ok");

  const API = "https://cib-admin-api.prodej-bytu-3-1-70-m2-172175436.workers.dev";
  const WEB = new URL("../", location.href).pathname; // např. /propozice-cib-next/
  const KLIC = "cib-admin-relace";
  let NECINNOST = 30 * 60 * 1000; // server může poslat necinnost_s v /ja
  const MAX_FOTKA = 2400;
  const STRANKY_ZALOHA = [
    ["", "Domů"], ["nemovitosti/", "Nemovitosti"], ["nemovitosti/balabenka/", "Balabenka"],
    ["nemovitosti/vodickova-33/", "Vodičkova 33"], ["nemovitosti/vodickova-luxury-suites/", "Vodičkova Luxury Suites"],
    ["nemovitosti/sprava-bytu-liberec/", "Správa bytů Liberecko"], ["nemovitosti/sprava-bytu-praha/", "Správa bytů Praha"],
    ["development/lichoceves/", "Obec v zahradě"], ["staje/emma-sophia-stables/", "Emma Sophia Stables"],
    ["o-nas/", "O nás"], ["kontakt/", "Kontakt"],
  ].map(([u, n]) => ({ url: WEB + u, nazev: n }));

  const S = {
    token: null, jmeno: "", platiDo: null, obsah: null, katalog: null, stranka: null, tab: "prehled",
    historie: null, aktivita: null, ja: null, posledni: Date.now(), uprava: false, vybrany: null,
    fotka: null, novaFotka: null, zamekDo: 0,
  };

  /* ───────── pomocníci ───────── */
  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...deti) {
    const el = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
    for (const d of deti.flat(Infinity)) {
      if (d == null || d === false) continue;
      el.append(d instanceof Node ? d : document.createTextNode(String(d)));
    }
    return el;
  }
  function ik(n) {
    const t = $("i-" + n);
    return t ? t.content.firstElementChild.cloneNode(true) : document.createElement("span");
  }
  const fmtCas = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function cas(iso) { const d = new Date(iso); return isNaN(d) ? "–" : fmtCas.format(d); }
  function pred(iso) {
    const d = new Date(iso); if (isNaN(d)) return "";
    const s = Math.round((Date.now() - d) / 1000);
    if (s < 60) return "právě teď";
    if (s < 3600) return "před " + Math.round(s / 60) + " min";
    if (s < 86400) return "před " + Math.round(s / 3600) + " h";
    const dny = Math.round(s / 86400);
    return dny === 1 ? "včera" : "před " + dny + " dny";
  }
  function vlajka(z) {
    if (!/^[A-Z]{2}$/.test(z || "")) return z || "?";
    return String.fromCodePoint(...[...z].map((c) => 0x1f1a5 + c.charCodeAt(0))) + " " + z;
  }
  function prohlizec(ua) {
    ua = String(ua || "");
    const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Prohlížeč";
    const o = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
    return o ? b + " · " + o : b;
  }
  function inicialy(j) {
    const c = String(j || "?").split(/[\s._-]+/).filter(Boolean);
    return ((c[0] || "?")[0] + (c[1] ? c[1][0] : (c[0] || "")[1] || "")).toUpperCase();
  }
  function cisloKontaktu(n) { return n === 1 ? "kontakt" : n >= 2 && n <= 4 ? "kontakty" : "kontaktů"; }

  /* ───────── HTML textů: jen <strong>, <em>, <br> ───────── */
  const POVOLENE = { STRONG: "strong", B: "strong", EM: "em", I: "em", BR: "br" };
  function sanitizuj(html) {
    // zdroj = řetězec (rozparsuje se v inertním dokumentu, nic se nespustí ani nenačte) nebo vlastní uzel editoru
    const zdroj = html instanceof Node ? html : new DOMParser().parseFromString("<!doctype html><body>" + String(html == null ? "" : html), "text/html").body;
    const frag = document.createDocumentFragment();
    (function kopiruj(z, cil) {
      for (const n of Array.from(z.childNodes)) {
        if (n.nodeType === 3) cil.append(document.createTextNode(n.nodeValue));
        else if (n.nodeType === 1) {
          const t = POVOLENE[n.tagName];
          if (t === "br") cil.append(document.createElement("br"));
          else if (t) { const e = document.createElement(t); kopiruj(n, e); cil.append(e); }
          else if (n.tagName === "SCRIPT" || n.tagName === "STYLE" || n.tagName === "TEMPLATE") continue;
          else if (/^(DIV|P|LI)$/.test(n.tagName)) { if (cil.childNodes.length) cil.append(document.createElement("br")); kopiruj(n, cil); }
          else kopiruj(n, cil);
        }
      }
    })(zdroj, frag);
    return frag;
  }
  function serializuj(uzel) {
    let s = "";
    for (const n of Array.from(uzel.childNodes)) {
      if (n.nodeType === 3) s += n.nodeValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      else if (n.nodeName === "BR") s += "<br>";
      else if (n.nodeName === "STRONG" || n.nodeName === "EM") { const t = n.nodeName.toLowerCase(); const v = serializuj(n); if (v) s += "<" + t + ">" + v + "</" + t + ">"; }
      else s += serializuj(n);
    }
    return s;
  }
  const cisteHtml = (html) => serializuj(sanitizuj(html)).replace(/(<br>)+$/, "").trim();
  const jenText = (html) => (sanitizuj(html).textContent || "").replace(/\s+/g, " ").trim();

  /* ───────── API ───────── */
  class Chyba extends Error { constructor(m, status, data) { super(m); this.status = status; this.data = data; } }
  async function api(cesta, o) {
    o = o || {};
    const hl = {};
    if (!o.verejne && S.token) hl.Authorization = "Bearer " + S.token;
    let body;
    if (o.telo instanceof Blob) { body = o.telo; hl["Content-Type"] = o.typ || o.telo.type || "application/octet-stream"; }
    else if (o.telo !== undefined) { body = JSON.stringify(o.telo); hl["Content-Type"] = "application/json"; }
    let r;
    try {
      r = await fetch(API + cesta, { method: o.metoda || "GET", headers: hl, body, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", mode: "cors" });
    } catch (e) { throw new Chyba("Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.", 0); }
    let data = null;
    try { data = await r.json(); } catch (e) { /* prázdné tělo */ }
    if (r.status === 401 && !o.verejne && S.token) {
      odhlasMistne("Přihlášení vypršelo. Přihlaste se prosím znovu.");
      throw new Chyba("Přihlášení vypršelo.", 401, data);
    }
    if (!r.ok) throw new Chyba((data && data.chyba) || "Něco se nepovedlo (chyba " + r.status + ").", r.status, data);
    return data;
  }
  function prazdnyObsah() { return { verze: 0, upraveno: null, kontakty: {}, texty: {}, fotky: {} }; }
  function normalizujObsah(o) {
    o = o && typeof o === "object" ? o : {};
    return { verze: +o.verze || 0, upraveno: o.upraveno || null, kontakty: o.kontakty || {}, texty: o.texty || {}, fotky: o.fotky || {} };
  }

  /* uložení změn s kontrolou souběhu (409) */
  async function uloz(zmeny, hlaska) {
    try {
      const o = await api("/obsah", { metoda: "POST", telo: { zmeny, verze: S.obsah ? S.obsah.verze : 0 } });
      S.obsah = normalizujObsah(o); S.historie = null;
      aplikujNahled();
      toast(hlaska || "Uloženo a zveřejněno.", "ok");
      vykresliStav();
      return true;
    } catch (e) {
      if (e.status === 409) {
        if (e.data && e.data.obsah) S.obsah = normalizujObsah(e.data.obsah);
        else { try { S.obsah = normalizujObsah(await api("/obsah", { verejne: true })); } catch (x) { /* nic */ } }
        aplikujNahled(); vykresli();
        toast("Mezitím uložil změny někdo jiný. Načetl jsem aktuální verzi – zkontrolujte ji a uložte znovu.", "err", 7000);
      } else if (e.status !== 401) toast(e.message, "err", 6000);
      return false;
    }
  }

  /* ───────── toasty a dialogy ───────── */
  function toast(text, druh, ms) {
    const t = h("div", { class: "toast toast--" + (druh || "info") }, ik(druh === "ok" ? "check" : druh === "err" ? "chyba" : "info"), h("span", { text }));
    $("toasty").append(t);
    setTimeout(() => { t.classList.add("pryc"); setTimeout(() => t.remove(), 400); }, ms || 3800);
  }
  function potvrd(o) {
    return new Promise((res) => {
      const d = $("dlg-potvrd");
      $("dlg-potvrd-t").textContent = o.nadpis;
      $("dlg-potvrd-p").textContent = o.text;
      const ikona = $("dlg-potvrd-ik"); ikona.replaceChildren(ik(o.ikona || "info"));
      ikona.className = "dlg__ik" + (o.nebezpecne ? " dlg__ik--err" : "");
      const ano = $("dlg-potvrd-ano"), ne = $("dlg-potvrd-ne");
      ano.textContent = o.ok || "Potvrdit";
      ano.className = "btn " + (o.nebezpecne ? "btn--err" : "btn--ink");
      const hotovo = (v) => { ano.removeEventListener("click", a); ne.removeEventListener("click", n); d.removeEventListener("close", c); if (d.open) d.close(); res(v); };
      const a = () => hotovo(true), n = () => hotovo(false), c = () => hotovo(false);
      ano.addEventListener("click", a); ne.addEventListener("click", n); d.addEventListener("close", c);
      d.showModal(); ne.focus();
    });
  }

  /* ───────── přihlášení ───────── */
  function ukazPrihlaseni(zprava) {
    document.body.classList.remove("uprava");
    $("app").hidden = true; $("prihlaseni").hidden = false;
    $("bg-foto").hidden = false;
    const fr = $("nahled"); fr.classList.remove("nacteno"); fr.removeAttribute("src");
    const z = $("login-zprava"); z.hidden = !zprava; z.textContent = zprava || "";
    $("l-heslo").value = ""; $("l-kod").value = "";
    setTimeout(() => ($("l-jmeno").value ? $("l-heslo") : $("l-jmeno")).focus(), 50);
  }
  function naplnDuveru() {
    const ul = $("login-trust"); ul.replaceChildren();
    [["zamek", "Šifrované spojení a hesla uložená jen jako otisk"], ["klic", "Dvoufázové ověření kódem z telefonu"], ["stit", "Zámek po opakovaných neúspěšných pokusech"]]
      .forEach(([i, t]) => ul.append(h("li", null, ik(i), t)));
    $("l-oko").append(ik("oko"));
  }
  function zamekOdpocet() {
    const btn = $("login-btn"), err = $("login-chyba");
    clearInterval(S.zamekTimer);
    const krok = () => {
      const zb = Math.max(0, Math.ceil((S.zamekDo - Date.now()) / 1000));
      if (!zb) { clearInterval(S.zamekTimer); btn.disabled = false; err.className = "login__err"; err.textContent = ""; return; }
      btn.disabled = true;
      err.className = "login__err zamek";
      const m = Math.floor(zb / 60), s = zb % 60;
      err.textContent = "Z bezpečnostních důvodů je přihlášení dočasně zamčené. Zkuste to znovu za " + (m ? m + " min " : "") + s + " s.";
    };
    krok(); S.zamekTimer = setInterval(krok, 1000);
  }
  async function prihlas(ev) {
    ev.preventDefault();
    if (Date.now() < S.zamekDo) return;
    const jmeno = $("l-jmeno").value.trim(), heslo = $("l-heslo").value, kod = $("l-kod").value.replace(/\D/g, "");
    const err = $("login-chyba"); err.className = "login__err"; err.textContent = "";
    if (!jmeno || !heslo) { err.textContent = "Vyplňte jméno i heslo."; ($("l-jmeno").value ? $("l-heslo") : $("l-jmeno")).focus(); return; }
    if (kod.length !== 6) { err.textContent = "Ověřovací kód má 6 číslic – najdete ho v aplikaci Google Authenticator."; $("l-kod").focus(); return; }
    const btn = $("login-btn"); btn.disabled = true; btn.replaceChildren(h("span", { class: "tocka", "aria-hidden": "true" }), "Ověřuji…");
    try {
      const d = await api("/prihlaseni", { metoda: "POST", telo: { jmeno, heslo, kod }, verejne: true });
      S.token = d.token; S.jmeno = d.jmeno || jmeno; S.platiDo = d.plati_do || null;
      try { sessionStorage.setItem(KLIC, JSON.stringify({ t: S.token, j: S.jmeno, p: S.platiDo })); } catch (e) { /* jen v paměti */ }
      $("l-heslo").value = ""; $("l-kod").value = "";
      await spust();
    } catch (e) {
      $("l-kod").value = "";
      if (e.status === 429) {
        S.zamekDo = Date.now() + 1000 * Math.max(30, +((e.data && e.data.za_sekund) || 300));
        zamekOdpocet();
      } else {
        err.textContent = e.status === 401 ? "Jméno, heslo nebo ověřovací kód nesouhlasí." : e.message;
        const k = $("login-karta"); k.classList.remove("tres"); void k.offsetWidth; k.classList.add("tres");
        (e.status === 401 ? $("l-heslo") : $("l-jmeno")).focus();
      }
    } finally {
      btn.replaceChildren("Přihlásit se");
      if (Date.now() >= S.zamekDo) btn.disabled = false;
    }
  }
  function odhlasMistne(zprava) {
    try { sessionStorage.removeItem(KLIC); } catch (e) { /* nic */ }
    S.token = null; S.obsah = null; S.historie = null; S.aktivita = null; S.ja = null;
    zavriEditor(); document.body.classList.remove("uprava"); S.uprava = false;
    clearInterval(S.casovac);
    ukazPrihlaseni(zprava);
  }
  async function odhlas(zprava) {
    const t = S.token;
    odhlasMistne(zprava || "Byli jste bezpečně odhlášeni.");
    if (t) { try { await fetch(API + "/odhlaseni", { method: "POST", headers: { Authorization: "Bearer " + t }, credentials: "omit", referrerPolicy: "no-referrer" }); } catch (e) { /* relace stejně vyprší */ } }
  }

  /* ───────── nečinnost ───────── */
  function aktivita() { S.posledni = Date.now(); }
  function hlidejNecinnost() {
    clearInterval(S.casovac);
    S.posledni = Date.now();
    const krok = () => {
      if (!S.token) return;
      const zb = NECINNOST - (Date.now() - S.posledni);
      if (S.platiDo && Date.parse(S.platiDo) < Date.now()) { odhlas("Platnost přihlášení skončila. Přihlaste se prosím znovu."); return; }
      if (zb <= 0) { odhlas("Kvůli bezpečnosti jsme vás po 30 minutách nečinnosti odhlásili."); return; }
      const el = $("chip-cas"), m = Math.floor(zb / 60000), s = Math.floor((zb % 60000) / 1000);
      el.textContent = zb < 120000 ? "Odhlášení za " + m + ":" + String(s).padStart(2, "0") : "Odhlášení za " + (m + 1) + " min";
      el.classList.toggle("brzy", zb < 120000);
    };
    krok(); S.casovac = setInterval(krok, 1000);
  }

  /* ───────── start aplikace ───────── */
  async function spust() {
    $("prihlaseni").hidden = true; $("app").hidden = false; $("bg-foto").hidden = true;
    $("chip-jmeno").textContent = S.jmeno; $("chip-av").textContent = inicialy(S.jmeno);
    hlidejNecinnost();
    $("panel").replaceChildren(h("div", { class: "nacitam" }, h("span", { class: "tocka", "aria-hidden": "true" }), "Načítám obsah webu…"));
    const [kat, obs, ja] = await Promise.allSettled([
      fetch("katalog.json", { cache: "no-store", credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)),
      api("/obsah", { verejne: true }),
      api("/ja"),
    ]);
    if (!S.token) return; // mezitím odhlášen (401)
    S.katalog = kat.status === "fulfilled" && kat.value ? kat.value : { stranky: [], kontakty: [] };
    if (!Array.isArray(S.katalog.stranky) || !S.katalog.stranky.length) S.katalog.stranky = STRANKY_ZALOHA;
    const poradi = (st) => { const i = STRANKY_ZALOHA.findIndex((x) => x.url === st.url); return i < 0 ? 99 : i; };
    S.katalog.stranky = S.katalog.stranky.filter((x) => x && typeof x.url === "string" && x.url.indexOf(WEB) === 0).sort((x, y) => poradi(x) - poradi(y));
    if (!Array.isArray(S.katalog.kontakty)) S.katalog.kontakty = [];
    S.obsah = obs.status === "fulfilled" ? normalizujObsah(obs.value) : prazdnyObsah();
    if (obs.status !== "fulfilled") toast("Obsah webu se nepodařilo načíst: " + obs.reason.message, "err", 6000);
    S.ja = ja.status === "fulfilled" ? ja.value : null;
    if (S.ja && S.ja.plati_do) S.platiDo = S.ja.plati_do;
    if (S.ja && +S.ja.necinnost_s >= 60 && +S.ja.necinnost_s <= 4 * 3600) { NECINNOST = +S.ja.necinnost_s * 1000; S.posledni = Date.now(); }
    vykresliStranky();
    nactiStranku(S.katalog.stranky[0]);
    vykresli();
    nactiHistorii(true);
  }

  /* ───────── náhled webu (iframe, stejný origin) ───────── */
  function ramec() { const f = $("nahled"); try { return f.contentWindow; } catch (e) { return null; } }
  function cib() { const w = ramec(); try { return w && w.CIBObsah ? w.CIBObsah : null; } catch (e) { return null; } }
  function aplikujNahled() {
    const c = cib();
    if (c && S.obsah && typeof c.aplikuj === "function") { try { c.aplikuj(S.obsah); } catch (e) { /* náhled není kritický */ } }
  }
  function nactiStranku(st) {
    if (!st) return;
    S.stranka = st;
    const f = $("nahled");
    f.classList.remove("nacteno");
    f.src = st.url;
    document.querySelectorAll(".karta-s").forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.url === st.url)));
    const bar = $("edit-bar-t"); if (bar) nastavListu();
  }
  function poNacteniRamce() {
    const f = $("nahled");
    if (!f.getAttribute("src")) return;
    f.classList.add("nacteno");
    const w = ramec();
    let doc; try { doc = w.document; } catch (e) { return; }
    // web si obsah načte sám; nejčerstvější verzi z administrace vnutíme znovu (KV na okraji drží obsah až 60 s)
    aplikujNahled();
    [500, 1500, 3500].forEach((ms) => setTimeout(aplikujNahled, ms));
    // zabránit odchodu z náhledu jinam a hlídat nečinnost i v rámu
    doc.addEventListener("pointerdown", aktivita, true);
    doc.addEventListener("keydown", aktivita, true);
    doc.addEventListener("click", klikVRamci, true);
    doc.addEventListener("mousemove", najetiVRamci, true);
    doc.addEventListener("scroll", () => skryjZvyrazneni(), true);
    if (S.uprava) pripravRamecProUpravy();
    if (S.tab === "fotky") vykresli();
  }

  /* ───────── stránky (tmavé skleněné karty) ───────── */
  function vykresliStranky() {
    const box = $("stranky"); box.replaceChildren();
    for (const st of S.katalog.stranky) {
      const cesta = st.url.indexOf(WEB) === 0 ? "/" + st.url.slice(WEB.length) : st.url;
      box.append(h("button", {
        class: "karta-s", type: "button", "aria-pressed": "false", dataset: { url: st.url },
        onclick: () => { nactiStranku(st); if (S.tab === "fotky") vykresli(); },
      },
        h("span", { class: "karta-s__h" }, h("span", { class: "karta-s__ik" }, ik(st.url === WEB ? "web" : /kontakt/.test(st.url) ? "telefon" : "budova")), h("span", { class: "karta-s__ob" }, ik("sipka"))),
        h("span", null, h("span", { class: "karta-s__n", text: st.nazev }), h("span", { class: "karta-s__u", text: cesta === "/" ? "Úvodní stránka" : cesta }))));
    }
  }

  /* ───────── vykreslení panelů ───────── */
  function prepniTab(tab, fokus) {
    if (S.uprava && tab !== "texty") ukonciUpravy();
    S.tab = tab;
    document.querySelectorAll(".pill").forEach((p) => p.setAttribute("aria-selected", String(p.dataset.tab === tab)));
    $("panel").setAttribute("aria-labelledby", "tab-" + tab);
    vykresli();
    if (fokus) $("panel").focus({ preventScroll: true });
  }
  function vykresli() {
    vykresliStav();
    const p = $("panel");
    const fn = { prehled: pPrehled, kontakty: pKontakty, texty: pTexty, fotky: pFotky, historie: pHistorie, zabezpeceni: pZabezpeceni }[S.tab];
    p.replaceChildren(h("div", { class: "panel" }, fn()));
  }
  function vykresliStav() {
    const o = S.obsah || prazdnyObsah();
    const box = $("hero-stav"); box.replaceChildren(
      h("span", { class: "stav" }, h("i"), "Web je online"),
      h("span", { class: "stav" }, ik("historie"), o.upraveno ? "Naposledy uloženo " + pred(o.upraveno) : "Zatím beze změn"),
      h("span", { class: "stav" }, ik("stit"), "Dvoufázové ověření aktivní"));
    const pocty = { kontakty: Object.keys(o.kontakty).length, texty: Object.keys(o.texty).length, fotky: Object.keys(o.fotky).length };
    document.querySelectorAll(".pill").forEach((p) => {
      const n = pocty[p.dataset.tab]; let b = p.querySelector(".pill__n");
      if (n) { if (!b) { b = h("span", { class: "pill__n" }); p.append(b); } b.textContent = n; b.setAttribute("aria-label", n + " upraveno"); }
      else if (b) b.remove();
    });
  }
  function hlavicka(t, p, prava) {
    return h("div", { class: "panel__h" }, h("div", null, h("h2", { class: "panel__t", text: t }), p ? h("p", { class: "panel__p", text: p }) : null), prava || null);
  }

  /* PŘEHLED */
  function pPrehled() {
    const o = S.obsah || prazdnyObsah(), k = S.katalog.kontakty;
    const nK = Object.keys(o.kontakty).length, nT = Object.keys(o.texty).length, nF = Object.keys(o.fotky).length;
    const karta = (tab, ikona, t, s, cislo, mala, znak, znakTrida, sl) => h("div", {
      class: "karta karta--klik", role: "button", tabindex: "0", "aria-label": t + ": " + s,
      onclick: () => prepniTab(tab, true), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prepniTab(tab, true); } },
    },
      h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik(ikona)), h("div", null, h("h3", { class: "karta__t", text: t }), h("p", { class: "karta__s", text: s })), h("span", { class: "karta__ob" }, ik("sipka"))),
      h("div", { class: "karta__cislo" }, String(cislo), mala ? h("small", { text: mala }) : null),
      h("div", { class: "karta__pata" }, h("span", { text: tab === "zabezpeceni" ? "Ochrany webu" : "Upraveno" }), h("span", { class: "znak " + znakTrida, text: znak })),
      sl || null);
    const sloupky = (n, celkem) => { const box = h("div", { class: "sloupky", "aria-hidden": "true" }); for (let i = 0; i < 28; i++) { const zap = celkem ? i < Math.round((n / celkem) * 28) : false; box.append(h("i", { class: zap ? "on" : "" })); box.lastChild.style.height = (30 + ((i * 37) % 70)) + "%"; } return box; };
    const hist = Array.isArray(S.historie) ? S.historie : [];
    return [
      hlavicka("Přehled", "Vše podstatné o webu na jednom místě. Klikněte na kartu a pusťte se do úprav."),
      h("div", { class: "g4" },
        karta("kontakty", "telefon", "Kontakty", "Telefony a e-maily", nK, k.length ? "z " + k.length : "", nK ? "Upraveno" : "Původní", nK ? "znak--b" : "znak--mut", sloupky(nK, k.length || 1)),
        karta("texty", "text", "Texty", "Nadpisy a odstavce", nT, "", nT ? "Upraveno" : "Původní", nT ? "znak--b" : "znak--mut", sloupky(Math.min(nT, 28), 28)),
        karta("fotky", "foto", "Fotky", "Vyměněné obrázky", nF, "", nF ? "Vyměněno" : "Původní", nF ? "znak--b" : "znak--mut", sloupky(Math.min(nF, 28), 28)),
        karta("zabezpeceni", "stit", "Zabezpečení", "Dvoufázové ověření", "2FA", "", "Aktivní", "znak--ok", sloupky(28, 28))),
      h("div", { class: "g-hl" },
        h("div", { class: "karta" },
          h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik("historie")), h("div", null, h("h3", { class: "karta__t", text: "Aktivita na webu" }), h("p", { class: "karta__s", text: "Uložené změny za posledních 14 dní" }))),
          graf(hist)),
        h("div", { class: "karta" },
          h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik("pero")), h("div", null, h("h3", { class: "karta__t", text: "Poslední změny" }), h("p", { class: "karta__s", text: S.historie ? (hist.length ? "Kdo a co upravil" : "Zatím žádné změny") : "Načítám…" }))),
          hist.length ? h("ul", { class: "feed" }, hist.slice(0, 4).map((v) => h("li", null, h("span", { class: "feed__ik" }, ik("pero")), h("span", { class: "feed__t" }, h("b", { text: (v.popis && v.popis[0]) || "Úprava obsahu" }), h("small", { text: (v.jmeno || "–") + " · " + pred(v.cas) }))))) : h("div", { class: "prazdne" }, ik("historie"), h("b", { text: "Historie je prázdná" }), "Každá uložená změna se tu objeví i s autorem."),
          h("div", { class: "btn-r" }, h("button", { class: "btn btn--b btn--blok", type: "button", onclick: () => prepniTab("historie", true) }, ik("historie"), "Zobrazit celou historii")))),
    ];
  }
  function graf(hist) {
    const dny = [], dnes = new Date(); dnes.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) { const d = new Date(dnes); d.setDate(d.getDate() - i); dny.push({ d, n: 0 }); }
    for (const v of hist) { const d = new Date(v.cas); d.setHours(0, 0, 0, 0); const x = dny.find((y) => +y.d === +d); if (x) x.n++; }
    const max = Math.max(1, ...dny.map((x) => x.n));
    const g = h("div", { class: "graf", role: "img", "aria-label": "Počet uložených změn za posledních 14 dní: " + dny.reduce((a, x) => a + x.n, 0) });
    const osa = h("div", { class: "graf__x", "aria-hidden": "true" });
    dny.forEach((x, i) => {
      const b = h("div", { class: "graf__b" + (x.n ? (i === 13 ? " dnes" : "") : " nula") });
      b.style.height = (x.n ? 12 + (x.n / max) * 88 : 3) + "%";
      g.append(h("div", { class: "graf__d" }, x.n ? h("span", { class: "graf__n", text: String(x.n) }) : null, b));
      osa.append(h("span", { text: i === 13 ? "dnes" : x.d.getDate() + ". " + (x.d.getMonth() + 1) + "." }));
    });
    return h("div", null, g, osa);
  }

  /* KONTAKTY */
  const RE_TEL = /^\+?[0-9][0-9 ]{7,22}$/;
  const RE_MAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
  function overKontakt(typ, v) {
    v = String(v || "").trim();
    if (!v) return "Vyplňte hodnotu, nebo použijte „Vrátit původní“.";
    if (typ === "tel") { const c = v.replace(/\D/g, ""); if (!RE_TEL.test(v) || c.length < 9 || c.length > 15) return "Telefon zadejte jako +420 123 456 789 (jen číslice, mezery a + na začátku)."; }
    else if (!RE_MAIL.test(v)) return "Zadejte platný e-mail, např. info@cib.cz.";
    return "";
  }
  function nazevStranky(u) {
    const st = S.katalog.stranky.find((x) => x.url === u || x.url === WEB + String(u).replace(/^\//, ""));
    return st ? st.nazev : String(u);
  }
  function pKontakty() {
    const o = S.obsah || prazdnyObsah();
    const kat = S.katalog.kontakty;
    const hledat = h("input", { type: "search", placeholder: "Hledat kontakt…", "aria-label": "Hledat kontakt", value: S.hledat || "" });
    const vysledek = h("div");
    const kresli = () => {
      const q = (S.hledat || "").toLowerCase().trim();
      const shoda = (k) => !q || [k.hodnota, o.kontakty[k.id] || "", ...(k.popisky || [])].join(" ").toLowerCase().includes(q);
      const skup = [["tel", "Telefony"], ["mail", "E-maily"]].map(([typ, n]) => [n, kat.filter((k) => k.typ === typ && shoda(k))]).filter(([, l]) => l.length);
      vysledek.replaceChildren(...(skup.length ? skup.map(([n, l]) => h("div", { class: "skupina" }, h("h3", { class: "skupina__t" }, n, h("span", { text: String(l.length) })), h("div", { class: "kontakty" }, l.map(radekKontaktu)))) :
        [h("div", { class: "prazdne" }, ik("hledat"), h("b", { text: kat.length ? "Nic nenalezeno" : "Katalog kontaktů se nepodařilo načíst" }), kat.length ? "Zkuste jiné hledání." : "Zkuste stránku obnovit.")]));
    };
    hledat.addEventListener("input", () => { S.hledat = hledat.value; kresli(); });
    kresli();
    const nK = Object.keys(o.kontakty).length;
    return [
      hlavicka("Kontakty", "Telefony a e-maily se mění na všech stránkách najednou – v textu i v odkazech pro volání a psaní.", h("label", { class: "hledat" }, ik("hledat"), hledat)),
      nK ? h("p", { class: "panel__p", text: "Upraveno " + nK + " " + cisloKontaktu(nK) + " z " + kat.length + "." }) : null,
      vysledek,
    ];
  }
  /* původní hodnota kontaktu: e-mail vždy z id (katalog může mít u odkazu přilepený text), telefon z katalogu, když sedí číslice */
  function puvodniHodnota(k) {
    if (k.typ === "mail") return String(k.id).slice(5);
    const c = String(k.id).slice(4), v = String(k.hodnota || "").trim(), d = v.replace(/\D/g, "");
    if (v && (d === c || "420" + d === c) && /^\+?[0-9 ]+$/.test(v)) return v;
    return c.length === 12 && c.indexOf("420") === 0 ? "+420 " + c.slice(3, 6) + " " + c.slice(6, 9) + " " + c.slice(9) : "+" + c;
  }
  function radekKontaktu(kat) {
    const k = Object.assign({}, kat, { hodnota: puvodniHodnota(kat) });
    const o = S.obsah || prazdnyObsah();
    const zmena = Object.prototype.hasOwnProperty.call(o.kontakty, k.id);
    const akt = zmena ? o.kontakty[k.id] : k.hodnota;
    const vstup = h("input", { class: "kontakt__in", type: k.typ === "tel" ? "tel" : "email", value: akt, "aria-label": (k.typ === "tel" ? "Telefon " : "E-mail ") + k.hodnota, autocomplete: "off", spellcheck: "false", maxlength: "120", inputmode: k.typ === "tel" ? "tel" : "email" });
    const btn = h("button", { class: "kontakt__ulozit", type: "button", disabled: true }, ik("check"), "Uložit");
    const pozn = h("span");
    const zprava = () => {
      const v = vstup.value.trim(), ch = overKontakt(k.typ, v);
      vstup.setAttribute("aria-invalid", String(!!ch && v !== akt));
      btn.disabled = !!ch || v === akt;
      pozn.replaceChildren(ch && v !== akt ? h("span", { class: "chyba", text: ch }) : zmena ? h("span", { class: "kontakt__puv" }, "Původně ", h("s", { text: k.hodnota })) : h("span", { text: "Původní hodnota" }));
    };
    vstup.addEventListener("input", zprava);
    vstup.addEventListener("keydown", (e) => { if (e.key === "Enter" && !btn.disabled) btn.click(); if (e.key === "Escape") { vstup.value = akt; zprava(); } });
    btn.addEventListener("click", async () => {
      const v = vstup.value.trim();
      if (overKontakt(k.typ, v)) return;
      btn.disabled = true;
      const ok = await uloz({ kontakty: { [k.id]: v === k.hodnota ? null : v } }, "Kontakt uložen – na webu už platí " + v + ".");
      if (ok) vykresli(); else zprava();
    });
    zprava();
    const vratit = zmena ? h("button", { class: "btn btn--txt", type: "button", onclick: async () => {
      if (await potvrd({ nadpis: "Vrátit původní kontakt?", text: "Na webu bude znovu " + k.hodnota + ".", ok: "Vrátit původní", ikona: "zpet" })) { if (await uloz({ kontakty: { [k.id]: null } }, "Vráceno na " + k.hodnota + ".")) vykresli(); }
    } }, ik("zpet"), "Vrátit původní") : null;
    const popis = (k.popisky && k.popisky.filter(Boolean)) || [];
    const stranky = (k.stranky || []).map(nazevStranky);
    return h("article", { class: "kontakt" + (zmena ? " zmeneno" : ""), id: "k-" + k.id.replace(/[^a-z0-9]/gi, "-") },
      h("div", { class: "kontakt__h" }, h("span", { class: "kontakt__ik" }, ik(k.typ === "tel" ? "telefon" : "mail")),
        h("div", { class: "kontakt__l" }, h("b", { text: popis[0] || (k.typ === "tel" ? "Telefon" : "E-mail") }), h("small", { text: popis.slice(1).join(" · ") || (stranky.length ? "Na " + stranky.length + (stranky.length === 1 ? " stránce" : " stránkách") : "") })),
        zmena ? h("span", { class: "stitek stitek--b", text: "Upraveno" }) : null),
      h("div", { class: "kontakt__r" }, vstup, btn),
      h("div", { class: "kontakt__pozn" }, pozn, vratit),
      stranky.length ? h("div", { class: "stitky", "aria-label": "Stránky s tímto kontaktem" }, [...new Set(stranky)].slice(0, 8).map((n) => h("span", { class: "stitek", text: n }))) : null);
  }
  function zvyrazniKontakt(id) {
    prepniTab("kontakty");
    requestAnimationFrame(() => {
      const el = document.getElementById("k-" + String(id).replace(/[^a-z0-9]/gi, "-"));
      if (!el) return;
      el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      el.classList.add("zvyrazni"); const i = el.querySelector("input"); if (i) i.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove("zvyrazni"), 3200);
    });
  }

  /* TEXTY */
  function pTexty() {
    const o = S.obsah || prazdnyObsah();
    const klice = Object.keys(o.texty);
    return [
      hlavicka("Texty", "Upravujte nadpisy a odstavce přímo na stránce. Kliknete na text, napíšete nový a uložíte."),
      h("div", { class: "vyzva" },
        h("div", null, h("h3", { text: "Upravit texty přímo na webu" }), h("p", { text: "Otevře se stránka „" + (S.stranka ? S.stranka.nazev : "Domů") + "“. Najeďte myší na text, klikněte a upravte ho. Stránku přepnete v kartách nahoře." })),
        h("button", { class: "btn btn--b", type: "button", onclick: zacniUpravy }, ik("kurzor"), "Začít upravovat")),
      h("h3", { class: "skupina__t" }, "Upravené texty", h("span", { text: String(klice.length) })),
      klice.length ? h("ul", { class: "seznam" }, klice.map((kl) => h("li", null,
        h("span", { class: "feed__ik" }, ik("text")),
        h("span", { class: "seznam__t" }, h("b", { text: jenText(o.texty[kl]) || "(prázdný text)" }), h("small", { text: "Klíč " + kl })),
        h("button", { class: "btn btn--txt", type: "button", onclick: async () => {
          if (await potvrd({ nadpis: "Vrátit původní text?", text: "Na webu se znovu zobrazí původní znění tohoto textu.", ok: "Vrátit původní", ikona: "zpet" })) { if (await uloz({ texty: { [kl]: null } }, "Text vrácen do původní podoby.")) vykresli(); }
        } }, ik("zpet"), "Vrátit")))) :
        h("div", { class: "prazdne" }, ik("text"), h("b", { text: "Zatím žádné upravené texty" }), "Klikněte na „Začít upravovat“ a vyberte text na stránce."),
    ];
  }

  /* režim úprav v náhledu */
  let zvyr = null;
  function nastavListu() {
    const t = $("edit-bar-t"); t.replaceChildren(h("b", { text: S.stranka ? S.stranka.nazev : "Web" }), " · Klikněte na text nebo fotku, kterou chcete změnit.");
  }
  function zacniUpravy() {
    if (!cib()) { toast("Náhled stránky se ještě načítá. Zkuste to za okamžik.", "info"); return; }
    S.uprava = true; document.body.classList.add("uprava"); nastavListu();
    window.scrollTo({ top: 0 });
    pripravRamecProUpravy();
    toast("Režim úprav: klikněte na text nebo fotku na stránce.", "info");
  }
  function ukonciUpravy() {
    S.uprava = false; zavriEditor(); document.body.classList.remove("uprava"); skryjZvyrazneni();
    const doc = ramecDoc(); if (doc) doc.documentElement.classList.remove("cib-admin-uprava");
  }
  function ramecDoc() { const w = ramec(); try { return w ? w.document : null; } catch (e) { return null; } }
  function pripravRamecProUpravy() {
    const doc = ramecDoc(); if (!doc) return;
    doc.documentElement.classList.add("cib-admin-uprava");
    if (!doc.getElementById("cib-admin-styl")) {
      const st = doc.createElement("style"); st.id = "cib-admin-styl";
      st.textContent = ".cib-admin-uprava a,.cib-admin-uprava button{cursor:pointer}#cib-admin-zvyr{position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #a17652;border-radius:8px;background:rgba(161,118,82,.08);transition:all .12s ease;display:none}#cib-admin-zvyr span{position:absolute;left:-2px;bottom:100%;margin-bottom:6px;background:#a17652;color:#fff;font:500 12px/1 Jost,system-ui,sans-serif;letter-spacing:.04em;padding:6px 10px;border-radius:8px;white-space:nowrap}";
      doc.head.append(st);
    }
    if (!doc.getElementById("cib-admin-zvyr")) { const z = doc.createElement("div"); z.id = "cib-admin-zvyr"; z.append(doc.createElement("span")); doc.body.append(z); }
    zvyr = doc.getElementById("cib-admin-zvyr");
  }
  function cilVRamci(t) {
    const c = cib(); if (!c || !t) return null;
    let a = t.closest ? t.closest('a[href^="tel:"],a[href^="mailto:"]') : null;
    if (a) {
      let id = null;
      try { const k = (c.kontaktyNaStrance() || []).find((x) => x.el === a || (x.el && x.el.contains && x.el.contains(t))); if (k) id = k.id; } catch (e) { /* nic */ }
      if (!id) { const hr = a.getAttribute("href"); const typ = /^tel:/.test(hr) ? "tel" : "mail"; try { id = c.idKontaktu(typ, decodeURIComponent(hr.replace(/^(tel|mailto):/, ""))); } catch (e) { /* nic */ } }
      if (id) return { druh: "kontakt", el: a, id };
    }
    try {
      const el = c.editovatelny(t);
      if (el) return { druh: "text", el };
      const fot = fotkyRamce().filter((f) => f.el && (f.el === t || (f.el.contains && f.el.contains(t))));
      if (fot.length) {
        fot.sort((x, y) => (x.el.contains(y.el) ? 1 : y.el.contains(x.el) ? -1 : 0)); // nejhlubší prvek první
        return { druh: "fotka", el: fot[0].el, f: fot[0] };
      }
    } catch (e) { /* nic */ }
    return null;
  }
  let fotkyCache = { doc: null, t: 0, l: [] };
  function fotkyRamce() {
    const c = cib(), doc = ramecDoc(); if (!c || !doc) return [];
    if (fotkyCache.doc !== doc || Date.now() - fotkyCache.t > 2000) {
      let l = []; try { l = c.fotkyNaStrance() || []; } catch (e) { l = []; }
      fotkyCache = { doc, t: Date.now(), l };
    }
    return fotkyCache.l;
  }
  function najetiVRamci(e) {
    if (!S.uprava || !zvyr) return;
    const c = cilVRamci(e.target);
    if (!c) { skryjZvyrazneni(); return; }
    const r = c.el.getBoundingClientRect();
    zvyr.style.display = "block";
    zvyr.style.left = (r.left - 6) + "px"; zvyr.style.top = (r.top - 6) + "px";
    zvyr.style.width = (r.width + 12) + "px"; zvyr.style.height = (r.height + 12) + "px";
    zvyr.firstChild.textContent = c.druh === "kontakt" ? "Upravit kontakt" : c.druh === "fotka" ? "Vyměnit fotku" : "Upravit text";
  }
  function skryjZvyrazneni() { if (zvyr) zvyr.style.display = "none"; }
  function klikVRamci(e) {
    aktivita();
    if (!S.uprava) return;
    e.preventDefault(); e.stopPropagation();
    const c = cilVRamci(e.target);
    if (!c) return;
    if (c.druh === "kontakt") { ukonciUpravy(); zvyrazniKontakt(c.id); return; }
    if (c.druh === "fotka") { otevriFotku(c.f); return; }
    otevriEditor(c.el);
  }

  /* editor textu */
  function otevriEditor(el) {
    const c = cib(); if (!c) return;
    const klic = c.klicTextu(el); if (!klic) { toast("Tento text upravit nejde.", "info"); return; }
    S.vybrany = { el, klic, puvodni: cisteHtml(c.puvodniHtml(el)) };
    $("editor-puv").replaceChildren(sanitizuj(S.vybrany.puvodni));
    const pole = $("editor-pole"); pole.replaceChildren(sanitizuj(c.aktualniHtml ? c.aktualniHtml(el) : S.vybrany.puvodni));
    $("editor-vratit").hidden = !Object.prototype.hasOwnProperty.call((S.obsah || {}).texty || {}, klic);
    pocitejZnaky();
    const ed = $("editor"); ed.classList.add("open"); ed.setAttribute("aria-hidden", "false");
    setTimeout(() => { pole.focus(); const r = document.createRange(); r.selectNodeContents(pole); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, 300);
  }
  function zavriEditor() { const ed = $("editor"); ed.classList.remove("open"); ed.setAttribute("aria-hidden", "true"); S.vybrany = null; }
  function pocitejZnaky() { const n = ($("editor-pole").textContent || "").length; $("editor-pocet").textContent = n + " " + (n === 1 ? "znak" : n >= 2 && n <= 4 ? "znaky" : "znaků"); }
  async function ulozText() {
    if (!S.vybrany) return;
    const html = serializuj(sanitizuj($("editor-pole"))).replace(/(<br>)+$/, "").trim();
    if (!jenText(html)) { toast("Text nemůže být prázdný. Pro vrácení použijte „Vrátit původní text“.", "err"); return; }
    if (html.length > 5000) { toast("Text je příliš dlouhý (max. 5 000 znaků).", "err"); return; }
    const hodnota = html === S.vybrany.puvodni ? null : html;
    const b = $("editor-ulozit"); b.disabled = true;
    if (await uloz({ texty: { [S.vybrany.klic]: hodnota } }, hodnota ? "Text uložen a zveřejněn." : "Text je zase původní.")) { zavriEditor(); if (!S.uprava) vykresli(); }
    b.disabled = false;
  }
  async function vratText() {
    if (!S.vybrany) return;
    if (await uloz({ texty: { [S.vybrany.klic]: null } }, "Text vrácen do původní podoby.")) zavriEditor();
  }

  /* FOTKY */
  function pFotky() {
    const c = cib(), o = S.obsah || prazdnyObsah();
    let fotky = null;
    if (c && typeof c.fotkyNaStrance === "function") { try { fotky = c.fotkyNaStrance() || []; } catch (e) { fotky = []; } }
    const unik = []; const videne = new Set();
    for (const f of fotky || []) if (f && f.klic && !videne.has(f.klic)) { videne.add(f.klic); unik.push(f); }
    const mrizka = fotky === null
      ? h("div", { class: "fotky" }, Array.from({ length: 8 }, () => h("div", { class: "fotka skeleton" })))
      : unik.length ? h("div", { class: "fotky" }, unik.map((f) => {
        const zm = Object.prototype.hasOwnProperty.call(o.fotky, f.klic);
        const src = zm && c.urlSouboru ? c.urlSouboru(o.fotky[f.klic]) : f.url;
        return h("button", { class: "fotka" + (/logo|brand|monogram|ico|ikon/.test(f.klic) ? " fotka--logo" : ""), type: "button", "aria-label": "Vyměnit fotku " + f.klic, onclick: () => otevriFotku(f) },
          h("img", { src, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" }),
          zm ? h("span", { class: "fotka__zn", text: "Vyměněno" }) : null,
          h("span", { class: "fotka__pas" }, h("span", { text: f.klic }), h("i", null, ik("nahrat"))));
      })) : h("div", { class: "prazdne" }, ik("foto"), h("b", { text: "Na této stránce nejsou žádné fotky k výměně" }), "Vyberte jinou stránku v kartách nahoře.");
    return [
      hlavicka("Fotky", "Fotky stránky „" + (S.stranka ? S.stranka.nazev : "") + "“. Klikněte na fotku a nahrajte novou – na webu se vymění hned.",
        h("button", { class: "btn btn--o", type: "button", onclick: () => { prepniTab("texty"); zacniUpravy(); } }, ik("kurzor"), "Vybrat přímo na stránce")),
      mrizka,
    ];
  }
  function otevriFotku(f) {
    const c = cib(), o = S.obsah || prazdnyObsah();
    S.fotka = f; S.novaFotka = null;
    const zm = Object.prototype.hasOwnProperty.call(o.fotky, f.klic);
    const src = zm && c && c.urlSouboru ? c.urlSouboru(o.fotky[f.klic]) : f.url;
    $("dlg-fotka-t").textContent = "Vyměnit fotku";
    $("dlg-fotka-ted").replaceChildren(h("img", { src, alt: "Současná fotka", referrerpolicy: "no-referrer" }));
    const nova = $("dlg-fotka-nova"); nova.className = "ram ram--prazdny"; nova.replaceChildren("Zatím nevybráno – klikněte na „Vybrat fotku“.");
    $("dlg-fotka-ulozit").disabled = true;
    $("dlg-fotka-vratit").hidden = !zm;
    $("dlg-fotka-prubeh").hidden = true;
    $("dlg-fotka-soubor").value = "";
    $("dlg-fotka").showModal();
    $("dlg-fotka-vybrat").focus();
  }
  async function zmensi(soubor) {
    if (!/^image\/(jpeg|png|webp)$/.test(soubor.type)) throw new Error("Podporované jsou jen fotky JPG, PNG a WebP.");
    if (soubor.size > 40 * 1024 * 1024) throw new Error("Soubor je příliš velký (max. 40 MB).");
    const bmp = await createImageBitmap(soubor);
    const k = Math.min(1, MAX_FOTKA / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), v = Math.round(bmp.height * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = v;
    const ctx = cv.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, v);
    if (bmp.close) bmp.close();
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new Error("Fotku se nepodařilo zpracovat.");
    if (blob.size > 8 * 1024 * 1024) throw new Error("Ani po zmenšení se fotka nevešla do 8 MB.");
    return { blob, w, v };
  }
  async function vybranaFotka() {
    const s = $("dlg-fotka-soubor").files[0]; if (!s) return;
    const nova = $("dlg-fotka-nova"); nova.className = "ram"; nova.replaceChildren(h("span", { class: "tocka", "aria-hidden": "true" }));
    try {
      const z = await zmensi(s);
      S.novaFotka = z;
      if (S.novaUrl) URL.revokeObjectURL(S.novaUrl);
      S.novaUrl = URL.createObjectURL(z.blob);
      nova.replaceChildren(h("img", { src: S.novaUrl, alt: "Nová fotka" }));
      $("dlg-fotka-p").textContent = "Nová fotka " + z.w + " × " + z.v + " px, " + Math.round(z.blob.size / 1024) + " kB. Po nahrání se na webu vymění na všech místech.";
      $("dlg-fotka-ulozit").disabled = false; $("dlg-fotka-ulozit").focus();
    } catch (e) {
      S.novaFotka = null; nova.className = "ram ram--prazdny"; nova.replaceChildren(e.message || "Fotku se nepodařilo načíst.");
      $("dlg-fotka-ulozit").disabled = true;
    }
  }
  async function nahrajFotku() {
    if (!S.novaFotka || !S.fotka) return;
    const b = $("dlg-fotka-ulozit"); b.disabled = true;
    const pr = $("dlg-fotka-prubeh"), pi = $("dlg-fotka-prubeh-i"); pr.hidden = false; pi.style.width = "35%";
    try {
      const r = await api("/soubor", { metoda: "POST", telo: S.novaFotka.blob, typ: "image/jpeg" });
      pi.style.width = "80%";
      if (!r || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(r.id || "")) throw new Error("Server vrátil neplatnou odpověď.");
      if (await uloz({ fotky: { [S.fotka.klic]: r.id } }, "Fotka vyměněna a zveřejněna.")) {
        pi.style.width = "100%";
        $("dlg-fotka").close();
        if (S.tab === "fotky" && !S.uprava) vykresli();
      }
    } catch (e) { if (e.status !== 401) toast(e.message, "err", 6000); }
    finally { b.disabled = !S.novaFotka; setTimeout(() => { pr.hidden = true; pi.style.width = "0"; }, 500); }
  }
  async function vratFotku() {
    if (!S.fotka) return;
    if (await uloz({ fotky: { [S.fotka.klic]: null } }, "Fotka vrácena na původní.")) { $("dlg-fotka").close(); if (S.tab === "fotky" && !S.uprava) vykresli(); }
  }
  function ukazFotkuNaStrance() {
    if (!S.fotka || !S.fotka.el) return;
    $("dlg-fotka").close();
    try { S.fotka.el.scrollIntoView({ block: "center" }); } catch (e) { /* nic */ }
    if (!S.uprava) { prepniTab("texty"); zacniUpravy(); }
  }

  /* HISTORIE */
  async function nactiHistorii(tiche) {
    try { const d = await api("/historie"); S.historie = (d && Array.isArray(d.polozky)) ? d.polozky : []; }
    catch (e) { if (!tiche && e.status !== 401) toast(e.message, "err"); S.historie = S.historie || []; }
    if (S.tab === "prehled" || S.tab === "historie") vykresli();
  }
  function pHistorie() {
    if (!S.historie) { nactiHistorii(); return [hlavicka("Historie", "Každá uložená změna – kdo, kdy a odkud. Kteroukoli verzi můžete obnovit."), h("div", { class: "nacitam" }, h("span", { class: "tocka" }), "Načítám historii…")]; }
    const akt = S.obsah ? S.obsah.verze : null;
    return [
      hlavicka("Historie", "Každá uložená změna – kdo, kdy a odkud. Kteroukoli verzi můžete obnovit, nic se neztratí.",
        h("button", { class: "btn btn--o", type: "button", onclick: () => { S.historie = null; vykresli(); } }, ik("obnovit"), "Načíst znovu")),
      S.historie.length ? h("ol", { class: "osa" }, S.historie.map((v) => h("li", { class: v.verze === akt ? "akt" : "" },
        h("div", { class: "verze" },
          h("div", null,
            h("div", { class: "verze__h" }, h("b", { text: "Verze " + v.verze }), v.verze === akt ? h("span", { class: "typ typ--ok", text: "Právě na webu" }) : null),
            h("p", { class: "verze__m" }, h("span", null, ik("historie"), cas(v.cas)), h("span", null, ik("klic"), v.jmeno || "–"), h("span", null, ik("mista"), (v.ip || "–") + " · " + vlajka(v.zeme))),
            Array.isArray(v.popis) && v.popis.length ? h("ul", null, v.popis.slice(0, 8).map((p) => h("li", { text: String(p) }))) : null),
          v.verze !== akt ? h("button", { class: "btn btn--o", type: "button", onclick: () => obnov(v) }, ik("zpet"), "Obnovit tuto verzi") : null)))) :
        h("div", { class: "prazdne" }, ik("historie"), h("b", { text: "Zatím žádné změny" }), "Po prvním uložení se tu objeví záznam."),
    ];
  }
  async function obnov(v) {
    const ok = await potvrd({ nadpis: "Obnovit verzi " + v.verze + "?", text: "Web se vrátí do stavu z " + cas(v.cas) + ". Současný stav zůstane v historii, takže se k němu můžete kdykoli vrátit.", ok: "Obnovit verzi", ikona: "zpet" });
    if (!ok) return;
    try {
      const o = await api("/obnovit", { metoda: "POST", telo: { verze: v.verze } });
      S.obsah = normalizujObsah(o); aplikujNahled(); toast("Verze " + v.verze + " obnovena a zveřejněna.", "ok");
      S.historie = null; vykresli();
    } catch (e) { if (e.status !== 401) toast(e.message, "err", 6000); }
  }

  /* ZABEZPEČENÍ */
  async function nactiBezpecnost() {
    const [ja, ak] = await Promise.allSettled([api("/ja"), api("/aktivita")]);
    if (ja.status === "fulfilled") S.ja = ja.value;
    S.aktivita = ak.status === "fulfilled" && ak.value && Array.isArray(ak.value.polozky) ? ak.value.polozky : [];
    if (S.tab === "zabezpeceni") vykresli();
  }
  function pZabezpeceni() {
    if (!S.aktivita) { nactiBezpecnost(); }
    const ja = S.ja || {}, rel = ja.relace || {}, pr = ja.predchozi;
    const udaje = (radky) => h("dl", { class: "udaje" }, radky.map(([a, b]) => h("div", null, h("dt", { text: a }), h("dd", { text: b }))));
    const OCHRANY = [
      ["Dvoufázové ověření", "Kromě hesla je potřeba kód z aplikace v telefonu."],
      ["Hesla jen jako otisk", "Heslo se nikde neukládá, server zná jen jeho PBKDF2 otisk."],
      ["Zámek proti hádání", "Po opakovaných neúspěšných pokusech se přihlášení zamkne."],
      ["Šifrované spojení", "Vše jde přes HTTPS, administrace nepoužívá cookies."],
      ["Automatické odhlášení", "Po 30 minutách nečinnosti nebo zavření okna."],
      ["Historie všech změn", "Každá úprava je dohledatelná a jde vrátit."],
      ["Ochrana stránky", "Administraci nejde vložit do cizí stránky, vyhledávače ji nevidí."],
    ];
    const TYPY = { prihlaseni: ["Přihlášení", "typ--ok"], neuspech: ["Neúspěšný pokus", "typ--err"], zamceno: ["Zamčeno", "typ--err"], odhlaseni: ["Odhlášení", "typ--mut"], zmena: ["Změna obsahu", "typ--b"], obnoveni: ["Obnovení verze", "typ--b"] };
    return [
      hlavicka("Zabezpečení", "Kdo a odkud se přihlašuje a jak je administrace chráněná.",
        h("button", { class: "btn btn--err", type: "button", onclick: odhlasVsude }, ik("odhlasit"), "Odhlásit všude")),
      h("div", { class: "g3" },
        h("div", { class: "karta" }, h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik("zarizeni")), h("div", null, h("h3", { class: "karta__t", text: "Toto přihlášení" }), h("p", { class: "karta__s", text: prohlizec(navigator.userAgent) }))),
          udaje([["Uživatel", ja.jmeno || S.jmeno || "–"], ["Přihlášen", rel.vytvoreno ? cas(rel.vytvoreno) : "–"], ["Odkud", (rel.ip || "–") + " · " + vlajka(rel.zeme)], ["Platí nejdéle do", (ja.plati_do || S.platiDo) ? cas(ja.plati_do || S.platiDo) : "–"]])),
        h("div", { class: "karta" }, h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik("historie")), h("div", null, h("h3", { class: "karta__t", text: "Předchozí přihlášení" }), h("p", { class: "karta__s", text: "Nepoznáváte ho? Odhlaste všude a dejte vědět správci." }))),
          pr ? udaje([["Kdy", cas(pr.cas)], ["Odkud", (pr.ip || "–") + " · " + vlajka(pr.zeme)]]) : h("p", { class: "karta__s", text: "Toto je první přihlášení." })),
        h("div", { class: "karta" }, h("div", { class: "karta__h" }, h("span", { class: "karta__ik" }, ik("stit")), h("div", null, h("h3", { class: "karta__t", text: "Ochrany" }), h("p", { class: "karta__s", text: "Vše aktivní" }))),
          h("ul", { class: "ochrany" }, OCHRANY.map(([t, s]) => h("li", null, h("span", { class: "ochrany__ok" }, ik("check")), h("span", null, t, h("small", { text: s }))))))),
      h("h3", { class: "skupina__t" }, "Záznam aktivity", h("span", { text: S.aktivita ? String(S.aktivita.length) : "…" })),
      !S.aktivita ? h("div", { class: "nacitam" }, h("span", { class: "tocka" }), "Načítám záznam…") :
        S.aktivita.length ? h("div", { class: "tab-wrap" }, h("table", { class: "log" },
          h("thead", null, h("tr", null, ["Kdy", "Událost", "Uživatel", "Odkud", "Zařízení"].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", null, S.aktivita.map((a) => { const t = TYPY[a.typ] || [a.typ, "typ--mut"]; return h("tr", null, h("td", { text: cas(a.cas) }), h("td", null, h("span", { class: "typ " + t[1], text: t[0] })), h("td", { text: a.jmeno || "–" }), h("td", { text: (a.ip || "–") + " · " + vlajka(a.zeme) }), h("td", { text: prohlizec(a.ua) })); })))) :
          h("div", { class: "prazdne" }, ik("stit"), h("b", { text: "Záznam je prázdný" }), "Přihlášení a změny se tu budou zapisovat."),
    ];
  }
  async function odhlasVsude() {
    const ok = await potvrd({ nadpis: "Odhlásit všechna zařízení?", text: "Ukončíme všechna přihlášení k administraci, včetně tohoto. Potom se znovu přihlásíte heslem a kódem.", ok: "Odhlásit všude", nebezpecne: true, ikona: "odhlasit" });
    if (!ok) return;
    try { const r = await api("/odhlasit-vsude", { metoda: "POST" }); odhlasMistne("Odhlášeno ze všech zařízení (" + ((r && r.zruseno) || 0) + "). Přihlaste se znovu."); }
    catch (e) { if (e.status !== 401) toast(e.message, "err"); }
  }

  /* ───────── navázání událostí ───────── */
  function init() {
    try { document.execCommand("styleWithCSS", false, false); } catch (e) { /* nic */ }
    naplnDuveru();
    $("btn-web").append(ik("web"));
    $("btn-odhlasit").append(ik("odhlasit"));
    $("editor-x").append(ik("x"));
    $("login-form").addEventListener("submit", prihlas);
    $("l-kod").addEventListener("input", (e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); if (v !== e.target.value) e.target.value = v; if (v.length === 6 && $("l-jmeno").value && $("l-heslo").value) $("login-form").requestSubmit(); });
    $("l-oko").addEventListener("click", () => {
      const i = $("l-heslo"), vid = i.type === "password";
      i.type = vid ? "text" : "password";
      $("l-oko").setAttribute("aria-pressed", String(vid)); $("l-oko").setAttribute("aria-label", vid ? "Skrýt heslo" : "Zobrazit heslo");
      $("l-oko").replaceChildren(ik(vid ? "oko-ne" : "oko"));
    });
    $("pills").addEventListener("click", (e) => { const b = e.target.closest(".pill"); if (b) prepniTab(b.dataset.tab, true); });
    $("pills").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const p = [...document.querySelectorAll(".pill")], i = p.findIndex((x) => x.getAttribute("aria-selected") === "true");
      const n = p[(i + (e.key === "ArrowRight" ? 1 : p.length - 1)) % p.length]; n.focus(); prepniTab(n.dataset.tab);
    });
    $("btn-odhlasit").addEventListener("click", () => odhlas());
    $("edit-hotovo").addEventListener("click", () => { ukonciUpravy(); vykresli(); });
    $("editor-x").addEventListener("click", zavriEditor);
    $("editor-ulozit").addEventListener("click", ulozText);
    $("editor-vratit").addEventListener("click", vratText);
    const pole = $("editor-pole");
    pole.addEventListener("input", pocitejZnaky);
    pole.addEventListener("paste", (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData("text/plain"); document.execCommand("insertText", false, t); });
    pole.addEventListener("drop", (e) => e.preventDefault());
    pole.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ulozText(); return; }
      if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); }
      if (e.key === "Escape") zavriEditor();
    });
    document.querySelectorAll(".nastroje button").forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));
    document.querySelectorAll(".nastroje button").forEach((b) => b.addEventListener("click", () => {
      pole.focus();
      if (b.dataset.cmd === "br") document.execCommand("insertLineBreak"); else document.execCommand(b.dataset.cmd);
    }));
    $("dlg-fotka-vybrat").addEventListener("click", () => $("dlg-fotka-soubor").click());
    $("dlg-fotka-soubor").addEventListener("change", vybranaFotka);
    $("dlg-fotka-ulozit").addEventListener("click", nahrajFotku);
    $("dlg-fotka-vratit").addEventListener("click", vratFotku);
    $("dlg-fotka-zavrit").addEventListener("click", () => $("dlg-fotka").close());
    $("dlg-fotka-ukaz").addEventListener("click", ukazFotkuNaStrance);
    $("nahled").addEventListener("load", poNacteniRamce);
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => document.addEventListener(t, aktivita, { passive: true, capture: true }));
    window.addEventListener("scroll", () => $("app").classList.toggle("scrolled", window.scrollY > 40), { passive: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.uprava && !$("editor").classList.contains("open") && !document.querySelector("dialog[open]")) { ukonciUpravy(); vykresli(); } });
    // obnova relace v rámci karty prohlížeče
    let ul = null;
    try { ul = JSON.parse(sessionStorage.getItem(KLIC) || "null"); } catch (e) { ul = null; }
    if (ul && ul.t && (!ul.p || Date.parse(ul.p) > Date.now())) {
      S.token = ul.t; S.jmeno = ul.j || ""; S.platiDo = ul.p || null;
      spust().catch(() => odhlasMistne("Přihlaste se prosím znovu."));
    } else {
      try { sessionStorage.removeItem(KLIC); } catch (e) { /* nic */ }
      ukazPrihlaseni();
    }
  }
  init();
})();

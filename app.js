/* Витрина Волейкон — каталог из ДВУХ источников: products.json (мой) + Google-таблица (твоя) */
const MANAGER = "offangle1";
// Когда заведёшь Google-таблицу — вставь сюда её CSV-ссылку ("Файл → Поделиться → Опубликовать в интернете → CSV").
const SHEET_CSV_URL = "";

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }

const $ = (s,r=document)=>r.querySelector(s);
let ALL = [], FILTER = "all";

const SPORT = { volley:"Волейбол", basket:"Баскет", "волейбол":"Волейбол", "баскет":"Баскет", "баскетбол":"Баскет" };
const normSport = v => { v=(v||"").toLowerCase().trim();
  if(v.startsWith("вол")||v==="volley"||v==="volleyball") return "volley";
  if(v.startsWith("баск")||v==="basket"||v==="basketball") return "basket"; return ""; };

function parseCSV(text){
  const rows=[]; let i=0,f="",row=[],q=false;
  const push=()=>{row.push(f);f="";}; const end=()=>{push();rows.push(row);row=[];};
  while(i<text.length){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else { if(c==='"')q=true; else if(c===',')push(); else if(c==='\n')end(); else if(c==='\r'){} else f+=c; }
    i++; }
  if(f.length||row.length) end();
  return rows.filter(r=>r.some(x=>x&&x.trim()));
}
function csvToProducts(text){
  const rows=parseCSV(text); if(rows.length<2) return [];
  const head=rows[0].map(h=>h.toLowerCase().trim());
  const idx=n=>head.findIndex(h=>h.includes(n));
  const c={img:idx("фото"),model:idx("модел"),brand:idx("бренд"),sport:idx("спорт"),
    cw:idx("расцвет")>-1?idx("расцвет"):idx("цвет"),sizes:idx("размер"),price:idx("цена"),
    stock:idx("налич")>-1?idx("налич"):idx("сток"),note:idx("примеч")};
  return rows.slice(1).map(r=>({
    img:(r[c.img]||"").trim(), model:(r[c.model]||"").trim(), brand:(r[c.brand]||"").trim(),
    sport:(r[c.sport]||"").trim(), colorway:(r[c.cw]||"").trim(), sizes:(r[c.sizes]||"").trim(),
    price:(r[c.price]||"").trim(), stock:(r[c.stock]||"").trim(), note:(r[c.note]||"").trim()
  })).filter(p=>p.model);
}

async function load(){
  let mine=[], sheet=[];
  try{ mine=await (await fetch("products.json?t="+Date.now())).json(); }catch(e){}
  if(SHEET_CSV_URL){ try{ sheet=csvToProducts(await (await fetch(SHEET_CSV_URL)).text()); }catch(e){} }
  ALL=[...mine,...sheet].map(p=>({...p, _sport:normSport(p.sport),
    _in:/налич/i.test(p.stock||"")}));
  buildFilters(); render();
}

function buildFilters(){
  const brands=[...new Set(ALL.map(p=>p.brand).filter(Boolean))];
  const f=$("#filters");
  const defs=[["all","Все"],["volley","Волейбол"],["basket","Баскет"],["in","В наличии"]];
  f.innerHTML="";
  defs.concat(brands.map(b=>["b:"+b,b])).forEach(([k,label])=>{
    const el=document.createElement("button"); el.className="chip"+(k===FILTER?" active":"");
    el.textContent=label; el.onclick=()=>{FILTER=k;[...f.children].forEach(c=>c.classList.remove("active"));
      el.classList.add("active");render();}; f.appendChild(el);
  });
}

function match(p){
  if(FILTER==="all")return true;
  if(FILTER==="in")return p._in;
  if(FILTER==="volley"||FILTER==="basket")return p._sport===FILTER;
  if(FILTER.startsWith("b:"))return p.brand===FILTER.slice(2);
  return true;
}

function order(p){
  const txt=encodeURIComponent(`Здравствуйте! Интересует ${p.model}${p.colorway?" ("+p.colorway+")":""}. Подскажите по наличию и размеру.`);
  const url=`https://t.me/${MANAGER}?text=${txt}`;
  if(tg&&tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url,"_blank");
}

function render(){
  const g=$("#grid"); const list=ALL.filter(match);
  if(!list.length){ g.innerHTML=`<div class="empty">Пока пусто в этом разделе.<br>Загляни позже 👟</div>`; return; }
  g.innerHTML="";
  list.forEach(p=>{
    const card=document.createElement("div"); card.className="card";
    const badge=p._in?`<span class="badge in">в наличии</span>`:`<span class="badge order">под заказ</span>`;
    const brand=p.brand?`<span class="brand">${p.brand}</span>`:"";
    const img=p.img?`<img src="${p.img}" alt="${p.model}" loading="lazy" onerror="this.style.display='none'">`:"";
    card.innerHTML=`
      <div class="ph">${badge}${brand}${img}</div>
      <div class="info">
        <div class="model">${p.model}</div>
        ${p.colorway?`<div class="cw">${p.colorway}</div>`:""}
        <div class="sz">Размеры: <b>${p.sizes||"уточняйте"}</b></div>
        ${p.note?`<div class="note">${p.note}</div>`:""}
        <button class="buy">ЗАКАЗАТЬ</button>
      </div>`;
    card.querySelector(".buy").onclick=()=>order(p);
    g.appendChild(card);
  });
}
load();

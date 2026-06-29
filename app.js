/* Витрина Волейкон — каталог из ДВУХ источников: products.json (мой) + Google-таблица (твоя).
   Карточки группируются по модель+бренд+цвет → если одна модель/цвет в разных размерах,
   показывается выбор размера. В заказ уходит модель, бренд, цвет, размер и ссылка на фото. */
const MANAGER = "offangle1";
// Google-таблица (опубликованный CSV) — твой self-service источник:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQij-lusvUZ3fYANfXCwtnYeSayYkOjnI3fEjNuiUMHSB-3R9d41PztPsn_gLZuDT91bo0cBhis92Zy/pub?gid=0&single=true&output=csv";

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }
const $ = (s,r=document)=>r.querySelector(s);
let GROUPS = [], FILTER = "all";

const inStock = s => /налич/i.test(s||"");
const splitSizes = s => (Array.isArray(s)?s.join(","):(s||"")).split(/[,;/]+/).map(x=>x.trim()).filter(Boolean);
const isNumSize = t => /^\d{2}([.,]\d)?(\s?eu)?$/i.test(String(t).replace(",","."));

function parseCSV(text){
  const rows=[]; let i=0,f="",row=[],q=false;
  const push=()=>{row.push(f);f="";}, end=()=>{push();rows.push(row);row=[];};
  while(i<text.length){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else { if(c==='"')q=true; else if(c===',')push(); else if(c==='\n')end(); else if(c==='\r'){} else f+=c; }
    i++; }
  if(f.length||row.length) end();
  return rows.filter(r=>r.some(x=>x&&x.trim()));
}
function csvToProducts(text){
  const rows=parseCSV(text); if(rows.length<2) return [];
  const head=rows[0].map(h=>h.toLowerCase().trim()), idx=n=>head.findIndex(h=>h.includes(n));
  const c={img:idx("фото"),model:idx("модел"),brand:idx("бренд"),
    cw:idx("расцвет")>-1?idx("расцвет"):idx("цвет"),sizes:idx("размер"),
    stock:idx("налич")>-1?idx("налич"):idx("сток"),note:idx("примеч")};
  return rows.slice(1).map(r=>({img:(r[c.img]||"").trim(),model:(r[c.model]||"").trim(),
    brand:(r[c.brand]||"").trim(),colorway:(r[c.cw]||"").trim(),sizes:(r[c.sizes]||"").trim(),
    stock:(r[c.stock]||"").trim(),note:(r[c.note]||"").trim()})).filter(p=>p.model);
}

async function load(){
  let mine=[], sheet=[];
  try{ mine=await (await fetch("products.json?t="+Date.now())).json(); }catch(e){}
  if(SHEET_CSV_URL){ try{ sheet=csvToProducts(await (await fetch(SHEET_CSV_URL)).text()); }catch(e){} }
  const all=[...mine,...sheet].filter(p=>p&&p.model);
  const map=new Map();
  all.forEach(p=>{
    const key=[(p.brand||"").toLowerCase().trim(),(p.model||"").toLowerCase().trim(),(p.colorway||"").toLowerCase().trim()].join("|");
    let g=map.get(key);
    if(!g){ g={model:p.model,brand:p.brand||"",colorway:p.colorway||"",img:p.img||"",note:p.note||"",_sz:new Set(),under:false,inStock:false}; map.set(key,g); }
    splitSizes(p.sizes).forEach(t=>{ isNumSize(t)?g._sz.add(t.replace(".",",")):g.under=true; });
    if(inStock(p.stock)) g.inStock=true;
    if(!g.img&&p.img) g.img=p.img; if(!g.note&&p.note) g.note=p.note;
  });
  GROUPS=[...map.values()].map(g=>({...g,sizes:[...g._sz].sort((a,b)=>parseFloat(a.replace(",","."))-parseFloat(b.replace(",",".")))}));
  buildFilters(); render();
}

function buildFilters(){
  const brands=[...new Set(GROUPS.map(g=>g.brand).filter(Boolean))];
  const defs=[["all","Все"],["in","В наличии"]].concat(brands.map(b=>["b:"+b,b]));
  const f=$("#filters"); f.innerHTML="";
  defs.forEach(([k,label])=>{ const el=document.createElement("button");
    el.className="chip"+(k===FILTER?" active":""); el.textContent=label;
    el.onclick=()=>{FILTER=k;[...f.children].forEach(c=>c.classList.remove("active"));el.classList.add("active");render();};
    f.appendChild(el); });
}
const match=g=> FILTER==="all"?true : FILTER==="in"?g.inStock : FILTER.startsWith("b:")?g.brand===FILTER.slice(2):true;

function order(g,size){
  const parts=["Здравствуйте! Хочу заказать пару:", "Модель: "+g.model];
  if(g.brand) parts.push("Бренд: "+g.brand);
  if(g.colorway) parts.push("Цвет: "+g.colorway);
  parts.push("Размер: "+(size||(g.sizes[0]||"уточню")));
  if(g.img){ try{ parts.push("Фото: "+new URL(g.img,location.href).href); }catch(e){} }
  const url="https://t.me/"+MANAGER+"?text="+encodeURIComponent(parts.join("\n"));
  if(tg&&tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url,"_blank");
}

function render(){
  const wrap=$("#grid"), list=GROUPS.filter(match);
  if(!list.length){ wrap.innerHTML='<div class="empty">Пока пусто в этом разделе 👟</div>'; return; }
  wrap.innerHTML="";
  list.forEach(g=>{
    const card=document.createElement("div"); card.className="card";
    const badge=g.inStock?'<span class="badge in">в наличии</span>':'<span class="badge order">под заказ</span>';
    const brand=g.brand?`<span class="brand">${g.brand}</span>`:"";
    const img=g.img?`<img src="${g.img}" loading="lazy" onerror="this.style.display='none'">`:"";
    let sz = g.sizes.length
      ? `<div class="szlabel">Размер:</div><div class="szrow">${g.sizes.map((s,i)=>`<button class="szchip${i===0?' sel':''}" data-s="${s}">${s}</button>`).join("")}</div>`
      : `<div class="szlabel under">под заказ · любой размер</div>`;
    card.innerHTML=`<div class="ph">${badge}${brand}${img}</div>
      <div class="info"><div class="model">${g.model}</div>
      ${g.colorway?`<div class="cw">${g.colorway}</div>`:""}
      ${sz}${g.note?`<div class="note">${g.note}</div>`:""}
      <button class="buy">ЗАКАЗАТЬ</button></div>`;
    let sel=g.sizes[0]||"";
    card.querySelectorAll(".szchip").forEach(ch=>ch.onclick=()=>{card.querySelectorAll(".szchip").forEach(c=>c.classList.remove("sel"));ch.classList.add("sel");sel=ch.dataset.s;});
    card.querySelector(".buy").onclick=()=>order(g,sel);
    wrap.appendChild(card);
  });
}
load();

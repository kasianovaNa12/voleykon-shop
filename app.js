/* Витрина Волейкон — каталог из ДВУХ источников: products.json (мой) + Google-таблица (твоя).
   Размерные сетки по брендам (≈Poizon, через длину стопы в см): EU / US / см.
   Карточки группируются по модель+бренд+цвет; на карточке выбор размера, в заказ уходят все типы. */
const MANAGER = "offangle1";
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQij-lusvUZ3fYANfXCwtnYeSayYkOjnI3fEjNuiUMHSB-3R9d41PztPsn_gLZuDT91bo0cBhis92Zy/pub?gid=0&single=true&output=csv";

/* Размерные сетки (мужские, см = длина стопы). По вводу EU показываем US и см. */
const GRIDS = {
  nike: [["38.5","6",24],["39","6.5",24.5],["40","7",25],["40.5","7.5",25.5],["41","8",26],["42","8.5",26.5],["42.5","9",27],["43","9.5",27.5],["44","10",28],["44.5","10.5",28.5],["45","11",29],["45.5","11.5",29.5],["46","12",30],["47","12.5",30.5],["47.5","13",31]],
  anta: [["39","6.5",24.5],["40","7",25],["41","8",25.5],["42","8.5",26],["42.5","9",26.5],["43","9.5",27],["44","10",27.5],["44.5","10.5",28],["45","11",28.5],["46","12",29],["47","13",30]],
  lining: [["38.5","6",23.5],["39","6.5",24],["40","7",24.5],["40.5","7.5",25],["41","8",25.5],["42","8.5",26],["42.5","9",26.5],["43","9.5",27],["44","10",27.5],["44.5","10.5",28],["45","11",28.5],["46","11.5",29]],
  mizuno: [["38","7.5",24],["38.5","8",24.5],["39.5","8.5",25],["40","9",25.5],["40.5","9.5",26],["41","10",26.5],["42","10.5",27],["42.5","11",27.5],["43","11.5",28],["44","12",28.5],["44.5","12.5",29]]
};
const GRID_NAME = {nike:"Nike / Jordan", anta:"Anta", lining:"Li-Ning", mizuno:"Mizuno", default:"стандарт"};
GRIDS.default = GRIDS.nike;
function brandKey(b){ b=(b||"").toLowerCase().replace(/[\s\-_'’]/g,"");
  if(/jordan|nike/.test(b)) return "nike";
  if(/lining|wayofwade|wow/.test(b)) return "lining";
  if(/anta|peak|361|kai|kt/.test(b)) return "anta";
  if(/mizuno/.test(b)) return "mizuno";
  return "default"; }

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }
const $ = (s,r=document)=>r.querySelector(s);
let GROUPS = [], FILTER = "all";

const inStock = s => /налич/i.test(s||"");
const splitSizes = s => (Array.isArray(s)?s.join(","):(s||"")).split(/[,;/]+/).map(x=>x.trim()).filter(Boolean);
const isNumSize = t => /^\d{2}([.,]\d)?(\s?eu)?$/i.test(String(t).replace(",","."));
const euNorm = t => String(t).replace(",",".").replace(/\s?eu/i,"").trim();

function convert(eu, key){
  const grid = GRIDS[key] || GRIDS.default;
  const e = parseFloat(euNorm(eu));
  let best=null, bd=1e9;
  grid.forEach(r=>{ const d=Math.abs(parseFloat(r[0])-e); if(d<bd){bd=d;best=r;} });
  if(best && bd<=0.4) return {eu:euNorm(eu).replace(".",","), us:best[1], cm:best[2]};
  return {eu:euNorm(eu).replace(".",","), us:"", cm:""};
}

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
    if(!g){ g={model:p.model,brand:p.brand||"",colorway:p.colorway||"",img:p.img||"",note:p.note||"",_eu:new Set(),under:false,inStock:false}; map.set(key,g); }
    splitSizes(p.sizes).forEach(t=>{ isNumSize(t)?g._eu.add(euNorm(t)):g.under=true; });
    if(inStock(p.stock)) g.inStock=true;
    if(!g.img&&p.img) g.img=p.img; if(!g.note&&p.note) g.note=p.note;
  });
  GROUPS=[...map.values()].map(g=>{ const key=brandKey(g.brand);
    const sizes=[...g._eu].sort((a,b)=>parseFloat(a)-parseFloat(b)).map(eu=>convert(eu,key));
    return {...g, key, gridName:GRID_NAME[key]||GRID_NAME.default, sizes}; });
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

function order(g,s){
  const parts=["Здравствуйте! Хочу заказать пару:", "Модель: "+g.model];
  if(g.brand) parts.push("Бренд: "+g.brand);
  if(g.colorway) parts.push("Цвет: "+g.colorway);
  if(s && s.eu){ let r="Размер: EU "+s.eu; if(s.us) r+=" / US "+s.us; if(s.cm) r+=" / "+s.cm+" см"; parts.push(r); }
  else parts.push("Размер: уточню (под заказ)");
  const url="https://t.me/"+MANAGER+"?text="+encodeURIComponent(parts.join("\n"));
  if(tg&&tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url,"_blank");
}
const convLine = s => s ? `EU ${s.eu}${s.us?" · US "+s.us:""}${s.cm?" · "+s.cm+" см":""}` : "";

function render(){
  const wrap=$("#grid"), list=GROUPS.filter(match);
  if(!list.length){ wrap.innerHTML='<div class="empty">Пока пусто в этом разделе 👟</div>'; return; }
  wrap.innerHTML="";
  list.forEach(g=>{
    const card=document.createElement("div"); card.className="card";
    const badge=g.inStock?'<span class="badge in">в наличии</span>':'<span class="badge order">под заказ</span>';
    const brand=g.brand?`<span class="brand">${g.brand}</span>`:"";
    const img=g.img?`<img src="${g.img}" loading="lazy" onerror="this.style.display='none'">`:"";
    let sz, conv="";
    if(g.sizes.length){
      conv=convLine(g.sizes[0]);
      sz=`<div class="szlabel">Размер (EU):</div><div class="szrow">${g.sizes.map((s,i)=>`<button class="szchip${i===0?' sel':''}" data-i="${i}">${s.eu}</button>`).join("")}</div>
          <div class="szconv">${conv}</div><div class="gridnote">сетка: ${g.gridName}</div>`;
    } else {
      sz=`<div class="szlabel under">под заказ · любой размер</div>`;
    }
    card.innerHTML=`<div class="ph">${badge}${brand}${img}</div>
      <div class="info"><div class="model">${g.model}</div>
      ${g.colorway?`<div class="cw">${g.colorway}</div>`:""}
      ${sz}${g.note?`<div class="note">${g.note}</div>`:""}
      <button class="buy">ЗАКАЗАТЬ</button></div>`;
    let sel=g.sizes[0]||null;
    const convEl=card.querySelector(".szconv");
    card.querySelectorAll(".szchip").forEach(ch=>ch.onclick=()=>{
      card.querySelectorAll(".szchip").forEach(c=>c.classList.remove("sel")); ch.classList.add("sel");
      sel=g.sizes[+ch.dataset.i]; if(convEl) convEl.textContent=convLine(sel);
    });
    card.querySelector(".buy").onclick=()=>order(g,sel);
    wrap.appendChild(card);
  });
}

/* ===== вкладка «Размеры» ===== */
let SZBRAND="nike";
const SZTABS=[["nike","Nike / Jordan"],["anta","Anta"],["lining","Li-Ning"],["mizuno","Mizuno"]];
function buildBrandTabs(){
  const f=$("#brandtabs"); f.innerHTML="";
  SZTABS.forEach(([k,label])=>{ const el=document.createElement("button");
    el.className="chip"+(k===SZBRAND?" active":""); el.textContent=label;
    el.onclick=()=>{SZBRAND=k;[...f.children].forEach(c=>c.classList.remove("active"));el.classList.add("active");renderSizes();};
    f.appendChild(el); });
}
function renderSizes(){
  const grid=GRIDS[SZBRAND]||GRIDS.default;
  const cmv=parseFloat(String($("#cm").value||"").replace(",","."));
  let hl=-1;
  if(cmv){ hl=grid.findIndex(r=>r[2]>=cmv-0.01); if(hl<0) hl=grid.length-1; }
  $("#sztbody").innerHTML=grid.map((r,i)=>`<tr class="${i===hl?'hl':''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]} см</td></tr>`).join("");
  const res=$("#szresult");
  if(cmv&&hl>=0){ const r=grid[hl]; res.style.display="block"; res.innerHTML=`Длина стопы <b>${String(cmv).replace(".",",")} см</b> → твой размер: <b>EU ${r[0]} · US ${r[1]}</b>`; }
  else res.style.display="none";
}
function initTabs(){
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); t.classList.add("active");
    const v=t.dataset.v;
    $("#catalog").style.display = v==="catalog"?"":"none";
    $("#sizes").style.display   = v==="sizes"?"":"none";
  });
  $("#cm").addEventListener("input",renderSizes);
}
initTabs(); buildBrandTabs(); renderSizes();
load();

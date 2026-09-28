const fmt=new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0});
let products=[],cart=JSON.parse(localStorage.getItem("cf-cart")||"{}"),category="All";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const menu=$("#menuGrid"),filters=$("#filters"),drawer=$("#cart"),backdrop=$("#backdrop");

function count(){return Object.values(cart).reduce((a,b)=>a+Number(b),0)}
function save(){localStorage.setItem("cf-cart",JSON.stringify(cart));$$(".cart-count").forEach(x=>x.textContent=count());renderCart()}
function product(id){return products.find(x=>x.id===id)}
function openCart(){drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");backdrop.hidden=false}
function closeCart(){drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");backdrop.hidden=true}
function notice(t){const n=$("#notice");n.textContent=t;n.hidden=false;setTimeout(()=>n.hidden=true,3500)}

function renderFilters(){const cats=["All",...new Set(products.map(p=>p.category))];filters.innerHTML=cats.map(c=>`<button class="filter ${c===category?"active":""}" data-cat="${c}">${c}</button>`).join("")}
function renderMenu(){menu.innerHTML=products.filter(p=>category==="All"||p.category===category).map(p=>`<article class="card"><img src="${p.image}" alt="${p.name}"><div class="card-body"><small>${p.category}</small><h3>${p.name}</h3><p>${p.description}</p><div class="card-row"><strong>${fmt.format(p.price)}</strong><button class="add" data-add="${p.id}">ADD +</button></div></div></article>`).join("")}
function lines(){return Object.entries(cart).map(([id,quantity])=>({p:product(id),quantity:Number(quantity)})).filter(x=>x.p&&x.quantity>0)}
function renderCart(){const rows=lines();$("#emptyCart").hidden=rows.length>0;$("#cartItems").innerHTML=rows.map(({p,quantity})=>`<div class="cart-item"><img src="${p.image}" alt=""><div><h4>${p.name}</h4><small>${fmt.format(p.price)} each</small><div class="qty"><button data-q="${p.id}" data-d="-1">−</button><b>${quantity}</b><button data-q="${p.id}" data-d="1">+</button></div></div><strong>${fmt.format(p.price*quantity)}</strong></div>`).join("");const subtotal=rows.reduce((s,x)=>s+x.p.price*x.quantity,0);$("#subtotal").textContent=fmt.format(subtotal);$("#whatsappCheckout").href=whatsappUrl()}
function whatsappUrl(){const rows=lines();const text=["CHOP FIX ORDER","",...rows.map(x=>`${x.quantity} × ${x.p.name} — ${fmt.format(x.p.price*x.quantity)}`),"",`Subtotal: ${$("#subtotal")?.textContent||"₦0"}`].join("\n");return "https://wa.me/message/AH3HK7IFQK57H1?text="+encodeURIComponent(text)}

document.addEventListener("click",e=>{const a=e.target.closest("[data-add]");if(a){cart[a.dataset.add]=(cart[a.dataset.add]||0)+1;save();openCart();return}const q=e.target.closest("[data-q]");if(q){const id=q.dataset.q,next=(cart[id]||0)+Number(q.dataset.d);if(next<=0)delete cart[id];else cart[id]=next;save();return}const f=e.target.closest("[data-cat]");if(f){category=f.dataset.cat;renderFilters();renderMenu();return}if(e.target.closest(".cart-open"))openCart()});
$("#closeCart").onclick=closeCart;backdrop.onclick=closeCart;

$("#fulfilment").onchange=e=>{const d=e.target.value==="Delivery";$("#addressWrap").hidden=!d;$("#address").required=d};$("#fulfilment").dispatchEvent(new Event("change"));

$("#checkout").onsubmit=async e=>{e.preventDefault();if(!lines().length)return notice("Add something to your cart first.");const fd=new FormData(e.target);const payload=Object.fromEntries(fd.entries());payload.items=lines().map(x=>({id:x.p.id,quantity:x.quantity}));const btn=$("#payBtn");btn.disabled=true;btn.textContent="PREPARING PAYMENT…";try{const r=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const out=await r.json();if(!r.ok)throw new Error(out.error||"Could not create order");if(out.payment_url){location.href=out.payment_url}else{notice("Order created. Paystack is not configured yet.");btn.textContent="PAYSTACK NOT CONFIGURED"}}catch(err){notice(err.message);btn.disabled=false;btn.textContent="PAY WITH PAYSTACK ↗"}}

async function init(){const r=await fetch("/api/products");products=await r.json();renderFilters();renderMenu();save();const p=new URLSearchParams(location.search);if(p.get("payment")==="success"){notice("Payment successful! Your order is confirmed.");cart={};save()}else if(p.get("payment")==="failed")notice("Payment could not be verified. Please contact us if you were charged.")}
init().catch(()=>notice("Could not load the menu."));

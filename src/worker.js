const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}});
const bad=(message,status=400)=>json({error:message},status);
const allowedStatuses=["pending_payment","confirmed","preparing","out_for_delivery","delivered","cancelled"];

function id(prefix="ord"){return prefix+"_"+crypto.randomUUID().replaceAll("-","").slice(0,18)}
function moneyNairaToKobo(n){return Math.round(Number(n)*100)}
function cookie(name,value,opts=""){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; ${opts}`}
function parseCookie(req,name){const raw=req.headers.get("cookie")||"";const hit=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));return hit?hit.slice(name.length+1):null}
async function hmacHex(secret,text,algo="SHA-256"){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:algo},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text));return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function makeSession(env){const exp=Date.now()+1000*60*60*8;const payload=btoa(JSON.stringify({exp}));const sig=await hmacHex(env.SESSION_SECRET,payload);return payload+"."+sig}
async function validSession(req,env){const token=parseCookie(req,"cf_admin");if(!token)return false;const [payload,sig]=token.split(".");if(!payload||!sig)return false;const expect=await hmacHex(env.SESSION_SECRET,payload);if(!safeEqual(sig,expect))return false;try{return JSON.parse(atob(payload)).exp>Date.now()}catch{return false}}

async function body(req){try{return await req.json()}catch{return null}}
async function products(env,admin=false){const q=admin?"SELECT * FROM products ORDER BY sort_order,name":"SELECT * FROM products WHERE available=1 ORDER BY sort_order,name";const r=await env.DB.prepare(q).all();return r.results.map(p=>({...p,available:Boolean(p.available)}))}
async function orderById(env,id){const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();if(!order)return null;const items=(await env.DB.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY id").bind(id).all()).results;return {...order,items}}

async function createOrder(req,env){
  const data=await body(req); if(!data||!Array.isArray(data.items)||!data.items.length)return bad("Your cart is empty.");
  const name=String(data.name||"").trim(), phone=String(data.phone||"").trim(), email=String(data.email||"").trim();
  const fulfilment=data.fulfilment==="Pickup"?"Pickup":"Delivery", address=String(data.address||"").trim(), notes=String(data.notes||"").trim();
  if(!name||!phone||!email)return bad("Name, phone and email are required.");
  if(fulfilment==="Delivery"&&!address)return bad("Delivery address is required.");

  const ids=[...new Set(data.items.map(x=>String(x.id)))];
  const placeholders=ids.map(()=>"?").join(",");
  const found=(await env.DB.prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND available=1`).bind(...ids).all()).results;
  const map=new Map(found.map(p=>[p.id,p])); let subtotal=0; const lines=[];
  for(const row of data.items){const p=map.get(String(row.id));const qty=Math.max(1,Math.min(50,Number(row.quantity)||1));if(!p)return bad("One of the selected meals is unavailable.");const line=p.price*qty;subtotal+=line;lines.push({p,qty,line})}
  const deliveryFee=0,total=subtotal+deliveryFee,orderId=id(),reference="CF-"+Date.now()+"-"+Math.floor(Math.random()*900+100);

  await env.DB.prepare(`INSERT INTO orders(id,reference,customer_name,phone,email,fulfilment,address,notes,subtotal,delivery_fee,total) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(orderId,reference,name,phone,email,fulfilment,address||null,notes||null,subtotal,deliveryFee,total).run();
  const stmts=lines.map(({p,qty,line})=>env.DB.prepare(`INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES(?,?,?,?,?,?)`).bind(orderId,p.id,p.name,p.price,qty,line));
  await env.DB.batch(stmts);

  let payment_url=null;
  if(env.PAYSTACK_SECRET_KEY){
    const res=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{
      Authorization:`Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "content-type":"application/json",
      "accept":"application/json",
      "user-agent":"Mozilla/5.0 (compatible; ChopFixKitchen/1.0; +https://thechopfix.com)"
    },body:JSON.stringify({
      email,
      amount:String(moneyNairaToKobo(total)),
      reference,
      callback_url:`${env.SITE_URL}/api/payments/callback`,
      metadata:JSON.stringify({order_id:orderId,customer_name:name})
    })});
    const rawPay=await res.text();
    let pay=null;
    try{
      pay=rawPay?JSON.parse(rawPay):null;
    }catch(parseErr){
      console.error("Paystack initialize returned non-JSON", {status:res.status, body:rawPay.slice(0,500)});
      return bad("Paystack returned an invalid response. Please try again.",502);
    }
    if(res.ok&&pay?.status&&pay.data?.authorization_url){
      payment_url=pay.data.authorization_url;
      await env.DB.prepare("UPDATE orders SET paystack_reference=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(reference,orderId).run();
    } else {
      console.error("Paystack initialize failed", {status:res.status, body:pay});
      return bad(pay?.message||"Paystack could not initialize payment.",502);
    }
  }
  return json({order_id:orderId,reference,total,payment_url});
}

async function verifyPaystack(env,reference){
  const res=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{
    Authorization:`Bearer ${env.PAYSTACK_SECRET_KEY}`,
    "accept":"application/json",
    "user-agent":"Mozilla/5.0 (compatible; ChopFixKitchen/1.0; +https://thechopfix.com)"
  }});
  const out=await res.json();
  if(out.status&&out.data?.status==="success"){
    await env.DB.prepare("UPDATE orders SET payment_status='paid',order_status=CASE WHEN order_status='pending_payment' THEN 'confirmed' ELSE order_status END,updated_at=CURRENT_TIMESTAMP WHERE reference=?").bind(reference).run();
    return true;
  }
  return false;
}

async function adminApi(req,env,url){
  if(url.pathname==="/api/admin/login"&&req.method==="POST"){
    const data=await body(req);if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return bad("Admin secrets are not configured.",503);
    if(String(data?.password||"")!==env.ADMIN_PASSWORD)return bad("Invalid password.",401);
    const session=await makeSession(env);return json({ok:true},200,{"set-cookie":cookie("cf_admin",session,"Max-Age=28800")});
  }
  if(url.pathname==="/api/admin/logout"&&req.method==="POST")return json({ok:true},200,{"set-cookie":cookie("cf_admin","","Max-Age=0")});
  if(!(await validSession(req,env)))return bad("Unauthorized",401);

  if(url.pathname==="/api/admin/me")return json({authenticated:true});
  if(url.pathname==="/api/admin/products"&&req.method==="GET")return json(await products(env,true));
  if(url.pathname==="/api/admin/products"&&req.method==="POST"){
    const d=await body(req);if(!d?.name||!d?.category||!Number.isFinite(Number(d?.price)))return bad("Name, category and price are required.");
    const pid=d.id?String(d.id):id("prd");
    await env.DB.prepare(`INSERT INTO products(id,name,category,price,image,description,available,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,image=excluded.image,description=excluded.description,available=excluded.available,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`)
      .bind(pid,String(d.name),String(d.category),Number(d.price),String(d.image||"/assets/jollof.png"),String(d.description||""),d.available===false?0:1,Number(d.sort_order)||0).run();
    return json({ok:true,id:pid});
  }
  const pm=url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if(pm&&req.method==="DELETE"){await env.DB.prepare("DELETE FROM products WHERE id=?").bind(decodeURIComponent(pm[1])).run();return json({ok:true})}
  if(url.pathname==="/api/admin/orders"&&req.method==="GET"){const rows=(await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all()).results;return json(rows)}
  const om=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if(om&&req.method==="GET"){const order=await orderById(env,decodeURIComponent(om[1]));return order?json(order):bad("Order not found",404)}
  if(om&&req.method==="PATCH"){const d=await body(req);if(!allowedStatuses.includes(d?.order_status))return bad("Invalid order status.");await env.DB.prepare("UPDATE orders SET order_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(d.order_status,decodeURIComponent(om[1])).run();return json({ok:true})}
  return bad("Not found",404);
}

export default {
  async fetch(req,env){
    const url=new URL(req.url);
    try{
      if(url.pathname.startsWith("/api/admin/"))return adminApi(req,env,url);
      if(url.pathname==="/api/products"&&req.method==="GET")return json(await products(env,false));
      if(url.pathname==="/api/orders"&&req.method==="POST")return createOrder(req,env);

      if(url.pathname==="/api/payments/callback"&&req.method==="GET"){
        const reference=url.searchParams.get("reference")||url.searchParams.get("trxref");
        if(!reference||!env.PAYSTACK_SECRET_KEY)return Response.redirect(env.SITE_URL+"/?payment=failed",302);
        const ok=await verifyPaystack(env,reference);
        return Response.redirect(env.SITE_URL+`/?payment=${ok?"success":"failed"}&reference=${encodeURIComponent(reference)}`,302);
      }

      if(url.pathname==="/api/payments/webhook"&&req.method==="POST"){
        if(!env.PAYSTACK_SECRET_KEY)return bad("Not configured",503);
        const raw=await req.text(),provided=req.headers.get("x-paystack-signature")||"",expected=await hmacHex(env.PAYSTACK_SECRET_KEY,raw,"SHA-512");
        if(!safeEqual(provided,expected))return bad("Invalid signature",401);
        const event=JSON.parse(raw);
        if(event.event==="charge.success"&&event.data?.reference)await verifyPaystack(env,event.data.reference);
        return new Response("ok");
      }

      if(url.pathname.startsWith("/api/"))return bad("Not found",404);
      return env.ASSETS.fetch(req);
    }catch(err){
      console.error(err);
      return bad("Something went wrong.",500);
    }
  }
};

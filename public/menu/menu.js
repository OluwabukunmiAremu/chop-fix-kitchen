const fmt=new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0});
let cart=JSON.parse(localStorage.getItem('chopfix-revised-menu-cart')||'{}');
const items={
  'Penne Pasta + Meatballs':{id:'penne-meatballs',price:7000},
  'Penne Pasta + Grilled Chicken':{id:'penne-grilled-chicken',price:6500},
  'Jollof Combo':{id:'jollof-combo',price:6500},
  'Party Platter — serves 15':{id:'party-platter',price:250000}
};
const $=id=>document.getElementById(id);
function qty(name){return Number(cart[name]||0)}
function count(){return Object.values(cart).reduce((a,b)=>a+Number(b),0)}
function rows(){return Object.entries(cart).filter(([,q])=>q>0)}
function save(){localStorage.setItem('chopfix-revised-menu-cart',JSON.stringify(cart));render()}
function subtotal(){return rows().reduce((s,[name,q])=>s+items[name].price*q,0)}
function whatsappUrl(){
  const text=['CHOP FIX ORDER','',...rows().map(([name,q])=>q+' × '+name+' — '+fmt.format(items[name].price*q)),'','Subtotal: '+fmt.format(subtotal())].join('\n');
  return 'https://wa.me/message/AH3HK7IFQK57H1?text='+encodeURIComponent(text)
}
function render(){
  $('cartCount').textContent=count();
  $('mobileCount').textContent=count();
  const r=rows();
  $('empty').hidden=r.length>0;
  $('cartItems').innerHTML=r.map(([name,q])=>'<div class="cart-row"><div><h4>'+name+'</h4><small>'+fmt.format(items[name].price)+' each</small><div class="qty"><button data-name="'+name+'" data-delta="-1">−</button><b>'+q+'</b><button data-name="'+name+'" data-delta="1">+</button></div></div><strong>'+fmt.format(items[name].price*q)+'</strong></div>').join('');
  $('subtotal').textContent=fmt.format(subtotal());
  $('whatsappOrder').href=whatsappUrl();
}
function openCart(){$('cart').classList.add('open');$('cart').setAttribute('aria-hidden','false');$('backdrop').hidden=false}
function closeCart(){$('cart').classList.remove('open');$('cart').setAttribute('aria-hidden','true');$('backdrop').hidden=true}
document.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]');
  if(add){const n=add.dataset.add,min=Number(add.dataset.min||1);cart[n]=qty(n)+min;save();return}
  const q=e.target.closest('[data-name]');
  if(q){const n=q.dataset.name,next=qty(n)+Number(q.dataset.delta);if(next<=0)delete cart[n];else cart[n]=next;save()}
});
$('openCart').onclick=openCart;
$('mobileCart').onclick=openCart;
$('closeCart').onclick=closeCart;
$('backdrop').onclick=closeCart;
$('fulfilment').onchange=e=>{const delivery=e.target.value==='Delivery';$('addressWrap').hidden=!delivery;$('address').required=delivery};
$('fulfilment').dispatchEvent(new Event('change'));
$('checkout').onsubmit=async e=>{
  e.preventDefault();
  if(!rows().length)return;
  const fd=new FormData(e.target);
  const payload=Object.fromEntries(fd.entries());
  payload.items=rows().map(([name,q])=>({id:items[name].id,quantity:q}));
  const btn=$('payBtn');
  btn.disabled=true;
  btn.textContent='PREPARING PAYMENT…';
  try{
    const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const out=await r.json();
    if(!r.ok)throw new Error(out.error||'Could not create order');
    if(out.payment_url){location.href=out.payment_url;return}
    btn.textContent='PAYSTACK NOT CONFIGURED';
    alert('Order created, but Paystack is not configured yet. You can continue on WhatsApp instead.');
  }catch(err){
    alert(err.message);
    btn.disabled=false;
    btn.textContent='PAY WITH PAYSTACK ↗';
  }
};
const p=new URLSearchParams(location.search);
if(p.get('payment')==='success'){cart={};save();alert('Payment successful! Your order is confirmed.')}
else {
  render();
  const cartIntent=p.get('cart');
  if(cartIntent==='open' && rows().length){
    openCart();
  } else if(cartIntent==='empty' || (cartIntent==='open' && !rows().length)){
    const prompt=document.createElement('div');
    prompt.className='menu-prompt';
    prompt.innerHTML='<b>YOUR ORDER IS EMPTY.</b><span>Pick a fix below and tap ADD + to start your order.</span>';
    document.querySelector('.menu-section').prepend(prompt);
    setTimeout(()=>prompt.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
}

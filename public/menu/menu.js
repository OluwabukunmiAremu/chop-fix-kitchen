const fmt=new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0});
let cart=JSON.parse(localStorage.getItem('chopfix-revised-menu-cart')||'{}');
const items={
  'Penne Pasta + Meatballs':{id:'penne-meatballs',price:7000,min:1},
  'Penne Pasta + Grilled Chicken':{id:'penne-grilled-chicken',price:6500,min:1},
  'Jollof Combo':{id:'jollof-combo',price:6500,min:5},
  'Party Platter — serves 15':{id:'party-platter',price:250000,min:1}
};
const $=id=>document.getElementById(id);
function qty(name){return Number(cart[name]||0)}
function count(){return Object.values(cart).reduce((a,b)=>a+Number(b),0)}
function rows(){return Object.entries(cart).filter(([name,q])=>items[name]&&q>0)}
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
  $('cartItems').innerHTML=r.map(([name,q])=>'<div class="cart-row"><div><h4>'+name+'</h4><small>'+fmt.format(items[name].price)+' each'+(items[name].min>1?' • minimum '+items[name].min:'')+'</small><div class="qty"><button data-name="'+name+'" data-delta="-1">−</button><b>'+q+'</b><button data-name="'+name+'" data-delta="1">+</button></div></div><strong>'+fmt.format(items[name].price*q)+'</strong></div>').join('');
  $('subtotal').textContent=fmt.format(subtotal());
  $('whatsappOrder').href=whatsappUrl();
}
function openCart(){$('cart').classList.add('open');$('cart').setAttribute('aria-hidden','false');$('backdrop').hidden=false}
function closeCart(){$('cart').classList.remove('open');$('cart').setAttribute('aria-hidden','true');$('backdrop').hidden=true}
function showNotice(title,message,type='info'){
  const existing=document.querySelector('.payment-notice');if(existing)existing.remove();
  const notice=document.createElement('div');
  notice.className='menu-prompt payment-notice '+type;
  notice.innerHTML='<b>'+title+'</b><span>'+message+'</span>';
  document.querySelector('.menu-section').prepend(notice);
  setTimeout(()=>notice.scrollIntoView({behavior:'smooth',block:'start'}),50);
}
document.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]');
  if(add){const n=add.dataset.add,min=items[n]?.min||Number(add.dataset.min||1);cart[n]=qty(n)>0?qty(n)+1:min;save();return}
  const q=e.target.closest('[data-name]');
  if(q){
    const n=q.dataset.name,item=items[n];if(!item)return;
    const delta=Number(q.dataset.delta),current=qty(n),next=current+delta;
    if(delta<0&&current<=item.min){delete cart[n]}
    else if(next<=0)delete cart[n];
    else cart[n]=next;
    save();
  }
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
  const invalid=rows().find(([name,q])=>q<(items[name]?.min||1));
  if(invalid){showNotice('CHECK YOUR ORDER',invalid[0]+' has a minimum quantity of '+items[invalid[0]].min+'.','error');return}
  const fd=new FormData(e.target);
  const payload=Object.fromEntries(fd.entries());
  payload.items=rows().map(([name,q])=>({id:items[name].id,quantity:q}));
  const btn=$('payBtn');
  btn.disabled=true;
  btn.textContent='PREPARING PAYMENT…';
  try{
    const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const raw=await r.text();
    let out={};try{out=raw?JSON.parse(raw):{}}catch{throw new Error('The server returned an unexpected response. Please try again.')}
    if(!r.ok)throw new Error(out.error||'Could not create order');
    if(out.payment_url){location.href=out.payment_url;return}
    btn.textContent='PAYSTACK NOT CONFIGURED';
    showNotice('PAYMENT UNAVAILABLE','Your order could not be sent to Paystack. You can continue on WhatsApp instead.','error');
  }catch(err){
    showNotice('PAYMENT NOT STARTED',err.message||'Please try again.','error');
    btn.disabled=false;
    btn.textContent='PAY WITH PAYSTACK ↗';
  }
};
const p=new URLSearchParams(location.search);
if(p.get('payment')==='success'){
  cart={};save();
  showNotice('PAYMENT SUCCESSFUL','Your payment was verified and your order is confirmed.','success');
  history.replaceState({},'',location.pathname);
}else if(p.get('payment')==='failed'){
  render();
  showNotice('PAYMENT NOT CONFIRMED','We could not verify this payment. Your cart is still here, so you can try again or contact Chop Fix.','error');
  history.replaceState({},'',location.pathname);
}else{
  render();
  const cartIntent=p.get('cart');
  if(cartIntent==='open' && rows().length){
    openCart();
  } else if(cartIntent==='empty' || (cartIntent==='open' && !rows().length)){
    showNotice('YOUR ORDER IS EMPTY.','Pick a fix below and tap ADD + to start your order.');
  }
}

const money = new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0});
const menu = window.CHOP_FIX_MENU || [];
const storageKey = 'chop-fix-cart-v1';
let cart = JSON.parse(localStorage.getItem(storageKey) || '{}');
let activeCategory = 'All';

const menuGrid = document.getElementById('menuGrid');
const categoryFilters = document.getElementById('categoryFilters');
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartItems = document.getElementById('cartItems');
const emptyCart = document.getElementById('emptyCart');
const cartSubtotal = document.getElementById('cartSubtotal');
const fulfilment = document.getElementById('fulfilment');
const addressField = document.getElementById('addressField');

function saveCart(){ localStorage.setItem(storageKey, JSON.stringify(cart)); }

function itemQty(id){ return Number(cart[id] || 0); }

function cartCount(){ return Object.values(cart).reduce((a,b)=>a+Number(b),0); }

function updateCount(){
  document.querySelectorAll('.cart-count').forEach(el=>el.textContent=cartCount());
}

function renderFilters(){
  const cats = ['All', ...new Set(menu.map(item=>item.category))];
  categoryFilters.innerHTML = cats.map(cat =>
    '<button class="filter-btn '+(cat===activeCategory?'active':'')+'" data-category="'+cat+'" type="button">'+cat+'</button>'
  ).join('');
}

function renderMenu(){
  const visible = menu.filter(item=>activeCategory==='All' || item.category===activeCategory);
  menuGrid.innerHTML = visible.map((item,index)=>`
    <article class="card reveal in">
      <div class="food-img">
        <img src="${item.image}" alt="${item.name}">
        <span class="category-pill">${item.category}</span>
      </div>
      <div class="card-copy">
        <p class="num">${String(index+1).padStart(2,'0')}</p>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="product-row">
          <strong>${money.format(item.price)}</strong>
          <button class="add-btn" data-add="${item.id}" type="button" ${item.available?'':'disabled'}>${item.available?'Add +':'Sold out'}</button>
        </div>
      </div>
    </article>
  `).join('');
}

function getProduct(id){ return menu.find(x=>x.id===id); }

function addItem(id){
  cart[id] = itemQty(id) + 1;
  saveCart();
  updateCount();
  renderCart();
  openCart();
}

function changeQty(id,delta){
  const next = itemQty(id)+delta;
  if(next<=0) delete cart[id]; else cart[id]=next;
  saveCart();
  updateCount();
  renderCart();
}

function cartLines(){
  return Object.entries(cart)
    .map(([id,qty])=>({product:getProduct(id),qty:Number(qty)}))
    .filter(x=>x.product && x.qty>0);
}

function renderCart(){
  const lines = cartLines();
  emptyCart.hidden = lines.length>0;
  cartItems.innerHTML = lines.map(({product,qty})=>`
    <article class="cart-item">
      <img src="${product.image}" alt="">
      <div class="cart-item-copy">
        <div><h4>${product.name}</h4><p>${money.format(product.price)} each</p></div>
        <div class="qty-control">
          <button data-qty="${product.id}" data-delta="-1" type="button" aria-label="Remove one">−</button>
          <strong>${qty}</strong>
          <button data-qty="${product.id}" data-delta="1" type="button" aria-label="Add one">+</button>
        </div>
      </div>
      <strong>${money.format(product.price*qty)}</strong>
    </article>
  `).join('');
  const subtotal = lines.reduce((sum,x)=>sum+x.product.price*x.qty,0);
  cartSubtotal.textContent = money.format(subtotal);
}

function openCart(){
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden','false');
  cartBackdrop.hidden = false;
  document.body.classList.add('cart-open');
}

function closeCart(){
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden','true');
  cartBackdrop.hidden = true;
  document.body.classList.remove('cart-open');
}

function buildOrderText(){
  const lines = cartLines();
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const method = fulfilment.value;
  const address = document.getElementById('customerAddress').value.trim();
  const notes = document.getElementById('customerNotes').value.trim();
  const subtotal = lines.reduce((sum,x)=>sum+x.product.price*x.qty,0);

  return [
    'CHOP FIX ORDER',
    '',
    ...lines.map(x=>`${x.qty} × ${x.product.name} — ${money.format(x.product.price*x.qty)}`),
    '',
    `Subtotal: ${money.format(subtotal)}`,
    '',
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Method: ${method}`,
    method==='Delivery' ? `Address: ${address || 'Not provided'}` : '',
    notes ? `Notes: ${notes}` : ''
  ].filter(Boolean).join('\n');
}

document.addEventListener('click',e=>{
  const filter=e.target.closest('[data-category]');
  if(filter){ activeCategory=filter.dataset.category; renderFilters(); renderMenu(); return; }

  const add=e.target.closest('[data-add]');
  if(add){ addItem(add.dataset.add); return; }

  const qty=e.target.closest('[data-qty]');
  if(qty){ changeQty(qty.dataset.qty,Number(qty.dataset.delta)); return; }

  if(e.target.closest('.cart-trigger')) openCart();
});

document.getElementById('closeCart').addEventListener('click',closeCart);
cartBackdrop.addEventListener('click',closeCart);
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCart(); });

fulfilment.addEventListener('change',()=>{
  const delivery=fulfilment.value==='Delivery';
  addressField.hidden=!delivery;
  document.getElementById('customerAddress').required=delivery;
});
fulfilment.dispatchEvent(new Event('change'));

document.getElementById('checkoutForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(cartLines().length===0){ alert('Add at least one item to your cart first.'); return; }
  const text=buildOrderText();
  try{
    await navigator.clipboard.writeText(text);
    document.getElementById('checkoutNote').textContent='Order copied! Paste it into the WhatsApp chat that is opening now.';
  }catch{
    document.getElementById('checkoutNote').textContent='WhatsApp is opening. Copy your order details manually if your browser blocked clipboard access.';
  }
  window.open('https://wa.me/message/AH3HK7IFQK57H1','_blank','noopener');
});

const revealItems=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
  }),{threshold:.12});
  revealItems.forEach(el=>io.observe(el));
}else revealItems.forEach(el=>el.classList.add('in'));

renderFilters();
renderMenu();
renderCart();
updateCount();

const items=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){const io=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});items.forEach(el=>io.observe(el));}else{items.forEach(el=>el.classList.add('in'));}

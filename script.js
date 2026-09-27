const WA="https://wa.me/message/AH3HK7IFQK57H1";
const meals=[
{name:"Smoky Jollof Fix",desc:"Smoky jollof rice, grilled chicken & sweet plantain.",price:"₦6,500",image:"https://thechopfix.floot.app/_cdn/static/ca91148d-fc36-4df7-a741-e7354183557c.png"},
{name:"Fried Rice Fix",desc:"Nigerian fried rice, grilled chicken & plantain.",price:"₦7,000",image:"https://thechopfix.floot.app/_cdn/static/40db43ba-0339-47e9-9038-d5f4cc16fe2f.png"},
{name:"Spaghetti Fix",desc:"Smoky party spaghetti, turkey & sweet plantain.",price:"₦6,500",image:"https://thechopfix.floot.app/_cdn/static/2158589b-93c1-4d89-b94a-497860388195.png"}];
document.querySelector("#mealGrid").innerHTML=meals.map((m,i)=>`<article class="card reveal"><div class="cardImage"><img src="${m.image}" alt="${m.name}"><span>0${i+1}</span></div><div class="cardText"><div><h3>${m.name}</h3><p>${m.desc}</p></div><strong>${m.price}</strong></div><a href="${WA}" target="_blank" rel="noreferrer">I want this <span>↗</span></a></article>`).join("");
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.dataset.revealed="true";observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
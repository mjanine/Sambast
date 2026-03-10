const tabs = document.querySelectorAll(".tab");
const cards = document.querySelectorAll(".order-card");

tabs.forEach(tab=>{
tab.addEventListener("click",()=>{

tabs.forEach(t=>t.classList.remove("active"));
tab.classList.add("active");

let filter = tab.dataset.filter;

cards.forEach(card=>{

if(filter === "all"){
card.style.display="block";
}
else if(card.dataset.status === filter){
card.style.display="block";
}
else{
card.style.display="none";
}

});

});
});
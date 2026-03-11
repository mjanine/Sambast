const tabs = document.querySelectorAll(".tab");
const cards = document.querySelectorAll(".order-card");

/* TAB FILTER */

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

/* SIDEBAR MENU */

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

menuBtn.addEventListener("click", () => {
sidebar.classList.add("open");
overlay.classList.add("show");
});

closeBtn.addEventListener("click", closeMenu);
overlay.addEventListener("click", closeMenu);

function closeMenu(){
sidebar.classList.remove("open");
overlay.classList.remove("show");
}

/* ORDER BUTTON ACTIONS */

document.querySelectorAll(".primary").forEach(btn=>{

btn.addEventListener("click",()=>{

const card = btn.closest(".order-card");
let status = card.dataset.status;

if(status === "pending"){
card.dataset.status = "processing";
btn.textContent = "Mark as Ready for pick up";
}

else if(status === "processing"){
card.dataset.status = "ready";
btn.textContent = "Completed";
}

else if(status === "ready"){
card.dataset.status = "completed";
btn.remove();
}

});

});

/* CANCEL BUTTON */

document.querySelectorAll(".secondary").forEach(btn=>{

btn.addEventListener("click",()=>{

const card = btn.closest(".order-card");
card.dataset.status = "cancelled";

btn.parentElement.remove();

});

});
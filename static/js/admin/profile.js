const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

menuBtn.onclick = () => {
sidebar.classList.add("open");
overlay.classList.add("show");
}

closeBtn.onclick = () => {
sidebar.classList.remove("open");
overlay.classList.remove("show");
}

overlay.onclick = () => {
sidebar.classList.remove("open");
overlay.classList.remove("show");
}
// Shared scripts for every page

// ---------- Footer year ----------
const year = document.getElementById("year");

if (year) {
  year.textContent = new Date().getFullYear();
}

// ---------- Search chips ----------
const searchInput = document.getElementById("searchInput");
const searchForm = document.getElementById("searchForm");
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (searchInput && searchForm) {
      searchInput.value = chip.textContent.trim();
      searchForm.submit();
    }
  });
});

// ---------- Mobile menu ----------
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });
}
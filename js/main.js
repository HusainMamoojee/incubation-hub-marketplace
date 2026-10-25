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


// ---------- Shared helpers (used by home, browse, listing pages) ----------

// Make user-typed text safe to put inside HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// 150 → "R150", 85.5 → "R85.50"
function formatPrice(price) {
  const amount = Number(price);
  return "R" + (Number.isInteger(amount) ? amount : amount.toFixed(2));
}

// "Husain", "Mamoojee" → "HM"
function initials(first, last) {
  return ((first || "").charAt(0) + (last || "").charAt(0)).toUpperCase() || "?";
}

// (I) Zeke moved the const status lables to the main js.

const STATUS_LABELS = {
  new: "Awaiting reply",
  replied: "Replied",
  confirmed: "Confirmed",
  closed: "Closed"
  
};


// Order statuses → friendly labels (used by buyer and seller pages)
const ORDER_STATUS_LABELS = {
  pending_payment: "Awaiting payment",
  paid_in_escrow: "Paid · in escrow",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled"
};
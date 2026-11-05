// Seller levels: sellers earn badges as they complete sales.
// Load AFTER js/supabase.js on any page that shows badges.
//
// How to show a badge anywhere: put an empty element with the seller's id on the page,
//   <span data-seller-badge="SELLER-ID"></span>
// and this file fills it in by itself, even if the element is added later by other code.

// Highest level first. A seller gets the first level whose "min" they've reached.
const SELLER_LEVELS = [
  { min: 15, name: "Top seller",     icon: "🏆", key: "top" },
  { min: 5,  name: "Trusted seller", icon: "💎", key: "trusted" },
  { min: 1,  name: "Rising seller",  icon: "⭐", key: "rising" },
  { min: 0,  name: "New seller",     icon: "🌱", key: "new" }
];

// Which level a number of completed sales gives, and the next one up
function getSellerLevel(sales) {
  const index = SELLER_LEVELS.findIndex((level) => sales >= level.min);
  return {
    level: SELLER_LEVELS[index],
    next: index > 0 ? SELLER_LEVELS[index - 1] : null   // null = already at the top
  };
}

function sellerBadgeHtml(sales) {
  const { level } = getSellerLevel(sales);
  const title = `${sales} completed ${sales === 1 ? "sale" : "sales"}`;
  return `<span class="level-badge level-${level.key}" title="${title}">${level.icon} ${level.name}</span>`;
}

// ---------- Completed sales per seller (loaded once per page) ----------
// The database function only returns numbers, never who bought what.
let sellerSalesPromise = null;

function loadSellerSales() {
  if (!sellerSalesPromise) {
    sellerSalesPromise = supabaseClient.rpc("seller_sales").then(({ data, error }) => {
      if (error) console.error("Could not load seller levels:", error.message);
      return new Map((data || []).map((row) => [row.seller_id, Number(row.completed_sales)]));
    });
  }
  return sellerSalesPromise;
}

// ---------- Fill every empty badge on the page ----------
async function fillSellerBadges() {
  const slots = document.querySelectorAll("[data-seller-badge]:not([data-badge-filled])");
  if (slots.length === 0) return;

  const sales = await loadSellerSales();

  slots.forEach((slot) => {
    const sellerId = slot.dataset.sellerBadge;
    if (!sellerId) return;
    slot.innerHTML = sellerBadgeHtml(sales.get(sellerId) || 0);
    slot.dataset.badgeFilled = "true";
  });
}

// Watch the page: whenever other scripts add listing cards (or set a seller id),
// fill in their badges automatically. This is called a MutationObserver.
new MutationObserver(fillSellerBadges).observe(document.body, {
  childList: true,                       // elements added or removed
  subtree: true,                         // anywhere on the page
  attributes: true,
  attributeFilter: ["data-seller-badge"] // or a seller id being set
});
fillSellerBadges();

// ---------- Seller dashboard: your level and progress to the next ----------
async function renderLevelProgress(sellerId, box) {
  const sales = (await loadSellerSales()).get(sellerId) || 0;
  const { level, next } = getSellerLevel(sales);

  // How far between this level and the next (0–100%)
  const percent = next ? Math.round(((sales - level.min) / (next.min - level.min)) * 100) : 100;
  const toGo = next ? next.min - sales : 0;

  box.innerHTML = `
    <div class="level-card-top">
      <span class="level-icon level-${level.key}">${level.icon}</span>
      <div>
        <small>Your seller level</small>
        <strong>${level.name}</strong>
      </div>
      <span class="level-sales">${sales} ${sales === 1 ? "sale" : "sales"}</span>
    </div>
    <div class="level-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
      <span style="width:${percent}%"></span>
    </div>
    <p class="level-next">
      ${next
        ? `<strong>${toGo} more ${toGo === 1 ? "sale" : "sales"}</strong> to reach ${next.icon} ${next.name}`
        : "You've reached the highest level. Legend! 🎉"}
    </p>`;
  box.hidden = false;
}
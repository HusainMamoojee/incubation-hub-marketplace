// Browse page: load active listings with search, filters and sorting

// ---------- Current search and filters (start from the URL) ----------
const params = new URLSearchParams(window.location.search);

const filters = {
  q: params.get("q") || "",
  type: params.get("type") || "all",
  category: params.get("category") || "",
  campus: params.get("campus") || "",
  sort: params.get("sort") || "newest"
};

// ---------- Page elements ----------
const typeTabs = document.getElementById("typeTabs");
const categoryFilter = document.getElementById("categoryFilter");
const campusFilter = document.getElementById("campusFilter");
const sortFilter = document.getElementById("sortFilter");
const resultsCount = document.getElementById("resultsCount");
const clearFiltersBtn = document.getElementById("clearFilters");
const listingGrid = document.getElementById("listingGrid");

// ---------- Make the controls match the filters ----------
function syncControls() {
  searchInput.value = filters.q;
  categoryFilter.value = filters.category;
  campusFilter.value = filters.campus;
  sortFilter.value = filters.sort;

  typeTabs.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.type === filters.type);
  });

  const anyFilter = filters.q || filters.type !== "all" || filters.category || filters.campus;
  clearFiltersBtn.hidden = !anyFilter;
}

// ---------- Keep the URL in sync, so results can be shared or refreshed ----------
function updateUrl() {
  const next = new URLSearchParams();
  if (filters.q) next.set("q", filters.q);
  if (filters.type !== "all") next.set("type", filters.type);
  if (filters.category) next.set("category", filters.category);
  if (filters.campus) next.set("campus", filters.campus);
  if (filters.sort !== "newest") next.set("sort", filters.sort);

  const query = next.toString();
  history.replaceState(null, "", query ? `browse.html?${query}` : "browse.html");
}

// ---------- Load listings from Supabase ----------
let latestRequest = 0;

async function loadListings() {
  const requestId = ++latestRequest;
  listingGrid.innerHTML = `<p class="empty-state">Loading listings...</p>`;
  resultsCount.textContent = "";

  let query = supabaseClient
    .from("listings")
    .select(
      "id, title, description, type, category, price, price_unit, campus, seller:profiles ( first_name, last_name )",
      { count: "exact" }
    )
    .eq("status", "active");

  if (filters.q) {
    // Remove characters that have a special meaning in Supabase filters
    const term = filters.q.replace(/[,()%]/g, " ").trim();
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
  }
  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.campus) query = query.eq("campus", filters.campus);

  if (filters.sort === "price-low") {
    query = query.order("price", { ascending: true });
  } else if (filters.sort === "price-high") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: listings, count, error } = await query;

  // A newer search started while we were waiting: ignore this old result
  if (requestId !== latestRequest) return;

  if (error) {
    listingGrid.innerHTML = `<p class="empty-state">We couldn't load listings. Please refresh the page.</p>`;
    console.error("Could not load listings:", error.message);
    return;
  }

  resultsCount.textContent =
    `${count} listing${count === 1 ? "" : "s"}` +
    (filters.q ? ` for "${filters.q}"` : "");

  if (listings.length === 0) {
    listingGrid.innerHTML = `
      <p class="empty-state">
        No listings match your search.
        <a href="browse.html">Clear all filters</a> to see everything on the Hub.
      </p>`;
    return;
  }

  listingGrid.innerHTML = listings.map((listing, index) => renderListingCard(listing, index)).join("");
}

// ---------- Apply a change: update URL, buttons, results ----------
function applyFilters() {
  syncControls();
  updateUrl();
  loadListings();
}

// ---------- Listen to the controls ----------
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  filters.q = searchInput.value.trim();
  applyFilters();
});

typeTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  filters.type = tab.dataset.type;
  applyFilters();
});

categoryFilter.addEventListener("change", () => {
  filters.category = categoryFilter.value;
  applyFilters();
});

campusFilter.addEventListener("change", () => {
  filters.campus = campusFilter.value;
  applyFilters();
});

sortFilter.addEventListener("change", () => {
  filters.sort = sortFilter.value;
  applyFilters();
});

clearFiltersBtn.addEventListener("click", () => {
  filters.q = "";
  filters.type = "all";
  filters.category = "";
  filters.campus = "";
  filters.sort = "newest";
  applyFilters();
});

// ---------- First load ----------
syncControls();
loadListings();
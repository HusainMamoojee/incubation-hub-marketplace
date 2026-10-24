// Seller tools on the home dashboard: your shop, your listings, add a listing

// ---------- Show the shop (called by home.js for approved sellers) ----------
async function loadShop(user, profile) {
  document.getElementById("myShop").hidden = false;
  document.getElementById("shopTitle").textContent = profile.shop_name || "My shop";

  setupAddListingForm(user, profile);
  setupListingActions(user);

  await loadMyListings(user);
}

// ---------- Your listings ----------
async function loadMyListings(user) {
  const box = document.getElementById("myListings");

  const { data: listings, error } = await supabaseClient
    .from("listings")
    .select("id, title, type, price, price_unit, status")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="empty-state">We couldn't load your listings. Please refresh the page.</p>`;
    console.error("Could not load your listings:", error.message);
    return;
  }

  if (listings.length === 0) {
    box.innerHTML = `
      <p class="empty-state">
        You haven't listed anything yet. Click <strong>+ Add listing</strong> to post your first one.
      </p>`;
    return;
  }

  box.innerHTML = listings.map((listing) => `
    <div class="enquiry-row" data-listing-id="${listing.id}">
      <div class="enquiry-info">
        <strong>${escapeHtml(listing.title)}</strong>
        <span>
          ${listing.type === "service" ? "Service" : "Product"} ·
          ${formatPrice(listing.price)}${listing.price_unit ? "/" + escapeHtml(listing.price_unit) : ""}
        </span>
      </div>
      <select class="listing-status" aria-label="Status of ${escapeHtml(listing.title)}">
        <option value="active" ${listing.status === "active" ? "selected" : ""}>Active</option>
        <option value="hidden" ${listing.status === "hidden" ? "selected" : ""}>Hidden</option>
        <option value="sold" ${listing.status === "sold" ? "selected" : ""}>Sold</option>
      </select>
    </div>
  `).join("");
}

// ---------- Change a listing's status (one listener for every row) ----------
function setupListingActions(user) {
  const box = document.getElementById("myListings");
  const message = document.getElementById("shopMessage");

  box.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("listing-status")) return;

    const select = e.target;
    const row = select.closest("[data-listing-id]");
    const listingId = row.dataset.listingId;

    select.disabled = true;

    const { error } = await supabaseClient
      .from("listings")
      .update({ status: select.value })
      .eq("id", listingId);

    select.disabled = false;

    if (error) {
      showMessage(message, "Couldn't update that listing: " + error.message, "error");
      return;
    }

    showMessage(message, "Listing updated.", "success");
    refreshDashboard(user);
  });
}

// ---------- Add a listing ----------
function setupAddListingForm(user, profile) {
  const form = document.getElementById("addListingForm");
  const openBtn = document.getElementById("openAddListing");
  const cancelBtn = document.getElementById("cancelAddListing");
  const box = document.getElementById("listingMessage");

  function openForm() {
    form.hidden = false;
    openBtn.hidden = true;
    document.getElementById("listingTitle").focus();
  }

  function closeForm() {
    form.reset();
    clearErrors(form);
    box.className = "form-message";
    form.hidden = true;
    openBtn.hidden = false;
  }

  openBtn.addEventListener("click", openForm);
  cancelBtn.addEventListener("click", closeForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(form);

    const title = document.getElementById("listingTitle");
    const type = document.getElementById("listingType");
    const category = document.getElementById("listingCategory");
    const price = document.getElementById("listingPrice");
    const unit = document.getElementById("listingUnit");
    const description = document.getElementById("listingDescription");
    let valid = true;

    if (title.value.trim().length < 3) {
      setError(title, "Use at least 3 characters.");
      valid = false;
    }
    if (category.value === "") {
      setError(category, "Choose a category.");
      valid = false;
    }
    if (price.value === "" || Number(price.value) < 0) {
      setError(price, "Enter a price of R0 or more.");
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing...";

    const { error } = await supabaseClient.from("listings").insert({
      title: title.value.trim(),
      type: type.value,
      category: category.value,
      price: Number(price.value),
      price_unit: unit.value.trim() || null,
      description: description.value.trim(),
      campus: profile.campus
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Publish listing";

    if (error) {
      showMessage(box, error.message, "error");
      return;
    }

    showMessage(box, "Listing published! 🎉", "success");
    refreshDashboard(user);
    setTimeout(closeForm, 1200);
  });
}

// ---------- Reload everything that shows listings ----------
function refreshDashboard(user) {
  loadMyListings(user);
  loadJustListed();
  loadStats(user);
}
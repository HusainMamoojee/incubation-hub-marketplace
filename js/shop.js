// Public shop page (shop.html?id=<seller id>): anyone can open it, even without logging in.
// The data comes from the get_public_shop database function, which only returns
// the shop's public details and active listings.
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  const loading = document.getElementById("shopLoading");
  const notFound = document.getElementById("shopNotFound");

  function showNotFound() {
    loading.hidden = true;
    notFound.hidden = false;
  }

  //  Which shop
  const id = new URLSearchParams(window.location.search).get("id") || "";
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (!looksLikeId) {
    showNotFound();
    return;
  }

  // Load the shop and who's looking, at the same time 
  const [result, user] = await Promise.all([
    supabaseClient.rpc("get_public_shop", { p_seller_id: id }),
    getCurrentUser()
  ]);

  const { data, error } = result;

  if (error || !data) {
    if (error) console.error("Could not load shop:", error.message);
    showNotFound();
    return;
  }

  const shop = data.shop;
  const listings = data.listings || [];
  const shopName = shop.shop_name || `${shop.first_name}'s shop`;

  // Shop header 
  document.title = `${shopName} | Hub Market`;
  document.getElementById("shopName").textContent = shopName;
    document.getElementById("shopLevel").dataset.sellerBadge = id; // badges.js fills it in
  document.getElementById("shopAvatar").textContent = initials(shopName.split(" ")[0], shopName.split(" ")[1]);
  document.getElementById("shopOwner").textContent =
    `Run by ${shop.first_name}${shop.last_initial ? " " + shop.last_initial + "." : ""}, an Eduvos student`;

  const description = document.getElementById("shopDescription");
  if (shop.description) {
    description.textContent = shop.description;
  } else {
    description.hidden = true;
  }

  const categoryPill = document.getElementById("shopCategory");
  if (shop.category) {
    categoryPill.textContent = shop.category;
    categoryPill.hidden = false;
  }

  const campusPill = document.getElementById("shopCampus");
  if (shop.campus) {
    campusPill.textContent = shop.campus + " campus";
    campusPill.hidden = false;
  }

  // Visitors who aren't logged in see how to buy
  document.getElementById("shopLogin").hidden = Boolean(user);

  // Listings
  const grid = document.getElementById("shopListings");
  document.getElementById("listingsHeading").textContent =
    listings.length === 1 ? "1 listing" : `${listings.length} listings`;

  if (listings.length === 0) {
    grid.innerHTML = `<p class="empty-state">This shop has nothing listed right now. Check back soon!</p>`;
  } else {
    // renderListingCard() (listing-card.js) expects a seller on each listing
    const seller = { first_name: shop.first_name, last_name: shop.last_initial || "" };
    grid.innerHTML = listings
       .map((listing, index) => renderListingCard({ ...listing, seller, seller_id: id }, index))
      .join("");
  }

  loading.hidden = true;
  document.getElementById("shopDetail").hidden = false;
  document.getElementById("shopListingsSection").hidden = false;

  //  Copy shop link 
  const copyBtn = document.getElementById("copyLinkBtn");

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Shop link copied. Share it with your friends!", "success");
    } catch {
      showToast("Couldn't copy automatically. Copy the address from your browser's address bar.", "error", 6);
    }
  });
})();
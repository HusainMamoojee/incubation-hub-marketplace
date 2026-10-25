// Home dashboard: everything on this page comes from Supabase

// ---------- Run when the page loads ----------
(async function () {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await loadProfile(user);
  showSellerBanner(profile);

  // These three don't depend on each other, so load them at the same time
   const tasks = [
    loadStats(user),
    loadEnquiries(user),
    loadJustListed()
  ];

  // Approved sellers also get their shop
  if (profile && profile.seller_status === "approved") {
    tasks.push(loadShop(user, profile));
  }

  await Promise.all(tasks);
})();

// ---------- 1. Name, initials, campus ----------
async function loadProfile(user) {
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("first_name, last_name, campus, seller_status,shop_name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Could not load profile:", error.message);
    return null;
  }

  const first = profile.first_name || user.email.split("@")[0];

  document.getElementById("userName").textContent = first;
  document.getElementById("headerName").textContent = first;
  document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);

  if (profile.campus) {
    document.getElementById("campusName").textContent = profile.campus + " campus";
    document.getElementById("campusPill").classList.add("show");
  }

  return profile;
}

// ---------- 2. Seller banner ----------
function showSellerBanner(profile) {
  const banner = document.getElementById("sellerBanner");
  if (!banner || !profile) return;

  if (profile.seller_status === "approved") {
    banner.style.display = "none";
  } else if (profile.seller_status === "pending") {
    banner.querySelector("h2").textContent = "Your shop is under review";
    banner.querySelector("p").textContent = "The Incubation Hub is checking your application. You'll be able to add listings once you're approved.";
    banner.querySelector("a").style.display = "none";
  }
}

// ---------- 3. Stats ----------
async function countRows(query) {
  const { count, error } = await query;
  if (error) {
    console.error("Count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function loadStats(user) {
  const [sent, replies, listings, sellers] = await Promise.all([
    countRows(
      supabaseClient.from("enquiries").select("*", { count: "exact", head: true })
        .eq("buyer_id", user.id)
    ),
    countRows(
      supabaseClient.from("enquiries").select("*", { count: "exact", head: true })
        .eq("buyer_id", user.id)
        .eq("status", "replied")
    ),
    countRows(
      supabaseClient.from("listings").select("*", { count: "exact", head: true })
        .eq("status", "active")
    ),
    countRows(
      supabaseClient.from("profiles").select("*", { count: "exact", head: true })
        .eq("seller_status", "approved")
    )
  ]);

  document.getElementById("statEnquiries").textContent = sent;
  document.getElementById("statReplies").textContent = replies;
  document.getElementById("statListings").textContent = listings;
  document.getElementById("statSellers").textContent = sellers;
}

// ---------- 4. Your enquiries ----------
const STATUS_LABELS = {
  new: "Awaiting reply",
  replied: "Replied",
  confirmed: "Confirmed",
  closed: "Closed"
};

async function loadEnquiries(user) {
  const list = document.getElementById("enquiryList");

  const { data: enquiries, error } = await supabaseClient
    .from("enquiries")
     .select(`
      id,
      status,
      seller_reply,
      listing:listings ( id, title ),
      seller:profiles!enquiries_seller_id_fkey ( first_name, last_name )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    list.innerHTML = `<p class="empty-state">We couldn't load your enquiries. Please refresh the page.</p>`;
    console.error("Could not load enquiries:", error.message);
    return;
  }

  if (enquiries.length === 0) {
    list.innerHTML = `
      <p class="empty-state">
        You haven't sent any enquiries yet.
        <a href="browse.html">Browse the marketplace</a> to find something you like.
      </p>`;
    return;
  }

  list.innerHTML = enquiries.map((enquiry) => {
    const title = enquiry.listing ? enquiry.listing.title : "Listing no longer available";
    const seller = enquiry.seller || {};
    const sellerName = `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
    const link = enquiry.listing ? `listing.html?id=${enquiry.listing.id}` : "browse.html";

    return `
      <div class="enquiry-row">
        <span class="avatar">${escapeHtml(initials(seller.first_name, seller.last_name))}</span>
       <div class="enquiry-info">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(sellerName)}</span>
          ${enquiry.seller_reply ? `<span class="enquiry-reply">💬 ${escapeHtml(enquiry.seller_reply)}</span>` : ""}
        </div>
        <span class="status-pill status-${enquiry.status}">${STATUS_LABELS[enquiry.status]}</span>
        <a href="${link}" class="enquiry-link">View</a>
      </div>`;
  }).join("");
}

// ---------- 5. Just listed on the Hub ----------
async function loadJustListed() {
  const grid = document.getElementById("justListed");

  const { data: listings, error } = await supabaseClient
    .from("listings")
    .select(`
      id, title, description, type, price, price_unit,
      seller:profiles ( first_name, last_name )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    grid.innerHTML = `<p class="empty-state">We couldn't load listings. Please refresh the page.</p>`;
    console.error("Could not load listings:", error.message);
    return;
  }

  if (listings.length === 0) {
    grid.innerHTML = `<p class="empty-state">No listings yet. Check back soon!</p>`;
    return;
  }

  grid.innerHTML = listings.map((listing, index) => renderListingCard(listing, index)).join("");
}

  grid.innerHTML = listings.map((listing, index) => renderListingCard(listing, index)).join("");
  const firstCard = grid.querySelector(".listing-card");
  if (firstCard) firstCard.classList.add("lead");

// ---------- Log out ----------
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}
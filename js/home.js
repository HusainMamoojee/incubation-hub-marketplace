// Home: the logged-in buyer's starting point. Everything here comes from Supabase.
// Wrapped in one function so names can't clash with other scripts.

(async function () {
  // Settings for this page 
  // Orders that still need something to happen
  const ACTIVE_ORDER_STATUSES = ["pending_payment", "paid_in_escrow", "delivered", "disputed"];

  // A short "what happens next" line for each of those statuses
  const NEXT_STEP = {
    pending_payment: "Waiting for your payment",
    paid_in_escrow: "Meet the seller to collect",
    delivered: "Confirm you received it",
    disputed: "The Hub is reviewing this"
  };

  // Columns renderListingCard() needs (used by two sections)
  const LISTING_FIELDS = `
    id, title, description, type, price, price_unit, image_url,
    seller:profiles ( first_name, last_name )
  `;

  // Log out
  document.getElementById("logoutBtn").addEventListener("click", logout);

  //  Load the page 
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await loadProfile(user);
  showSellerStatus(profile);

  // These don't depend on each other, so load them at the same time
  await Promise.all([
    loadStats(user),
    loadActiveOrders(user),
    loadJustListed(),
    loadCampusListings(profile),
    loadEnquiries(user)
  ]);

  // Profile: name, initials, campus, admin link
  async function loadProfile(user) {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("first_name, last_name, campus, seller_status, shop_name, is_admin")
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
    if (profile.is_admin) {
      document.getElementById("adminLink").hidden = false;
    }
    return profile;
  }

  // Seller status: quick-action tile + banner 
  function showSellerStatus(profile) {
    if (!profile) return;

    const tile = document.getElementById("qaSell");
    const tileTitle = document.getElementById("qaSellTitle");
    const tileSub = document.getElementById("qaSellSub");
    const banner = document.getElementById("sellerBanner");

    if (profile.seller_status === "approved") {
      tile.href = "dashboard.html";
      tileTitle.textContent = "Seller dashboard";
      tileSub.textContent = profile.shop_name || "Manage your shop";

      banner.querySelector("h2").textContent = "Your shop is live 🎉";
      banner.querySelector("p").textContent = "Add listings, update their status and reply to enquiries in your seller dashboard.";
      const button = banner.querySelector("a");
      button.href = "dashboard.html";
      button.textContent = "Open seller dashboard";

      document.getElementById("dashboardLink").hidden = false;
    } else if (profile.seller_status === "pending") {
      tile.href = "#sell";
      tileTitle.textContent = "Shop under review";
      tileSub.textContent = "The Hub is checking it";

      banner.querySelector("h2").textContent = "Your shop is under review";
      banner.querySelector("p").textContent = "The Incubation Hub is checking your application. You'll be able to add listings once you're approved.";
      banner.querySelector("a").hidden = true;
    }
  }

  //  Numbers for the quick actions and trust block 
  async function countRows(query) {
    const { count, error } = await query;
    if (error) {
      console.error("Count failed:", error.message);
      return 0;
    }
    return count ?? 0;
  }

  async function loadStats(user) {
    const [listings, activeOrders, replies, sellers] = await Promise.all([
      countRows(
        supabaseClient.from("listings").select("*", { count: "exact", head: true })
          .eq("status", "active")
      ),
      countRows(
        supabaseClient.from("orders").select("*", { count: "exact", head: true })
          .eq("buyer_id", user.id)
          .in("status", ACTIVE_ORDER_STATUSES)
      ),
      countRows(
        supabaseClient.from("enquiries").select("*", { count: "exact", head: true })
          .eq("buyer_id", user.id)
          .eq("status", "replied")
      ),
      countRows(
        supabaseClient.from("profiles").select("*", { count: "exact", head: true })
          .eq("seller_status", "approved")
      )
    ]);

    document.getElementById("qaListings").textContent = listings;
    document.getElementById("qaOrders").textContent = activeOrders;
    document.getElementById("qaReplies").textContent = replies;
    document.getElementById("trustSellers").textContent = sellers;
  }

  //  Orders in progress (preview only; actions live on orders.html)
  async function loadActiveOrders(user) {
    const section = document.getElementById("inProgress");
    const list = document.getElementById("activeOrders");

    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select(`
        id, amount, status,
        listing:listings ( title ),
        seller:profiles!orders_seller_id_fkey ( first_name, last_name, shop_name )
      `)
      .eq("buyer_id", user.id)
      .in("status", ACTIVE_ORDER_STATUSES)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Could not load orders:", error.message);
      return;
    }
    if (orders.length === 0) return; // section stays hidden

    list.innerHTML = orders.map((order) => {
      const seller = order.seller || {};
      const sellerName = seller.shop_name || `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
      const title = order.listing ? order.listing.title : "Listing no longer available";

      return `
        <a href="orders.html" class="progress-item">
          <span class="avatar">${escapeHtml(initials(seller.first_name, seller.last_name))}</span>
          <span class="progress-info">
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(sellerName)} · ${NEXT_STEP[order.status]}</small>
          </span>
          <span class="order-amount">${formatPrice(order.amount)}</span>
          <span class="status-pill status-${order.status}">${ORDER_STATUS_LABELS[order.status]}</span>
        </a>`;
    }).join("");

    section.hidden = false;
  }

  // Just listed on the Hub 
  async function loadJustListed() {
    const grid = document.getElementById("justListed");

    const { data: listings, error } = await supabaseClient
      .from("listings")
      .select(LISTING_FIELDS)
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

  // On your campus 
  async function loadCampusListings(profile) {
    if (!profile || !profile.campus) return;

    const section = document.getElementById("campusSection");
    const grid = document.getElementById("campusListings");

    const { data: listings, error } = await supabaseClient
      .from("listings")
      .select(LISTING_FIELDS)
      .eq("status", "active")
      .eq("campus", profile.campus)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Could not load campus listings:", error.message);
      return;
    }
    if (listings.length === 0) return; // section stays hidden

    document.getElementById("campusHeading").textContent = `On the ${profile.campus} campus`;
    document.getElementById("campusLink").href = `browse.html?campus=${encodeURIComponent(profile.campus)}`;
    grid.innerHTML = listings.map((listing, index) => renderListingCard(listing, index)).join("");
    section.hidden = false;
  }

  // Your messages (STATUS_LABELS lives in main.js)
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
      .limit(4);

    if (error) {
      list.innerHTML = `<p class="empty-state">We couldn't load your messages. Please refresh the page.</p>`;
      console.error("Could not load enquiries:", error.message);
      return;
    }

    if (enquiries.length === 0) {
      list.innerHTML = `
        <p class="empty-state">
          You haven't messaged any sellers yet.
          <a href="browse.html">Browse the marketplace</a> and ask about something you like.
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
})();
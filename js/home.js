// Home dashboard: everything on this page comes from Supabase

// Run when the page loads
(async function () {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await loadProfile(user);
  showSellerBanner(profile);

  // Order buttons only need setting up once
  setupOrderActions(user);

  // These don't depend on each other, so load them at the same time
  await Promise.all([
    loadStats(user),
    loadEnquiries(user),
    loadOrders(user),
    loadJustListed()
  ]);
})();

// Name, initials, campus
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

// Seller banner
function showSellerBanner(profile) {
  const banner = document.getElementById("sellerBanner");
  if (!banner || !profile) return;

  if (profile.seller_status === "approved") {
    // Approved sellers: link to their dashboard
    banner.querySelector("h2").textContent = "Your shop is live 🎉";
    banner.querySelector("p").textContent = "Add listings, update their status and reply to enquiries in your seller dashboard.";

    const button = banner.querySelector("a");
    button.href = "dashboard.html";
    button.textContent = "Open seller dashboard";

    document.getElementById("dashboardLink").hidden = false;
  } else if (profile.seller_status === "pending") {
    banner.querySelector("h2").textContent = "Your shop is under review";
    banner.querySelector("p").textContent = "The Incubation Hub is checking your application. You'll be able to add listings once you're approved.";
    banner.querySelector("a").style.display = "none";
  }
}

// Stats
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

// Your enquiries (STATUS_LABELS lives in main.js)
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

// Your orders (buyer). ORDER_STATUS_LABELS lives in main.js
async function loadOrders(user) {
  const list = document.getElementById("orderList");

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select(`
      id, amount, status, created_at, dispute_reason,
      listing:listings ( id, title ),
      seller:profiles!orders_seller_id_fkey ( first_name, last_name, shop_name )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<p class="empty-state">We couldn't load your orders. Please refresh the page.</p>`;
    console.error("Could not load orders:", error.message);
    return;
  }

  if (orders.length === 0) {
    list.innerHTML = `
      <p class="empty-state">
        No orders yet. <a href="browse.html">Browse the marketplace</a> to find something you like.
      </p>`;
    return;
  }

  list.innerHTML = orders.map(renderBuyerOrder).join("");
}

function renderBuyerOrder(order) {
  const seller = order.seller || {};
  const sellerName = seller.shop_name || `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
  const title = order.listing ? order.listing.title : "Listing no longer available";
  const amount = formatPrice(order.amount);
  const date = new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

  // What the buyer sees depends on the status
  let details = "";

  if (order.status === "pending_payment") {
    details = `
      <p class="order-note">This order isn't confirmed until you pay.</p>
      <div class="inbox-actions">
        <button type="button" class="btn btn-mint btn-sm" data-action="pay">Pay ${amount} (demo)</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cancel">Cancel order</button>
      </div>`;
  } else if (order.status === "paid_in_escrow" || order.status === "delivered") {
    const note = order.status === "paid_in_escrow"
      ? `💰 ${amount} is held in escrow. Meet the seller on campus to collect.`
      : `📦 The seller says this was delivered. Confirm to release ${amount} to them.`;

    details = `
      <p class="order-note">${note}</p>
      <div class="inbox-actions">
        <button type="button" class="btn btn-mint btn-sm" data-action="confirm">I received it</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="report">Report a problem</button>
      </div>
      <form class="reply-form dispute-form" hidden>
        <textarea rows="2" maxlength="500" placeholder="What went wrong? e.g. The seller didn't show up." aria-label="Describe the problem"></textarea>
        <button type="submit" class="btn btn-indigo btn-sm">Send to the Hub</button>
      </form>`;
  } else if (order.status === "disputed") {
    details = `
      <p class="order-note warning">
        ⚠️ The Incubation Hub is reviewing this order. Your money stays in escrow until it's resolved.
        ${order.dispute_reason ? `<br>Reason: ${escapeHtml(order.dispute_reason)}` : ""}
      </p>`;
  } else if (order.status === "completed") {
    details = `<p class="order-note">✓ ${amount} released to the seller.</p>`;
  } else if (order.status === "refunded") {
    details = `<p class="order-note">↩ ${amount} refunded to you.</p>`;
  }

  return `
    <div class="inbox-item" data-order-id="${order.id}">
      <div class="inbox-head">
        <span class="avatar">${escapeHtml(initials(seller.first_name, seller.last_name))}</span>
        <div class="enquiry-info">
          <strong>${escapeHtml(title)}</strong>
          <span>Order #${order.id} · ${escapeHtml(sellerName)} · ${date}</span>
        </div>
        <span class="order-amount">${amount}</span>
        <span class="status-pill status-${order.status}">${ORDER_STATUS_LABELS[order.status]}</span>
      </div>
      ${details}
    </div>`;
}

// Order buttons (one listener for every order)
function setupOrderActions(user) {
  const list = document.getElementById("orderList");
  const message = document.getElementById("ordersMessage");
  if (!list) return;

  const SUCCESS_TEXT = {
    pay: "Payment received 🎉 Your money is held safely in escrow.",
    cancel: "Order cancelled.",
    confirm: "Thanks for confirming! The payment has been released to the seller.",
    dispute: "Problem reported. The Incubation Hub will review this order and contact you."
  };

  async function runAction(orderId, action, reason = null) {
    const { error } = await supabaseClient.rpc("order_action", {
      p_order_id: orderId,
      p_action: action,
      p_reason: reason
    });

    if (error) {
      showMessage(message, error.message, "error");
    } else {
      showMessage(message, SUCCESS_TEXT[action], "success");
    }

    loadOrders(user);
  }

  // Buttons: pay, cancel, confirm, report
  list.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const item = button.closest("[data-order-id]");
    const orderId = Number(item.dataset.orderId);
    const action = button.dataset.action;

    // "Report a problem" just opens the reason box
    if (action === "report") {
      const form = item.querySelector(".dispute-form");
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("textarea").focus();
      return;
    }

    // Releasing money can't be undone, so double-check
    if (action === "confirm") {
      const ok = confirm("Have you received this order? Confirming releases the payment to the seller and can't be undone.");
      if (!ok) return;
    }

    button.disabled = true;
    await runAction(orderId, action);
  });

  // Sending a problem report
  list.addEventListener("submit", async (e) => {
    if (!e.target.classList.contains("dispute-form")) return;
    e.preventDefault();

    const form = e.target;
    const textarea = form.querySelector("textarea");
    const reason = textarea.value.trim();

    if (reason === "") {
      textarea.focus();
      return;
    }

    const orderId = Number(form.closest("[data-order-id]").dataset.orderId);
    form.querySelector("button").disabled = true;
    await runAction(orderId, "dispute", reason);
  });
}

// Just listed on the Hub
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

  const firstCard = grid.querySelector(".listing-card");
  if (firstCard) firstCard.classList.add("lead");
}

// Log out
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}
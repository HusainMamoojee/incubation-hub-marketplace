// My orders (buyer): track orders, pay (demo), confirm receipt, report problems.
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  const user = await getCurrentUser();
  if (!user) return;

  const list = document.getElementById("orderList");
  const message = document.getElementById("ordersMessage");

  // ---------- Header name and avatar ----------
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  if (profile) {
    document.getElementById("headerName").textContent = profile.first_name || user.email.split("@")[0];
    document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);
  }

  // ---------- Load orders ----------
  async function loadOrders() {
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

    showOrderStats(orders);

    if (orders.length === 0) {
      list.innerHTML = `
        <p class="empty-state">
          No orders yet. <a href="browse.html">Browse the marketplace</a> to find something you like.
        </p>`;
      return;
    }

    list.innerHTML = orders.map(renderOrder).join("");
  }

  // ---------- Stats ----------
  function showOrderStats(orders) {
    const sum = (rows) => rows.reduce((total, order) => total + Number(order.amount), 0);

    const active = orders.filter((o) => ["pending_payment", "paid_in_escrow", "delivered", "disputed"].includes(o.status));
    const inEscrow = orders.filter((o) => ["paid_in_escrow", "delivered", "disputed"].includes(o.status));
    const completed = orders.filter((o) => o.status === "completed");

    document.getElementById("statActiveOrders").textContent = active.length;
    document.getElementById("statBuyerEscrow").textContent = formatPrice(sum(inEscrow));
    document.getElementById("statCompletedOrders").textContent = completed.length;
    document.getElementById("statTotalSpent").textContent = formatPrice(sum(completed));
  }

  // ---------- One order ----------
  function renderOrder(order) {
    const seller = order.seller || {};
    const sellerName = seller.shop_name || `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
    const title = order.listing ? order.listing.title : "Listing no longer available";
    const link = order.listing ? `listing.html?id=${order.listing.id}` : "browse.html";
    const amount = formatPrice(order.amount);
    const date = new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

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
            <strong><a href="${link}">${escapeHtml(title)}</a></strong>
            <span>Order #${order.id} · ${escapeHtml(sellerName)} · ${date}</span>
          </div>
          <span class="order-amount">${amount}</span>
          <span class="status-pill status-${order.status}">${ORDER_STATUS_LABELS[order.status]}</span>
        </div>
        ${details}
      </div>`;
  }

  // ---------- Buttons (one listener for every order) ----------
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

    loadOrders();
  }

  list.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const item = button.closest("[data-order-id]");
    const orderId = Number(item.dataset.orderId);
    const action = button.dataset.action;

    if (action === "report") {
      const form = item.querySelector(".dispute-form");
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("textarea").focus();
      return;
    }

    if (action === "confirm") {
      const ok = confirm("Have you received this order? Confirming releases the payment to the seller and can't be undone.");
      if (!ok) return;
    }

    button.disabled = true;
    await runAction(orderId, action);
  });

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

  // ---------- Go ----------
  await loadOrders();

  document.getElementById("logoutBtn").addEventListener("click", logout);
})();
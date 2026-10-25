// Hub admin: approve sellers and resolve escrow disputes.
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  const user = await getCurrentUser();
  if (!user) return;

  // ---------- 1. Admins only ----------
  const { data: me, error: meError } = await supabaseClient
    .from("profiles")
    .select("first_name, last_name, is_admin")
    .eq("id", user.id)
    .single();

  if (meError || !me || !me.is_admin) {
    window.location.replace(HOME_PAGE);
    return;
  }

  document.getElementById("headerName").textContent = me.first_name || "Admin";
  document.getElementById("userAvatar").textContent = initials(me.first_name, me.last_name);

  const applicationList = document.getElementById("applicationList");
  const applicationsMessage = document.getElementById("applicationsMessage");
  const disputeList = document.getElementById("disputeList");
  const disputesMessage = document.getElementById("disputesMessage");

  // ---------- 2. Seller applications ----------
  async function loadApplications() {
    const { data: applicants, error } = await supabaseClient
      .from("profiles")
      .select("id, first_name, last_name, campus, shop_name, shop_category, shop_description, created_at")
      .eq("seller_status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      applicationList.innerHTML = `<p class="empty-state">Couldn't load applications.</p>`;
      console.error("Could not load applications:", error.message);
      return;
    }

    document.getElementById("statPending").textContent = applicants.length;

    if (applicants.length === 0) {
      applicationList.innerHTML = `<p class="empty-state">No pending applications. 🎉</p>`;
      return;
    }

    applicationList.innerHTML = applicants.map((person) => `
      <div class="inbox-item" data-user-id="${person.id}">
        <div class="inbox-head">
          <span class="avatar">${escapeHtml(initials(person.first_name, person.last_name))}</span>
          <div class="enquiry-info">
            <strong>${escapeHtml(person.shop_name || "Unnamed shop")}</strong>
            <span>
              ${escapeHtml(person.first_name)} ${escapeHtml(person.last_name)} ·
              ${escapeHtml(person.campus || "No campus")} ·
              ${escapeHtml(person.shop_category || "No category")}
            </span>
          </div>
          <span class="status-pill status-new">Pending</span>
        </div>
        <p class="inbox-message">${escapeHtml(person.shop_description || "No description given.")}</p>
        <div class="inbox-actions">
          <button type="button" class="btn btn-mint btn-sm" data-decision="approved">Approve seller</button>
          <button type="button" class="btn btn-ghost btn-sm" data-decision="rejected">Reject</button>
        </div>
      </div>
    `).join("");
  }

  applicationList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-decision]");
    if (!button) return;

    const item = button.closest("[data-user-id]");
    const decision = button.dataset.decision;

    if (decision === "rejected" && !confirm("Reject this seller application?")) return;

    button.disabled = true;

    const { error } = await supabaseClient.rpc("set_seller_status", {
      p_user_id: item.dataset.userId,
      p_status: decision
    });

    if (error) {
      showMessage(applicationsMessage, error.message, "error");
    } else {
      showMessage(
        applicationsMessage,
        decision === "approved" ? "Seller approved. They can now add listings. ✓" : "Application rejected.",
        "success"
      );
    }

    loadApplications();
    loadOverview();
  });

  // ---------- 3. Disputes ----------
  async function loadDisputes() {
    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select(`
        id, amount, dispute_reason, buyer_note, created_at, paid_at, delivered_at,
        listing:listings ( title ),
        buyer:profiles!orders_buyer_id_fkey ( first_name, last_name ),
        seller:profiles!orders_seller_id_fkey ( first_name, last_name, shop_name )
      `)
      .eq("status", "disputed")
      .order("created_at", { ascending: true });

    if (error) {
      disputeList.innerHTML = `<p class="empty-state">Couldn't load disputes.</p>`;
      console.error("Could not load disputes:", error.message);
      return;
    }

    document.getElementById("statDisputes").textContent = orders.length;

    if (orders.length === 0) {
      disputeList.innerHTML = `<p class="empty-state">No open disputes. Everyone's happy. 🙌</p>`;
      return;
    }

    const day = (value) =>
      value ? new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "–";

    disputeList.innerHTML = orders.map((order) => {
      const buyer = order.buyer || {};
      const seller = order.seller || {};
      const sellerName = seller.shop_name || `${seller.first_name || ""} ${seller.last_name || ""}`;

      return `
        <div class="inbox-item" data-order-id="${order.id}">
          <div class="inbox-head">
            <span class="avatar">#${order.id}</span>
            <div class="enquiry-info">
              <strong>${escapeHtml(order.listing ? order.listing.title : "Listing")}</strong>
              <span>
                Buyer: ${escapeHtml(`${buyer.first_name || ""} ${buyer.last_name || ""}`)} ·
                Seller: ${escapeHtml(sellerName)}
              </span>
              <span>Ordered ${day(order.created_at)} · Paid ${day(order.paid_at)} · Delivered ${day(order.delivered_at)}</span>
            </div>
            <span class="order-amount">${formatPrice(order.amount)}</span>
            <span class="status-pill status-disputed">Disputed</span>
          </div>
          <p class="inbox-message"><strong>Problem:</strong> ${escapeHtml(order.dispute_reason || "No reason given.")}</p>
          <div class="inbox-actions">
            <button type="button" class="btn btn-mint btn-sm" data-resolve="release">Release ${formatPrice(order.amount)} to seller</button>
            <button type="button" class="btn btn-ghost btn-sm" data-resolve="refund">Refund buyer</button>
          </div>
        </div>`;
    }).join("");
  }

  disputeList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-resolve]");
    if (!button) return;

    const item = button.closest("[data-order-id]");
    const action = button.dataset.resolve;
    const question = action === "release"
      ? "Release the payment to the seller? This can't be undone."
      : "Refund the buyer? This can't be undone.";

    if (!confirm(question)) return;

    button.disabled = true;

    const { error } = await supabaseClient.rpc("order_action", {
      p_order_id: Number(item.dataset.orderId),
      p_action: action
    });

    if (error) {
      showMessage(disputesMessage, error.message, "error");
    } else {
      showMessage(
        disputesMessage,
        action === "release" ? "Payment released to the seller. ✓" : "Buyer refunded. ✓",
        "success"
      );
    }

    loadDisputes();
    loadOverview();
  });

  // ---------- 4. Overview numbers ----------
  async function loadOverview() {
    const [escrowResult, sellersResult] = await Promise.all([
      supabaseClient
        .from("orders")
        .select("amount")
        .in("status", ["paid_in_escrow", "delivered", "disputed"]),
      supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("seller_status", "approved")
    ]);

    const held = (escrowResult.data || []).reduce((total, order) => total + Number(order.amount), 0);

    document.getElementById("statEscrowAll").textContent = formatPrice(held);
    document.getElementById("statApproved").textContent = sellersResult.count ?? 0;
  }

  // ---------- 5. Load everything ----------
  await Promise.all([loadApplications(), loadDisputes(), loadOverview()]);

  // ---------- Log out ----------
  document.getElementById("logoutBtn").addEventListener("click", logout);
})();
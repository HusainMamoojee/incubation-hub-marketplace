// Seller plan on the dashboard: R39 a month, no commission, 30-day free trial.
// Shows how long the plan has left and lets the seller renew (DEMO payment).
// The real rules (hidden listings, no new listings, no orders) are enforced by the database.
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  const card = document.getElementById("planCard");
  if (!card) return;

  const PRICE = 39;
  const WARN_DAYS = 5;
  const DAY = 24 * 60 * 60 * 1000;

  const user = await getCurrentUser();
  if (!user) return;

  function niceDate(date) {
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }

  // Lapsed sellers can't publish: grey out the "+ Add listing" buttons
  function lockAddListing(locked) {
    ["heroAddListing", "openAddListing"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = locked;
      btn.title = locked ? "Renew your plan to add listings" : "";
    });
  }

  async function loadPlan() {
    const { data: plan, error } = await supabaseClient
      .from("seller_subscriptions")
      .select("plan, paid_until")
      .eq("seller_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Could not load your plan:", error.message);
      card.hidden = true;
      return;
    }

    render(plan);
  }

  function render(plan) {
    const until = plan ? new Date(plan.paid_until) : null;
    const daysLeft = until ? Math.ceil((until - Date.now()) / DAY) : 0;
    const active = daysLeft > 0;
    const isTrial = plan && plan.plan === "trial";

    let state, badge, title, text, buttonText, buttonClass;

    if (!active) {
      state = "lapsed";
      badge = "Plan ended";
      title = until ? `Your plan ended on ${niceDate(until)}` : "You don't have a plan yet";
      text = "Your listings are hidden from buyers and you can't add new ones. Renew to bring everything back instantly. Nothing has been deleted.";
      buttonText = `Renew for R${PRICE}`;
      buttonClass = "btn-indigo";
    } else if (daysLeft <= WARN_DAYS) {
      state = "warning";
      badge = isTrial ? "Free trial" : "Seller plan";
      title = `Your ${isTrial ? "free trial" : "plan"} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      text = `Renew before ${niceDate(until)} to keep your listings visible to buyers.`;
      buttonText = `Renew for R${PRICE}`;
      buttonClass = "btn-mint";
    } else {
      state = "active";
      badge = isTrial ? "Free trial" : "Seller plan";
      title = isTrial ? `Free trial · ${daysLeft} days left` : `Active until ${niceDate(until)}`;
      text = isTrial
        ? `After ${niceDate(until)} it's R${PRICE} a month. No commission: you keep 100% of every sale.`
        : `R${PRICE} a month. No commission: you keep 100% of every sale.`;
      buttonText = isTrial ? `Subscribe for R${PRICE}/month` : "Renew early";
      buttonClass = "btn-ghost";
    }

    card.className = `plan-card plan-${state}`;
    card.innerHTML = `
      <div class="plan-text">
        <span class="plan-badge">${badge}</span>
        <strong>${title}</strong>
        <p>${text}</p>
      </div>
      <button type="button" class="btn ${buttonClass} btn-sm" id="renewPlanBtn">${buttonText}</button>`;
    card.hidden = false;

    lockAddListing(!active);
  }

  // Renew: +30 days on top of any days left (DEMO payment)
  card.addEventListener("click", async (e) => {
    const button = e.target.closest("#renewPlanBtn");
    if (!button) return;

    const ok = await confirmDialog({
      title: `Renew your plan for R${PRICE}?`,
      text: "You get 30 more days of selling, added on top of any days you have left. Demo: no real money is taken.",
      confirmText: `Pay R${PRICE}`,
      cancelText: "Not now"
    });
    if (!ok) return;

    button.disabled = true;
    button.textContent = "Processing...";

    const { data: newUntil, error } = await supabaseClient.rpc("renew_subscription");

    if (error) {
      showToast("Couldn't renew your plan: " + error.message, "error", 6);
      button.disabled = false;
      return;
    }

    showToast(`Plan renewed! You're active until ${niceDate(new Date(newUntil))}.`, "success");
    await loadPlan();

    // Listings may have just become visible again: refresh the dashboard numbers
    if (typeof refreshDashboard === "function") refreshDashboard(user);
  });

  await loadPlan();
})();
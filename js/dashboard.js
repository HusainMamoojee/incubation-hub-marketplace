// Seller dashboard: only approved sellers can use this page.
// The shop, listings, orders and enquiries code lives in seller.js.

(async function () {
  // Log out
  document.getElementById("logoutBtn").addEventListener("click", logout);

  setupTabs();

  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("first_name, last_name, campus, seller_status, shop_name")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("Could not load profile:", error ? error.message : "no profile");
    return;
  }

  // Not an approved seller? Send them back home
  if (profile.seller_status !== "approved") {
    window.location.replace("home.html");
    return;
  }

  // Header name and avatar
  document.getElementById("headerName").textContent = profile.first_name || user.email.split("@")[0];
  document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);

  // Shop subtitle
  if (profile.campus) {
    document.getElementById("shopSub").textContent =
      `Selling on the ${profile.campus} campus. Manage your orders, listings and messages in one place.`;
  }

  await loadShop(user, profile);

  // ---------- Tabs: Orders / Listings / Enquiries ----------
  function setupTabs() {
    const tabs = document.querySelectorAll(".seller-tab");
    const panels = document.querySelectorAll(".seller-panel");

    function showTab(panelId) {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === panelId;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive);
      });
      panels.forEach((panel) => {
        panel.hidden = panel.id !== panelId;
      });

      // Remember the tab in the URL (e.g. dashboard.html#inbox), so refreshing keeps you there
      history.replaceState(null, "", "#" + panelId);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => showTab(tab.dataset.tab));
    });

    // The "+ Add listing" button in the header jumps to Listings and opens the form
    document.getElementById("heroAddListing").addEventListener("click", () => {
      showTab("myShop");
      document.getElementById("openAddListing").click();
    });

    // Open the tab named in the URL, if there is one
    const fromUrl = window.location.hash.slice(1);
    if (document.getElementById(fromUrl)?.classList.contains("seller-panel")) {
      showTab(fromUrl);
    }
  }
})();
// Seller dashboard will only have approved sellers can use this page

(async function () {
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

  // Not an approved seller?
  //  Send them back home
  if (profile.seller_status !== "approved") {
    window.location.replace("home.html");
    return;
  }

  // Header name and avatar
  document.getElementById("headerName").textContent = profile.first_name || user.email.split("@")[0];
  document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);

  // Shop, listings, add-listing form and inbox all from seller.js 
  await loadShop(user, profile);
})();

// Log out
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}
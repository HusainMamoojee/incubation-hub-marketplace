// Become a seller: apply through Supabase, then wait for Hub approval

// ---------- Already applied? Show their status instead of the form ----------
(async function () {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("seller_status")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  if (profile.seller_status === "approved") {
    showMessage(
      document.getElementById("formMessage"),
      "You're already an approved seller. Taking you to your dashboard...",
      "success"
    );
    document.querySelector('#sellerForm button[type="submit"]').disabled = true;
    setTimeout(() => { window.location.replace(HOME_PAGE); }, 1500);
  } else if (profile.seller_status === "pending") {
    showMessage(
      document.getElementById("formMessage"),
      "Your application is being reviewed by the Incubation Hub. We'll let you know once your shop is approved.",
      "success"
    );
    document.querySelector('#sellerForm button[type="submit"]').disabled = true;
  }
})();

// ---------- Submit the application ----------
const sellerForm = document.getElementById("sellerForm");

if (sellerForm) {
  sellerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(sellerForm);

    const shopName = document.getElementById("shopName");
    const category = document.getElementById("category");
    const description = document.getElementById("description");
    const terms = document.getElementById("terms");
    const box = document.getElementById("formMessage");
    let valid = true;

    if (shopName.value.trim() === "") {
      setError(shopName, "Enter a name for your shop.");
      valid = false;
    }
    if (category.value === "") {
      setError(category, "Choose a category.");
      valid = false;
    }
    if (description.value.trim() === "") {
      setError(description, "Tell us what you'll be selling.");
      valid = false;
    }
    if (!terms.checked) {
      setError(terms, "Please accept the guidelines to continue.");
      valid = false;
    }
    if (!valid) return;

    const submitBtn = sellerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending application...";

    const { error } = await supabaseClient.rpc("apply_to_sell", {
      p_shop_name: shopName.value.trim(),
      p_shop_category: category.value,
      p_shop_description: description.value.trim()
    });

    if (error) {
      showMessage(box, error.message, "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Become a seller";
      return;
    }

    showMessage(box, "Application sent! The Incubation Hub will review your shop shortly.", "success");
    setTimeout(() => { window.location.href = HOME_PAGE; }, 1500);
  });
}
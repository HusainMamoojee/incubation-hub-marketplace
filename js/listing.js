// Listing page: one listing in full, plus the "Message the seller" form.
// All the code sits inside one function, so its variable names can't
// clash with the other scripts on the page.

(async function () {
  const loading = document.getElementById("listingLoading");
  const notFound = document.getElementById("listingNotFound");
  const detail = document.getElementById("listingDetail");

  function showNotFound() {
    loading.hidden = true;
    notFound.hidden = false;
  }

  // ---------- 1. Which listing? ----------
  const id = Number(new URLSearchParams(window.location.search).get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    showNotFound();
    return;
  }

  // ---------- 2. Load the user and the listing at the same time ----------
  const [user, result] = await Promise.all([
    getCurrentUser(),
    supabaseClient
      .from("listings")
      .select(`
        id, seller_id, title, description, type, category, price, price_unit, campus, status,
        seller:profiles ( first_name, last_name, shop_name )
      `)
      .eq("id", id)
      .maybeSingle()
  ]);

  const { data: listing, error } = result;

  if (error || !listing) {
    if (error) console.error("Could not load listing:", error.message);
    showNotFound();
    return;
  }

  // ---------- 3. Fill in the page ----------
  const isService = listing.type === "service";
  const seller = listing.seller || {};
  const sellerName = `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;

  document.title = `${listing.title} | Hub Market`;

  document.getElementById("listingImage").classList.add(`ph-${(listing.id % 3) + 1}`);

  const typeTag = document.getElementById("listingTypeTag");
  typeTag.textContent = isService ? "Service" : "Product";
  if (!isService) typeTag.classList.add("tag-mint");

  document.getElementById("listingTitle").textContent = listing.title;
  document.getElementById("listingCategory").textContent = listing.category;

  const campusPill = document.getElementById("listingCampus");
  if (listing.campus) {
    campusPill.textContent = listing.campus + " campus";
  } else {
    campusPill.hidden = true;
  }

  document.getElementById("listingDescription").textContent =
    listing.description || "The seller hasn't added a description yet.";

  document.getElementById("priceLabel").textContent = isService ? "From" : "Price";
  document.getElementById("listingPrice").textContent = formatPrice(listing.price);
  document.getElementById("listingUnit").textContent = listing.price_unit ? "/" + listing.price_unit : "";

  document.getElementById("sellerAvatar").textContent = initials(seller.first_name, seller.last_name);
  document.getElementById("sellerShop").textContent = seller.shop_name || sellerName;
  document.getElementById("sellerName").textContent = seller.shop_name ? "by " + sellerName : "";

  loading.hidden = true;
  detail.hidden = false;

  // ---------- 4. Is this the seller's own listing? ----------
  const form = document.getElementById("enquiryForm");
  const messageBox = document.getElementById("formMessage");
  const viewEnquiries = document.getElementById("viewEnquiries");

  if (user && listing.seller_id === user.id) {
    form.hidden = true;
    document.getElementById("ownListingNote").hidden = false;
    return;
  }

  // ---------- 5. Already enquired? Let them know ----------
  const { count } = await supabaseClient
    .from("enquiries")
    .select("*", { count: "exact", head: true })
    .eq("listing_id", listing.id)
    .eq("buyer_id", user.id);

  if (count > 0) {
    showMessage(messageBox, "You've already messaged this seller. Their reply will show on your dashboard.", "success");
    viewEnquiries.hidden = false;
  }

  // ---------- 6. Send an enquiry ----------
  const messageInput = document.getElementById("enquiryMessage");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(form);

    const text = messageInput.value.trim();

    if (text === "") {
      setError(messageInput, "Write a short message to the seller.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const { error: sendError } = await supabaseClient
      .from("enquiries")
      .insert({ listing_id: listing.id, message: text });

    if (sendError) {
      showMessage(messageBox, "Couldn't send your enquiry: " + sendError.message, "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Send enquiry";
      return;
    }

    // Success: swap the form for a confirmation
    form.querySelector(".field").hidden = true;
    submitBtn.hidden = true;
    form.querySelector(".hint").hidden = true;
    showMessage(messageBox, "Enquiry sent! 🎉 You'll see the seller's reply on your dashboard.", "success");
    viewEnquiries.hidden = false;
  });
})();
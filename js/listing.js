// Listing page: one listing in full, the checkout (escrow), and the "Message the seller" form.
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

  //  Which listing? 
  const id = Number(new URLSearchParams(window.location.search).get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    showNotFound();
    return;
  }

  // Load the user and the listing at the same time 
  const [user, result] = await Promise.all([
    getCurrentUser(),
    supabaseClient
      .from("listings")
      .select(`
        id, seller_id, title, description, type, category, price, price_unit, campus, status, image_url,
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

  // Fill in the page 
  const isService = listing.type === "service";
  const seller = listing.seller || {};
  const sellerName = `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;

  document.title = `${listing.title} | Hub Market`;

 const imageBox = document.getElementById("listingImage");
  imageBox.classList.add(`ph-${(listing.id % 3) + 1}`);

  const photo = safeImageUrl(listing.image_url);
  if (photo) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = listing.title;
    imageBox.prepend(img);
  }

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

  //  Is this the seller's own listing
  const form = document.getElementById("enquiryForm");
  const messageBox = document.getElementById("formMessage");
  const viewEnquiries = document.getElementById("viewEnquiries");

  if (user && listing.seller_id === user.id) {
    form.hidden = true;
    document.getElementById("buyBox").hidden = true;
    document.getElementById("ownListingNote").hidden = false;
    return;
  }

  //  Already enquired? Let them know 
  const { count } = await supabaseClient
    .from("enquiries")
    .select("*", { count: "exact", head: true })
    .eq("listing_id", listing.id)
    .eq("buyer_id", user.id);

  if (count > 0) {
    showMessage(messageBox, "You've already messaged this seller. Their reply will show on your dashboard.", "success");
    viewEnquiries.hidden = false;
  }

  //  Send an enquiry 
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

  //Checkout: place an order, then pay into escrow (demo) 
  const buyBox = document.getElementById("buyBox");
  const buyBtn = document.getElementById("buyBtn");
  const checkoutPanel = document.getElementById("checkoutPanel");
  const orderNote = document.getElementById("orderNote");
  const checkoutMessage = document.getElementById("checkoutMessage");
  const placeOrderBtn = document.getElementById("placeOrderBtn");
  const payBtn = document.getElementById("payBtn");
  const viewOrderBtn = document.getElementById("viewOrderBtn");
  const cancelCheckoutBtn = document.getElementById("cancelCheckoutBtn");

  const priceText = formatPrice(listing.price) + (listing.price_unit ? "/" + listing.price_unit : "");
  const payLabel = `Pay ${formatPrice(listing.price)} into escrow (demo)`;

  buyBtn.textContent = isService ? "Book this service" : "Buy now";
  document.getElementById("checkoutItem").textContent = listing.title;
  document.getElementById("checkoutAmount").textContent = priceText;
  payBtn.textContent = payLabel;

  let orderId = null;

  function resetCheckout() {
    orderId = null;
    orderNote.value = "";
    orderNote.disabled = false;
    checkoutMessage.className = "form-message";
    placeOrderBtn.hidden = false;
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Place order";
    payBtn.hidden = true;
    payBtn.disabled = false;
    payBtn.textContent = payLabel;
    viewOrderBtn.hidden = true;
    cancelCheckoutBtn.hidden = false;
    cancelCheckoutBtn.disabled = false;
    checkoutPanel.hidden = true;
    buyBox.hidden = false;
  }

  // Open checkout
  buyBtn.addEventListener("click", () => {
    buyBox.hidden = true;
    checkoutPanel.hidden = false;
    orderNote.focus();
  });

  // Cancel: if an unpaid order was already placed, cancel it in the database too
  cancelCheckoutBtn.addEventListener("click", async () => {
    if (orderId) {
      cancelCheckoutBtn.disabled = true;
      await supabaseClient.rpc("order_action", { p_order_id: orderId, p_action: "cancel" });
    }
    resetCheckout();
  });

  //  place the order
  placeOrderBtn.addEventListener("click", async () => {
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Placing order...";

    const { data: newOrderId, error: orderError } = await supabaseClient.rpc("create_order", {
      p_listing_id: listing.id,
      p_note: orderNote.value.trim()
    });

    if (orderError) {
      showMessage(checkoutMessage, orderError.message, "error");
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = "Place order";
      return;
    }

    orderId = newOrderId;
    orderNote.disabled = true;
    placeOrderBtn.hidden = true;
    payBtn.hidden = false;
    showMessage(checkoutMessage, `Order #${orderId} placed. Pay into escrow to confirm it.`, "success");
  });

  // pay into escrow (DEMO: in production this is TradeSafe's payment page)
  payBtn.addEventListener("click", async () => {
    payBtn.disabled = true;
    payBtn.textContent = "Processing payment...";

    const { error: payError } = await supabaseClient.rpc("order_action", {
      p_order_id: orderId,
      p_action: "pay"
    });

    if (payError) {
      showMessage(checkoutMessage, payError.message, "error");
      payBtn.disabled = false;
      payBtn.textContent = payLabel;
      return;
    }

    payBtn.hidden = true;
    cancelCheckoutBtn.hidden = true;
    viewOrderBtn.hidden = false;
    showMessage(
      checkoutMessage,
      `Payment received 🎉 ${formatPrice(listing.price)} is held safely in escrow. The seller gets paid once you confirm you've received it.`,
      "success"
    );
  });
})();
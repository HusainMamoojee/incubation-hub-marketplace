// Seller tools for dashboard.html: orders, listings, add a listing and enquiries

async function loadShop(user, profile) {
  document.getElementById("shopTitle").textContent = profile.shop_name || "My shop";

  setupAddListingForm(user, profile);
  setupListingActions(user);
  setupInboxActions(user);
  setupSellerOrderActions(user);

  await Promise.all([
    loadMyListings(user),
    loadIncomingEnquiries(user),
    loadSellerOrders(user)
  ]);
}

// Tab badges: the little numbers next to Orders / Listings / Enquiries 
function setTabCount(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = count;
  badge.hidden = count === 0;
}

//  Your listings 
async function loadMyListings(user) {
  const box = document.getElementById("myListings");

  const { data: listings, error } = await supabaseClient
    .from("listings")
    .select("id, title, type, category, price, price_unit, status, image_url")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="empty-state">We couldn't load your listings. Please refresh the page.</p>`;
    console.error("Could not load your listings:", error.message);
    return;
  }

  setTabCount("countListings", listings.length);

  if (listings.length === 0) {
    box.innerHTML = `
      <p class="empty-state">
        You haven't listed anything yet. Click <strong>+ Add listing</strong> to post your first one.
      </p>`;
    return;
  }

  box.innerHTML = listings.map((listing) => {
    const photo = safeImageUrl(listing.image_url);

    return `
      <div class="enquiry-row listing-row is-${listing.status}" data-listing-id="${listing.id}">
        <span class="listing-thumb ph-${(listing.id % 3) + 1}">
          ${photo ? `<img src="${photo}" alt="" loading="lazy">` : ""}
          <span class="listing-dot" aria-hidden="true"></span>
        </span>
        <div class="enquiry-info">
          <strong>${escapeHtml(listing.title)}</strong>
          <span>
            ${listing.type === "service" ? "Service" : "Product"} ·
            ${escapeHtml(listing.category || "Other")}
          </span>
        </div>
        <span class="order-amount">
          ${formatPrice(listing.price)}${listing.price_unit ? `<small>/${escapeHtml(listing.price_unit)}</small>` : ""}
        </span>
        <select class="listing-status" aria-label="Status of ${escapeHtml(listing.title)}">
          <option value="active" ${listing.status === "active" ? "selected" : ""}>Active</option>
          <option value="hidden" ${listing.status === "hidden" ? "selected" : ""}>Hidden</option>
          <option value="sold" ${listing.status === "sold" ? "selected" : ""}>Sold</option>
        </select>
        <a href="listing.html?id=${listing.id}" class="enquiry-link">View</a>
      </div>`;
  }).join("");
}

// Change a listing's status (one listener for every row) 
function setupListingActions(user) {
  const box = document.getElementById("myListings");
  const message = document.getElementById("shopMessage");

  box.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("listing-status")) return;

    const select = e.target;
    const row = select.closest("[data-listing-id]");
    const listingId = row.dataset.listingId;

    select.disabled = true;

    const { error } = await supabaseClient
      .from("listings")
      .update({ status: select.value })
      .eq("id", listingId);

    select.disabled = false;

    if (error) {
      showMessage(message, "Couldn't update that listing: " + error.message, "error");
      return;
    }

    showMessage(message, "Listing updated.", "success");
    refreshDashboard(user);
  });
}

// Listing photos

// Shrink big phone photos before uploading (max 1200px, saved as JPEG)
function resizeImage(file, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; // white behind see-through PNGs
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

// Upload to Supabase Storage and return the public link
async function uploadListingPhoto(user, file) {
  const blob = await resizeImage(file);
  const path = `${user.id}/${Date.now()}.jpg`;
  const bucket = supabaseClient.storage.from("listing-images");

  const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;

  return bucket.getPublicUrl(path).data.publicUrl;
}

// Add a listing 
function setupAddListingForm(user, profile) {
  const form = document.getElementById("addListingForm");
  const openBtn = document.getElementById("openAddListing");
  const cancelBtn = document.getElementById("cancelAddListing");
  const box = document.getElementById("listingMessage");

  const photoInput = document.getElementById("listingPhoto");
  const photoPreview = document.getElementById("photoPreview");
  const photoText = document.getElementById("photoDropText");

  function resetPhoto() {
    if (photoPreview.src) URL.revokeObjectURL(photoPreview.src);
    photoPreview.removeAttribute("src");
    photoPreview.hidden = true;
    photoText.hidden = false;
  }

  // Show a preview as soon as a photo is chosen
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    resetPhoto();
    if (!file) return;

    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
    photoText.hidden = true;
  });

  function openForm() {
    form.hidden = false;
    openBtn.hidden = true;
    document.getElementById("listingTitle").focus();
  }

  function closeForm() {
    form.reset();
    resetPhoto();
    clearErrors(form);
    box.className = "form-message";
    form.hidden = true;
    openBtn.hidden = false;
  }

  openBtn.addEventListener("click", openForm);
  cancelBtn.addEventListener("click", closeForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(form);

    const title = document.getElementById("listingTitle");
    const type = document.getElementById("listingType");
    const category = document.getElementById("listingCategory");
    const price = document.getElementById("listingPrice");
    const unit = document.getElementById("listingUnit");
    const description = document.getElementById("listingDescription");
    const file = photoInput.files[0];
    let valid = true;

    if (title.value.trim().length < 3) {
      setError(title, "Use at least 3 characters.");
      valid = false;
    }
    if (category.value === "") {
      setError(category, "Choose a category.");
      valid = false;
    }
    if (price.value === "" || Number(price.value) < 0) {
      setError(price, "Enter a price of R0 or more.");
      valid = false;
    }
    if (file && !file.type.startsWith("image/")) {
      setError(photoInput, "Choose a JPG, PNG or WebP image.");
      valid = false;
    } else if (file && file.size > 10 * 1024 * 1024) {
      setError(photoInput, "That photo is too big. Use one under 10 MB.");
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    // Upload the photo first (if there is one)
    let imageUrl = null;
    if (file) {
      submitBtn.textContent = "Uploading photo...";
      try {
        imageUrl = await uploadListingPhoto(user, file);
      } catch (err) {
        showMessage(box, "Couldn't upload the photo: " + err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Publish listing";
        return;
      }
    }

    submitBtn.textContent = "Publishing...";

    const { error } = await supabaseClient.from("listings").insert({
      title: title.value.trim(),
      type: type.value,
      category: category.value,
      price: Number(price.value),
      price_unit: unit.value.trim() || null,
      description: description.value.trim(),
      campus: profile.campus,
      image_url: imageUrl
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Publish listing";

    if (error) {
      showMessage(box, error.message, "error");
      return;
    }

    showMessage(box, "Listing published!", "success");
    refreshDashboard(user);
    setTimeout(closeForm, 1200);
  });
}

// Incoming enquiries 
async function loadIncomingEnquiries(user) {
  const box = document.getElementById("incomingEnquiries");

  const { data: enquiries, error } = await supabaseClient
    .from("enquiries")
    .select(`
      id, status, message, seller_reply, created_at,
      listing:listings ( title ),
      buyer:profiles!enquiries_buyer_id_fkey ( first_name, last_name )
    `)
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="empty-state">We couldn't load your enquiries. Please refresh the page.</p>`;
    console.error("Could not load incoming enquiries:", error.message);
    return;
  }

  // Badge = enquiries still waiting for your reply
  setTabCount("countEnquiries", enquiries.filter((enquiry) => enquiry.status === "new").length);

  if (enquiries.length === 0) {
    box.innerHTML = `<p class="empty-state">No enquiries yet. They'll appear here when students message you about your listings.</p>`;
    return;
  }

  box.innerHTML = enquiries.map(renderInboxItem).join("");
}

function renderInboxItem(enquiry) {
  const buyer = enquiry.buyer || {};
  const buyerName = `${buyer.first_name || "Student"} ${(buyer.last_name || "").charAt(0)}.`;
  const title = enquiry.listing ? enquiry.listing.title : "a listing";
  const date = new Date(enquiry.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

  // What the seller can do depends on the status
  let actions = "";

  if (enquiry.status === "new") {
    actions = `
      <form class="reply-form">
        <textarea rows="2" maxlength="500" placeholder="Reply with a time and place to meet on campus..." aria-label="Reply to ${escapeHtml(buyerName)}"></textarea>
        <button type="submit" class="btn btn-indigo btn-sm">Send reply</button>
      </form>`;
  } else if (enquiry.status === "replied") {
    actions = `
      <div class="inbox-actions">
        <button type="button" class="btn btn-mint btn-sm" data-status="confirmed">Mark as confirmed</button>
        <button type="button" class="btn btn-ghost btn-sm" data-status="closed">Close</button>
      </div>`;
  } else if (enquiry.status === "confirmed") {
    actions = `
      <div class="inbox-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-status="closed">Close</button>
      </div>`;
  }

  return `
    <div class="inbox-item" data-enquiry-id="${enquiry.id}">
      <div class="inbox-head">
        <span class="avatar">${escapeHtml(initials(buyer.first_name, buyer.last_name))}</span>
        <div class="enquiry-info">
          <strong>${escapeHtml(buyerName)}</strong>
          <span>About: ${escapeHtml(title)} · ${date}</span>
        </div>
        <span class="status-pill status-${enquiry.status}">${STATUS_LABELS[enquiry.status]}</span>
      </div>
      <p class="inbox-message">${escapeHtml(enquiry.message)}</p>
      ${enquiry.seller_reply ? `<p class="inbox-reply"><strong>Your reply:</strong> ${escapeHtml(enquiry.seller_reply)}</p>` : ""}
      ${actions}
    </div>`;
}

//  Reply and status buttons (one listener each for every enquiry) 
function setupInboxActions(user) {
  const box = document.getElementById("incomingEnquiries");
  const message = document.getElementById("inboxMessage");

  async function updateEnquiry(enquiryId, changes, successText) {
    const { error } = await supabaseClient
      .from("enquiries")
      .update(changes)
      .eq("id", enquiryId);

    if (error) {
      showMessage(message, "Couldn't update that enquiry: " + error.message, "error");
      return;
    }

    showMessage(message, successText, "success");
    loadIncomingEnquiries(user);
  }

  // Sending a reply
  box.addEventListener("submit", async (e) => {
    if (!e.target.classList.contains("reply-form")) return;
    e.preventDefault();

    const form = e.target;
    const textarea = form.querySelector("textarea");
    const reply = textarea.value.trim();
    const enquiryId = form.closest("[data-enquiry-id]").dataset.enquiryId;

    if (reply === "") {
      textarea.focus();
      return;
    }

    form.querySelector("button").disabled = true;
    await updateEnquiry(enquiryId, { seller_reply: reply, status: "replied" }, "Reply sent.");
  });

  // Confirm / close buttons
  box.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-status]");
    if (!button) return;

    const enquiryId = button.closest("[data-enquiry-id]").dataset.enquiryId;
    const newStatus = button.dataset.status;

    button.disabled = true;
    await updateEnquiry(
      enquiryId,
      { status: newStatus },
      newStatus === "confirmed" ? "Marked as confirmed." : "Enquiry closed."
    );
  });
}

//  Orders to fulfil (seller side of escrow)
const ESCROW_HELD_STATUSES = ["paid_in_escrow", "delivered", "disputed"];

// Orders that still need something to happen go at the top; the rest go under "Past orders"
const OPEN_ORDER_STATUSES = ["pending_payment", "paid_in_escrow", "delivered", "disputed"];

async function loadSellerOrders(user) {
  const list = document.getElementById("sellerOrderList");
  if (!list) return;

  const [ordersResult, activeCount] = await Promise.all([
    supabaseClient
      .from("orders")
      .select(`
        id, amount, status, created_at, buyer_note, dispute_reason,
        listing:listings ( title ),
        buyer:profiles!orders_buyer_id_fkey ( first_name, last_name )
      `)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "active")
  ]);

  const { data: orders, error } = ordersResult;

  if (error) {
    list.innerHTML = `<p class="empty-state">We couldn't load your orders. Please refresh the page.</p>`;
    console.error("Could not load seller orders:", error.message);
    return;
  }

  //  Escrow summary 
  const held = orders
    .filter((order) => ESCROW_HELD_STATUSES.includes(order.status))
    .reduce((total, order) => total + Number(order.amount), 0);

  const released = orders
    .filter((order) => order.status === "completed")
    .reduce((total, order) => total + Number(order.amount), 0);

  const toFulfil = orders.filter((order) => order.status === "paid_in_escrow").length;

  document.getElementById("statEscrow").textContent = formatPrice(held);
  document.getElementById("statReleased").textContent = formatPrice(released);
  document.getElementById("statToFulfil").textContent = toFulfil;
  document.getElementById("statActiveListings").textContent = activeCount.count ?? 0;

  // Badge = orders you need to hand over
  setTabCount("countOrders", toFulfil);

  //  Split into open and past orders 
  const openOrders = orders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status));
  const pastOrders = orders.filter((order) => !OPEN_ORDER_STATUSES.includes(order.status));

  if (openOrders.length === 0) {
    list.innerHTML = orders.length === 0
      ? `<p class="empty-state">No orders yet. When a student buys one of your listings, it'll appear here.</p>`
      : `<p class="empty-state">You're all caught up. Nothing needs your attention right now.</p>`;
  } else {
    list.innerHTML = openOrders.map(renderSellerOrder).join("");
  }

  const pastBox = document.getElementById("pastOrders");
  if (pastBox) {
    pastBox.hidden = pastOrders.length === 0;
    document.getElementById("pastCount").textContent = `(${pastOrders.length})`;
    document.getElementById("pastOrderList").innerHTML = pastOrders.map(renderSellerOrder).join("");
  }
}

function renderSellerOrder(order) {
  const buyer = order.buyer || {};
  const buyerName = `${buyer.first_name || "Student"} ${(buyer.last_name || "").charAt(0)}.`;
  const title = order.listing ? order.listing.title : "A listing";
  const amount = formatPrice(order.amount);
  const date = new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

  const reportButton = `<button type="button" class="btn btn-ghost btn-sm" data-action="report">Report a problem</button>`;
  const disputeForm = `
    <form class="reply-form dispute-form" hidden>
      <textarea rows="2" maxlength="500" placeholder="What went wrong? e.g. The buyer didn't show up." aria-label="Describe the problem"></textarea>
      <button type="submit" class="btn btn-indigo btn-sm">Send to the Hub</button>
    </form>`;

  let details = "";

  if (order.status === "pending_payment") {
    details = `<p class="order-note">Waiting for the buyer to pay. Don't hand anything over yet.</p>`;
  } else if (order.status === "paid_in_escrow") {
    details = `
      <p class="order-note">${amount} is in escrow. Hand it over on campus, then mark it as delivered.</p>
      <div class="inbox-actions">
        <button type="button" class="btn btn-mint btn-sm" data-action="deliver">Mark as delivered</button>
        ${reportButton}
      </div>
      ${disputeForm}`;
  } else if (order.status === "delivered") {
    details = `
      <p class="order-note">Waiting for the buyer to confirm. ${amount} is released to you once they do.</p>
      <div class="inbox-actions">${reportButton}</div>
      ${disputeForm}`;
  } else if (order.status === "disputed") {
    details = `
      <p class="order-note warning">
        The Incubation Hub is reviewing this order. The payment stays in escrow until it's resolved.
        ${order.dispute_reason ? `<br>Reason: ${escapeHtml(order.dispute_reason)}` : ""}
      </p>`;
  } else if (order.status === "completed") {
    details = `<p class="order-note">✓ ${amount} released to you.</p>`;
  } else if (order.status === "refunded") {
    details = `<p class="order-note">↩ ${amount} was refunded to the buyer.</p>`;
  } else if (order.status === "cancelled") {
    details = `<p class="order-note">The buyer cancelled before paying.</p>`;
  }

  return `
    <div class="inbox-item" data-order-id="${order.id}">
      <div class="inbox-head">
        <span class="avatar">${escapeHtml(initials(buyer.first_name, buyer.last_name))}</span>
        <div class="enquiry-info">
          <strong>${escapeHtml(title)}</strong>
          <span>Order #${order.id} · ${escapeHtml(buyerName)} · ${date}</span>
        </div>
        <span class="order-amount">${amount}</span>
        <span class="status-pill status-${order.status}">${ORDER_STATUS_LABELS[order.status]}</span>
      </div>
      ${order.buyer_note ? `<p class="inbox-message">${escapeHtml(order.buyer_note)}</p>` : ""}
      ${details}
    </div>`;
}

function setupSellerOrderActions(user) {
  const list = document.getElementById("sellerOrderList");
  const message = document.getElementById("sellerOrdersMessage");
  if (!list) return;

  const SUCCESS_TEXT = {
    deliver: "Marked as delivered. The buyer will confirm to release your payment.",
    dispute: "Problem reported. The Incubation Hub will review this order."
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

    loadSellerOrders(user);
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
}
// Reload everything that changes when a listing is added or updated
function refreshDashboard(user) {
  loadMyListings(user);
  loadSellerOrders(user);
}
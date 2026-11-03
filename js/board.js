// Looking for board: students pin what they need, sellers offer to help.
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  // ---------- Settings ----------
  // The columns every note needs (buyer = who posted it)
  const REQUEST_FIELDS = `
    id, title, details, type, category, budget, campus, status, created_at, buyer_id,
    buyer:profiles ( first_name, last_name )
  `;

  // ---------- Elements ----------
  const notesBox = document.getElementById("notes");
  const countText = document.getElementById("boardCount");
  const boardMessage = document.getElementById("boardMessage");
  const filterBox = document.getElementById("boardFilters");

  // ---------- What we know about the board right now ----------
  let currentFilter = "all";
  let requestsById = new Map();   // id → request, so we can redraw one note
  let offerCounts = new Map();    // request id → how many offers it has
  let myOffers = new Map();       // request id → "pending" / "accepted" (sellers only)

  // Log out
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // ---------- Who's logged in ----------
  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("first_name, last_name, campus, seller_status")
    .eq("id", user.id)
    .single();

  if (profile) {
    document.getElementById("headerName").textContent = profile.first_name || user.email.split("@")[0];
    document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);
  }

  const isSeller = profile && profile.seller_status === "approved";
  if (isSeller) document.getElementById("myOffersChip").hidden = false;

  setupFilters();
  setupPostForm();
  const openOfferForm = setupOfferForm();     // returns a function that opens the "I can help" pop-up
  const openOffersList = setupOffersList();   // returns a function that opens the "See offers" pop-up
  setupNoteActions();
  await loadRequests();
    // Came from Browse with no results (board.html?ask=calculator)? Open the form, pre-filled
  const params = new URLSearchParams(window.location.search);
  if (params.has("ask")) {
    document.getElementById("openPost").click();
    document.getElementById("reqTitle").value = params.get("ask");
    history.replaceState(null, "", "board.html"); // so a refresh doesn't open it again
  }
  listenForChanges();

  // =========================================================
  // LOADING
  // =========================================================

  async function loadRequests() {
    // Offer counts and "my offers" first, because the notes show them
    await loadOfferInfo();

    let query = supabaseClient
      .from("requests")
      .select(REQUEST_FIELDS)
      .order("created_at", { ascending: false });

    if (currentFilter === "mine") {
      // Your own requests, including ones you've found
      query = query.eq("buyer_id", user.id).neq("status", "closed");
    } else if (currentFilter === "offers") {
      // Requests you (a seller) have offered to help with
      const ids = [...myOffers.keys()];
      if (ids.length === 0) return renderNotes([]);
      query = query.in("id", ids);
    } else {
      query = query.eq("status", "open");
      if (currentFilter !== "all") query = query.eq("category", currentFilter);
    }

    const { data: requests, error } = await query;

    if (error) {
      notesBox.innerHTML = `<p class="board-empty">We couldn't load the board. Please refresh the page.</p>`;
      console.error("Could not load requests:", error.message);
      return;
    }

    renderNotes(requests);
  }

  async function loadOfferInfo() {
    // How many offers each request has (a database function, so nobody sees whose they are)
    const { data: counts, error } = await supabaseClient.rpc("request_offer_counts");
    if (error) console.error("Could not load offer counts:", error.message);
    offerCounts = new Map((counts || []).map((row) => [row.request_id, Number(row.offer_count)]));

    // Which requests I've already offered on
    myOffers = new Map();
    if (isSeller) {
      const { data: mine } = await supabaseClient
        .from("offers")
        .select("request_id, status")
        .eq("seller_id", user.id);
      (mine || []).forEach((offer) => myOffers.set(offer.request_id, offer.status));
    }
  }

  function renderNotes(requests) {
    requestsById = new Map(requests.map((r) => [r.id, r]));

    const open = requests.filter((r) => r.status === "open").length;
    if (currentFilter === "mine") countText.textContent = `Your requests (${requests.length})`;
    else if (currentFilter === "offers") countText.textContent = `Requests you offered on (${requests.length})`;
    else countText.textContent = `${open} ${open === 1 ? "student is" : "students are"} looking...`;

    if (requests.length === 0) {
      const empty = {
        mine: "You haven't pinned anything yet. Click “+ Pin a request” to start.",
        offers: "You haven't offered on any requests yet."
      };
      notesBox.innerHTML = `<p class="board-empty">${empty[currentFilter] || "Nothing pinned here yet. Be the first!"}</p>`;
      return;
    }

    notesBox.innerHTML = requests.map((request, i) => noteHtml(request, i, "drop")).join("");
  }

  // =========================================================
  // ONE STICKY NOTE
  // =========================================================

  function noteHtml(request, index, animation) {
    const buyer = request.buyer || {};
    const isMine = request.buyer_id === user.id;
    const name = isMine ? "You" : `${buyer.first_name || "Student"} ${(buyer.last_name || "").charAt(0)}.`;
    const offers = offerCounts.get(request.id) || 0;
    const myOffer = myOffers.get(request.id);

    // Each note leans a little, always the same way for the same note
    const tilt = ((request.id * 37) % 7 - 3) * 0.8;

    const budget = request.budget
      ? `<p class="note-budget">Up to ${formatPrice(request.budget)}</p>`
      : `<p class="note-budget">Budget: open</p>`;

    // The buttons depend on who you are and the note's status
    let actions = "";

    if (request.status === "open" && isMine) {
      actions = `
        ${offers > 0 ? `<button type="button" class="btn btn-offers" data-action="view-offers">See ${offers} ${offers === 1 ? "offer" : "offers"}</button>` : ""}
        <div class="note-actions">
          <button type="button" class="btn btn-found" data-action="found">Found it ✓</button>
          <button type="button" class="btn" data-action="remove">Remove</button>
        </div>`;
    } else if (request.status === "open" && myOffer) {
      actions = `<p class="note-sent">✓ You offered to help</p>`;
    } else if (request.status === "open" && isSeller) {
      actions = `<button type="button" class="btn btn-help" data-action="help">I can help</button>`;
    } else if (request.status === "open") {
      actions = `<a href="become-seller.html" class="note-link">Become a seller to help →</a>`;
    } else if (myOffer === "accepted") {
      actions = `<p class="note-sent accepted">🎉 Your offer was accepted. Meet up as agreed!</p>`;
    }

    const stamp = request.status === "found"
      ? `<span class="stamp">${myOffer && myOffer !== "accepted" ? "Taken" : "Found"}</span>`
      : "";

    return `
      <article class="note ${animation} ${isMine ? "mine" : ""} ${request.status === "found" ? "found" : ""}"
               data-id="${request.id}"
               data-category="${escapeHtml(request.category)}"
               style="--tilt:${tilt}deg; --i:${index}">
        <span class="pin" aria-hidden="true"></span>
        ${offers > 0 && request.status === "open" ? `<span class="offer-badge">${offers} ${offers === 1 ? "offer" : "offers"}</span>` : ""}
        <span class="note-tag">${escapeHtml(request.category)} · ${request.type === "service" ? "Service" : "Product"}</span>
        <h3>${escapeHtml(request.title)}</h3>
        ${request.details ? `<p class="note-details">${escapeHtml(request.details)}</p>` : ""}
        ${budget}
        ${actions}
        <div class="note-foot">
          <span class="avatar">${escapeHtml(initials(buyer.first_name, buyer.last_name))}</span>
          <span>${escapeHtml(name)}${request.campus ? " · " + escapeHtml(request.campus) : ""}</span>
          <span>${timeAgo(request.created_at)}</span>
        </div>
        ${stamp}
      </article>`;
  }

  // Redraw one note in place (e.g. after an offer), with a little wiggle
  function redrawNote(id) {
    const old = notesBox.querySelector(`.note[data-id="${id}"]`);
    const request = requestsById.get(id);
    if (!old || !request) return;

    old.outerHTML = noteHtml(request, 0, "wiggle");
  }

  // "5m ago", "3h ago", "2d ago"
  function timeAgo(dateString) {
    const minutes = Math.floor((Date.now() - new Date(dateString)) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // Pull a note off the board with a stamp, then reload
  function stampAndRemove(note, label) {
    note.insertAdjacentHTML("beforeend", `<span class="stamp">${label}</span>`);
    note.querySelectorAll(".note-actions, .btn-offers, .offer-badge").forEach((el) => el.remove());
    note.classList.remove("drop", "fresh", "wiggle");
    note.classList.add("found-leaving");
    setTimeout(() => removeNote(note), 1600);
  }

  // Take one note out of the board (and the count) without reloading everything
  function removeNote(note) {
    requestsById.delete(Number(note.dataset.id));
    note.remove();
    updateCount();
    if (!notesBox.querySelector(".note")) loadRequests(); // board is empty: show the empty message
  }

  function updateCount() {
    if (currentFilter === "mine" || currentFilter === "offers") return;
    const open = notesBox.querySelectorAll(".note:not(.found-leaving):not(.removing)").length;
    countText.textContent = `${open} ${open === 1 ? "student is" : "students are"} looking...`;
  }

  // =========================================================
  // FILTERS
  // =========================================================

  function setupFilters() {
    filterBox.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;

      filterBox.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
      currentFilter = chip.dataset.filter;
      loadRequests();
    });
  }

  // =========================================================
  // POP-UPS (shared open/close)
  // =========================================================

  function setupDialog(dialog, closeButtons, onClose) {
    function close() {
      if (onClose) onClose();
      dialog.close();
    }
    closeButtons.forEach((button) => button.addEventListener("click", close));
    // Clicking the dark area around the pop-up closes it
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    return close;
  }

  // ---------- Pin a request ----------
  function setupPostForm() {
    const dialog = document.getElementById("postDialog");
    const form = document.getElementById("postForm");
    const message = document.getElementById("postMessage");

    const close = setupDialog(dialog, [document.getElementById("closePost"), document.getElementById("cancelPost")], () => {
      form.reset();
      clearErrors(form);
      message.className = "form-message";
    });

    document.getElementById("openPost").addEventListener("click", () => {
      dialog.showModal();
      document.getElementById("reqTitle").focus();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors(form);

      const title = document.getElementById("reqTitle");
      const type = document.getElementById("reqType");
      const category = document.getElementById("reqCategory");
      const budget = document.getElementById("reqBudget");
      const details = document.getElementById("reqDetails");
      let valid = true;

      if (title.value.trim().length < 3) {
        setError(title, "Use at least 3 characters.");
        valid = false;
      }
      if (category.value === "") {
        setError(category, "Choose a category.");
        valid = false;
      }
      if (budget.value !== "" && Number(budget.value) < 0) {
        setError(budget, "Budget can't be negative.");
        valid = false;
      }
      if (!valid) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Pinning...";

      // buyer_id is filled in by the database (default auth.uid())
      const { data: request, error } = await supabaseClient
        .from("requests")
        .insert({
          title: title.value.trim(),
          type: type.value,
          category: category.value,
          budget: budget.value === "" ? null : Number(budget.value),
          details: details.value.trim() || null,
          campus: profile ? profile.campus : null
        })
        .select(REQUEST_FIELDS)
        .single();

      submitBtn.disabled = false;
      submitBtn.textContent = "Pin it to the board";

      if (error) {
        showMessage(message, error.message, "error");
        return;
      }

      close();
      addFreshNote(request);
    });
  }

  // Slap a new note onto the front of the board
  function addFreshNote(request) {
    const fits = currentFilter === "all" || currentFilter === "mine" || currentFilter === request.category;
    if (!fits) {
      // Switch to "All" so you can see it land
      filterBox.querySelector('[data-filter="all"]').click();
      return;
    }

    requestsById.set(request.id, request);
    notesBox.querySelector(".board-empty")?.remove();
    notesBox.insertAdjacentHTML("afterbegin", noteHtml(request, 0, "fresh"));
    updateCount();
    showMessage(boardMessage, "Your request is on the board! Sellers can now see it.", "success");
  }

  // ---------- Seller: "I can help" ----------
  let offeringOn = null; // the request the seller is offering on

  function setupOfferForm() {
    const dialog = document.getElementById("offerDialog");
    const form = document.getElementById("offerForm");
    const message = document.getElementById("offerMessage");

    const close = setupDialog(dialog, [document.getElementById("closeOffer"), document.getElementById("cancelOffer")], () => {
      form.reset();
      clearErrors(form);
      message.className = "form-message";
      offeringOn = null;
    });

    // Opened from a note's "I can help" button (see setupNoteActions)
    function open(request) {
      offeringOn = request;
      document.getElementById("offerFor").textContent = request.title;
      dialog.showModal();
      document.getElementById("offerText").focus();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors(form);

      const text = document.getElementById("offerText");
      const price = document.getElementById("offerPrice");
      let valid = true;

      if (text.value.trim().length < 3) {
        setError(text, "Tell them how you can help.");
        valid = false;
      }
      if (price.value !== "" && Number(price.value) < 0) {
        setError(price, "Price can't be negative.");
        valid = false;
      }
      if (!valid || !offeringOn) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      // seller_id is filled in by the database (default auth.uid())
      const { error } = await supabaseClient.from("offers").insert({
        request_id: offeringOn.id,
        message: text.value.trim(),
        price: price.value === "" ? null : Number(price.value)
      });

      submitBtn.disabled = false;
      submitBtn.textContent = "Send offer";

      if (error) {
        showMessage(message, error.message, "error");
        return;
      }

      // Update this note straight away: +1 offer, and "You offered to help"
      const id = offeringOn.id;
      offerCounts.set(id, (offerCounts.get(id) || 0) + 1);
      myOffers.set(id, "pending");
      close();
      redrawNote(id);
      showMessage(boardMessage, "Offer sent! The student will see it on their note.", "success");
    });

    return open;
  }

  // ---------- Buyer: see the offers on your note ----------
  function setupOffersList() {
    const dialog = document.getElementById("offersDialog");
    const list = document.getElementById("offersList");
    let viewing = null;

    setupDialog(dialog, [document.getElementById("closeOffers")]);

    async function open(request) {
      viewing = request;
      document.getElementById("offersFor").textContent = request.title;
      list.innerHTML = `<p class="empty-state">Loading offers...</p>`;
      dialog.showModal();

      const { data: offers, error } = await supabaseClient
        .from("offers")
        .select("id, message, price, created_at, seller:profiles ( first_name, last_name, shop_name )")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true });

      if (error) {
        list.innerHTML = `<p class="empty-state">We couldn't load the offers. Please try again.</p>`;
        console.error("Could not load offers:", error.message);
        return;
      }

      list.innerHTML = offers.map((offer) => {
        const seller = offer.seller || {};
        const sellerName = `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
        return `
          <div class="offer-row" data-offer-id="${offer.id}">
            <span class="avatar">${escapeHtml(initials(seller.first_name, seller.last_name))}</span>
            <div class="offer-info">
              <strong>${escapeHtml(seller.shop_name || sellerName)}</strong>
              <span>${seller.shop_name ? escapeHtml(sellerName) + " · " : ""}<span class="verified">Hub verified</span> · ${timeAgo(offer.created_at)}</span>
              <p>${escapeHtml(offer.message)}</p>
            </div>
            <div class="offer-side">
              ${offer.price !== null ? `<strong class="offer-price">${formatPrice(offer.price)}</strong>` : ""}
              <button type="button" class="btn btn-mint btn-sm" data-accept>Accept</button>
            </div>
          </div>`;
      }).join("") || `<p class="empty-state">No offers yet.</p>`;
    }

    // Accept one offer: the database marks it accepted and your request as found
    list.addEventListener("click", async (e) => {
      const button = e.target.closest("[data-accept]");
      if (!button || !viewing) return;

      const row = button.closest("[data-offer-id]");
      const sellerName = row.querySelector("strong").textContent;
      if (!confirm(`Accept the offer from ${sellerName}? Your request will come off the board.`)) return;

      button.disabled = true;
      const { error } = await supabaseClient.rpc("accept_offer", { p_offer_id: Number(row.dataset.offerId) });

      if (error) {
        button.disabled = false;
        alert(error.message);
        return;
      }

      dialog.close();
      showMessage(boardMessage, `You accepted ${sellerName}'s offer. Meet up as agreed! 🎉`, "success");

      const note = notesBox.querySelector(`.note[data-id="${viewing.id}"]`);
      if (note) stampAndRemove(note, "Found");
      else loadRequests();
    });

    return open;
  }

  // =========================================================
  // REALTIME: the board updates itself while you watch
  // =========================================================

  function listenForChanges() {
    const live = document.getElementById("liveDot");

    supabaseClient
      .channel("looking-for-board")

      // Someone pinned a new request
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "requests" }, async ({ new: row }) => {
        if (row.buyer_id === user.id) return;                       // your own: already on the board
        if (notesBox.querySelector(`.note[data-id="${row.id}"]`)) return;
        if (!(currentFilter === "all" || currentFilter === row.category)) return;

        // The live message only has the raw row, so fetch it with the buyer's name
        const { data: request } = await supabaseClient
          .from("requests").select(REQUEST_FIELDS).eq("id", row.id).single();
        if (!request) return;

        requestsById.set(request.id, request);
        notesBox.querySelector(".board-empty")?.remove();
        notesBox.insertAdjacentHTML("afterbegin", noteHtml(request, 0, "fresh"));
        updateCount();
        toast(`📌 New request: <strong>${escapeHtml(request.title)}</strong>`);
      })

      // A request was found or closed somewhere else
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "requests" }, ({ new: row }) => {
        const note = notesBox.querySelector(`.note[data-id="${row.id}"]`);
        if (!note || row.status === "open" || note.classList.contains("found-leaving")) return;
        if (currentFilter === "mine" || currentFilter === "offers") return loadRequests();
        stampAndRemove(note, row.buyer_id === user.id ? "Found" : "Taken");
      })

      // A request was removed
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "requests" }, ({ old: row }) => {
        const note = notesBox.querySelector(`.note[data-id="${row.id}"]`);
        if (!note || note.classList.contains("removing")) return;
        note.classList.remove("drop", "fresh", "wiggle");
        note.classList.add("removing");
        setTimeout(() => removeNote(note), 500);
      })

      // A seller offered to help (you only receive offers you're allowed to see: ones on YOUR requests)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, ({ new: offer }) => {
        if (offer.seller_id === user.id) return;                    // your own offer: already shown
        offerCounts.set(offer.request_id, (offerCounts.get(offer.request_id) || 0) + 1);
        redrawNote(offer.request_id);

        const request = requestsById.get(offer.request_id);
        if (request && request.buyer_id === user.id) {
          toast(`🙋 Someone can help with <strong>${escapeHtml(request.title)}</strong>!`);
        }
      })

      .subscribe((status) => {
        // Green "Live" dot once we're connected
        live.hidden = status !== "SUBSCRIBED";
      });
  }

  // A small pop-up in the corner that slides in, then away
  function toast(html) {
    const box = document.getElementById("toasts");
    box.insertAdjacentHTML("beforeend", `<div class="toast" role="status">${html}</div>`);
    const el = box.lastElementChild;
    setTimeout(() => el.classList.add("toast-leaving"), 4500);
    setTimeout(() => el.remove(), 5000);
  }

  // =========================================================
  // NOTE BUTTONS (one listener for every note)
  // =========================================================

  function setupNoteActions() {
    notesBox.addEventListener("click", async (e) => {
      const button = e.target.closest("button[data-action]");
      if (!button) return;

      const note = button.closest(".note");
      const id = Number(note.dataset.id);
      const request = requestsById.get(id);
      const action = button.dataset.action;

      if (action === "help") return openOfferForm(request);
      if (action === "view-offers") return openOffersList(request);

      if (action === "remove" && !confirm("Remove this request from the board?")) return;

      button.disabled = true;

      const { error } = action === "found"
        ? await supabaseClient.from("requests").update({ status: "found" }).eq("id", id)
        : await supabaseClient.from("requests").delete().eq("id", id);

      if (error) {
        button.disabled = false;
        showMessage(boardMessage, "Couldn't update that request: " + error.message, "error");
        return;
      }

      if (action === "found") {
        stampAndRemove(note, "Found");
        showMessage(boardMessage, "Great! We've taken it off the board.", "success");
      } else {
        note.classList.remove("drop", "fresh", "wiggle");
        note.classList.add("removing");
        setTimeout(() => removeNote(note), 500);
      }
    });
  }
})();
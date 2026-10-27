// Shared listing card, used by home.html and browse.html

function renderListingCard(listing, index = 0) {
  const seller = listing.seller || {};
  const isService = listing.type === "service";
  const sellerName = `${seller.first_name || "Seller"} ${(seller.last_name || "").charAt(0)}.`;
  const photo = safeImageUrl(listing.image_url);

  return `
    <article class="listing-card">
      <div class="listing-img ph-${(index % 3) + 1}">
        ${photo ? `<img src="${photo}" alt="" loading="lazy">` : ""}
        <span class="tag${isService ? "" : " tag-mint"}">${isService ? "Service" : "Product"}</span>
      </div>
      <div class="listing-body">
        <div class="seller row">
          <span class="avatar">${escapeHtml(initials(seller.first_name, seller.last_name))}</span>
          <span>${escapeHtml(sellerName)} · <span class="verified">Hub verified</span></span>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <p>${escapeHtml(listing.description)}</p>
        <div class="listing-footer">
          <div class="price">
            <small>${isService ? "From" : "Price"}</small>
            <strong>${formatPrice(listing.price)}</strong>${listing.price_unit ? `<span>/${escapeHtml(listing.price_unit)}</span>` : ""}
          </div>
          <a href="listing.html?id=${listing.id}" class="btn btn-indigo btn-sm">${isService ? "Book slot" : "View"}</a>
        </div>
      </div>
    </article>`;
}
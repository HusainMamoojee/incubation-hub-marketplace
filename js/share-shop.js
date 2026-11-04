// "Share my shop" on the seller dashboard: a QR code that opens the seller's
// public shop page, ready to download and post on WhatsApp or Instagram.
// Uses the qrcode-generator library (loaded in dashboard.html).
// Everything is inside one function, so names can't clash with other scripts.

(async function () {
  const openBtn = document.getElementById("shareShopBtn");
  const dialog = document.getElementById("shareDialog");
  if (!openBtn || !dialog) return;

  const canvas = document.getElementById("qrCanvas");
  const linkInput = document.getElementById("shopLinkInput");
  const copyBtn = document.getElementById("copyShopLink");
  const downloadBtn = document.getElementById("downloadQr");
  const openShopLink = document.getElementById("openShopLink");
  const localNote = document.getElementById("shareLocalNote");

  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("shop_name, first_name")
    .eq("id", user.id)
    .single();

  const shopName = (profile && (profile.shop_name || `${profile.first_name}'s shop`)) || "My shop";

  // The full web address of this seller's public shop page
  const shopUrl = new URL(`shop.html?id=${user.id}`, window.location.href).href;
  linkInput.value = shopUrl;
  openShopLink.href = shopUrl;

  // On 127.0.0.1 / localhost the link only works on this computer
  const isLocal = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  localNote.hidden = !isLocal;

  let drawn = false;

  openBtn.addEventListener("click", async () => {
    dialog.showModal();
    if (!drawn) {
      await document.fonts.ready; // so the shop name uses the Inter font
      drawShareCard();
      drawn = true;
    }
  });

  dialog.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => dialog.close())
  );

  // Click on the dark backdrop closes it
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Draw the QR card (portrait, 1080 x 1350: fits an Instagram post) 
  function drawShareCard() {
    const W = 1080, H = 1350;
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    // Background with a brand-colour band at the top
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, "#4F46E5");
    band.addColorStop(1, "#7C3AED");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, W, 190);

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 64px Inter, system-ui, sans-serif";
    ctx.fillText("Hub Market", W / 2, 112);
    ctx.font = "500 32px Inter, system-ui, sans-serif";
    ctx.fillText("Eduvos Incubation Hub", W / 2, 160);

    // The QR code itself (dark modules on white, with a quiet zone around it)
    const qr = qrcode(0, "M");
    qr.addData(shopUrl);
    qr.make();

    const count = qr.getModuleCount();
    const qrSize = 720;
    const cell = Math.floor(qrSize / count);
    const drawSize = cell * count;
    const left = Math.round((W - drawSize) / 2);
    const topEdge = 270;

    ctx.fillStyle = "#1E1B4B";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(left + col * cell, topEdge + row * cell, cell, cell);
        }
      }
    }

    // Shop name (shrinks to fit if it's long)
    let size = 64;
    ctx.fillStyle = "#0F172A";
    do {
      ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
      size -= 4;
    } while (ctx.measureText(shopName).width > W - 160 && size > 30);
    ctx.fillText(shopName, W / 2, topEdge + drawSize + 120);

    ctx.fillStyle = "#64748B";
    ctx.font = "500 36px Inter, system-ui, sans-serif";
    ctx.fillText("Scan to visit my shop", W / 2, topEdge + drawSize + 180);
  }

  //  Copy link 
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shopUrl);
    } catch {
      linkInput.select();
      document.execCommand("copy");
    }
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = "Copy link"), 2000);
  });

  // Download the QR card as a PNG 
  downloadBtn.addEventListener("click", () => {
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${shopName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "my-shop"}-qr.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  });
})();
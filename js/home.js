 (async function () {
      const user = await getCurrentUser();
      if (!user) return;

      const meta = user.user_metadata || {};
      const first = meta.first_name || user.email.split("@")[0];
      const last = meta.last_name || "";

      document.getElementById("userName").textContent = first;
      document.getElementById("headerName").textContent = first;
      document.getElementById("userAvatar").textContent =
        (first[0] + (last[0] || "")).toUpperCase();

      if (meta.campus) {
        document.getElementById("campusName").textContent = meta.campus + " campus";
        document.getElementById("campusPill").classList.add("show");
      }

      if (meta.role === "seller") {
        document.getElementById("sellerBanner").style.display = "none";
      }
    })();

    document.getElementById("logoutBtn").addEventListener("click", logout);
// Shop analytics page.
// LOGIN IS REAL: only approved sellers can open it, and the header shows who is logged in.
// THE NUMBERS ARE DEMO DATA: hardcoded below until the real analytics are ready.
//
// How it's built, so the real data can be plugged in later:
//   1. getDemoData() returns the raw rows (one row per day, plus a list of listings).
//   2. Everything else only does maths on those rows and draws the charts.
// To go live, replace getDemoData() with Supabase queries that return the SAME shape.

(function () {
 
  //  WHO IS LOGGED IN? (same check as the seller dashboard)
  
  async function setupUser() {
    document.getElementById("logoutBtn").addEventListener("click", logout);

    const user = await getCurrentUser();
    if (!user) return; // session.js already sends logged-out visitors to login.html

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("first_name, last_name, seller_status, shop_name")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Could not load profile:", error ? error.message : "no profile");
      return;
    }

    // Only approved sellers have analytics
    if (profile.seller_status !== "approved") {
      window.location.replace("home.html");
      return;
    }

    document.getElementById("headerName").textContent = profile.first_name || user.email.split("@")[0];
    document.getElementById("userAvatar").textContent = initials(profile.first_name, profile.last_name);

    if (profile.shop_name) {
      document.getElementById("analyticsSub").textContent =
        `How ${profile.shop_name} is doing: views, enquiries, orders and money earned.`;
    }
  }

  setupUser();

  
  // DEMO DATA (replace this section with real queries)
  

  // Tiny random-number generator with a fixed seed, so the demo looks the same on every refresh
  function seededRandom(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  function getDemoData() {
    const random = seededRandom(42);
    const days = [];
    const today = new Date();

    // 180 days, so we can compare "this period" with "the period before"
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const weekday = date.getDay(); // 0 = Sunday
      const isWeekend = weekday === 0 || weekday === 6;
      const growth = 1 + (179 - i) / 260; // the shop slowly gets busier
      const busyDay = weekday === 3 || weekday === 4 ? 1.35 : 1; // Wed and Thu are busiest

      const views = Math.round((isWeekend ? 14 : 38) * growth * busyDay * (0.7 + random() * 0.6));
      const enquiries = Math.round(views * (0.09 + random() * 0.05));
      const orders = Math.round(enquiries * (0.35 + random() * 0.3));
      const revenue = orders * Math.round(55 + random() * 70);

      days.push({ date, views, enquiries, orders, revenue });
    }

    // Per-listing totals for the last 30 days (scaled for 7 and 90 days below)
    const listings = [
      { title: "Java and Python tutoring", category: "Tutoring", views: 412, enquiries: 58, orders: 31, revenue: 3720 },
      { title: "Graduation photoshoot", category: "Photography", views: 298, enquiries: 34, orders: 12, revenue: 2880 },
      { title: "Homemade samoosas (12 pack)", category: "Food & snacks", views: 365, enquiries: 41, orders: 37, revenue: 2035 },
      { title: "Logo and poster design", category: "Design", views: 187, enquiries: 22, orders: 9, revenue: 1620 },
      { title: "Laptop clean-up and setup", category: "Tech help", views: 156, enquiries: 19, orders: 10, revenue: 1200 },
      { title: "Hand-painted tote bags", category: "Fashion", views: 133, enquiries: 12, orders: 7, revenue: 840 }
    ];

    // Reply times for enquiries, in minutes
    const replyMinutes = [12, 25, 8, 40, 95, 18, 22, 300, 15, 35, 60, 9, 28, 45, 20, 14, 180, 30, 11, 50];

    return { days, listings, replyMinutes };
  }

  const DATA = getDemoData();

  
  // HELPERS
  
  const tip = document.getElementById("chartTip");
  const SVG_NS = "http://www.w3.org/2000/svg";

  function sum(rows, key) {
    return rows.reduce((total, row) => total + row[key], 0);
  }

  function money(amount) {
    return "R" + Math.round(amount).toLocaleString("en-ZA");
  }

  function number(n) {
    return Math.round(n).toLocaleString("en-ZA");
  }

  function percent(part, whole) {
    return whole === 0 ? 0 : (part / whole) * 100;
  }

  function shortDate(date) {
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  // Tooltip that follows the mouse (or finger)
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const box = tip.getBoundingClientRect();
    let left = x + 14;
    if (left + box.width > window.innerWidth - 8) left = x - box.width - 14;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = Math.max(8, y - box.height - 12) + "px";
  }

  function hideTip() {
    tip.hidden = true;
  }

  // Round a max value up to a friendly number for the axis (e.g. 437 -> 500)
  function niceMax(value) {
    if (value <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const steps = [1, 2, 2.5, 5, 10];
    const step = steps.find((s) => s * power >= value);
    return step * power;
  }

 
  //  KPI TILES
  
  function setDelta(id, current, previous, isPoints = false) {
    const el = document.getElementById(id);
    if (previous === 0) {
      el.textContent = "";
      return;
    }
    const change = isPoints ? current - previous : percent(current - previous, previous);

    // No real change: show it in grey, not green or red
    if (Math.abs(change) < 0.05) {
      el.className = "kpi-delta";
      el.innerHTML = `No change <span>vs previous period</span>`;
      return;
    }

    const arrow = change >= 0 ? "▲" : "▼";
    const unit = isPoints ? " pts" : "%";
    el.className = "kpi-delta " + (change >= 0 ? "up" : "down");
    el.innerHTML = `${arrow} ${Math.abs(change).toFixed(1)}${unit} <span>vs previous period</span>`;
  }

  function renderKpis(current, previous) {
    const revenue = sum(current, "revenue");
    const orders = sum(current, "orders");
    const views = sum(current, "views");
    const conversion = percent(orders, views);

    const prevConversion = percent(sum(previous, "orders"), sum(previous, "views"));

    document.getElementById("kpiRevenue").textContent = money(revenue);
    document.getElementById("kpiOrders").textContent = number(orders);
    document.getElementById("kpiViews").textContent = number(views);
    document.getElementById("kpiConversion").textContent = conversion.toFixed(1) + "%";

    setDelta("deltaRevenue", revenue, sum(previous, "revenue"));
    setDelta("deltaOrders", orders, sum(previous, "orders"));
    setDelta("deltaViews", views, sum(previous, "views"));
    setDelta("deltaConversion", conversion, prevConversion, true);
  }

  
  //  REVENUE LINE CHART
  
  function renderRevenueChart(rows) {
    const box = document.getElementById("revenueChart");
    box.innerHTML = "";

    const width = box.clientWidth || 800;
    const height = width < 500 ? 220 : 280;
    const pad = { top: 12, right: 8, bottom: 28, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const maxValue = niceMax(Math.max(...rows.map((r) => r.revenue)));
    const x = (i) => pad.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
    const y = (v) => pad.top + innerH - (v / maxValue) * innerH;

    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Revenue per day" });

    // Soft fill under the line
    const defs = svgEl("defs");
    const gradient = svgEl("linearGradient", { id: "revenueFill", x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.append(
      svgEl("stop", { offset: "0%", "stop-color": "#4F46E5", "stop-opacity": 0.18 }),
      svgEl("stop", { offset: "100%", "stop-color": "#4F46E5", "stop-opacity": 0 })
    );
    defs.append(gradient);
    svg.append(defs);

    // Grid lines and y-axis labels
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * i;
      svg.append(svgEl("line", { class: "grid-line", x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value) }));
      const label = svgEl("text", { class: "axis-label", x: pad.left - 8, y: y(value) + 4, "text-anchor": "end" });
      label.textContent = money(value);
      svg.append(label);
    }

    // X-axis labels: one every ~80px, so they never overlap
    const labelCount = Math.max(2, Math.floor(innerW / 80));
    const every = Math.max(1, Math.ceil(rows.length / labelCount));
    rows.forEach((row, i) => {
      if (i % every !== 0 && i !== rows.length - 1) return;
      if (i !== rows.length - 1 && rows.length - 1 - i < every / 2) return; // avoid crowding the last label
      const label = svgEl("text", { class: "axis-label", x: x(i), y: height - 6, "text-anchor": i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle" });
      label.textContent = shortDate(row.date);
      svg.append(label);
    });

    // Area + line
    const points = rows.map((row, i) => `${x(i)},${y(row.revenue)}`);
    svg.append(svgEl("path", { class: "area", d: `M${x(0)},${y(0)} L${points.join(" L")} L${x(rows.length - 1)},${y(0)} Z` }));
    svg.append(svgEl("path", { class: "line", d: `M${points.join(" L")}` }));

    // Hover: crosshair + dot + tooltip
    const crosshair = svgEl("line", { class: "crosshair", y1: pad.top, y2: pad.top + innerH, visibility: "hidden" });
    const dot = svgEl("circle", { class: "hover-dot", r: 5, visibility: "hidden" });
    const hitArea = svgEl("rect", { x: pad.left, y: pad.top, width: innerW, height: innerH, fill: "transparent" });
    svg.append(crosshair, dot, hitArea);

    function onMove(event) {
      const point = event.touches ? event.touches[0] : event;
      const rect = svg.getBoundingClientRect();
      const svgX = ((point.clientX - rect.left) / rect.width) * width;
      const i = Math.max(0, Math.min(rows.length - 1, Math.round(((svgX - pad.left) / innerW) * (rows.length - 1))));
      const row = rows[i];

      crosshair.setAttribute("x1", x(i));
      crosshair.setAttribute("x2", x(i));
      crosshair.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x(i));
      dot.setAttribute("cy", y(row.revenue));
      dot.setAttribute("visibility", "visible");

      showTip(
        `<strong>${money(row.revenue)}</strong>${row.orders} ${row.orders === 1 ? "order" : "orders"} · ${row.views} views<br><span>${row.date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}</span>`,
        point.clientX,
        point.clientY
      );
    }

    function onLeave() {
      crosshair.setAttribute("visibility", "hidden");
      dot.setAttribute("visibility", "hidden");
      hideTip();
    }

    hitArea.addEventListener("mousemove", onMove);
    hitArea.addEventListener("touchmove", onMove, { passive: true });
    hitArea.addEventListener("mouseleave", onLeave);
    hitArea.addEventListener("touchend", onLeave);

    box.append(svg);

    // "Best day" in the corner
    const best = rows.reduce((a, b) => (b.revenue > a.revenue ? b : a));
    document.getElementById("bestDay").textContent = `${money(best.revenue)} · ${shortDate(best.date)}`;
  }

  
  // FUNNEL (views -> enquiries -> orders)
  
  function renderFunnel(rows) {
    const steps = [
      { label: "Views", value: sum(rows, "views") },
      { label: "Enquiries", value: sum(rows, "enquiries") },
      { label: "Orders", value: sum(rows, "orders") }
    ];
    const top = steps[0].value;

    document.getElementById("funnelChart").innerHTML = steps.map((step, i) => `
      <div class="bar-row">
        <span class="bar-label">${step.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${percent(step.value, top)}%"></div></div>
        <span class="bar-value">${number(step.value)}</span>
        ${i > 0 ? `<span class="bar-step">${percent(step.value, steps[i - 1].value).toFixed(1)}% of ${steps[i - 1].label.toLowerCase()}</span>` : ""}
      </div>`).join("");
  }

  
  // REVENUE BY CATEGORY
 
  function renderCategories(listings) {
    const totals = {};
    listings.forEach((l) => {
      totals[l.category] = (totals[l.category] || 0) + l.revenue;
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];

    document.getElementById("categoryChart").innerHTML = sorted.map(([category, revenue]) => `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(category)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${percent(revenue, max)}%"></div></div>
        <span class="bar-value">${money(revenue)}</span>
      </div>`).join("");
  }

  
  //  BUSIEST DAYS (vertical bars)
  
  function renderWeekdays(rows) {
    const box = document.getElementById("weekdayChart");
    box.innerHTML = "";

    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    rows.forEach((row) => {
      totals[(row.date.getDay() + 6) % 7] += row.orders; // Monday first
    });

    const width = box.clientWidth || 400;
    const height = 220;
    const pad = { top: 22, right: 4, bottom: 26, left: 4 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const slot = innerW / 7;
    const barW = Math.min(36, slot - 12);
    const max = Math.max(...totals) || 1;
    const busiest = totals.indexOf(Math.max(...totals));

    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Orders by day of the week" });
    svg.append(svgEl("line", { class: "grid-line", x1: pad.left, x2: width - pad.right, y1: pad.top + innerH, y2: pad.top + innerH }));

    totals.forEach((total, i) => {
      const barH = Math.max(2, (total / max) * innerH);
      const bx = pad.left + slot * i + (slot - barW) / 2;
      const by = pad.top + innerH - barH;

      // Bar with rounded top only
      const r = Math.min(4, barW / 2, barH);
      const path = `M${bx},${by + barH} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${by + barH} Z`;
      const bar = svgEl("path", { class: "bar" + (i === busiest ? " top" : ""), d: path });

      const name = svgEl("text", { class: "axis-label", x: bx + barW / 2, y: height - 6, "text-anchor": "middle" });
      name.textContent = names[i];

      svg.append(bar, name);

      // Only label the busiest bar, to keep it clean
      if (i === busiest) {
        const value = svgEl("text", { class: "axis-label", x: bx + barW / 2, y: by - 6, "text-anchor": "middle", "font-weight": 700 });
        value.textContent = total;
        svg.append(value);
      }

      // Bigger invisible hover target than the bar itself
      const hit = svgEl("rect", { class: "bar-hit", x: pad.left + slot * i, y: pad.top, width: slot, height: innerH });
      hit.addEventListener("mousemove", (e) => {
        box.classList.add("has-hover");
        bar.classList.add("is-hover");
        showTip(`<strong>${total} ${total === 1 ? "order" : "orders"}</strong><span>${names[i]}days</span>`, e.clientX, e.clientY);
      });
      hit.addEventListener("mouseleave", () => {
        box.classList.remove("has-hover");
        bar.classList.remove("is-hover");
        hideTip();
      });
      svg.append(hit);
    });

    box.append(svg);
  }

  
  //  ENQUIRY RESPONSE
 
  function renderReplies(replyMinutes) {
    const sorted = [...replyMinutes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const withinHour = replyMinutes.filter((m) => m <= 60).length;
    const share = percent(withinHour, replyMinutes.length);

    const format = (m) => (m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} hrs`);

    document.getElementById("replyStats").innerHTML = `
      <div class="reply-box">
        <small>Typical reply time</small>
        <strong>${format(median)}</strong>
        <p>Half your replies are faster than this</p>
      </div>
      <div class="reply-box">
        <small>Slowest reply</small>
        <strong>${format(sorted[sorted.length - 1])}</strong>
        <p>Out of ${replyMinutes.length} enquiries</p>
      </div>
      <div class="reply-meter">
        <div class="bar-track"><div class="bar-fill" style="width:${share}%"></div></div>
        <p><strong>${share.toFixed(0)}%</strong> of enquiries answered within an hour. Fast replies win more orders.</p>
      </div>`;
  }

  
  //TOP LISTINGS TABLE
  
  function renderTopListings(listings) {
    const sorted = [...listings].sort((a, b) => b.revenue - a.revenue);
    const max = sorted[0].revenue;

    document.getElementById("topListings").innerHTML = sorted.map((l, i) => `
      <tr>
        <td>
          <div class="listing-cell">
            <span class="mini-thumb ph-${(i % 3) + 1}"></span>
            <div>
              <strong>${escapeHtml(l.title)}</strong>
              <span>${escapeHtml(l.category)}</span>
            </div>
          </div>
        </td>
        <td class="num hide-sm">${number(l.views)}</td>
        <td class="num hide-sm">${number(l.enquiries)}</td>
        <td class="num">${number(l.orders)}</td>
        <td class="num hide-sm">${percent(l.orders, l.views).toFixed(1)}%</td>
        <td>
          <div class="rev-cell">
            <div class="bar-track"><div class="bar-fill" style="width:${percent(l.revenue, max)}%"></div></div>
            <strong>${money(l.revenue)}</strong>
          </div>
        </td>
      </tr>`).join("");
  }

  
  // PUT IT ALL TOGETHER + RANGE BUTTONS
  
  let range = 30;

  function render() {
    const current = DATA.days.slice(-range);
    const previous = DATA.days.slice(-range * 2, -range);

    // Listing totals are for 30 days, so scale them to the chosen range
    const scale = range / 30;
    const listings = DATA.listings.map((l) => ({
      ...l,
      views: Math.round(l.views * scale),
      enquiries: Math.round(l.enquiries * scale),
      orders: Math.max(1, Math.round(l.orders * scale)),
      revenue: Math.round(l.revenue * scale)
    }));

    document.getElementById("revenueSub").textContent = `Money from completed orders, per day · last ${range} days`;

    renderKpis(current, previous);
    renderRevenueChart(current);
    renderFunnel(current);
    renderCategories(listings);
    renderWeekdays(current);
    renderReplies(DATA.replyMinutes);
    renderTopListings(listings);
  }

  document.querySelectorAll(".range-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", b === button);
      });
      range = Number(button.dataset.range);
      render();
    });
  });

  // Redraw the SVG charts when the window size changes
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  render();
})();
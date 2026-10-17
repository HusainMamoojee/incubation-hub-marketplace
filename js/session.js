// Shared login helpers. Load AFTER js/supabase.js on every page.

// ---------- Who is logged in? ----------
async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.user : null;
}

// ---------- Log out ----------
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// ---------- Guard private pages ----------
// Any page with <body data-protected> needs a logged-in user
async function protectPage() {
  if (!document.body.hasAttribute("data-protected")) return;

  const user = await getCurrentUser();

  if (!user) {
    window.location.replace("login.html");
    return;
  }

  document.body.classList.add("auth-ready");
}

// ---------- Swap header buttons when logged in ----------
async function updateHeader() {
  const actions = document.querySelector(".nav-actions");
  if (!actions) return;

  const user = await getCurrentUser();
  if (!user) return;

  const loginLink = actions.querySelector('a[href="login.html"]');
  const sellLink = actions.querySelector('a[href="register.html"]');

  if (loginLink) {
    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-ghost btn-sm";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", logout);
    loginLink.replaceWith(logoutBtn);
  }

  if (sellLink) {
    sellLink.href = HOME_PAGE;
    sellLink.textContent = "My dashboard";
  }
}

protectPage();
updateHeader();
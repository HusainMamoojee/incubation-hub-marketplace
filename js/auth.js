const EDUVOS_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*vossie\.net$/i;

// ---------- Show / hide password ----------
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "Show" : "Hide";
  });
});

// ---------- Helpers ----------
function setError(input, message) {
  const field = input.closest(".field");
  if (!field) return;
  const error = field.querySelector(".field-error");
  field.classList.add("invalid");
  if (error) error.textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}

function showMessage(box, text, type) {
  if (!box) return;
  box.textContent = text;
  box.className = "form-message show " + type;
}

// Clear an error as soon as the person starts fixing it
document.querySelectorAll(".auth-form input, .auth-form select").forEach((el) => {
  el.addEventListener("input", () => {
    const field = el.closest(".field");
    if (field) field.classList.remove("invalid");
  });
});

// ---------- Login ----------
const loginForm = document.getElementById("loginForm");

if (loginForm) {

  // Coming from registration? Show a welcome message and pre-fill the email
  const params = new URLSearchParams(window.location.search);

  if (params.get("registered") === "1") {
    showMessage(
      document.getElementById("formMessage"),
      "Your account is ready. Log in to continue.",
      "success"
    );
    document.getElementById("email").value = params.get("email") || "";
    document.getElementById("password").focus();
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(loginForm);

    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const box = document.getElementById("formMessage");
    let valid = true;

    if (!EDUVOS_EMAIL.test(email.value.trim())) {
      setError(email, "Enter your Eduvos student email.");
      valid = false;
    }
    if (password.value.length === 0) {
      setError(password, "Enter your password.");
      valid = false;
    }
    if (!valid) return;

    // Fake login for now: step 5 replaces this with Supabase
    showMessage(box, "Logged in. Taking you to the marketplace...", "success");
    setTimeout(() => { window.location.href = "index.html"; }, 900);
  });
}

// ---------- Register ----------
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(registerForm);

    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const email = document.getElementById("email");
    const campus = document.getElementById("campus");
    const password = document.getElementById("password");
    const confirm = document.getElementById("confirmPassword");
    const terms = document.getElementById("terms");
    const box = document.getElementById("formMessage");
    let valid = true;

    if (firstName.value.trim() === "") {
      setError(firstName, "Enter your first name.");
      valid = false;
    }
    if (lastName.value.trim() === "") {
      setError(lastName, "Enter your last name.");
      valid = false;
    }
    if (!EDUVOS_EMAIL.test(email.value.trim())) {
      setError(email, "Use your Eduvos student email.");
      valid = false;
    }
    if (campus.value === "") {
      setError(campus, "Choose your campus.");
      valid = false;
    }
    if (password.value.length < 8) {
      setError(password, "Use at least 8 characters.");
      valid = false;
    }
    if (confirm.value !== password.value || confirm.value === "") {
      setError(confirm, "Passwords don't match.");
      valid = false;
    }
    if (!terms.checked) {
      setError(terms, "Please accept the terms to continue.");
      valid = false;
    }
    if (!valid) return;

    // Stop double-clicks while we wait for Supabase
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    // Create the account in Supabase
    const { error } = await supabaseClient.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        data: {
          first_name: firstName.value.trim(),
          last_name: lastName.value.trim(),
          campus: campus.value
        }
      }
    });

    // If something went wrong, show it and let them try again
    if (error) {
      showMessage(box, error.message, "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
      return;
    }

    // Success: sign out the automatic session, then send them to log in
    await supabaseClient.auth.signOut();

    showMessage(box, "Account created! Taking you to log in...", "success");

    const registeredEmail = encodeURIComponent(email.value.trim());
    setTimeout(() => {
      window.location.href = `login.html?registered=1&email=${registeredEmail}`;
    }, 1200);
  });
}
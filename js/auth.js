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

    showMessage(box, "Logged in. Taking you to the marketplace...", "success");
    setTimeout(() => { window.location.href = "browse.html"; }, 900);
  });
}

// ---------- Register ----------
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", (e) => {
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

    showMessage(box, "Account created. Check your Eduvos email to verify it.", "success");
    registerForm.reset();
  });
}
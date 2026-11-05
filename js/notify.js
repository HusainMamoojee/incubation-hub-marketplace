


//  Toasts little messages that slide in, then fade away
const TOAST_ICONS = { success: "✓", error: "!", info: "i" };

function showToast(text, type = "success", seconds = 4) {
  // If a pop-up (dialog) is open, show the toast inside it, otherwise it would sit behind it
  const host = document.querySelector("dialog[open]") || document.body;

  let stack = host.querySelector(":scope > .toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    host.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const words = document.createElement("span");
  words.className = "toast-text";
  words.textContent = text;   // textContent: safe, even for error messages

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "✕";

  toast.append(icon, words, close);
  stack.appendChild(toast);

  // Slide in on the next frame
  requestAnimationFrame(() => toast.classList.add("show"));

  function dismiss() {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }

  close.addEventListener("click", dismiss);
  setTimeout(dismiss, seconds * 1000);
}

// Confirm pop-up in the site's design (returns true / false) 
function confirmDialog({ title, text, confirmText = "Confirm", cancelText = "Cancel" }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const body = document.createElement("p");
    body.textContent = text;

    const actions = document.createElement("div");
    actions.className = "confirm-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost btn-sm";
    cancelBtn.textContent = cancelText;

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn-indigo btn-sm";
    okBtn.textContent = confirmText;

    actions.append(cancelBtn, okBtn);
    dialog.append(heading, body, actions);
    document.body.appendChild(dialog);

    let answer = false;
    function finish(value) {
      answer = value;
      dialog.close();
    }

    okBtn.addEventListener("click", () => finish(true));
    cancelBtn.addEventListener("click", () => finish(false));
    dialog.addEventListener("click", (e) => { if (e.target === dialog) finish(false); }); // click outside
    dialog.addEventListener("close", () => {     // also fires for the Esc key
      dialog.remove();
      resolve(answer);
    });

    dialog.showModal();
    okBtn.focus();
  });
}
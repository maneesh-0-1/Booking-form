/**
 * YYC Reflexology Universal Popup Booking Embed Script
 * Embed anywhere using: <script src="https://YOUR-DOMAIN.com/embed.js" defer></script>
 * Any button with class="yyc-book-btn" or onclick="openYYCBooking()" will trigger the popup!
 */
(function () {
  "use strict";

  // Determine current host from the script tag src
  var currentScript = document.currentScript;
  var scriptSrc = currentScript ? currentScript.src : "";
  var defaultBase = window.location.origin;

  try {
    if (scriptSrc && scriptSrc.startsWith("http")) {
      var url = new URL(scriptSrc);
      defaultBase = url.origin;
    }
  } catch (e) {
    // fallback to window.location.origin
  }

  var EMBED_URL = defaultBase + "/embed";
  var modalEl = null;
  var iframeEl = null;

  function createModal() {
    if (modalEl) return modalEl;

    // Inject CSS
    var style = document.createElement("style");
    style.innerHTML = [
      ".yyc-embed-backdrop {",
      "  position: fixed;",
      "  inset: 0;",
      "  background: rgba(15, 23, 42, 0.6);",
      "  backdrop-filter: blur(4px);",
      "  -webkit-backdrop-filter: blur(4px);",
      "  z-index: 999999;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  padding: 16px;",
      "  opacity: 0;",
      "  visibility: hidden;",
      "  transition: opacity 0.25s ease, visibility 0.25s ease;",
      "}",
      ".yyc-embed-backdrop.yyc-visible {",
      "  opacity: 1;",
      "  visibility: visible;",
      "}",
      ".yyc-embed-container {",
      "  width: 100%;",
      "  max-width: 1060px;",
      "  height: 90vh;",
      "  max-height: 840px;",
      "  background: #ffffff;",
      "  border-radius: 16px;",
      "  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);",
      "  overflow: hidden;",
      "  position: relative;",
      "  transform: translateY(16px) scale(0.98);",
      "  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);",
      "}",
      ".yyc-embed-backdrop.yyc-visible .yyc-embed-container {",
      "  transform: translateY(0) scale(1);",
      "}",
      ".yyc-embed-close {",
      "  position: absolute;",
      "  top: 14px;",
      "  right: 16px;",
      "  width: 36px;",
      "  height: 36px;",
      "  border-radius: 50%;",
      "  background: #f1f5f9;",
      "  border: 1px solid #e2e8f0;",
      "  color: #475569;",
      "  font-size: 20px;",
      "  line-height: 1;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  cursor: pointer;",
      "  z-index: 100;",
      "  transition: background 0.15s ease, color 0.15s ease;",
      "}",
      ".yyc-embed-close:hover {",
      "  background: #fee2e2;",
      "  color: #dc2626;",
      "  border-color: #fca5a5;",
      "}",
      ".yyc-embed-iframe {",
      "  width: 100%;",
      "  height: 100%;",
      "  border: none;",
      "  display: block;",
      "}",
      "@media (max-width: 640px) {",
      "  .yyc-embed-backdrop { padding: 0; }",
      "  .yyc-embed-container { height: 100vh; max-height: 100vh; border-radius: 0; }",
      "}"
    ].join("\n");
    document.head.appendChild(style);

    // Create Modal HTML
    modalEl = document.createElement("div");
    modalEl.className = "yyc-embed-backdrop";
    modalEl.id = "yyc-booking-modal-overlay";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");

    var container = document.createElement("div");
    container.className = "yyc-embed-container";

    var closeBtn = document.createElement("button");
    closeBtn.className = "yyc-embed-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = closeYYCBooking;

    iframeEl = document.createElement("iframe");
    iframeEl.className = "yyc-embed-iframe";
    iframeEl.src = EMBED_URL;
    iframeEl.title = "YYC Reflexology Appointment Booking Engine";
    iframeEl.allow = "payment";

    container.appendChild(closeBtn);
    container.appendChild(iframeEl);
    modalEl.appendChild(container);

    // Close on backdrop click
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) {
        closeYYCBooking();
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl && modalEl.classList.contains("yyc-visible")) {
        closeYYCBooking();
      }
    });

    document.body.appendChild(modalEl);
    return modalEl;
  }

  function openYYCBooking() {
    createModal();
    modalEl.classList.add("yyc-visible");
    document.body.style.overflow = "hidden";
  }

  function closeYYCBooking() {
    if (modalEl) {
      modalEl.classList.remove("yyc-visible");
      document.body.style.overflow = "";
    }
  }

  // Auto-bind to buttons/links on page
  function bindTriggers() {
    var triggers = document.querySelectorAll(".yyc-book-btn, [data-yyc-book], [data-booking-trigger], #book-now-trigger");
    triggers.forEach(function (btn) {
      btn.removeEventListener("click", onTriggerClick);
      btn.addEventListener("click", onTriggerClick);
    });
  }

  function onTriggerClick(e) {
    e.preventDefault();
    openYYCBooking();
  }

  // Expose global methods
  window.openYYCBooking = openYYCBooking;
  window.closeYYCBooking = closeYYCBooking;
  window.YYCBooking = {
    open: openYYCBooking,
    close: closeYYCBooking,
    init: bindTriggers,
    setOrigin: function (origin) {
      EMBED_URL = origin.replace(/\/+$/, "") + "/embed";
      if (iframeEl) iframeEl.src = EMBED_URL;
    }
  };

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTriggers);
  } else {
    bindTriggers();
  }
})();

(() => {
  const map = document.querySelector("[data-contact-map-src]");
  if (map instanceof HTMLIFrameElement) {
    const loadMap = () => { map.src = map.dataset.contactMapSrc; delete map.dataset.contactMapSrc; };
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadMap(); observer.disconnect();
      }, { rootMargin: "120px" });
      observer.observe(map);
    } else loadMap();
  }
  const button = document.querySelector("[data-copy-requisites]");
  const source = document.getElementById("contact-copy-data");
  const status = document.querySelector("[data-copy-status]");
  if (!button || !source || !status || !navigator.clipboard?.writeText) return;
  let text;
  try { text = JSON.parse(source.textContent); } catch { return; }
  if (typeof text !== "string") return;
  const message = status.querySelector("[data-copy-message]") || status;
  const check = status.querySelector("[data-copy-check]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let feedback;
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) feedback?.cancel();
  });
  const setStatus = (state, value) => {
    feedback?.cancel();
    status.dataset.copyState = state;
    message.textContent = value;
    if (check) check.toggleAttribute("hidden", state !== "success");
    if (state === "pending") return;
    try {
      status.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "auto" : "smooth" });
      const stroke = check?.querySelector("path");
      if (state !== "success" || reducedMotion.matches || !stroke?.animate) return;
      const style = getComputedStyle(status);
      const timing = style.getPropertyValue("--duration-fast").trim();
      const duration = parseFloat(timing) * (timing.endsWith("ms") ? 1 : 1000) || 180;
      feedback = stroke.animate([{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }], {
        duration, easing: style.getPropertyValue("--ease-standard").trim() || "ease-out",
      });
    } catch { /* Optional motion must not turn a successful copy into an error. */ }
  };
  button.hidden = false;
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setStatus("pending", "");
    try { await navigator.clipboard.writeText(text); setStatus("success", "Реквизиты скопированы"); }
    catch { setStatus("error", "Не удалось скопировать. Выделите данные в таблице или скачайте PDF."); }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  });
})();

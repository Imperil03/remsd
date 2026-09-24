(() => {
  const map = document.querySelector("[data-company-map-src]");
  if (map instanceof HTMLIFrameElement && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      map.src = map.dataset.companyMapSrc;
      delete map.dataset.companyMapSrc;
      observer.disconnect();
    }, { rootMargin: "160px" });
    observer.observe(map);
  }
  const dialog = document.querySelector("[data-company-viewer]");
  const source = document.getElementById("company-media-data");
  if (!(dialog instanceof HTMLDialogElement) || !source) return;
  let groups;
  try { groups = JSON.parse(source.textContent); } catch { return; }
  const image = dialog.querySelector("[data-company-image]");
  const caption = document.getElementById("company-viewer-caption");
  const counter = dialog.querySelector("[data-company-counter]");
  const fileLink = dialog.querySelector("[data-company-file]");
  const error = dialog.querySelector("[data-company-error]");
  const previous = dialog.querySelector("[data-company-prev]");
  const next = dialog.querySelector("[data-company-next]");
  let active = [];
  let index = 0;
  let opener = null;

  function show() {
    const item = active[index];
    if (!item) return;
    error.hidden = true;
    image.hidden = false;
    image.alt = item.alt;
    image.src = item.src;
    caption.textContent = item.caption;
    counter.textContent = active.length > 1 ? `${index + 1} / ${active.length}` : "";
    fileLink.href = item.src;
    previous.disabled = index === 0;
    next.disabled = index === active.length - 1;
    previous.hidden = next.hidden = active.length === 1;
  }
  const step = (direction) => { index = Math.max(0, Math.min(active.length - 1, index + direction)); show(); };
  document.querySelectorAll("[data-company-media]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const items = groups[link.dataset.companyMedia];
      if (!Array.isArray(items) || !items.length) return;
      event.preventDefault();
      opener = link;
      active = items;
      index = Number(link.dataset.mediaIndex) || 0;
      show();
      document.body.classList.add("is-company-viewer-open");
      dialog.showModal();
      dialog.querySelector("[data-company-close]").focus();
    });
  });
  dialog.querySelector("[data-company-close]").addEventListener("click", () => dialog.close());
  previous.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const targets = [...dialog.querySelectorAll("button:not([disabled]), a[href]")]
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (targets.length && (!dialog.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("is-company-viewer-open");
    image.removeAttribute("src");
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  image.addEventListener("error", () => { if (dialog.open) { image.hidden = true; error.hidden = false; } });
  image.addEventListener("load", () => { error.hidden = true; image.hidden = false; });
})();

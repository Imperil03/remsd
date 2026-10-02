(() => {
  const oldDocument = location.hash.match(/^#document-([a-z0-9-]+)$/)?.[1];
  const documentIds = (document.body.dataset.documentIds || "").split(" ");
  if (oldDocument && document.body.dataset.documentsPage && documentIds.includes(oldDocument)) {
    location.replace(new URL(`${document.body.dataset.documentsPage}#document-${oldDocument}`, location.href));
    return;
  }
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
    window.REMSDMotion?.cancel(dialog);
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
  const step = (direction) => {
    const nextIndex = Math.max(0, Math.min(active.length - 1, index + direction));
    if (nextIndex === index) return;
    index = nextIndex;
    show();
    window.REMSDMotion?.viewerStep(dialog, image, direction);
  };
  let openEpoch = 0;
  const closingSessions = [];
  const close = () => {
    if (!dialog.open) return;
    const destination = [...document.querySelectorAll("[data-company-media]")].find((link) => link.dataset.companyMedia === opener?.dataset.companyMedia && Number(link.dataset.mediaIndex || 0) === index);
    closingSessions.push({ epoch: openEpoch, capture: window.REMSDMotion?.captureMedia(dialog, image), destination });
    dialog.close();
  };
  document.querySelectorAll("[data-company-media]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const items = groups[link.dataset.companyMedia];
      if (!Array.isArray(items) || !items.length) return;
      event.preventDefault();
      const origin = window.REMSDMotion?.thumbnail(link);
      opener = link;
      openEpoch += 1;
      active = items;
      index = Number(link.dataset.mediaIndex) || 0;
      show();
      document.body.classList.add("is-company-viewer-open");
      dialog.showModal();
      dialog.querySelector("[data-company-close]").focus();
      window.REMSDMotion?.viewerEnter(dialog, image, origin);
    });
  });
  dialog.querySelector("[data-company-close]").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
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
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener("close", () => {
    const session = closingSessions.shift();
    if (dialog.open || (session && session.epoch !== openEpoch)) return;
    document.body.classList.remove("is-company-viewer-open");
    image.removeAttribute("src");
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    window.REMSDMotion?.viewerExit(dialog, session?.capture, session?.destination);
  });
  image.addEventListener("error", () => { if (dialog.open) { image.hidden = true; error.hidden = false; } });
  image.addEventListener("load", () => { error.hidden = true; image.hidden = false; });
})();

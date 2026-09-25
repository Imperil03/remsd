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
  button.hidden = false;
  button.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(text); status.textContent = "Реквизиты скопированы"; }
    catch { status.textContent = "Не удалось скопировать. Выделите данные в таблице или скачайте PDF."; }
  });
})();

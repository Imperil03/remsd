const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.querySelector("[data-site-nav]");
const mobileCallbar = document.querySelector("[data-mobile-callbar]");
const mobileCallbarQuery = window.matchMedia("(max-width: 720px)");
let updateMobileCallbar = () => {};

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-nav-open", isOpen);
    updateMobileCallbar();
  });

  siteNav.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
    updateMobileCallbar();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
    updateMobileCallbar();
  });
}

if (mobileCallbar) {
  updateMobileCallbar = () => {
    const isVisible = mobileCallbarQuery.matches && window.scrollY > 360 && !document.body.classList.contains("is-nav-open");
    document.body.classList.toggle("is-callbar-visible", isVisible);
    mobileCallbar.setAttribute("aria-hidden", String(!isVisible));
  };

  updateMobileCallbar();
  window.addEventListener("scroll", updateMobileCallbar, { passive: true });
  window.addEventListener("resize", updateMobileCallbar);
  mobileCallbarQuery.addEventListener("change", updateMobileCallbar);
}

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
    const isVisible =
      mobileCallbarQuery.matches &&
      window.scrollY > 360 &&
      !document.body.classList.contains("is-nav-open") &&
      !document.body.classList.contains("is-lightbox-open");
    document.body.classList.toggle("is-callbar-visible", isVisible);
    mobileCallbar.setAttribute("aria-hidden", String(!isVisible));
  };

  updateMobileCallbar();
  window.addEventListener("scroll", updateMobileCallbar, { passive: true });
  window.addEventListener("resize", updateMobileCallbar);
  mobileCallbarQuery.addEventListener("change", updateMobileCallbar);
}

const mediaLightbox = document.querySelector("[data-media-lightbox]");
const lightboxItems = Array.from(document.querySelectorAll("[data-lightbox-item]"));

if (mediaLightbox && lightboxItems.length) {
  const lightboxImage = mediaLightbox.querySelector("[data-lightbox-image]");
  const lightboxTitle = mediaLightbox.querySelector("[data-lightbox-title]");
  const lightboxCaption = mediaLightbox.querySelector("[data-lightbox-caption]");
  const lightboxCounter = mediaLightbox.querySelector("[data-lightbox-counter]");
  const closeButton = mediaLightbox.querySelector("[data-lightbox-close]");
  const prevButton = mediaLightbox.querySelector("[data-lightbox-prev]");
  const nextButton = mediaLightbox.querySelector("[data-lightbox-next]");
  let activeItems = [];
  let activeIndex = 0;
  let previousFocus = null;

  const getItemData = (item) => {
    const image = item.querySelector("img");
    const caption = item.dataset.caption || image?.alt || "Изображение";

    return {
      src: item.dataset.largeSrc || image?.src || "",
      alt: image?.alt || caption,
      caption,
    };
  };

  const renderLightbox = () => {
    const data = getItemData(activeItems[activeIndex]);
    lightboxImage.src = data.src;
    lightboxImage.alt = data.alt;
    lightboxTitle.textContent = data.caption;
    lightboxCaption.textContent = data.caption;
    lightboxCounter.textContent = `${activeIndex + 1} / ${activeItems.length}`;
  };

  const moveLightbox = (step) => {
    activeIndex = (activeIndex + step + activeItems.length) % activeItems.length;
    renderLightbox();
  };

  const closeLightbox = () => {
    mediaLightbox.hidden = true;
    document.body.classList.remove("is-lightbox-open");
    lightboxImage.removeAttribute("src");
    updateMobileCallbar();

    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  };

  const openLightbox = (item) => {
    const group = item.dataset.lightboxGroup || "default";
    activeItems = lightboxItems.filter((candidate) => (candidate.dataset.lightboxGroup || "default") === group);
    activeIndex = activeItems.indexOf(item);
    previousFocus = document.activeElement;

    renderLightbox();
    mediaLightbox.hidden = false;
    document.body.classList.add("is-lightbox-open");
    updateMobileCallbar();
    closeButton.focus();
  };

  lightboxItems.forEach((item) => {
    item.addEventListener("click", () => openLightbox(item));
  });

  closeButton.addEventListener("click", closeLightbox);
  prevButton.addEventListener("click", () => moveLightbox(-1));
  nextButton.addEventListener("click", () => moveLightbox(1));

  mediaLightbox.addEventListener("click", (event) => {
    if (event.target === mediaLightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (mediaLightbox.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLightbox(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLightbox(1);
    }
  });
}

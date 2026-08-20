const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.querySelector("[data-site-nav]");
const mobileCallbar = document.querySelector("[data-mobile-callbar]");
const mobileCallbarQuery = window.matchMedia("(max-width: 720px)");
const menuItems = Array.from(document.querySelectorAll("[data-menu-item]"));
let updateMobileCallbar = () => {};

document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

const closeMenuPanels = (except = null) => {
  menuItems.forEach((item) => {
    if (item === except) return;
    item.classList.remove("is-panel-open");
    item.querySelector("[data-menu-toggle]")?.setAttribute("aria-expanded", "false");
  });
};

const suppressMenuPanels = () => {
  menuItems.forEach((item) => item.classList.add("is-panel-suppressed"));
};

menuItems.forEach((item) => {
  const trigger = item.querySelector("[data-menu-toggle]");
  if (!trigger) return;

  item.addEventListener("mouseleave", () => {
    item.classList.remove("is-panel-suppressed");
  });

  trigger.addEventListener("pointerenter", () => {
    item.classList.remove("is-panel-suppressed");
  });

  trigger.addEventListener("click", () => {
    item.classList.remove("is-panel-suppressed");
    const isOpen = item.classList.toggle("is-panel-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    closeMenuPanels(isOpen ? item : null);
  });
});

document.addEventListener("click", (event) => {
  if (event.target instanceof Node && siteNav?.contains(event.target)) return;
  closeMenuPanels();
});

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-nav-open", isOpen);
    if (!isOpen) closeMenuPanels();
    updateMobileCallbar();
  });

  siteNav.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.matches("[data-placeholder-link]")) {
      event.preventDefault();
      return;
    }
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
    closeMenuPanels();
    updateMobileCallbar();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
    closeMenuPanels();
    suppressMenuPanels();
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
  const lightboxStatus = mediaLightbox.querySelector("[data-lightbox-status]");
  const closeButton = mediaLightbox.querySelector("[data-lightbox-close]");
  const prevButton = mediaLightbox.querySelector("[data-lightbox-prev]");
  const nextButton = mediaLightbox.querySelector("[data-lightbox-next]");
  let activeItems = [];
  let activeIndex = 0;
  let activeRender = 0;
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
    const renderId = activeRender + 1;
    let hasFinished = false;
    activeRender = renderId;

    lightboxImage.alt = data.alt;
    lightboxTitle.textContent = data.caption;
    lightboxCaption.textContent = data.caption;
    lightboxCounter.textContent = `${activeIndex + 1} / ${activeItems.length}`;
    mediaLightbox.classList.add("is-loading");
    mediaLightbox.classList.remove("is-error");
    lightboxStatus.hidden = false;
    lightboxStatus.textContent = "Загрузка изображения…";

    const finishLoading = () => {
      if (renderId !== activeRender || hasFinished) return;
      hasFinished = true;
      mediaLightbox.classList.remove("is-loading", "is-error");
      const settleDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
      window.setTimeout(() => {
        if (renderId === activeRender) lightboxStatus.hidden = true;
      }, settleDelay);
    };

    lightboxImage.onload = finishLoading;
    lightboxImage.onerror = () => {
      if (renderId !== activeRender) return;
      mediaLightbox.classList.remove("is-loading");
      mediaLightbox.classList.add("is-error");
      lightboxStatus.hidden = false;
      lightboxStatus.textContent = "Не удалось загрузить изображение.";
    };

    lightboxImage.src = data.src;
    if (lightboxImage.complete && lightboxImage.naturalWidth > 0) finishLoading();
  };

  const moveLightbox = (step) => {
    activeIndex = (activeIndex + step + activeItems.length) % activeItems.length;
    renderLightbox();
  };

  const closeLightbox = () => {
    activeRender += 1;
    mediaLightbox.hidden = true;
    mediaLightbox.classList.remove("is-loading", "is-error");
    document.body.classList.remove("is-lightbox-open");
    lightboxImage.onload = null;
    lightboxImage.onerror = null;
    lightboxImage.removeAttribute("src");
    lightboxStatus.hidden = true;
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

const dossierSections = Array.from(document.querySelectorAll("[data-dossier-section][id]"));
const dossierNavLinks = Array.from(document.querySelectorAll("[data-dossier-nav-link]"));

if (dossierSections.length && dossierNavLinks.length && "IntersectionObserver" in window) {
  const visibleSections = new Map();

  const setCurrentDossierSection = (sectionId) => {
    dossierNavLinks.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;

      if (link.hash === `#${sectionId}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  setCurrentDossierSection(dossierSections[0].id);

  const dossierObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.set(entry.target.id, entry.boundingClientRect.top);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });

      const current = Array.from(visibleSections.entries()).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
      if (current) setCurrentDossierSection(current[0]);
    },
    { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.15, 0.5] },
  );

  dossierSections.forEach((section) => dossierObserver.observe(section));
}

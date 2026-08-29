const DESIGN_BREAKPOINTS = Object.freeze({
  compact: 720,
  internalNav: 1020,
  homeNav: 1120,
});

const maxWidthQuery = (value) => `(max-width: ${value}px)`;

const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.querySelector("[data-site-nav]");
const mobileCallbar = document.querySelector("[data-mobile-callbar]");
const mobileCallbarQuery = window.matchMedia(maxWidthQuery(DESIGN_BREAKPOINTS.compact));
const menuItems = Array.from(document.querySelectorAll("[data-menu-item]"));
const navQuery = navToggle?.classList.contains("v3-nav-toggle")
  ? maxWidthQuery(DESIGN_BREAKPOINTS.homeNav)
  : maxWidthQuery(DESIGN_BREAKPOINTS.internalNav);
const navMediaQuery = window.matchMedia(navQuery);
let navIsOpen = false;
let updateMobileCallbar = () => {};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusableElements = (root) =>
  Array.from(root.querySelectorAll(focusableSelector)).filter(
    (element) =>
      element instanceof HTMLElement &&
      !element.closest("[inert]") &&
      !element.closest("[hidden]") &&
      element.getAttribute("aria-hidden") !== "true" &&
      (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0),
  );

document.querySelectorAll(".skip-link[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!(target instanceof HTMLElement)) return;
    window.setTimeout(() => target.focus({ preventScroll: true }), 0);
  });
});

const setMenuPanelState = (item, isOpen, { restoreFocus = false } = {}) => {
  const trigger = item.querySelector("[data-menu-toggle]");
  const panel = item.querySelector("[data-menu-panel]");
  if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;

  item.classList.toggle("is-panel-open", isOpen);
  trigger.setAttribute("aria-expanded", String(isOpen));
  panel.hidden = !isOpen;
  panel.toggleAttribute("inert", !isOpen);

  if (!isOpen && restoreFocus) {
    trigger.focus();
  }
};

const closeMenuPanels = ({ except = null, restoreFocus = false } = {}) => {
  menuItems.forEach((item) => {
    if (item === except) return;
    const shouldRestoreFocus = restoreFocus && item.classList.contains("is-panel-open");
    setMenuPanelState(item, false, { restoreFocus: shouldRestoreFocus });
  });
};

const setNavState = (isOpen, { moveFocus = false, restoreFocus = false } = {}) => {
  if (!(navToggle instanceof HTMLButtonElement) || !(siteNav instanceof HTMLElement)) return;

  navIsOpen = navMediaQuery.matches && isOpen;
  siteNav.classList.toggle("is-open", navIsOpen);
  siteNav.hidden = navMediaQuery.matches && !navIsOpen;
  siteNav.toggleAttribute("inert", navMediaQuery.matches && !navIsOpen);
  navToggle.setAttribute("aria-expanded", String(navIsOpen));
  navToggle.setAttribute("aria-label", navIsOpen ? "Закрыть меню" : "Открыть меню");
  document.body.classList.toggle("is-nav-open", navIsOpen);

  if (navMediaQuery.matches) {
    siteNav.setAttribute("aria-hidden", String(!navIsOpen));
  } else {
    siteNav.removeAttribute("aria-hidden");
  }

  if (!navIsOpen) {
    closeMenuPanels();
  }

  updateMobileCallbar();

  if (navIsOpen && moveFocus) {
    window.requestAnimationFrame(() => getFocusableElements(siteNav)[0]?.focus());
  }

  if (!navIsOpen && restoreFocus) {
    navToggle.focus();
  }
};

const syncNavBreakpoint = () => {
  closeMenuPanels();
  if (navMediaQuery.matches) {
    setNavState(false);
    return;
  }

  navIsOpen = false;
  if (siteNav instanceof HTMLElement) {
    siteNav.hidden = false;
    siteNav.removeAttribute("inert");
    siteNav.removeAttribute("aria-hidden");
    siteNav.classList.remove("is-open");
  }
  if (navToggle instanceof HTMLButtonElement) {
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Открыть меню");
  }
  document.body.classList.remove("is-nav-open");
  updateMobileCallbar();
};

menuItems.forEach((item) => {
  const trigger = item.querySelector("[data-menu-toggle]");
  if (!(trigger instanceof HTMLButtonElement)) return;

  setMenuPanelState(item, false);

  trigger.addEventListener("click", () => {
    const isOpen = !item.classList.contains("is-panel-open");
    closeMenuPanels({ except: isOpen ? item : null });
    setMenuPanelState(item, isOpen);
  });

  trigger.addEventListener("pointerenter", (event) => {
    if (navMediaQuery.matches || event.pointerType === "touch") return;
    closeMenuPanels({ except: item });
    setMenuPanelState(item, true);
  });

  item.addEventListener("mouseleave", () => {
    if (navMediaQuery.matches || item.contains(document.activeElement)) return;
    setMenuPanelState(item, false);
  });

  item.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!item.contains(document.activeElement)) {
        setMenuPanelState(item, false);
      }
    }, 0);
  });
});

if (navToggle instanceof HTMLButtonElement && siteNav instanceof HTMLElement) {
  navToggle.addEventListener("click", () => {
    setNavState(!navIsOpen, { moveFocus: !navIsOpen });
  });

  siteNav.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    closeMenuPanels();
    if (navMediaQuery.matches) {
      setNavState(false);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node)) return;
    if (siteNav.contains(event.target) || navToggle.contains(event.target)) return;
    closeMenuPanels();
    if (navMediaQuery.matches && navIsOpen) {
      setNavState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || document.body.classList.contains("is-lightbox-open")) return;

    const openItem = menuItems.find((item) => item.classList.contains("is-panel-open"));
    if (openItem) {
      event.preventDefault();
      setMenuPanelState(openItem, false, { restoreFocus: true });
      return;
    }

    if (navIsOpen) {
      event.preventDefault();
      setNavState(false, { restoreFocus: true });
    }
  });

  navMediaQuery.addEventListener("change", syncNavBreakpoint);
  syncNavBreakpoint();
}

if (siteNav instanceof HTMLElement) {
  const normalizedPath = (pathname) => {
    const withoutIndex = pathname.replace(/\/index\.html$/i, "/");
    return withoutIndex.length > 1 ? withoutIndex.replace(/\/$/, "") : withoutIndex;
  };
  const currentPath = normalizedPath(window.location.pathname);
  let currentLinkAssigned = false;

  siteNav.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const url = new URL(link.href, window.location.href);
    const isCurrent = url.origin === window.location.origin && normalizedPath(url.pathname) === currentPath;
    if (isCurrent && !currentLinkAssigned) {
      link.setAttribute("aria-current", "page");
      currentLinkAssigned = true;
    }
  });

  menuItems.forEach((item) => {
    item.classList.toggle("is-current", Boolean(item.querySelector("a[aria-current='page']")));
  });
}

const brandToggle = document.querySelector("[data-brand-toggle]");
const brandPanel = document.querySelector("[data-brand-panel]");
const brandMediaQuery = window.matchMedia(maxWidthQuery(DESIGN_BREAKPOINTS.compact));
let brandsAreExpanded = false;

const setBrandPanelState = (isExpanded) => {
  if (!(brandToggle instanceof HTMLButtonElement) || !(brandPanel instanceof HTMLElement)) return;
  brandsAreExpanded = !brandMediaQuery.matches || isExpanded;
  brandToggle.setAttribute("aria-expanded", String(brandsAreExpanded));
  brandPanel.hidden = brandMediaQuery.matches && !brandsAreExpanded;
  brandPanel.toggleAttribute("inert", brandMediaQuery.matches && !brandsAreExpanded);
};

if (brandToggle instanceof HTMLButtonElement && brandPanel instanceof HTMLElement) {
  brandToggle.addEventListener("click", () => setBrandPanelState(!brandsAreExpanded));
  brandMediaQuery.addEventListener("change", () => setBrandPanelState(false));
  setBrandPanelState(false);
}

if (mobileCallbar instanceof HTMLElement) {
  updateMobileCallbar = () => {
    const isVisible =
      mobileCallbarQuery.matches &&
      window.scrollY > 360 &&
      !document.body.classList.contains("is-nav-open") &&
      !document.body.classList.contains("is-lightbox-open");
    document.body.classList.toggle("is-callbar-visible", isVisible);
    mobileCallbar.setAttribute("aria-hidden", String(!isVisible));
    mobileCallbar.toggleAttribute("inert", !isVisible);
  };

  updateMobileCallbar();
  window.addEventListener("scroll", updateMobileCallbar, { passive: true });
  window.addEventListener("resize", updateMobileCallbar);
  mobileCallbarQuery.addEventListener("change", updateMobileCallbar);
}

const mediaLightbox = document.querySelector("[data-media-lightbox]");
const lightboxItems = Array.from(document.querySelectorAll("[data-lightbox-item]"));

if (mediaLightbox instanceof HTMLElement && lightboxItems.length) {
  const lightboxImage = mediaLightbox.querySelector("[data-lightbox-image]");
  const lightboxTitle = mediaLightbox.querySelector("[data-lightbox-title]");
  const lightboxCaption = mediaLightbox.querySelector("[data-lightbox-caption]");
  const lightboxCounter = mediaLightbox.querySelector("[data-lightbox-counter]");
  const closeButton = mediaLightbox.querySelector("[data-lightbox-close]");
  const prevButton = mediaLightbox.querySelector("[data-lightbox-prev]");
  const nextButton = mediaLightbox.querySelector("[data-lightbox-next]");
  const backgroundInertState = new Map();
  let activeItems = [];
  let activeIndex = 0;
  let previousFocus = null;

  const setBackgroundInert = (isInert) => {
    Array.from(document.body.children).forEach((element) => {
      if (!(element instanceof HTMLElement) || element === mediaLightbox || element.tagName === "SCRIPT") return;

      if (isInert) {
        backgroundInertState.set(element, element.hasAttribute("inert"));
        element.setAttribute("inert", "");
        return;
      }

      if (!backgroundInertState.get(element)) {
        element.removeAttribute("inert");
      }
    });

    if (!isInert) {
      backgroundInertState.clear();
    }
  };

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
    if (mediaLightbox.hidden) return;
    mediaLightbox.hidden = true;
    mediaLightbox.setAttribute("inert", "");
    document.body.classList.remove("is-lightbox-open");
    lightboxImage.removeAttribute("src");
    setBackgroundInert(false);
    updateMobileCallbar();

    if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };

  const openLightbox = (item) => {
    const group = item.dataset.lightboxGroup || "default";
    activeItems = lightboxItems.filter((candidate) => (candidate.dataset.lightboxGroup || "default") === group);
    activeIndex = activeItems.indexOf(item);
    previousFocus = document.activeElement;

    renderLightbox();
    setBackgroundInert(true);
    mediaLightbox.hidden = false;
    mediaLightbox.removeAttribute("inert");
    document.body.classList.add("is-lightbox-open");
    prevButton.hidden = activeItems.length < 2;
    nextButton.hidden = activeItems.length < 2;
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

    if (event.key === "Tab") {
      const focusable = getFocusableElements(mediaLightbox);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft" && activeItems.length > 1) {
      event.preventDefault();
      moveLightbox(-1);
    }

    if (event.key === "ArrowRight" && activeItems.length > 1) {
      event.preventDefault();
      moveLightbox(1);
    }
  });
}

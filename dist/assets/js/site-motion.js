(() => {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const active = new Map();
  const allowed = () => !preference.matches && document.visibilityState === "visible" && typeof Element.prototype.animate === "function";
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
  const cancel = (owner) => active.get(owner)?.dispose();
  const cancelAll = () => [...active.values()].forEach((scope) => scope.dispose());
  function begin(owner) {
    cancel(owner);
    if (!allowed()) return null;
    const scope = { animations: [], cleanup: [] };
    scope.dispose = () => {
      if (active.get(owner) !== scope) return;
      active.delete(owner);
      scope.animations.forEach((animation) => animation.cancel());
      scope.cleanup.forEach((cleanup) => cleanup());
    };
    scope.play = (element, frames, duration, options = {}) => {
      const animation = element.animate(frames, { duration, easing: ease, ...options });
      scope.animations.push(animation);
      return animation;
    };
    scope.finish = () => Promise.all(scope.animations.map((animation) => animation.finished)).then(scope.dispose, scope.dispose);
    scope.scrollX = scrollX;
    scope.scrollY = scrollY;
    active.set(owner, scope);
    return scope;
  }
  function box(element) {
    const rect = element?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  }
  function visible(rect) {
    return rect && rect.y + rect.height > 0 && rect.y < innerHeight && rect.x + rect.width > 0 && rect.x < innerWidth;
  }
  function cleanClone(element) {
    const clone = element.cloneNode(true);
    for (const node of [clone, ...clone.querySelectorAll("*")]) {
      for (const attribute of [...node.attributes]) if (attribute.name === "id" || attribute.name.startsWith("data-")) node.removeAttribute(attribute.name);
    }
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");
    clone.dataset.motionGhost = "";
    return clone;
  }
  function snapshot(element) {
    if (!allowed() || !(element instanceof HTMLElement) || element.hidden) return null;
    const rect = box(element);
    if (!visible(rect)) return null;
    const style = getComputedStyle(element);
    const clone = cleanClone(element);
    for (const property of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "background", "border", "borderRadius", "padding", "boxShadow", "display", "overflow", "gap", "gridTemplateColumns", "textAlign", "clipPath"]) clone.style[property] = style[property];
    Object.assign(clone.style, { position: "fixed", left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`, maxWidth: "none", maxHeight: "none", margin: "0", transform: "none", opacity: style.opacity, visibility: "visible", pointerEvents: "none", zIndex: style.zIndex === "auto" ? "240" : style.zIndex });
    // Desktop dropdowns inherit link styling from .v3-nav. Preserve that CSS
    // context outside the transformed header without cloning its live controls.
    if (element.matches('.main-nav__panel') && element.closest('.v3-nav')) {
      const context = document.createElement('div');
      context.className = 'v3-nav';
      context.setAttribute('aria-hidden', 'true');
      context.setAttribute('inert', '');
      context.dataset.motionGhost = '';
      Object.assign(context.style, { position:'fixed', left:'0', top:'0', width:'0', height:'0', minWidth:'0', minHeight:'0', display:'block', padding:'0', margin:'0', border:'0', background:'none', boxShadow:'none', transform:'none', opacity:'1', overflow:'visible', pointerEvents:'none', zIndex:clone.style.zIndex });
      context.append(clone);
      return context;
    }
    return clone;
  }
  function panelExit(element, clone) {
    const scope = begin(element);
    if (!scope) return;
    if (!clone) { scope.dispose(); return; }
    document.body.append(clone);
    scope.cleanup.push(() => clone.remove());
    try { scope.play(clone, [{ opacity: clone.style.opacity }, { opacity: 0 }], 120); scope.finish(); }
    catch { scope.dispose(); }
  }
  function panelEnter(element) {
    const scope = begin(element);
    if (!scope) return;
    if (element.hidden) { scope.dispose(); return; }
    const transform = getComputedStyle(element).transform;
    try { scope.finish(scope.play(element, [{ opacity: .55, transform: `${transform === "none" ? "" : transform} translateY(-4px)` }, { opacity: 1, transform }], 180)); }
    catch { scope.dispose(); }
  }
  function mediaBox(image) {
    if (!(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth || !image.naturalHeight || image.hidden) return null;
    const rect = box(image);
    if (!rect) return null;
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
  }
  function thumbnail(element) {
    const image = element instanceof HTMLImageElement ? element : element?.querySelector("img");
    const rect = box(image);
    if (!visible(rect)) return null;
    const position = getComputedStyle(image).objectPosition.split(" ").map((value) => value.endsWith("%") ? Math.max(0, Math.min(1, parseFloat(value) / 100)) : .5);
    return { ...rect, position, fit: getComputedStyle(image).objectFit };
  }
  // A uniform scale plus a crop reproduces the thumbnail without stretching it.
  function thumbnailPose(frame, thumb) {
    const scale = (thumb.fit === "contain" ? Math.min : Math.max)(thumb.width / frame.width, thumb.height / frame.height);
    const dx = Math.max(0, frame.width - thumb.width / scale), dy = Math.max(0, frame.height - thumb.height / scale);
    const left = dx * thumb.position[0], right = dx - left;
    const top = dy * (thumb.position[1] ?? .5), bottom = dy - top;
    const x = thumb.x + thumb.width / 2 - frame.x - frame.width / 2 - scale * (left - right) / 2;
    const y = thumb.y + thumb.height / 2 - frame.y - frame.height / 2 - scale * (top - bottom) / 2;
    return { transform: `translate(${x}px, ${y}px) scale(${scale})`, clipPath: thumb.fit === "contain" ? "inset(0px 0px 0px 0px)" : `inset(${top}px ${right}px ${bottom}px ${left}px)` };
  }
  function imageGhost(src, frame, parent) {
    const ghost = document.createElement("img");
    ghost.src = src;
    ghost.alt = "";
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    ghost.dataset.motionGhost = "";
    Object.assign(ghost.style, { position: "fixed", left: `${frame.x}px`, top: `${frame.y}px`, width: `${frame.width}px`, height: `${frame.height}px`, maxWidth: "none", margin: "0", objectFit: "contain", pointerEvents: "none", transformOrigin: "center", zIndex: "1601" });
    parent.append(ghost);
    return ghost;
  }
  function viewerEnter(viewer, image, origin) {
    const scope = begin(viewer);
    if (!scope) return;
    const started = performance.now();
    let timeout;
    const launch = () => {
      clearTimeout(timeout);
      if (active.get(viewer) !== scope || performance.now() - started > 300) { scope.dispose(); return; }
      const frame = mediaBox(image);
      if (!frame || !origin) { scope.dispose(); return; }
      const ghost = imageGhost(image.currentSrc || image.src, frame, viewer);
      scope.cleanup.push(() => ghost.remove());
      try {
        scope.play(image, [{ opacity: 0 }, { opacity: 0 }], 350);
        scope.finish(scope.play(ghost, [thumbnailPose(frame, origin), { transform: "none", clipPath: "inset(0px 0px 0px 0px)" }], 350));
      } catch { scope.dispose(); }
    };
    if (image.complete && image.naturalWidth) launch();
    else {
      image.addEventListener("load", launch, { once: true });
      timeout = setTimeout(scope.dispose, 300);
      scope.cleanup.push(() => { clearTimeout(timeout); image.removeEventListener("load", launch); });
    }
  }
  function captureMedia(viewer, image) {
    cancel(viewer);
    const frame = mediaBox(image);
    if (!allowed() || !frame) return null;
    const backdrop = viewer instanceof HTMLDialogElement ? getComputedStyle(viewer, "::backdrop").backgroundColor : getComputedStyle(viewer).backgroundColor;
    return { frame, src: image.currentSrc || image.src, backdrop };
  }
  function viewerExit(viewer, capture, destination) {
    const scope = begin(viewer);
    if (!scope) return;
    if (!capture) { scope.dispose(); return; }
    const shade = document.createElement("div");
    shade.setAttribute("aria-hidden", "true");
    shade.setAttribute("inert", "");
    shade.dataset.motionGhost = "";
    Object.assign(shade.style, { position: "fixed", inset: "0", pointerEvents: "none", background: capture.backdrop, zIndex: "1600" });
    document.body.append(shade);
    const ghost = imageGhost(capture.src, capture.frame, document.body);
    scope.cleanup.push(() => { ghost.remove(); shade.remove(); });
    const thumb = thumbnail(destination);
    try {
      scope.play(shade, [{ opacity: 1 }, { opacity: 0 }], 180);
      scope.finish(scope.play(ghost, thumb ? [{ transform: "none", clipPath: "inset(0px 0px 0px 0px)", opacity: 1 }, { ...thumbnailPose(capture.frame, thumb), opacity: .8 }] : [{ opacity: 1 }, { opacity: 0 }], 180));
    } catch { scope.dispose(); }
  }
  function viewerStep(viewer, image, direction) {
    const scope = begin(viewer);
    if (!scope) return;
    const started = performance.now();
    let timeout;
    const launch = () => {
      clearTimeout(timeout);
      if (active.get(viewer) !== scope || performance.now() - started > 300) { scope.dispose(); return; }
      try { scope.finish(scope.play(image, [{ opacity: .55, transform: `translateX(${direction * 8}px)` }, { opacity: 1, transform: "none" }], 180)); }
      catch { scope.dispose(); }
    };
    if (image.complete && image.naturalWidth) launch();
    else {
      image.addEventListener("load", launch, { once: true });
      timeout = setTimeout(scope.dispose, 300);
      scope.cleanup.push(() => { clearTimeout(timeout); image.removeEventListener("load", launch); });
    }
  }
  document.querySelectorAll(".internal-faq details").forEach((details) => {
    const summary = details.querySelector("summary");
    summary?.addEventListener("click", (event) => {
      if (!allowed() || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
      const answer = summary.nextElementSibling;
      if (!(answer instanceof HTMLElement)) return;
      const section = details.closest("section");
      const following = [...details.parentElement.children].slice([...details.parentElement.children].indexOf(details) + 1);
      if (section) {
        let sibling = section.nextElementSibling;
        while (sibling) { following.push(sibling); sibling = sibling.nextElementSibling; }
        const footer = document.querySelector(".v3-footer");
        if (footer) following.push(footer);
      }
      const positions = following.map((element) => [element, element.getBoundingClientRect().top]);
      const wasOpen = details.open;
      const closing = wasOpen ? snapshot(answer) : null;
      const scope = begin(details.parentElement);
      if (!scope) return;
      event.preventDefault();
      details.open = !wasOpen;
      try {
        let last;
        for (const [element, before] of positions) {
          const distance = before - element.getBoundingClientRect().top;
          if (Math.abs(distance) > .5) last = scope.play(element, [{ transform: `translateY(${distance}px)` }, { transform: "none" }], 260);
        }
        if (closing) {
          document.body.append(closing);
          scope.cleanup.push(() => closing.remove());
          last = scope.play(closing, [{ opacity: 1 }, { opacity: 0 }], 180);
        } else last = scope.play(answer, [{ opacity: .6, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }], 260);
        scope.finish(last);
      } catch { scope.dispose(); }
    });
  });
  document.querySelectorAll("a.rental-category, a.internal-related-card, a.v3-category-card, .v3-brand-card a, a.company-document, a.v3-cert-card").forEach((link) => {
    const heading = link.querySelector("h3, h4, strong");
    if (heading) heading.style.transition = "color var(--duration-fast) var(--ease-standard)";
    const photo = link.querySelector("img");
    if (photo) photo.style.transition = "transform var(--duration-medium) var(--ease-standard)";
    const arrow = link.querySelector(".internal-related-card__arrow");
    if (!arrow) return;
    const update = () => {
      const engaged = link.matches(":hover, :focus-visible");
      const start = getComputedStyle(arrow).translate;
      const scope = begin(arrow);
      if (!scope) return;
      try {
        const animation = scope.play(arrow, [{ translate: start === "none" ? "0px" : start }, { translate: engaged ? "3px" : "0px" }], 180, { fill: engaged ? "forwards" : "none" });
        if (!engaged) scope.finish(animation);
      } catch { scope.dispose(); }
    };
    link.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") update(); });
    link.addEventListener("pointerleave", update);
    link.addEventListener("focus", update);
    link.addEventListener("blur", update);
  });
  const callbar = document.querySelector('[data-mobile-callbar]');
  if (callbar) callbar.style.transition = 'opacity var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)';
  let anchorMarker;
  function markAnchor() {
    if (anchorMarker) cancel(anchorMarker);
    anchorMarker?.remove();
    if (!location.hash || document.body.classList.contains("contacts-page")) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    const heading = target?.matches("h2") ? target : target?.matches("section") ? target.querySelector("h2") : null;
    if (!heading || !heading.closest("main")) return;
    const style = getComputedStyle(heading);
    if (style.position === "static") heading.style.position = "relative";
    anchorMarker = document.createElement("span");
    anchorMarker.setAttribute("aria-hidden", "true");
    anchorMarker.dataset.motionAnchor = "";
    Object.assign(anchorMarker.style, { position: "absolute", width: "64px", height: "2px", bottom: "-10px", left: style.textAlign === "center" ? "calc(50% - 32px)" : "0", background: "var(--action-primary)", pointerEvents: "none", transformOrigin: style.textAlign === "center" ? "center" : "left" });
    heading.append(anchorMarker);
    const scope = begin(anchorMarker);
    if (scope) {
      scope.ignoreScroll = true;
      try { scope.finish(scope.play(anchorMarker, [{ transform: "scaleX(.25)", opacity: .5 }, { transform: "none", opacity: 1 }], 260)); }
      catch { scope.dispose(); }
    }
  }
  window.addEventListener("hashchange", markAnchor);
  markAnchor();
  preference.addEventListener("change", cancelAll);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") cancelAll(); });
  window.addEventListener("resize", cancelAll);
  window.addEventListener("scroll", () => [...active.values()].forEach((scope) => {
    if (!scope.ignoreScroll && (scope.scrollX !== scrollX || scope.scrollY !== scrollY)) scope.dispose();
  }), { passive: true });
  window.REMSDMotion = Object.freeze({ cancel, snapshot, panelEnter, panelExit, thumbnail, viewerEnter, captureMedia, viewerExit, viewerStep });
})();

module.exports = async function verifyHeroHeading(page, definition) {
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const style = getComputedStyle(h1);
    const home = h1.id === "v3-hero-title";
    const internal = Boolean(h1.closest(".internal-hero"));
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const textBoxes = (element) => {
      const boxes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        boxes.push(...[...range.getClientRects()].filter((box) => box.width > 1).map((box) => ({
          left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        })));
      }
      return boxes;
    };
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;color:var(--action-primary)";
    document.body.append(probe);
    const orange = getComputedStyle(probe).color;
    probe.remove();
    const accents = [...h1.querySelectorAll(home ? ".v3-hero-title__accent" : "span")].map((element) => ({
      text: element.textContent.trim(), box: rect(element), textBoxes: textBoxes(element),
      color: getComputedStyle(element).color, display: getComputedStyle(element).display,
    }));
    const prefix = [...h1.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const prefixRange = document.createRange();
    if (prefix) prefixRange.selectNodeContents(prefix);
    return {
      text: h1.textContent.replace(/\s+/g, " ").trim(), box: rect(h1), textBoxes: textBoxes(h1),
      prefix: prefix ? rect(prefixRange) : null, accents, orange, home, internal,
      lines: [...h1.querySelectorAll(".v3-hero-title__line")].map((element) => element.textContent.trim()),
      font: style.fontFamily, fontSize: parseFloat(style.fontSize),
      scrollOverflow: h1.scrollWidth - h1.clientWidth, viewport: innerWidth,
    };
  });
  const fail = (message) => { throw new Error(`H1 ${metrics.viewport}px: ${message}`); };
  if (/Сургут/iu.test(metrics.text)) fail("город остался в заголовке");
  if (metrics.scrollOverflow > 1 || metrics.textBoxes.some((box) => box.left < metrics.box.left - 2 || box.right > metrics.box.right + 2)) {
    fail("текст выходит за ширину заголовка");
  }
  if (metrics.accents.some((accent) => accent.color !== metrics.orange)) fail("акцент потерял оранжевый цвет");
  if (metrics.home) {
    if (metrics.lines.join(" / ") !== "Ремонт / грузовых автомобилей / и спецтехники") fail("неверные смысловые строки главной");
    if (metrics.accents.map((accent) => accent.text).join(" / ") !== "грузовых автомобилей / спецтехники") fail("неверные акценты главной");
    if (!metrics.font.includes("Geologica V3")) fail("изменился шрифт главной");
    if (metrics.viewport >= 414 && metrics.accents.some((accent) => accent.textBoxes.length !== 1)) fail("услуга переносится внутри на достаточной ширине");
  } else if (definition) {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    if (metrics.text !== normalize(definition.hero.h1)) fail("текст не совпадает с данными страницы");
    if (metrics.accents.map((accent) => accent.text).join(" / ") !== (definition.hero.accent || "")) fail("неверный текст акцента");
    if (metrics.internal) {
      const accent = metrics.accents[0];
      if (!metrics.font.includes("Montserrat")) fail("изменился шрифт внутренних страниц");
      if (accent?.display !== "inline-block" || accent.box.width > metrics.box.width + 1) fail("акцент не сохраняет цельную смысловую группу");
      if (definition.path === "remont/kamaz" && metrics.viewport >= 320 && accent.textBoxes[0].top > metrics.prefix.top + 2) fail("короткий заголовок КАМАЗ разбит на строки");
      if (definition.path === "remont-sedelnyh-tyagachey" && metrics.viewport >= 1298) {
        if (accent.textBoxes.length !== 1 || accent.textBoxes[0].top <= metrics.prefix.top + 2) fail("нужны две строки: Ремонт / седельных тягачей");
      }
    }
  }
  return metrics;
};

const SETTLE_MS = 220;
const HOLD_MS = 400;

// Exercise pointer events without a focused trigger: focus-within previously hid
// the gap between the desktop trigger and its fixed-position dropdown.
module.exports = async function verifyMenuHover(page, { label = "Desktop menu hover" } = {}) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width <= 1120) throw new Error(`${label}: нужен desktop viewport`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  const triggers = page.locator("[data-menu-toggle]");
  if (await triggers.count() !== 2) throw new Error(`${label}: ожидаются меню ремонта и аренды`);
  const outside = { x: viewport.width - 8, y: viewport.height - 8 };
  const measurements = [];

  async function state(index) {
    return triggers.nth(index).evaluate((trigger) => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      const style = getComputedStyle(panel);
      return {
        expanded: trigger.getAttribute("aria-expanded"),
        hidden: panel.hidden,
        inert: panel.hasAttribute("inert"),
        visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.99,
        focused: trigger.closest("[data-menu-item]").contains(document.activeElement),
      };
    });
  }

  async function assertState(index, open, step) {
    const actual = await state(index);
    if (actual.expanded !== String(open) || actual.hidden === open || actual.inert === open || actual.visible !== open) {
      throw new Error(`${label}, меню ${index + 1}, ${step}: ${JSON.stringify(actual)}`);
    }
  }

  async function move(point) {
    await page.mouse.move(point.x, point.y);
  }

  async function slowMove(from, to) {
    for (let step = 1; step <= 8; step += 1) {
      await move({ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 });
      await page.waitForTimeout(20);
    }
  }

  async function clearFocus() {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
  }

  async function openByPointer(index) {
    await clearFocus();
    const box = await triggers.nth(index).boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await move(point);
    await page.waitForTimeout(SETTLE_MS);
    await assertState(index, true, "наведение на пункт меню");
    if ((await state(index)).focused) throw new Error(`${label}: проверка hover замаскирована фокусом внутри меню`);
    return point;
  }

  async function waitForClosed(index, step) {
    try {
      await page.waitForFunction((menuIndex) => {
        const trigger = document.querySelectorAll("[data-menu-toggle]")[menuIndex];
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        return trigger.getAttribute("aria-expanded") === "false" && panel.hidden && panel.hasAttribute("inert");
      }, index, { timeout: 500, polling: 20 });
    } catch {
      throw new Error(`${label}, меню ${index + 1}: ${step}, меню не закрылось за 500 мс (${JSON.stringify(await state(index))})`);
    }
    await assertState(index, false, step);
  }

  await move(outside);
  await page.keyboard.press("Escape");
  await clearFocus();
  for (let index = 0; index < 2; index += 1) {
    const trigger = triggers.nth(index);
    const start = await openByPointer(index);
    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    const triggerBox = await trigger.boundingBox();
    const panelBox = await panel.boundingBox();
    // Rental destinations remain static until those routes are published.
    const links = panel.locator("a[href]");
    const destination = await links.count() ? links.first() : panel.locator(".main-nav__column--rent-list .main-nav__static").first();
    const targetBox = await destination.boundingBox();
    if (!targetBox) throw new Error(`${label}, меню ${index + 1}: не найден первый пункт панели`);
    const target = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + Math.min(22, targetBox.height / 2) };
    const gap = panelBox.y - (triggerBox.y + triggerBox.height);
    const gapPoint = {
      x: start.x + (target.x - start.x) * 0.35,
      y: gap > 0 ? triggerBox.y + triggerBox.height + gap / 2 : panelBox.y + 1,
    };
    await slowMove(start, gapPoint);
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, true, `пауза 400 мс в зазоре ${gap.toFixed(1)} px`);
    await slowMove(gapPoint, target);
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, true, "диагональный переход к первому пункту панели");
    if ((await state(index)).focused) throw new Error(`${label}: движение мыши не должно фокусировать пункт меню`);
    const hitTarget = await destination.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), target);
    if (!hitTarget) throw new Error(`${label}, меню ${index + 1}: первый пункт недоступен под указателем`);
    measurements.push({ menu: (await trigger.textContent()).trim(), gap: Number(gap.toFixed(2)) });

    await move(outside);
    await waitForClosed(index, "выход за пределы меню");

    // A brief leave schedules a close; re-entry must cancel that pending close.
    await openByPointer(index);
    await move(outside);
    await page.waitForTimeout(25);
    await openByPointer(index);
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, true, "повторное наведение после краткого выхода");

    // Switching groups must not let the first group's stale timer close the second.
    await move(outside);
    await page.waitForTimeout(25);
    const other = 1 - index;
    await openByPointer(other);
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, false, "переключение в другое меню");
    await assertState(other, true, "чужой отложенный таймер после переключения");
    await move(outside);
    await waitForClosed(other, "выход после переключения");

    // Escape must beat both hover styling and an outstanding close timer.
    await openByPointer(index);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, false, "Escape при указателе на пункте меню");
    await move(outside);
    await openByPointer(index);
    await move(outside);
    await page.waitForTimeout(25);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, false, "Escape при отложенном закрытии");

    await clearFocus();
    await openByPointer(index);
    await move(outside);
    await page.waitForTimeout(25);
    await page.mouse.click(outside.x, outside.y);
    await page.waitForTimeout(HOLD_MS);
    await assertState(index, false, "внешний клик при отложенном закрытии");
  }
  await clearFocus();
  return measurements;
};

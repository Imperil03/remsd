# РемСД

Многостраничный статический сайт ремонтной базы грузовых автомобилей и спецтехники в Сургуте. Исходники написаны на HTML, CSS и JavaScript; `tools/build.js` собирает готовый сайт в `dist/`.

## Что уже сделано

- Доработана главная без смены её Industrial Editorial-направления.
- Выпущены три эталонные страницы: `/remont/`, `/remont-gbc/`, `/remont/maz/`.
- Убраны неработающие `href="#"`; будущие направления выводятся обычным текстом.
- Меню, lightbox и мобильная callbar приведены к единому состоянию `hidden`/`inert` и проверяются с клавиатуры.
- Добавлены breadcrumbs, локальная навигация, уникальные metadata, JSON-LD, favicon и полезная 404.
- GitHub Pages работает как закрытый от индексации preview. Production-режим заранее поддерживает canonical, sitemap и индексируемый `robots.txt`.

## Контентная модель

- `src/data/site-config.json` — режимы сборки, NAP, CTA и подтверждённые владельцем claims.
- `src/data/entities.json` — услуги, узлы, системы, техника, марки, симптомы, методы проверки и доказательства.
- `src/data/relations.json` — проверяемые связи `subject → predicate → object`.
- `src/data/pilot-pages.json` — три пилота семейств `hub`, `service`, `brand`.
- `src/data/seo-pages.json` — прежние страницы семейства `legacy`; они остаются на старом шаблоне до поэтапной миграции.
- `src/templates/semantic-page.html` — общий каркас новых внутренних страниц.

Сборка проверяет ID, отношения, claims, маршруты, внутренние ссылки, обязательные поля секций и уникальность title/description. Произвольный HTML в контентных JSON запрещён.

## Команды

Установка зависимостей:

```powershell
npm ci
```

Preview-сборка с `noindex,nofollow,noarchive` и без sitemap:

```powershell
npm run verify
```

Production-like сборка для проверки SEO и Lighthouse:

```powershell
$env:SITE_MODE = "production"
$env:SITE_URL = "http://127.0.0.1:4175/"
npm run verify
npm run test:browser
npm run test:lighthouse
```

После production-проверки вернуть `dist/` в preview:

```powershell
Remove-Item Env:SITE_MODE -ErrorAction SilentlyContinue
Remove-Item Env:SITE_URL -ErrorAction SilentlyContinue
npm run verify
```

`test:browser` проверяет главную на 1440×900, 1120×900, 414×896 и 390×844, внутреннюю шапку на 1120/1050/1020/390 px, клавиатурное меню, lightbox, callbar, overflow и три пилота. `test:lighthouse` проверяет четыре маршрута с порогами P/A/SEO ≥ 95, LCP < 2,5 с, CLS < 0,1 и без ошибок консоли.

Если меняются стили первого экрана главной, после обычной сборки обновите покрытие critical CSS и снова соберите сайт:

```powershell
npm run build
npm run generate:critical
npm run verify
```

## Структура

- `src/pages/` — вручную собранные страницы.
- `src/partials/` — общие блоки главной, header/footer, меню, callbar и lightbox.
- `assets/css/` — исходная дизайн-система; в `dist/` CSS минифицируется и собирается в page-aware bundles.
- `assets/js/main.js` — навигация, раскрытие марок, callbar и просмотр изображений.
- `assets/img/` — реальные фотографии, логотипы, сертификаты и responsive hero.
- `tools/check-site.js` — структурная и ссылочная проверка результата.
- `tools/verify-browser.js` — Playwright-сценарии.
- `tools/verify-lighthouse.js` — Lighthouse-барьер для indexable-сборки.
- `docs/project-handoff.md` — актуальное состояние и следующие шаги.

## Деплой

Workflow `.github/workflows/deploy-pages.yml` сначала собирает indexable-тестовую версию, запускает Playwright и Lighthouse, затем заново собирает preview с `noindex` и публикует `dist/`.

- Preview: https://imperil03.github.io/remsd/
- Хаб ремонта: https://imperil03.github.io/remsd/remont/
- Ремонт ГБЦ: https://imperil03.github.io/remsd/remont-gbc/
- Ремонт МАЗ: https://imperil03.github.io/remsd/remont/maz/

Перенос на `remsd.ru`, серверные 301, Search Console и аналитика в эту итерацию не входят.

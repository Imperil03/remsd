# РемСД

Статический сайт сервисного центра по ремонту грузовых автомобилей и спецтехники в Сургуте. Исходники написаны на HTML, CSS и JavaScript; `tools/build.js` собирает готовый сайт в `dist/`.

## Опубликованные страницы

- `/` — утверждённая главная.
- `/remont-gruzovyh-avtomobiley/` — эталонная внутренняя страница семейства `hub`.
- `/remont-sedelnyh-tyagachey/` — ремонт седельных тягачей, `hub`.
- `/remont-polupricepov-i-tralov/` — ремонт полуприцепов и тралов, `hub`.
- `/remont-avtobusov/` — ремонт автобусов, `hub`.
- `/remont-spectehniki/` — ремонт спецтехники, `hub`.
- `/kuzovnoy-remont-gruzovoy-tehniki/` — кузовной ремонт грузовой техники, `service`.
- `/404.html` — служебная страница ошибки.

Будущие услуги, марки и разделы показываются только как неинтерактивные элементы, пока для них не создан и не опубликован отдельный `PageDefinition`.

## Контекст для нового агента

После клонирования репозитория читать:

1. `AGENTS.md`;
2. `.agent/SEO_STRUCTURE.md`;
3. `docs/project-handoff.md`;
4. `docs/project-history.md`;
5. перед дизайном — `docs/design-guideline.md`, `docs/design-system.md` и `DESIGN.md`.

Утверждённый внешний референс композиции эталонной внутренней страницы сохранён в `docs/references/internal-hub-block-reference.png`. Он задаёт оформление блоков, но не плотность, брендинг, реквизиты или CTA. Главная остаётся источником визуального языка РемСД.

## Кодовый контракт

- `src/data/site-config.json` — режимы сборки, NAP, график, CTA и подтверждённые владельцем факты.
- `src/data/internal-pages/index.json` — manifest схемы v3 с опубликованными файлами страниц и `referenceByFamily`.
- `src/data/internal-pages/*.json` — отдельные типизированные `PageDefinition` семейств `hub`, `service`, `brand`.
- `src/data/page-templates.json` — общие данные `repair-v1`; `tools/lib/page-templates.js` разворачивает их до полной валидации.
- `tools/lib/internal-pages.js` — реестр секций: validator и renderer каждого типа находятся рядом.
- `src/templates/internal-page.html` — общий каркас внутренних страниц.
- `src/partials/v3-header.html`, `main-nav.html`, `v3-footer.html` — общая шапка, навигация и футер.
- `assets/css/design-system.css` — единственный источник глобальных токенов.
- `assets/css/styles.css` — только variable fonts, reset, `body` и `.container`.
- `assets/css/site-chrome.css` — навигация, skip-link, mobile callbar, единая `.v3-button`, шапка, футер и 404.
- `assets/css/styles-v3.css` — композиция утверждённой главной.
- `assets/css/internal-pages.css` — композиционный слой внутренних страниц.

Сборка выпускает только публичные бандлы:

- `base.css = tokens + shared`;
- `home.css = base + homepage`;
- `internal.css = base + internal pages`.

Поддерживаемые секции: `introProof`, `serviceGrid`, `popularWorks`, `vehicleTypes`, `brandShowcase`, `editorialContent`, `symptoms`, `workStages`, `priceExamples`, `relatedIndex`, `faq`. В `repair-v1` зафиксированы 11 секций, у страниц без `template` набор и порядок остаются свободными.

Лимиты несжатых minified-бандлов: `base.css ≤45 KB`, `home.css ≤85 KB`, `internal.css ≤70 KB`.

Подробный контракт, источник Word, редакционные исправления, цены и изображения: `docs/repair-pages-wave-one.md`.

## Команды

```powershell
npm ci
npm run verify
npm run test:browser
git diff --check
```

`npm run verify` собирает preview и проверяет manifest, сущности/отношения, маршруты, ссылки, JSON-LD, service-fixture, лимиты CSS и контракт владения стилями. `npm run test:browser` проверяет главную и эталонный hub на 11 ширинах от 1992 до 320 px; новые страницы ремонта проверяются на тех же 11 ширинах, со скриншотами и интерактивными сценариями на 1440 и 390 px. Lighthouse охватывает главную и все страницы manifest.

Для production-like проверки:

```powershell
$env:SITE_MODE = "production"
$env:SITE_URL = "http://127.0.0.1:4175/"
npm run verify
npm run test:browser
npm run test:lighthouse
```

После неё вернуть tracked `dist/` в preview:

```powershell
Remove-Item Env:SITE_MODE -ErrorAction SilentlyContinue
Remove-Item Env:SITE_URL -ErrorAction SilentlyContinue
npm run verify
```

Если меняется первый экран главной, обновить critical CSS:

```powershell
npm run build
npm run generate:critical
npm run verify
```

## Деплой

`dist/` отслеживается в git и публикуется GitHub Pages workflow. Preview остаётся закрытым от индексации метатегом `noindex`; sitemap в preview не выпускается.

- Главная: https://imperil03.github.io/remsd/
- Ремонт грузовых автомобилей: https://imperil03.github.io/remsd/remont-gruzovyh-avtomobiley/

Перенос на `remsd.ru`, серверные редиректы, Search Console и аналитика в текущую итерацию не входят.

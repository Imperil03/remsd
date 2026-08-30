# РемСД

Статический сайт сервисного центра по ремонту грузовых автомобилей и спецтехники в Сургуте. Исходники написаны на HTML, CSS и JavaScript; `tools/build.js` собирает готовый сайт в `dist/`.

## Опубликованные страницы

- `/` — утверждённая главная.
- `/remont-gruzovyh-avtomobiley/` — эталонная внутренняя страница семейства `hub`.
- `/404.html` — служебная страница ошибки.

Других внутренних страниц в исходниках и сборке сейчас нет. Будущие услуги, марки и разделы показываются только как неинтерактивные элементы, пока для них не создан и не опубликован отдельный `PageDefinition`.

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
- `src/data/internal-pages.json` — типизированные определения внутренних страниц семейств `hub`, `service`, `brand`.
- `src/templates/internal-page.html` — общий каркас внутренних страниц.
- `src/partials/v3-header.html`, `main-nav.html`, `v3-footer.html` — общая шапка, навигация и футер.
- `assets/css/design-system.css` — единственный источник глобальных токенов.
- `assets/css/styles.css` и `site-chrome.css` — общие foundations и компоненты.
- `assets/css/styles-v3.css` — композиция утверждённой главной.
- `assets/css/internal-pages.css` — композиционный слой внутренних страниц.

Сборка выпускает только публичные бандлы:

- `base.css = tokens + shared`;
- `home.css = base + homepage`;
- `internal.css = base + internal pages`.

Поддерживаемые секции первой версии: `introProof`, `serviceGrid`, `vehicleTypes`, `brandStrip`, `symptoms`, `workStages`, `priceExamples`, `relatedIndex`, `faq`. Их набор и порядок определяет сама страница.

## Команды

```powershell
npm ci
npm run verify
npm run test:browser
git diff --check
```

`npm run verify` собирает preview и проверяет структуру, ссылки, JSON-LD, точное число страниц и контракт дизайн-системы. `npm run test:browser` проверяет главную на четырёх viewport, внутреннюю страницу на desktop, tablet, 414×896, 390×844 и 320 px, а также burger, клавиатурный FAQ, callbar, изображения, цели 44 px, отсутствие overflow и ошибки консоли.

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

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
- Десять дочерних страниц ремонта спецтехники и 23 страницы `/remont/{марка}/`.
- `/o-kompanii/` — база, команда, подход к ремонту и документы РемСД, `company`.
- `/kontakty/` — телефоны отделов, WhatsApp, карта и реквизиты с PDF, `contact`.
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
- `src/data/documents.json` — единые сканы, назначения и сроки пяти комплектов документов; главная и компания используют стабильные ID этого каталога.
- `src/data/internal-pages/index.json` — manifest схемы v3 с опубликованными файлами страниц и `referenceByFamily`.
- `src/data/internal-pages/*.json` — отдельные типизированные `PageDefinition` семейств `hub`, `service`, `brand`, `company`, `contact`.
- `src/data/page-templates.json` — общие данные `repair-v1`; `tools/lib/page-templates.js` разворачивает их до полной валидации.
- `tools/lib/internal-pages.js` — реестр секций: validator и renderer каждого типа находятся рядом.
- `src/templates/internal-page.html` — общий каркас внутренних страниц.
- `src/templates/company-page.html` и `tools/lib/company-sections.js` — отдельная композиция и секции компании.
- `src/partials/v3-header.html`, `main-nav.html`, `v3-footer.html` — общая шапка, навигация и футер.
- `assets/css/design-system.css` — единственный источник глобальных токенов.
- `assets/css/styles.css` — только variable fonts, reset, `body` и `.container`.
- `assets/css/site-chrome.css` — навигация, skip-link, mobile callbar, единая `.v3-button`, шапка, футер и 404.
- `assets/css/styles-v3.css` — композиция утверждённой главной.
- `assets/css/internal-pages.css` — композиционный слой внутренних страниц.
- `assets/css/company-page.css` — изолированный композиционный слой страницы компании.

Сборка выпускает только публичные бандлы:

- `base.css = tokens + shared`;
- `home.css = base + homepage`;
- `internal.css = base + internal pages`;
- `company.css = base + company page`;
- `contact.css = base + contact page`.

Поддерживаемые секции: `introProof`, `serviceGrid`, `popularWorks`, `vehicleTypes`, `brandShowcase`, `editorialContent`, `symptoms`, `workStages`, `priceExamples`, `relatedIndex`, `faq`. В `repair-v1` зафиксированы 11 секций, у страниц без `template` набор и порядок остаются свободными.

Лимиты несжатых minified-бандлов: `base.css ≤45 KB`, `home.css ≤85 KB`, `internal.css ≤70 KB`, `company.css ≤60 KB`, `contact.css ≤55 KB`.

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
- О компании: https://imperil03.github.io/remsd/o-kompanii/
- Контакты: https://imperil03.github.io/remsd/kontakty/

Перенос на `remsd.ru`, серверные редиректы, Search Console и аналитика в текущую итерацию не входят.

## Страницы марок

Иконки вкладки и Apple Touch пересобираются командой `npm run prepare:icons` из `assets/img/logo-remsd.png` с прозрачными полями. Адреса иконок получают хеш содержимого при сборке, чтобы браузер подхватывал обновления.

23 страницы `/remont/{марка}/` собраны из «Бренды.docx» на `brand-v1`: все 11 блоков, модели и технические особенности, расчёт стоимости без неподтверждённых сумм. Главная, меню и внутренние каталоги используют один список опубликованных марок. Контракт и источники: `docs/brand-pages.md`, `docs/brand-source-map.json`. Все марки проверяются в браузере на 1440/390 px, пять характерных страниц — на 11 ширинах.

## О компании

`/o-kompanii/` использует семейство `company`, восемь самостоятельных блоков и разметку `AboutPage`. Тексты и медиа заменяются в `src/data/internal-pages/o-kompanii.json`; контакты приходят из общей конфигурации. Фото и многостраничные документы открываются с клавиатуры в одном просмотрщике, карта загружается при приближении к контактам. Контракт, источники и адресные команды проверки — `docs/company-page.md`.

## Контакты

`/kontakty/` — семейство `contact`, отдельные шаблон, стили и critical CSS. Данные отделов и реквизиты — `src/data/contact-details.json`. PDF создаётся через `npm run prepare:contacts`; сборка сверяет контрольную сумму источника и файла. Страница позволяет скачать карточку и скопировать реквизиты обоих банков. Контракт и источники — `docs/contact-page.md`.

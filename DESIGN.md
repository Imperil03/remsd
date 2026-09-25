---
name: "РемСД"
description: "Industrial Editorial для грузового сервиса: реальные материалы, ясная B2B-структура и редкий янтарный акцент."
colors:
  service-amber: "#f5a21a"
  service-amber-deep: "#d88705"
  workshop-ink: "#102033"
  workshop-muted: "#5d6878"
  night-bay: "#0b1220"
  raised-navy: "#111827"
  service-blue: "#2f58a8"
  cool-steel: "#e8edf5"
  cool-paper: "#f4f7fb"
  clean-white: "#ffffff"
  on-amber: "#101820"
typography:
  display:
    fontFamily: "Geologica V3, Montserrat Variable, Segoe UI, sans-serif"
    fontSize: "clamp(42px, 4.3vw, 72px)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Montserrat Variable, Segoe UI, sans-serif"
    fontSize: "clamp(30px, 3vw, 48px)"
    fontWeight: 850
    lineHeight: 1.08
  body:
    fontFamily: "Source Sans 3 Variable, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Montserrat Variable, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "8px"
  round: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section-compact: "clamp(48px, 6vw, 64px)"
  section-default: "clamp(64px, 8vw, 104px)"
components:
  button-primary:
    backgroundColor: "{colors.service-amber}"
    textColor: "{colors.on-amber}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 30px"
    height: "56px"
  card-light:
    backgroundColor: "{colors.clean-white}"
    textColor: "{colors.workshop-ink}"
    rounded: "{rounded.md}"
    padding: "24px"
---

# Design System: РемСД

## Overview

**Creative North Star: "Industrial Editorial"**

РемСД выглядит как аккуратно собранный технический журнал действующей ремонтной базы: крупные факты, реальные фотографии цеха, ясные маршруты работ и минимум рекламного декора. Система сочетает плотную B2B-информацию с заметным воздухом между смысловыми блоками.

Тёмные поверхности задают контекст сервиса, светлые поверхности обеспечивают рабочую читаемость, а янтарный цвет отмечает действие и технические точки. Интерфейс не имитирует металл, штампы или приборные панели — материальность приходит из фотографий и реальных документов.

**Key Characteristics:**

- реальные фотографии ремонтной базы и техники;
- строгая типографическая иерархия без декоративных шрифтов;
- тёмное обрамление страницы и чередование белых и холодных светло-серых рабочих секций;
- редкий янтарный акцент для CTA, маркеров и состояния фокуса;
- асимметрия только там, где она помогает различать типы контента.

## Colors

Палитра холодная и техническая: глубокий navy, чистые белые поверхности, стальной фон и один тёплый акцент.

### Primary

- **Service Amber:** основной CTA, технические маркеры, активный фокус и редкие смысловые акценты.

### Secondary

- **Service Blue:** вспомогательные иконки, ссылки и спокойные системные сигналы.

### Neutral

- **Night Bay / Raised Navy:** hero, контактный пролог, футер и навигационные overlay-поверхности.
- **Cool Paper / Clean White:** чередующиеся рабочие поверхности.
- **Workshop Ink / Workshop Muted:** основной и вторичный текст.
- **Cool Steel:** мягкие границы и фоновые зоны.

**The Amber Rarity Rule.** Янтарный цвет отмечает действие или важную техническую точку; он не становится фоном каждой карточки и не конкурирует с фотографиями.

## Typography

**Display Font:** Geologica V3 с Montserrat Variable как системным продолжением.  
**Body Font:** Source Sans 3 Variable с нейтральным sans-serif fallback.  
**Label Font:** Montserrat Variable.

**Character:** заголовки собранные и инженерные, основной текст спокойный и легко читаемый. Контраст строится на масштабе и весе, а не на множестве гарнитур.

### Hierarchy

- **Display:** uppercase только для первого экрана; плотный межбуквенный ритм и короткие строки.
- **Headline:** секционные заголовки внутреннего hub используют `28–32 px`; на mobile диапазон сужается до `28–30 px`.
- **Title:** названия плотных карточек используют `17–18 px`, этапы — `18 px`, с весом 700–850.
- **Body:** основной B2B-текст использует не менее `16 px`; в компактных эталонных карточках допускается `14–15 px`, с длиной строки до 70 знаков там, где это возможно.
- **Label:** короткие факты, номера и навигационные подписи; uppercase применяется только к действительно коротким меткам.

**The Two-Voice Rule.** Geologica/Montserrat несут иерархию, Source Sans 3 несёт объяснение; новые декоративные или системные display-шрифты не добавляются.

## Layout

Главная и внутренние страницы используют единую видимую desktop-направляющую `1312 px` с безопасными полями `36 px`. Hero, общие шапка и футер и все контентные секции совпадают по её границам; на `≤720 px` ширина ограничена `520 px` с полями `14 px`. `section-default` разделяет крупные главы, а связка «направления → популярные работы → техника» использует контраст белой и светло-серой поверхностей без сложения двух секционных отступов. На mobile все внутренние секции переходят на компактный ритм.

На wide desktop (`>1120 px`) шесть направлений образуют одну строку вертикальных карточек, шесть типов техники — крупную сетку `3 × 2`, а популярные работы — четырёхколоночный индекс (16 у эталона и первой волны; 13–16 у дочерних hub спецтехники, неполный ряд допустим). Тёмный блок марок повторяет композицию главной: три карточки официального сервиса и матрица из двадцати остальных марок. Этапы остаются пятью колонками только на `≥1280 px`, а ниже переходят в вертикальный маршрут без разрыва слов. При `1021–1120 px` направления переходят в три колонки, при `721–1020 px` карточные сетки переходят в две колонки. На `≤520 px` направления, популярные работы и техника становятся одноколоночными; матрица марок раскрывается кнопкой и использует две колонки. Навигация переходит в burger при 1120 px. Горизонтальный scroll недопустим начиная с 320 px.

**The Air Between Systems Rule.** Разные смысловые системы разделяются поверхностью и секционным отступом. Индекс популярных работ остаётся компактным и статическим до публикации реальных посадочных страниц; блок марок работает как тёмная пауза, а полезный текст после него — как спокойная редакционная двухколоночная глава.

## Elevation & Depth

Система сочетает тональное расслоение и мягкую ambient-тень. Карточки отделяются прежде всего фоном и тонкой границей; более заметная тень используется для меню, CTA и интерактивного поднятия, а не для каждого элемента.

### Shadow Vocabulary

- **Card:** мягкая тень `0 18px 50px rgba(16, 32, 51, 0.12)` для светлых поднятых поверхностей.
- **Card Hover:** `0 24px 64px rgba(16, 32, 51, 0.16)` только для интерактивного состояния.
- **Overlay:** `0 24px 80px rgba(5, 12, 25, 0.22)` для раскрывающейся навигации и модального слоя.

**The Material Truth Rule.** Глубина не имитирует металл или тиснение; физическая фактура приходит из реальной фотографии.

## Shapes

Основная форма — слегка скруглённый технический прямоугольник. Малый радиус применяется к компактным элементам, средний — к карточкам, фото и CTA, круглый — только к точкам, индикаторам и служебным pill-формам. Тонкие границы важнее декоративных контуров.

## Components

### Buttons

- **Shape:** уверенный прямоугольник со средним скруглением и высотой 56 px.
- **Primary:** янтарный фон, тёмный текст, горизонтальный padding 30 px.
- **Hover / Focus:** небольшое поднятие, усиление ambient-тени и явное кольцо focus-visible.

### Cards / Containers

- **Corner Style:** среднее скругление.
- **Background:** белый или холодный светло-серый; тёмный navy зарезервирован для двух inline CTA и не используется как произвольный вариант обычной карточки.
- **Shadow Strategy:** граница и тональная разница по умолчанию, тень только при необходимости.
- **Internal Padding:** обычно 20–28 px.

### Navigation

Шапка использует компактные текстовые пункты и выделенный телефонный CTA. Будущие разделы остаются статическим текстом. На tablet/mobile меню становится полноширинной светлой панелью с синхронными `hidden`, `inert` и `aria-expanded`.

### Vehicle Cards

На wide desktop типы техники (либо ремонтируемые узлы дочерних hub спецтехники) показываются сеткой `3 × 2`: фотография `16:9` сверху, название `17 px` и компактное пояснение `14 px` снизу. На `≤1020 px` сетка становится двухколоночной, а на `≤520 px` — горизонтальными строками без фиксированной высоты. Подписи не накладываются на фотографии.

### Service Cards and Brand Strip

Шесть направлений ремонта на wide desktop образуют одну строку вертикальных карточек: предметная line-иконка `56 px`, заголовок `17 px` и компактное описание центрируются внутри карточки. При сужении сетка переходит в три, две, затем в одну колонку; на mobile карточка снова становится горизонтальной. Логотипы не получают описания или ссылки до публикации брендовых страниц.

### Symptoms and Work Stages

Признаки неисправности (6 у эталона, 8 у остальных ремонтных страниц) собираются в компактную трёхколоночную рамочную сетку рядом с первой тёмной телефонной CTA-панелью шириной до `360 px`; карточки имеют высоту от `84 px`, иконки `32 px`, текст `15 px`. Пять этапов ремонта показываются как пять самостоятельных горизонтальных шагов `01–05` с икон-плитками `56 px` и amber-шевронами между ними; на `≤1279 px` маршрут становится вертикальным. Заголовки переносятся только по пробелам, разрыв слова запрещён.

### Prices and Related Index

Восемь ориентировочных цен делятся на две светлые таблицы со строками от `56 px`; справа располагается вторая тёмная телефонная CTA-панель шириной `340 px`. Связанные направления образуют светлую четырёхколоночную сетку (8 карточек, у родительского hub спецтехники — каталог из 10): каждая карточка содержит предметную иконку `44 px`, название и короткое пояснение. Стрелка остаётся композиционным маркером, но элемент не получает `href`, hover, focus или роль кнопки до публикации маршрута; опциональный `href` превращает всю карточку в ссылку.

### FAQ

FAQ использует редакционную split-композицию: слева заголовок, вводный текст и компактная вторичная ссылка на мастера, справа — один последовательный столбец нативных `details/summary`. Строки разделены тонкими линиями, используют шрифт `17 px`, зону нажатия от `64 px` и видимый `focus-visible`. На `≤1020 px` вводная колонка располагается над списком.

### Mobile Callbar

Нижняя панель появляется только после прокрутки, уважает safe area и исчезает при открытом меню или lightbox. Она дублирует единственное основное действие — звонок.

### Contact Prologue and CTA Placement

На эталонном hub ровно четыре основные CTA-кнопки в `main`: hero, две тёмные inline-панели рядом с признаками и ценами и контактный пролог перед footer. Все четыре ведут на утверждённый `tel:`; формы не используются. В вводной колонке FAQ разрешена одна компактная текстовая ссылка на тот же телефон, но она не конкурирует с основными кнопками. На `>1020 px` inline-панели стоят справа от основного содержимого, на `≤1020 px` — под ним. Mobile callbar дублирует то же телефонное действие.

### Company Page

**The Company Surface Rule.** `/o-kompanii/` extends Industrial Editorial through eight editorial blocks, retaining the shared fonts, tokens, container, radii and chrome. Its primary phone buttons sit in the hero and closing contacts, with the shared mobile callbar as an additional action. Facts remain a flat rail, document previews link to the standalone catalog, and photo viewing preserves keyboard navigation and return focus. This composition belongs to `company`; `repair-v1` and `brand-v1` retain their own layouts and CTA counts.

- **Composition:** dark split hero with copy left and the real engine-work photo right; flat `10+ / 500+ / Любые / 7` facts, with the truck-brand value independent of the page catalog; three service directions; a pale workshop section with three photos and four capabilities below the address; a real team photo beside four specialty rows without an introductory paragraph; compact dark repair terms with two unnumbered items about approval and warranty documents; three official brands above MAZ and conformity document previews; dark contacts beside the Yandex map. Captions stay outside photos.
- **Responsive layout:** team, approach and contacts stack at `≤1020 px`; hero, history and workshop photos stack at `≤720 px`. Facts become `2 × 2` at `≤720 px` without section padding. The two horizontal document previews use two columns above `720 px` and one at `≤720 px`. Official brands form a single list of horizontal rows at `≤720 px`.
- **Documents and viewing:** previews retain the shared card geometry and uncropped scans, linking to the corresponding document on `/sertifikaty/`. The shared dark native dialog handles company photographs with a caption, direct file link, keyboard controls and return focus. The mobile callbar hides while the viewer is open.
- **Shared navigation and contacts:** About follows Rental. Header address/email hide at `1121–1280 px` while the phone remains visible; the burger threshold stays at `1120 px`. The map loads near the contacts; the address and route link remain outside the iframe.

Photos and documents reuse unchanged project assets, with origin URLs in `tools/prepare-media.js`. Page data lives in `src/data/internal-pages/o-kompanii.json`; the company template and stylesheet own page composition, while document cards and the media viewer are shared. See `docs/company-page.md`.

### Document Catalog

**The Document Catalog Rule.** `/sertifikaty/` owns the full catalog of unchanged scans, grouped by service powers, specialist training and service conformity. Home and About show only MAZ and conformity previews; About retains the official-brand strip. Purpose and neutral date information remain visible before opening a document. Dates retain the source's expiry, issue date or stated duration; they receive no automatic extension or validity badge. Stable document IDs connect previews, anchors and viewer groups.

- **Standalone page:** the `documents` family uses `CollectionPage`, a compact navy breadcrumb/H1 hero and the white catalog. It adds no promotional introduction, statistics or extra phone CTA. Hero clearance follows `152 px` above `1120 px`, `132 px` at `721–1120 px` and `118 px` at `≤720 px`; the shared header, footer and callbar remain in place.
- **Full catalog and cards:** MAZ and Advers form service powers; URAL and Weichai form specialist training; conformity contains one certificate with five appendices. The first two groups use two columns above `720 px` and one at `≤720 px`; conformity stays one wide card. Each horizontal card pairs an uncropped scan with title, purpose, date and viewing action. Preview columns remain `128 / 100 / 88 / 68 px` at `>1120 / 721–1120 / 361–720 / ≤360 px`; titles use `18 px`, `17 px` at `≤720 px` and `16 px` at `≤360 px`.
- **Previews and navigation:** Home and About each show two horizontal previews, in two columns above `720 px` and one at `≤720 px`, linking to `/sertifikaty/#document-{id}`. About uses the shared catalog card; Home keeps its `96 / 80 / 64 px` preview columns at `>720 / 361–720 / ≤360 px`. General links, the footer and top-menu “Сертификаты” item open `/sertifikaty/`; that menu item has the normal active state on the page. Known old `/o-kompanii/#document-{id}` links redirect to the matching new anchor. Header breakpoints and existing Home/About section anchors remain unchanged.
- **Viewing:** the dark native dialog keeps all six conformity sheets together, with a caption, counter, direct file link, finite previous/next controls, arrow keys, Tab containment, Escape and return focus. Single-image groups hide step controls; load errors retain the file link. The mobile callbar hides while the viewer is open.

`src/data/documents.json` owns all five bundles and ten scans; stable viewer groups use `documents-{id}`. `document-ui.css`, `media-viewer.html` and `company.js` are shared by About and the standalone page; `certificates.css` and its critical CSS own the standalone delivery. Existing scan provenance stays in `tools/prepare-media.js`; no new raster or global token is introduced. See `docs/documents.md`.

### Contacts Page

**The Contacts Surface Rule.** `/kontakty/` applies Industrial Editorial to three practical tasks: contact the right person, reach the base and obtain company details. The `contact` family retains shared fonts, tokens, container, radii, navigation and mobile callbar. Direct channels, a coordinate map and readable tables carry the page; its compact composition adds no promotional sections or new global tokens.

- **Composition:** the dark opening pairs the prominent master phone, email, WhatsApp and hours with three department rows. The pale directions section places the address, route action and real entrance photo left of the map. The white company-details section places download/copy actions left of the organization table and two bank tables. Phone and account numbers use tabular figures; fine rules separate rows.
- **Responsive layout:** reserve `152 px` above hero content on desktop, `132 px` at `721–1120 px` and `118 px` at `≤720 px` for the shared header. Bank tables stack at `≤1120 px`. At `≤720 px`, the page follows contacts → address → map → photo → company details. At `≤360 px`, department phones and organization-table values sit below their labels. The entrance photo retains its intrinsic proportions and a separate caption.
- **Map and navigation:** the lazy Yandex embed shows a coordinate pin without an organization balloon; the confirmed address and route link remain outside the iframe. Menu and footer contact links open `/kontakty/`; the homepage retains its contact block and a quiet link to the full page.
- **Company details:** the tables, clipboard text and one-page PDF use the same organization and two bank accounts. Copy appears only when the Clipboard API is available and reports success or a fallback to table selection/download. The PDF is a clean typeset card without the supplied scan's stamp or signature; source/PDF fingerprints prevent a stale download. Actions retain visible focus and targets of at least `44 px`.

General contacts come from `site-config.json`; department, messenger, map and organization data come from `src/data/contact-details.json`. The surface stays scoped to the contact template, stylesheet and script. See `docs/contact-page.md` for source and PDF-generation details.

## Do's and Don'ts

### Do:

- **Do** использовать реальные фотографии техники, базы и документов.
- **Do** чередовать поверхности и композиции, чтобы соседние разделы считывались как разные системы.
- **Do** сохранять интерактивные цели не меньше 44 px и явный `focus-visible`.
- **Do** использовать ровно две тёмные inline CTA как редкие контрастные паузы внутри длинного hub.
- **Do** создавать внутреннюю страницу из типизированных модулей, выбирая порядок по интенту.

### Don't:

- **Don't** превращать неопубликованный раздел в ссылку, hover-цель или псевдокнопку.
- **Don't** добавлять формы, декоративные отзывы, фейковые рейтинги или манипулятивную срочность.
- **Don't** добавлять третью inline CTA-панель или менять телефонные CTA на несуществующую форму заявки.
- **Don't** возвращать в эталонный hub асимметричную фотомозаику, тёмный индекс, тёмную стартовую карточку этапов или sticky-поведение FAQ.
- **Don't** использовать градиентный текст, emoji/glyph-иконки, боковые акцентные полосы или тяжёлые hard-offset тени.
- **Don't** копировать одну и ту же карточную сетку из секции в секцию.

## Repair page authoring contract

As of 2026-09-07, sixteen internal repair pages share `template: "repair-v1"`. `src/data/page-templates.json` owns the 11-section order, hero facts, proof metrics, brands, five stages and FAQ contact. The home brand lists use the same source without changing their layout. Per-page JSON owns thematic copy, images, symptoms, prices, related links and FAQ answers. The first wave retains 8 symptoms / 10 FAQ; the ten specialty hubs retain 8 symptoms / 5 FAQ and 13–16 popular works, with content-driven card heights. Their existing vehicleTypes section shows six repaired components, not invented vehicle subtypes. The parent specialty hub has a ten-link catalog. See docs/special-equipment-pages.md. Generated illustrations are documented separately from existing site photographs; never present them as proof of RemSD work. No public schema version, framework or CSS redesign is introduced.

## Brand page authoring contract

As of 2026-09-23, 23 pages in the `brand` family use `brand-v1`, with KAMAZ as the family reference. They retain the shared Industrial Editorial shell, fonts, tokens, photography, navigation and footer. Their 11-section order is `introProof → serviceGrid → popularWorks → modelRange → brandShowcase → editorialContent → symptoms → workStages → costEstimate → relatedIndex → faq`. The existing `repair-v1` composition, counts, grids and price tables keep their own contract.

- **Technical service groups:** 5–7 groups use three columns above `1120 px`, two at `721–1120 px` and one at `≤720 px`. Optional `serviceGrid.items[].details` lists preserve technical operations at a readable `16 px`. At `≤360 px`, the icon sits above the copy so long technical words retain the full card width.
- **Model coverage:** `modelRange` uses separated rows with a group title, optional static model labels and an explanation. It requires no image and creates no model links. Use confirmed vehicle types when a source does not name models. At `≤720 px`, each row stacks vertically; labels wrap within the available width.
- **Proof terms:** brand pages use confirmed service conditions instead of inherited numerical metrics. In `introProof`, the value appears first at `17 px`, followed by its supporting label at `14 px`: for example, “Договор” then “и заказ-наряд”. These terms do not imply official status beyond KAMAZ, MAZ and URAL.
- **Cost calculation:** `costEstimate` presents repair-cost factors and a note, with the second dark phone CTA on the right above `1020 px` and below at smaller widths. It contains no numerical prices. The four main phone buttons remain in the hero, symptoms, cost calculation and closing contact block; FAQ retains its secondary text link.
- **Published brand catalog:** the homepage, navigation and internal catalog share the same brand-to-entity mapping. Only a published PageDefinition creates a link. In the internal catalog, the current brand is a static `aria-current="page"` item with “Вы здесь” and a restrained amber state. Links fill their tiles, provide at least a `44 px` target and retain visible focus. At `≤360 px` on brand pages, the three official cards form one vertical list with horizontal logo-and-text rows.
- **Shared authoring data:** `brand-v1` inherits only the brand catalog, five repair stages and FAQ contact through one-level `sharedFrom: "repair-v1"`. Brand hero facts and proof terms remain separate; individual pages own technical copy, models, symptoms, cost explanation and FAQ answers. See `docs/brand-pages.md` and `docs/brand-source-map.json` for content and source boundaries.

# SEO СТРУКТУРА

Главный принцип после уточнения: главная страница продвигает общий ремонт грузовых автомобилей и спецтехники в Сургуте. Брендовые страницы КАМАЗ, МАЗ и УРАЛ — отдельный коммерческий слой, потому что РемСД работает как официальный сервисный центр по этим маркам. Агрегаты и системы техники — следующий слой. Низкочастотные работы собираем внутри укрупненных страниц, пока нет достаточно контента для отдельных URL.

/
├── /remont-gruzovyh-avtomobiley/      - будущий вход: ремонт грузовых автомобилей
├── /remont-tyagachey/                 - будущий вход: ремонт седельных тягачей
├── /remont-polupricepov-i-tralov/     - ремонт полуприцепов, прицепов и тралов
├── /remont-avtobusov/                 - будущий вход: ремонт автобусов
├── /kuzovnoy-remont-gruzovoy-tehniki/ - будущий вход: кузовной ремонт грузовой техники
├── /remont-spectehniki/               - будущий вход: ремонт спецтехники
│   ├── /remont-spectehniki/buldozerov/
│   ├── /remont-spectehniki/ekskavatorov/
│   ├── /remont-spectehniki/pogruzchikov/
│   ├── /remont-spectehniki/avtokranov/
│   ├── /remont-spectehniki/manipulyatorov/
│   ├── /remont-spectehniki/samosvalov/
│   ├── /remont-spectehniki/truboukladchikov/
│   ├── /remont-spectehniki/greyderov/
│   ├── /remont-spectehniki/dorozhnyh-katkov/
│   └── /remont-spectehniki/traktorov/
├── /remont/
│   ├── /remont/kamaz/                 - главный вход: ремонт КАМАЗ
│   ├── /remont/maz/                   - главный вход: ремонт МАЗ
│   ├── /remont/ural/                  - главный вход: ремонт УРАЛ
│   ├── /remont/man/                   - будущий брендовый вход: ремонт MAN
│   ├── /remont/shacman/               - будущий брендовый вход: ремонт Shacman
│   ├── /remont/scania/                - будущий брендовый вход: ремонт Scania
│   ├── /remont/volvo/                 - будущий брендовый вход: ремонт Volvo
│   ├── /remont/mercedes-benz/         - будущий брендовый вход: ремонт Mercedes-Benz
│   ├── /remont/renault-trucks/        - будущий брендовый вход: ремонт Renault Trucks
│   ├── /remont/howo/                  - будущий брендовый вход: ремонт Howo
│   ├── /remont/sitrak/                - будущий брендовый вход: ремонт Sitrak
│   ├── /remont/daf/                   - будущий брендовый вход: ремонт DAF
│   ├── /remont/iveco/                 - будущий брендовый вход: ремонт Iveco
│   ├── /remont/foton/                 - будущий брендовый вход: ремонт Foton
│   ├── /remont/faw/                   - будущий брендовый вход: ремонт FAW
│   ├── /remont/dongfeng/              - будущий брендовый вход: ремонт Dongfeng
│   ├── /remont/dvigateley/
│   ├── /remont-gbc/                   - укрупненная страница по ГБЦ для КАМАЗ, МАЗ, УРАЛ
│   ├── /remont-kpp/
│   ├── /remont-hodovoy/
│   ├── /remont-tormoznoy-sistemy/
│   ├── /remont-gidravliki/
│   ├── /remont-elektriki/
│   ├── /remont-toplivnoy-sistemy/
│   ├── /remont-sistemy-ohlazhdeniya/
│   ├── /razval-shozhdenie-gruzovikov/
│   ├── /diagnostika-scr-adblue/
│   ├── /remont-polupricepov-i-tralov/
│   └── /diagnostika-i-to/
│
├── /arenda/
│   ├── /arenda/avtokranov/
│   ├── /arenda/avtokran-80-tonn/
│   ├── /arenda/avtokran-40-tonn/
│   ├── /arenda/avtokran-25-tonn/
│   ├── /arenda/frontalnogo-pogruzchika/
│   ├── /arenda/ekskavatorov/
│   ├── /arenda/truboukladchik-90-tonn/
│   ├── /arenda/manipulyator-3-tonny/
│   ├── /arenda/samosvala/
│   └── /perevozka-negabarita/
│
├── /sertifikaty/
├── /remontnaya-baza/
├── /o-kompanii/
├── /otzyvy/
├── /vakansii/
├── /rekvizity/
└── /kontakty/

## Правило главной

Главная страница `/` использует новую структуру бывшей v3-версии:

- hero с основным интентом "ремонт грузовых автомобилей и спецтехники в Сургуте";
- категории техники;
- ремонт грузовиков по маркам;
- блок грузового автосервиса;
- типы спецтехники;
- ремонт по узлам и системам;
- доказательства базы, сертификаты, контакты.

На главной реальные переходы ведут только на существующие страницы и якоря. Будущие категории, бренды и типы спецтехники можно показывать как placeholder-ссылки `href="#"` с `data-future-href`, чтобы было видно будущую структуру, но не создавать 404 до появления посадочных страниц.

КАМАЗ, МАЗ и УРАЛ остаются кликабельными бренд-страницами и proof-сигналом официального сервиса, но не перетягивают основной смысл главной.

## Будущая структура посадочных страниц

Будущие посадочные страницы делятся на три слоя:
- категории техники: `/remont-gruzovyh-avtomobiley/`, `/remont-tyagachey/`, `/remont-polupricepov-i-tralov/`, `/remont-avtobusov/`, `/remont-spectehniki/`, `/kuzovnoy-remont-gruzovoy-tehniki/`;
- бренды грузовиков: `/remont/man/`, `/remont/shacman/`, `/remont/scania/`, `/remont/volvo/`, `/remont/mercedes-benz/`, `/remont/renault-trucks/`, `/remont/howo/`, `/remont/sitrak/`, `/remont/daf/`, `/remont/iveco/`, `/remont/foton/`, `/remont/faw/`, `/remont/dongfeng/`;
- типы спецтехники: `/remont-spectehniki/buldozerov/`, `/remont-spectehniki/ekskavatorov/`, `/remont-spectehniki/pogruzchikov/`, `/remont-spectehniki/avtokranov/`, `/remont-spectehniki/manipulyatorov/`, `/remont-spectehniki/samosvalov/`, `/remont-spectehniki/truboukladchikov/`, `/remont-spectehniki/greyderov/`, `/remont-spectehniki/dorozhnyh-katkov/`, `/remont-spectehniki/traktorov/`.

Новые страницы из этого списка не добавлять в `src/data/seo-pages.json`, пока структура и контент не согласованы отдельно.

## Правило низкой частотки

Запросы вида "ремонт ГБЦ КАМАЗ", "ремонт ГБЦ МАЗ", "ремонт ГБЦ УРАЛ" пока ведем на одну страницу `/remont-gbc/`. На брендовых страницах используем соответствующие анкоры, но не создаем отдельные страницы под каждую связку.

Отдельные страницы вида "услуга × марка" можно добавлять позже, если есть:
- показы и клики по конкретной связке;
- реальные фото или кейсы по этой работе;
- отличия по марке, которые дадут странице собственный полезный контент.

## Не создавать на первом этапе

- /remont-elektriki-kamaz/
- /remont-kpp-maz/
- /remont-gidravliki-ural/
- /remont-gbc-kamaz/
- /remont-gbc-maz/
- /remont-gbc-ural/
- другие страницы вида "услуга × марка".

# Project Skills

Документ фиксирует, какие Codex skills лежат в репозитории РемСД, как подключить их на новом компьютере и как решать конфликты между проектными правилами и общими фреймворками.

## Приоритет Правил

1. Системные и developer-инструкции текущей Codex-сессии.
2. `AGENTS.md`.
3. `.agent/CONTENT_GUIDE.md`, `.agent/SEO_STRUCTURE.md` и `.agent/CLAIMS_LEDGER.md`.
4. Проектные agent-роли в `.agent/agents/`.
5. Проектные skills в `.agent/skills/`.
6. Импортированные внешние skills в `.agent/skills/`.

Design skills носят рекомендательный характер. Они подчиняются стилю РемСД: промышленный B2B, реальные фотографии, сдержанная плотная сетка, ясная навигация, без декоративного "вау" ради "вау".

Marketing/copy skills тоже носят рекомендательный характер. Они подчиняются запретам проекта: без фейковых сроков, цен, гарантий, рейтингов, отзывов, манипулятивной срочности и пустых суперлативов.

## Skills В Репозитории

Проектные skills:

- `frontend-design` - правила frontend-интерфейсов для HTML/CSS/JS.
- `infostyle` - редактура русского текста: ясность, фактичность, меньше воды и штампов.
- `russian-text-humanization` - естественный русский язык и чистка маркеров AI-текста.

Импортированные MIT-licensed skills:

- `design-taste-frontend` - выборочно из `github.com/Leonxlnx/taste-skill`, commit `c807516`, MIT.
- `redesign-existing-projects` - выборочно из `github.com/Leonxlnx/taste-skill`, commit `c807516`, MIT.
- `refactoring-ui` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.
- `ux-heuristics` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.
- `web-typography` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.
- `storybrand-messaging` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.
- `jobs-to-be-done` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.
- `obviously-awesome` - выборочно из `github.com/wondelai/skills`, commit `7c71a84`, MIT.

Копии лицензий лежат в `.agent/skills/_licenses/`.

## Что Не Вендорим

- `github.com/vercel-labs/agent-skills`, commit `b9c8ee0`: не вендорим, потому что в клоне нет `LICENSE`, а большая часть skills относится к React/Vercel, а не к текущему HTML/CSS/JS + GitHub Pages проекту.
- `github.com/claudekit/frontend-design-pro-demo`, commit `756b8d9`: не вендорим, потому что в клоне нет `LICENSE`, а инструкции конфликтуют со сдержанной B2B-стилистикой РемСД: "jaw-dropping", "$50k agency", запрет системных шрифтов, чрезмерный hero/image-фокус.

К этим источникам можно вернуться позже, только если будет явное разрешение на использование или вендоринг.

## Как Подключить На Новом Компьютере

После клонирования репозитория скопируй только разрешенные skills в локальную папку Codex.

```powershell
$repo = "C:\path\to\remsd"
$target = "$env:USERPROFILE\.codex\skills"
$skills = @(
  "frontend-design",
  "infostyle",
  "russian-text-humanization",
  "design-taste-frontend",
  "redesign-existing-projects",
  "refactoring-ui",
  "ux-heuristics",
  "web-typography",
  "storybrand-messaging",
  "jobs-to-be-done",
  "obviously-awesome"
)

New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach ($skill in $skills) {
  Copy-Item -Path "$repo\.agent\skills\$skill" -Destination $target -Recurse -Force
}
```

Не копируй `.agent/skills/ui-ux-pro-max/`: эта папка намеренно игнорируется в проекте.

## Цепочка Проверки Текста

Для публичного русского текста:

1. Проверить `.agent/CONTENT_GUIDE.md`.
2. Проверить `.agent/CLAIMS_LEDGER.md`.
3. Применить `infostyle`.
4. Для SEO/GEO-текстов открыть `.agent/skills/infostyle/references/semantic-seo-authorship.md`.
5. Применить `russian-text-humanization`.
6. Для публичных SEO/коммерческих текстов обязательно подключить reviewer subagent: он проверяет естественность языка, читабельность, полезность, content rules и фактологическую безопасность.

`infostyle` в этом проекте не заставляет придумывать цифры: проверенная конкретика важнее обязательного числа. `russian-text-humanization` используется только для снятия машинного ритма, канцелярита и кальки; без сленга, шуток, намеренных ошибок, разговорной расхлябанности и первого лица в публичном B2B-тексте.

## Текстовые Агенты

Для крупных правок публичных текстов использовать две роли:

- `.agent/agents/remsd-copywriter.md` — пишет текст по `CONTENT_GUIDE -> SEO_STRUCTURE -> CLAIMS_LEDGER -> semantic-seo-authorship -> infostyle -> humanization`.
- `.agent/agents/remsd-reviewer.md` — проверяет текст и выдает `Approved`, `Needs revision` или `Blocked`.

Reviewer обязателен для главной, страниц услуг, брендовых страниц, FAQ, сертификатов, базы, аренды и CTA-блоков. Для мелких UI-лейблов и внутренних документов второй проход необязателен.

Reviewer не добавляет новые факты. Если тексту нужен новый факт, он помечает его как `needs proof` или блокирует публикацию.

Каждый H2-раздел закрывает один кластер интента. Заголовки в формате вопрос-ответ использовать там, где запросу нужен прямой ответ. Таблицы использовать, когда информация естественно ложится в структуру `attribute -> value`, но не превращать весь сайт в таблицы.

## Правила Конфликтов

Если два skills противоречат друг другу, использовать более узкое проектное правило:

- `.agent/CONTENT_GUIDE.md` важнее любого общего persuasion/copywriting framework.
- `.agent/SEO_STRUCTURE.md` важнее общей SEO-рекомендации.
- `infostyle` важнее generic marketing language.
- Дизайн-гайд РемСД важнее generic "premium", "agency" или "viral" visual styles.

Для РемСД полезность важнее объема. Абзац должен оставаться понятным, если поисковик или LLM процитирует его отдельно от страницы.

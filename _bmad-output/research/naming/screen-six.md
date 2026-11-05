# Скрининг 7 склеек на Wish-: Wishomi, Wishumi, Wishine, Wishub, Glowish, Kiwish, WishWay

Дата проверки: **5 ноября 2026**. Проверял агент по заданию [opencode-six-blend.md](opencode-six-blend.md). Метод: BMAD research a decision, критерии — [criteria.md](criteria.md). WishWay добавлен седьмым 5 ноября 2026 тем же методом и по тем же правилам. Код продукта не менялся, ничего не коммитилось, ничего не покупалось и не регистрировалось.

## Этап 0. Подготовка

Прочитаны [README.md](README.md), [criteria.md](criteria.md), [ideas.md](ideas.md), [dreamly.md](dreamly.md) (образец формы), [opencode-naming-15.md](opencode-naming-15.md), [screen-15.md](screen-15.md) и [decision-15-proposal.md](decision-15-proposal.md). Веса взяты из `criteria.md`, максимум — 40 баллов; блокеры — уникальность (вес 4) и товарный знак (вес 3). Пометка в `ideas.md` про старые баллы учтена: чужие баллы не пересчитывались, с ними кандидаты не сравниваются как с равными.

`criteria.md`, `ideas.md` и существующие разборы не менялись. Новые файлы — только те, что перечислены в задании.

### Инструменты и источники, которыми пользовался

| Что | Инструмент | Работал ли |
|---|---|---|
| Домены `.com` | RDAP Verisign: `https://rdap.verisign.com/com/v1/domain/{имя}.com` | да, JSON с регистратором и датами |
| Домены `.app` | RDAP Google Registry: `https://pubapi.registry.google/rdap/domain/{имя}.app` | да |
| Домены `.io` | RDAP Identity Digital: `https://rdap.identitydigital.services/rdap/domain/{имя}.io` | да |
| Домены `.ru` | WHOIS TCI через прокси `https://api.whois.vu/?q={имя}.ru` | да, сырой ответ TCI; прямой `rdap.tcinet.ru` не разрешился в DNS |
| Google Play | `https://play.google.com/store/search?q={имя}&c=apps&hl=ru&gl=RU` и страницы приложений | да |
| App Store | iTunes Search API: `https://itunes.apple.com/search?term={имя}&entity=software&country=us` и `country=ru`; `https://itunes.apple.com/lookup?id={id}` | да |
| RuStore | `https://backapi.rustore.ru/applicationData/apps?query={имя}&page=0&pageSize=10` и `https://www.rustore.ru/catalog/search?query={имя}` | да, API отвечает списком приложений |
| USPTO | поисковый JSON-эндпоинт `https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch`, POST `{"query":{"query_string":{"query":"…","default_field":"wordmark"}}}`; интерфейс `https://tmsearch.uspto.gov/` | да |
| EUIPO / TMview | `https://www.tmdn.org/tmview/`, `https://euipo.europa.eu/eSearch/` | **нет**: TMview — «Request Rejected», eSearch — обрыв соединения |
| WIPO Global Brand Database | `https://branddb.wipo.int/` | **нет**: капча altcha вместо поиска |
| ФИПС | `https://www1.fips.ru/registers-web/` | открылась только оболочка, поиск не отдался |
| Хэндлы X | `https://x.com/{имя}` | да: 200 — профиль есть, 404 — «User Profile Not Found» |
| Хэндлы TikTok | `https://www.tiktok.com/@{имя}` | да: `"statusCode":0` — профиль есть, `10221` — имени нет |
| Хэндлы Telegram | `https://t.me/{имя}` и `https://t.me/s/{имя}` | частично: у занятых видно имя и подписчиков, у свободных — заглушка без явного «не найдено» |
| Хэндлы Instagram | `https://www.instagram.com/{имя}/` | **нет**: и для существующего, и для случайного имени отдаёт одинаковую страницу-заглушку с логином |
| Веб-поиск | Yahoo (`https://search.yahoo.com/search?p=…`), DuckDuckGo, Bing, Brave, Mojeek, Qwant, Ecosia | Yahoo — да; DuckDuckGo после двух запросов отдаёт 202 с антиботом, Bing — нерелевантную выдачу, Brave — JS-оболочку без результатов, Mojeek — капчу, Qwant — JS, Ecosia — 403 |
| GitHub | `https://api.github.com/search/repositories?q={имя}+in:name` | да |
| Словари | Wiktionary (`en.wiktionary.org`, `ru.wiktionary.org`) | да |

Веб-поиск удалось провести по всем семи именам через Yahoo. Там, где выдача нерелевантна или пуста, это указано отдельно; «ничего нет» без поиска не утверждается.

---

## Этап 1. Быстрый скрининг

### 1. Wishomi (Вишоми)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishomi.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishomi.com) — 2026-11-05 [1] |
| wishomi.app | **свободен** | RDAP 404, «wishomi.app not found» | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishomi.app) — 2026-11-05 [1] |
| wishomi.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishomi.io) — 2026-11-05 [1] |
| wishomi.ru | **свободен** | TCI: «No entries found for the selected source(s)» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=wishomi.ru) — 2026-11-05 [1] |
| getwishomi.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getwishomi.com) — 2026-11-05 [1] |
| wishomiapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishomiapp.com) — 2026-11-05 [1] |

Это единственное имя из семи, у которого свободны все четыре основные зоны: `.com`, `.app`, `.io`, `.ru`.

**Google Play** ([выдача по `wishomi`](https://play.google.com/store/search?q=wishomi&c=apps&hl=ru&gl=RU), 2026-11-05): страница отдаёт «Ничего не найдено по запросу: wishomi» — ни точных, ни похожих приложений. По запросу `wishomi wishlist` — только общие вишлисты: Wishy, Wishlist.com, WishOwl, Things To Get Me и т. п.; Wishomi среди них нет [2].

**App Store** ([us](https://itunes.apple.com/search?term=wishomi&entity=software&country=us), [ru](https://itunes.apple.com/search?term=wishomi&entity=software&country=ru), 2026-11-05): точного «Wishomi» нет. В US первым идёт **Wishory** — «wish journal and photo community», GROVE TECHNOLOGY SERVICES LLC ([id6810144370](https://apps.apple.com/us/app/wishory/id6810144370)), дальше Wishora Tap (игра), 11:11 и другие. В российской витрине результатов нет [2].

**RuStore** ([поиск по `wishomi`](https://www.rustore.ru/catalog/search?query=wishomi), 2026-11-05): точного совпадения нет. API вернул 155 приложений по нечёткому совпадению, в первой выдаче — Ohmywishes, Dream Onet, Omi, Wishlumi — список желаний, Wish Whisper. Wishomi среди них нет [11].

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | точных «WISHOMI» нет. По префиксу `wishom*` — 7 знаков: WISHOME (кл. 25, действует; кл. 9 — abandoned), WISHOMEIN (кл. 7), WISHOMEE (кл. 11), WISHOME (кл. 21). Ни одного действующего в классах 9, 35, 42 нет [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

Классы 9, 35, 42 в USPTO чистые; европейские и российские базы не открылись, поэтому блокер по знаку **не закрыт**.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [3] | [instagram.com/wishomi](https://www.instagram.com/wishomi/) |
| TikTok | **свободен**: `"statusCode":10221` [3] | [tiktok.com/@wishomi](https://www.tiktok.com/@wishomi) |
| X | **свободен**: 404 «User Profile Not Found» [3] | [x.com/wishomi](https://x.com/wishomi) |
| Telegram | не проверено: `t.me/wishomi` отдаёт «Contact @wishomi» без владельца и подписчиков [3] | [t.me/wishomi](https://t.me/wishomi) |

**Лингвистика.**
- **ru:** «Вишоми», три слога, ударение не закреплено — возможно «ВишОми» и «ВИшоми». Читается и пишется устойчиво, плохих значений не найдено. *Оценка, по словарю не проверял.*
- **en:** «wish-OH-mee» или «WISH-oh-mee», ударение плавает. На письме однозначно; в словаре слова нет ([Wiktionary: 404](https://en.wiktionary.org/wiki/wishomi), 2026-11-05 [10]). *Оценка.*
- **ja:** `omi` — омонимичное японское чтение: 近江 (Ōmi, старая провинция), 臣 (omi, вассал); `umi` — 海, море ([Wiktionary: umi](https://en.wiktionary.org/wiki/umi), [海](https://en.wiktionary.org/wiki/%E6%B5%B7) [10]). Плохого значения нет, но и «моря» в Wishomi нет — это не Wishumi.
- **es/de/fr/pt:** читается как английское «уишоми/вишоми», плохих значений не найдено. *Оценка.*
- **Флаг:** имя ни на что не опирается, кроме `wish`; хвост `-omi` ничего не значит для покупателя. Зато нет и плохих созвучий.

**Вывод: кандидат в шорт-лист.** В сторах, вебе и на GitHub точного имени нет ([9] — выдача Yahoo по `"Wishomi"` нерелевантна: корейские фразы, YouTube, аниме; [12] — GitHub: 0 репозиториев). Все четыре домена свободны. Минус — смысловой хвост пустой.

---

### 2. Wishumi (Вишуми)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishumi.com | занят | GoDaddy.com, LLC; создан 14.07.2015, оплачен до 14.07.2027; сайт — шаблон с lorem ipsum | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishumi.com) — 2026-11-05 [4] |
| wishumi.app | занят | Spaceship, Inc.; создан 07.10.2026, оплачен до 07.10.2027; по адресу работает **wishumi** — вишлист на немецком | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishumi.app) — 2026-11-05 [4] |
| wishumi.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishumi.io) — 2026-11-05 [4] |
| wishumi.ru | **свободен** | TCI: «No entries found» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=wishumi.ru) — 2026-11-05 [4] |
| getwishumi.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getwishumi.com) — 2026-11-05 [4] |
| wishumiapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishumiapp.com) — 2026-11-05 [4] |

**Google Play** ([выдача по `wishumi`](https://play.google.com/store/search?q=wishumi&c=apps&hl=ru&gl=RU), 2026-11-05): «Ничего не найдено по запросу: wishumi». По `wishumi wishlist` — чужие вишлисты, Wishumi нет [5].

**App Store** ([us](https://itunes.apple.com/search?term=wishumi&entity=software&country=us), [ru](https://itunes.apple.com/search?term=wishumi&entity=software&country=ru), 2026-11-05): точного «Wishumi» нет. В US — Wishory, The Wishing Well, Lil Wish Lanterns; в RU — 0 результатов [5].

**RuStore** ([поиск по `wishumi`](https://www.rustore.ru/catalog/search?query=wishumi), 2026-11-05): точного совпадения нет. API вернул 342 приложения по нечёткому совпадению, в первой выдаче — Mi Mover, Mi Пульт, Mi Store, Ohmywishes. Wishumi нет [11].

**Веб — главная находка.** [wishumi.app](https://wishumi.app/) открыт 2026-11-05: «Dein Ort für all deine Wünsche» — «твоё место для всех твоих желаний». Сайт предлагает «Wunschlisten für Geburtstage, Feiertage und alles dazwischen», публичные списки, шаринг по ссылке и **резервирование желаний**: «Teile sie per Link und lass Wünsche reservieren» ([wishumi.app](https://wishumi.app/) [5]). На странице входа: «Erstelle und teile Wunschlisten für Geburtstage, Feiertage und alles dazwischen»; регистрация новых аккаунтов приостановлена, вход по e-mail-коду ([wishumi.app/login](https://wishumi.app/login) [5]). В Impressum оператор — Moritz Colin, Wiesbaden, Германия; «wishumi ist ein privates Projekt zur gemeinsamen Verwaltung von Wunschlisten» ([wishumi.app/impressum](https://wishumi.app/impressum) [5]).

Это прямой конкурент в нашей нише: вишлист с бронированием подарков, ровно та механика, что у Gift List.

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | точных «WISHUMI» нет; по префиксу `wishum*` — 0 записей [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

Блокер по знаку не закрыт, но кандидат отклоняется раньше — по уникальности.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [6] | [instagram.com/wishumi](https://www.instagram.com/wishumi/) |
| TikTok | занят: `"statusCode":0` [6] | [tiktok.com/@wishumi](https://www.tiktok.com/@wishumi) |
| X | занят: «ailene anit (@wishumi)» [6] | [x.com/wishumi](https://x.com/wishumi) |
| Telegram | не проверено: «Contact @wishumi» без владельца [6] | [t.me/wishumi](https://t.me/wishumi) |

**Лингвистика.**
- **ru:** «Вишуми» — на слух разваливается на «ви шуми»: `шуми` — повелительное наклонение от «шуметь» ([Викисловарь: шуметь](https://ru.wiktionary.org/wiki/%D1%88%D1%83%D0%BC%D0%B5%D1%82%D1%8C) [10]). Получается «вишь, шуми» — не бренд, а реплика. *Оценка чтения.*
- **en:** «wish-OO-mee», читается, ударение на второй слог. В словаре нет ([Wiktionary: 404](https://en.wiktionary.org/wiki/wishumi) [10]). *Оценка.*
- **ja:** `umi` — 海, море ([Wiktionary: umi](https://en.wiktionary.org/wiki/umi) [10]); «Wishumi» можно прочитать как «море желаний». Красиво, но по-русски и по-английски это не считывается.
- **es/de/fr/pt:** читается как английское, плохих значений не найдено. *Оценка.*
- **Флаг:** русская фраза «ви шуми» и прямой немецкий вишлист-конкурент.

**Вывод: отсев.** Точное имя занято вишлистом wishumi.app — блокер уникальности 0.

---

### 3. Wishine (Вишайн)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishine.com | занят, продаётся | TurnCommerce, Inc. DBA NameBright.com; создан 06.03.2016, оплачен до 06.03.2027; переадресует на HugeDomains, цена **$13 095** | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishine.com) — 2026-11-05 [3a]; [HugeDomains](https://www.hugedomains.com/domain_profile.cfm?d=wishine.com) [13] |
| wishine.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishine.app) — 2026-11-05 [3a] |
| wishine.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishine.io) — 2026-11-05 [3a] |
| wishine.ru | **свободен** | TCI: «No entries found» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=wishine.ru) — 2026-11-05 [3a] |
| getwishine.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getwishine.com) — 2026-11-05 [3a] |
| wishineapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishineapp.com) — 2026-11-05 [3a] |

**Google Play** ([выдача по `wishine`](https://play.google.com/store/search?q=wishine&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет; выдача забита созвучиями — Tuneshine, Winshine - Wealth Manager, Winline, Vivino. По `wishine wishlist` — общие вишлисты (Wishlist.com, WishOwl, Wishfinity, WISHUPON); Wishine нет [8a].

**App Store** ([us](https://itunes.apple.com/search?term=wishine&entity=software&country=us), [ru](https://itunes.apple.com/search?term=wishine&entity=software&country=ru), 2026-11-05): точного «Wishine» нет. В US первым идёт **WishinList** — «create fun, decorative lists… add wishes straight to your list», категория Shopping, B2 Ventures ([id6786354315](https://apps.apple.com/us/app/wishinlist/id6786354315), выпущен 25.08.2026 [14]). Это близкое написание и наша ниша. Дальше — игры «Would You Rather» и прочее. В RU — Akinator, FarmVille и другие, не по теме [8a].

**RuStore** ([поиск по `wishine`](https://www.rustore.ru/catalog/search?query=wishine), 2026-11-05): точного совпадения нет; API вернул 96 приложений, первая выдача — Winline, ЦУПИС, Фонбет, PARI. Wishine нет [11].

**Веб.** Yahoo по `"Wishine"` (2026-11-05): **WiShine** — программа в SupportGoWhere (Сингапур); **Wishine Leather Crossbody Bags** на Amazon; **WISHINE STORIES** на wsh.vn [9]. Это торговля и соцуслуги, не вишлист, но имя занято в одежде и аксессуарах.

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | 3 записи: **WISHINE, рег. 8273742, сер. 99481237, кл. 25, действует**, Tianyang Zheng / Putian Xinglian Zhixuan E-commerce (Китай), подан 05.11.2025; **YUEN KEE WISHINE**, сер. 50184478 и 50184401, кл. 43, заявки от 27.10.2026, ещё не переданы эксперту. В классах 9, 35, 42 — ничего [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

Классы 9, 35, 42 в USPTO чистые, но действующий знак в кл. 25 (одежда) и заявки в кл. 43 (рестораны) сужают пространство. Блокер по знаку не закрыт.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [9a] | [instagram.com/wishine](https://www.instagram.com/wishine/) |
| TikTok | занят: `"statusCode":0` [9a] | [tiktok.com/@wishine](https://www.tiktok.com/@wishine) |
| X | занят: «wish home (@wishine)» [9a] | [x.com/wishine](https://x.com/wishine) |
| Telegram | не проверено: «Contact @wishine» без владельца [9a] | [t.me/wishine](https://t.me/wishine) |

**Лингвистика.**
- **ru:** «Вишайн» — читается как английское «shine», но написание «Вишайн» не единственное: возможно «Вишин», «Вишине». Ударение на второй слог. *Оценка.*
- **en:** три чтения: «WISH-shine» (два слова), «WISH-een» и «WISH-in» (как `wishing`). Плюс визуальная и слуховая близость к **vishing** — «voice phishing», форма телефонного мошенничества ([Wiktionary: vishing](https://en.wiktionary.org/wiki/vishing) [10]). Это плохая ассоциация в сфере, где люди доверяют приложению свои желания и адреса.
- **es/de/fr/pt:** читается как английское, плохих значений не найдено. *Оценка.*
- **Флаг:** неустойчивое чтение, «wishing» и «vishing»; плюс действующий знак WISHINE в одежде.

**Вывод: кандидат, но с оговорками.** В нише вишлистов точного имени нет, `.app`, `.io` и `.ru` свободны. Минусы: `.com` за $13 095, близкий WishinList в App Store, омонимия с `wishing`/`vishing`.

---

### 4. Wishub (Вишаб)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishub.com | занят, продаётся | Tucows Domains Inc.; создан 02.07.2015, оплачен до 02.07.2027; неймсерверы `sedoparking.com`, ведёт на страницу продажи Sedo, цена не видна | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishub.com) — 2026-11-05 [4a]; [Sedo](https://sedo.com/search/details/?domain=wishub.com) [13] |
| wishub.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishub.app) — 2026-11-05 [4a] |
| wishub.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishub.io) — 2026-11-05 [4a] |
| wishub.ru | **свободен** | TCI: «No entries found» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=wishub.ru) — 2026-11-05 [4a] |
| getwishub.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getwishub.com) — 2026-11-05 [4a] |
| wishubapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishubapp.com) — 2026-11-05 [4a] |

**Google Play** ([выдача по `wishub`](https://play.google.com/store/search?q=wishub&c=apps&hl=ru&gl=RU), 2026-11-05): точного «Wishub» нет, но вплотную стоят **Wishhub** — [com.room6.wishhub](https://play.google.com/store/apps/details?id=com.room6.wishhub), «Create wishes, share wishlists, and stay connected with friends», 10+ скачиваний, и **WispHub** — [io.int2.wisphub_app](https://play.google.com/store/apps/details?id=io.int2.wisphub_app). По `wishub wishlist` — общие вишлисты [8b].

**App Store** ([us](https://itunes.apple.com/search?term=wishub&entity=software&country=us), [ru](https://itunes.apple.com/search?term=wishub&entity=software&country=ru), 2026-11-05): точного «Wishub» нет; выдача — Wish: Shop and Save, Sortd, Elfster, Likely и другие вишлисты. В RU — 0 результатов [8b].

**RuStore** ([поиск по `wishub`](https://www.rustore.ru/catalog/search?query=wishub), 2026-11-05): точного нет; API вернул 24 приложения, первая выдача — HipHub, GitHub, WinClub Academy. Wishub нет [11].

**Веб — прямой конкурент.** [thewishub.com](https://www.thewishub.com/) открыт 2026-11-05: «Wishub helps you remember and celebrate every important moment… Track birthdays, design custom cards, **create wishlists**, and send heartfelt messages» ([thewishub.com](https://www.thewishub.com/) [5a]). Плюс открытый проект [github.com/romanslonov/wishub.app](https://github.com/romanslonov/wishub.app): «Create wishlists, reserve gifts and present what truly matters. Wishub is a free and easy to use platform for sharing wishlists with your friends» ([GitHub](https://github.com/romanslonov/wishub.app) [12]). Это ровно наша механика — списки желаний с резервированием подарков.

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | точных «WISHUB» нет; по префиксу `wishub*` — 0 записей [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

USPTO чистый, но это не спасает: блокер уникальности уже 0.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [6a] | [instagram.com/wishub](https://www.instagram.com/wishub/) |
| TikTok | занят: `"statusCode":0` [6a] | [tiktok.com/@wishub](https://www.tiktok.com/@wishub) |
| X | занят: «Wishub (@Wishub)» [6a] | [x.com/wishub](https://x.com/wishub) |
| Telegram | не проверено: «Contact @wishub» без владельца [6a] | [t.me/wishub](https://t.me/wishub) |

**Лингвистика.**
- **ru:** «Вишаб» — читается, но хвост «шаб» ничего не значит; возможно членение «ви шаб». Ударение плавает: «ВИшаб» / «виШаб». *Оценка.*
- **en:** «WISH-hub» — прозрачно и хорошо: «центр желаний». Альтернативное чтение «wi-SHUB» менее вероятно, но возможно, потому что `shub` — не английское слово. В словаре имени нет ([Wiktionary: 404](https://en.wiktionary.org/wiki/wishub) [10]).
- **es/de/fr/pt:** читается как английское, плохих значений не найдено. *Оценка.*
- **Флаг:** по-английски смысл сильный, по-русски хвост пустой; плюс `Wishhub` и `WispHub` рядом в Google Play.

**Вывод: отсев.** Точное имя Wishub занято вишлистом thewishub.com и открытым проектом `wishub.app` — блокер уникальности 0.

---

### 5. Glowish (Глоуиш)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| glowish.com | занят | GoDaddy.com, LLC; создан 20.05.2015, оплачен до 20.05.2027; сайт — мёртвый магазин на Shopify: «This store is unavailable» | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/glowish.com) — 2026-11-05 [5b] |
| glowish.app | **свободен** | RDAP 404, «glowish.app not found» | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/glowish.app) — 2026-11-05 [5b] |
| glowish.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/glowish.io) — 2026-11-05 [5b] |
| glowish.ru | **свободен** | TCI: «No entries found» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=glowish.ru) — 2026-11-05 [5b] |
| getglowish.com | занят | NameCheap, Inc.; создан 12.07.2026, оплачен до 12.07.2027 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getglowish.com) — 2026-11-05 [5b] |
| glowishapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/glowishapp.com) — 2026-11-05 [5b] |

**Google Play** ([выдача по `glowish`](https://play.google.com/store/search?q=glowish&c=apps&hl=ru&gl=RU), 2026-11-05): точного «Glowish» нет; выдача — GlowAI, Glowin, Skin Glow, Glow Kitchen и другие beauty/glow-приложения. По `glowish wishlist` — общие вишлисты [8c].

**App Store** ([us](https://itunes.apple.com/search?term=glowish&entity=software&country=us), [ru](https://itunes.apple.com/search?term=glowish&entity=software&country=ru), 2026-11-05): точного «Glowish» нет. В US первым идёт **GoWish** — вишлист, дальше Art Of Glow, Glow Draw и другие. В RU — один результат, «Виш лист – список желаний» [8c]. Отдельно проверено: в US App Store нет ни одного приложения со словом Glowish в названии (131 результат по запросу, 0 совпадений) [8c].

**RuStore** ([поиск по `glowish`](https://www.rustore.ru/catalog/search?query=glowish), 2026-11-05): точного нет; API вернул 25 приложений, первая выдача — головоломки, live wallpapers, Fallout. Glowish нет [11].

**Веб.** Yahoo по `"Glowish"` (2026-11-05): [glowish.quest](https://glowish.quest/) — «GLOWISH SKINCARE»; YouTube-обзор **Glowish by Huda Beauty**; Amazon — «Glowish Huda Beauty»; [glowish.co.nz](https://glowish.co.nz/) — магазин косметики и товаров для творчества в Окленде [9]. То есть имя занято косметическим брендом, а не приложением.

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | **GLOWISH, рег. 6823542, сер. 90209658, кл. 3, действует**, Huda Beauty Limited (Британские Виргинские острова), подан 25.09.2020; **GLOWISH, рег. 6003138, кл. 35 — отменён** (Spigen Korea, Section 8). В классах 9 и 42 — ничего [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

Действующий знак Huda Beauty — в классе 3 (косметика), не в наших классах. Блокер по знаку формально не закрыт из-за EUIPO/WIPO, но USPTO в классах 9/35/42 чистый.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [6b] | [instagram.com/glowish](https://www.instagram.com/glowish/) |
| TikTok | занят: `"statusCode":0` [6b] | [tiktok.com/@glowish](https://www.tiktok.com/@glowish) |
| X | занят: «Glowish Matar (@Glowish)» [6b] | [x.com/glowish](https://x.com/glowish) |
| Telegram | не проверено: страница «View @glowish» без владельца — возможно, канал [6b] | [t.me/glowish](https://t.me/glowish) |

**Лингвистика.**
- **ru:** «Глоуиш» — на слух совпадает с «глоуишь», формой 2-го лица от игрового «глоуить» (светиться), плюс частица «ишь». Смешно, но не неприлично. *Оценка.*
- **en:** «GLOW-ish» — продуктивный суффикс `-ish` со значением «somewhat, like» ([Wiktionary: -ish](https://en.wiktionary.org/wiki/-ish) [10]). Читается как «светящийся-ish», «слегка светящийся». Для бренда это минус: суффикс обесценивает, звучит как «примерно». В словаре слова нет ([Wiktionary: 404](https://en.wiktionary.org/wiki/glowish) [10]).
- **es/de/fr/pt:** читается как английское, плохих значений не найдено. *Оценка.*
- **Флаг:** «glow-ish» — не «список желаний», а «светящийся»; плюс косметический бренд Huda Beauty.

**Вывод: кандидат, но не про вишлист.** Точного приложения нет, `.app`, `.io`, `.ru` свободны. Минус — сильный косметический бренд с тем же именем и смысл «светиться», а не «желать».

---

### 6. Kiwish (Кивиш)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| kiwish.com | занят, продаётся | NameSilo, LLC; создан 03.02.2012, оплачен до 03.02.2028; неймсерверы Afternic, сайт переадресует на страницу продажи GoDaddy (`forsale.godaddy.com`), цена не видна — 403 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/kiwish.com) — 2026-11-05 [5c]; [kiwish.com](https://kiwish.com/) [13] |
| kiwish.app | занят | Soluciones Corporativas IP, SLU (SCIP, dondominio); создан 15.10.2025, оплачен до 15.10.2027; по адресу работает **KiWish** — испанское приложение анонимных признаний | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/kiwish.app) — 2026-11-05 [5c] |
| kiwish.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/kiwish.io) — 2026-11-05 [5c] |
| kiwish.ru | **свободен** | TCI: «No entries found» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=kiwish.ru) — 2026-11-05 [5c] |
| getkiwish.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getkiwish.com) — 2026-11-05 [5c] |
| kiwishapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/kiwishapp.com) — 2026-11-05 [5c] |

**Google Play** ([выдача по `kiwish`](https://play.google.com/store/search?q=kiwish&c=apps&hl=ru&gl=RU), 2026-11-05): точного «Kiwish» нет; выдача — KIWI, Kiwi.com, Kiwi Hop, KIWI - Opening Doors и другие kiwi-приложения. По `kiwish wishlist` — общие вишлисты [8d].

**App Store** ([us](https://itunes.apple.com/search?term=kiwish&entity=software&country=us), [ru](https://itunes.apple.com/search?term=kiwish&entity=software&country=ru), 2026-11-05): **точное совпадение** — **Kiwish**, Mystwish Meet S.L, категория Social Networking, id6756278027, выпущен 22.01.2026, рейтинга и отзывов пока нет ([App Store US](https://apps.apple.com/us/app/kiwish/id6756278027), [RU](https://apps.apple.com/ru/app/kiwish/id6756278027) [8d]). Описание: «App de comunicación privada entre personas que ya se conocen. Sin perfiles públicos… Solo se notifica si existe coincidencia mutua» — приватное общение, не вишлист [14].

**RuStore** ([поиск по `kiwish`](https://www.rustore.ru/catalog/search?query=kiwish), 2026-11-05): точного нет; API вернул 54 приложения, первая выдача — PicWish, Picverse, Pixiv. Kiwish нет [11].

**Веб — прямой конкурент в нашей нише.** [kiwish.me](https://kiwish.me/) открыт 2026-11-05: «Créer et partager une liste de cadeaux avec vos amis» — создание и шаринг списков подарков; «Inspirez-vous des listes de vos amis pour être sûr de lui faire plaisir»; копирайт «©2026 JackWire» ([kiwish.me](https://kiwish.me/) [5c]). Это вишлист-сервис на французском и английском — ровно наша ниша. Отдельно [kiwish.app](https://kiwish.app/) — «KiWish – Confiesa lo que sientes de forma anónima y descubre si es mutuo», испанское приложение анонимных признаний [5c]. Имя Kiwish используется минимум двумя продуктами в двух нишах.

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | **KIWISH, рег. 6759542, сер. 90756815, кл. 11, действует**, Xu chaoyang (Китай), подан 06.06.2021; KIWISHOW, кл. 21 — отменён. В классах 9, 35, 42 — ничего [7] |
| EUIPO / TMview | не проверено: «Request Rejected» [8] |
| WIPO Global Brand Database | не проверено: капча altcha [8] |
| ФИПС | не проверено: поиск не отдался [8] |

USPTO в наших классах чистый, но уникальность уже 0 из-за kiwish.me.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином [6c] | [instagram.com/kiwish](https://www.instagram.com/kiwish/) |
| TikTok | занят: `"statusCode":0` [6c] | [tiktok.com/@kiwish](https://www.tiktok.com/@kiwish) |
| X | занят: «JD Stephenson (@kiwish)» [6c] | [x.com/kiwish](https://x.com/kiwish) |
| Telegram | не проверено: «Contact @kiwish» без владельца [6c] | [t.me/kiwish](https://t.me/kiwish) |

**Лингвистика.**
- **ru:** «Кивиш» — читается легко, ударение на первый слог; ассоциация с «киви» сильная, к подаркам не ведёт. Плохих значений нет. *Оценка.*
- **en:** «KEE-wish» — прозрачно kiwi + wish; также читается как «kiwi-ish» — «похожий на киви, кивиподобный». В словаре имени нет ([Wiktionary: 404](https://en.wiktionary.org/wiki/kiwish) [10]); `kiwi` — птица и фрукт ([Wiktionary: kiwi](https://en.wiktionary.org/wiki/kiwi) [10]).
- **es/de/fr/pt:** читается как английское, плохих значений не найдено. *Оценка.*
- **Флаг:** фруктово-птичья ассоциация и два чужих продукта с этим именем.

**Вывод: отсев.** Точное имя занято вишлистом kiwish.me и приложением Kiwish в App Store — блокер уникальности 0.

---

### 7. WishWay (Вишвей)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishway.com | занят, продаётся | Alibaba Cloud Computing Ltd. d/b/a HiChina; создан 09.12.2001, оплачен до 09.12.2028; парковка «WISHWAY.COM MAY BE AVAILABLE! ON SALE!», ссылка на GoDaddy for-sale; цена не видна — 403 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishway.com) — 2026-11-05 [15]; [wishway.com](https://wishway.com/) [17] |
| wishway.app | занят | CloudFlare, Inc.; создан 07.07.2025, оплачен до 07.07.2027; по адресу работает **wishway** — AI-планировщик впечатлений | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishway.app) — 2026-11-05 [15]; [wishway.app](https://www.wishway.app/) [17] |
| wishway.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishway.io) — 2026-11-05 [15] |
| wishway.ru | занят | TCI: RU-CENTER-RU, создан 25.01.2022, оплачен до 25.01.2027, free-date 25.02.2027, владелец — частное лицо; работает «Путь Желаний» | [WHOIS TCI через whois.vu](https://api.whois.vu/?q=wishway.ru) — 2026-11-05 [15]; [wishway.ru](https://wishway.ru/) [17] |
| getwishway.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/getwishway.com) — 2026-11-05 [15] |
| wishwayapp.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishwayapp.com) — 2026-11-05 [15] |
| wishway-app.com | **свободен** | RDAP 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishway-app.com) — 2026-11-05 [15] |
| wishway.by | вероятно свободен, регистратором напрямую не подтверждено | whois.vu: «object does not exist» | [WHOIS .by через whois.vu](https://api.whois.vu/?q=wishway.by) — 2026-11-05 [15] |

Свободен только `.io`: `.com` продаётся, `.app` занят живым продуктом, `.ru` — игрой. `getwishway.app` и `wishwayapp.app` тоже свободны, но основные зоны закрыты.

**Google Play** ([выдача по `wishway`](https://play.google.com/store/search?q=wishway&c=apps&hl=ru&gl=RU), 2026-11-05): точного «WishWay» нет; 50 результатов, в первой выдаче — [Wishaway TV](https://play.google.com/store/apps/details?id=com.vidiyo.wishaway), WishQue, Wishy, WISHUPON, **[Wishwave: Wishlist & Registry](https://play.google.com/store/apps/details?id=com.wishwave.app)** (1 тыс.+ скачиваний). По `wishway wishlist` — Wishy, WishOwl, Wishwave, WISHUPON; WishWay нет [16].

**App Store** ([us](https://itunes.apple.com/search?term=wishway&entity=software&country=us&limit=200), [ru](https://itunes.apple.com/search?term=wishway&entity=software&country=ru), 2026-11-05): в US — 176 результатов, ни одного с WishWay в названии, имени продавца или bundle id; в RU — 0 результатов. Ближайший по нише и написанию — **Wishwave: Wish List & Registry**, Greetings Island Ltd, 4,92 при 13 оценках ([App Store](https://apps.apple.com/us/app/wishwave-wish-list-registry/id6762080684)) [16].

**RuStore** ([поиск по `wishway`](https://www.rustore.ru/catalog/search?query=wishway), 2026-11-05): API вернул 30 приложений по нечёткому совпадению, первые — игры про Highway. WishWay нет [16].

**Веб — две находки.** [wishway.app](https://www.wishway.app/) открыт 2026-11-05: «wishway — AI-Powered Experience Planning | Turn Dreams into Adventures», «experience wishlist», AI-план подготовки, тарифы $0/$3.75/$9.75 в месяц при годовой оплате, «Join 10,000+ Adventurers», копирайт «© 2025 WishWay» ([wishway.app](https://www.wishway.app/) [17]). Это не вишлист подарков, но exact-name продукт в соседней нише. Вторая находка — **Wishwave**: [wishwave.com](https://www.wishwave.com/) «Free Wishlist Website & Gift Organizer App», «reserve gifts instantly»; [wishwave.app](https://wishwave.app/en); в Google Play — 1 тыс.+ скачиваний; в App Store — 4,92. Это прямой конкурент в нашей нише, и его имя отличается от WishWay окончанием `-way` / `-wave` [16] [17].

**Товарные знаки.**

| База | Результат |
|---|---|
| USPTO | точный **WISHWAY** — 1 запись: рег. 3814642, IR 1002114, кл. 9, Shenzhen Century Wishway Tech Co., Ltd. (Китай), подан 07.04.2009, зарегистрирован 06.07.2010, отменён 07.04.2019. По префиксу `wishwa*` — 11 записей, действующие только в кл. 3, 4, 14, 25, 37; в 9/35/42 действующих нет. **WISHWAVE** — abandoned, кл. 35; **WISHAWAY** — 0; «WISH WAY» — 0, ближайшее — WISH A WAY WILLIE, abandoned, кл. 28 [19] |
| EUIPO / TMview | не проверено: «Request Rejected» [20] |
| WIPO Global Brand Database | не проверено: капча altcha [20] |
| ФИПС | не проверено: поиск не отдался [20] |

В USPTO в классах 9, 35, 42 чисто: точный знак отменён, WISHWAVE брошен. Но блокер не закрыт: EUIPO, WIPO и ФИПС не проверены. Отдельно — WISHWAY-телефоны (HK Wishway Industrial Limited, Шэньчжэнь) и слабая различительная способность сочетания `wish` + `way`.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином; близкие `@wishway_store_`, `@wishway.oficial`, `@mywishway`, `@wishway_product` заняты [18] | [instagram.com/wishway](https://www.instagram.com/wishway/) |
| TikTok | занят: `"statusCode":0` [18] | [tiktok.com/@wishway](https://www.tiktok.com/@wishway) |
| X | занят: «Colin W. (@WishWay)», 0 подписчиков, регистрация сентябрь 2009 [18] | [x.com/wishway](https://x.com/wishway) |
| Telegram | занят: «Путь желаний», 4 подписчика, контакт `@sunny_seabuckthorn` [18] | [t.me/wishway](https://t.me/wishway) |

**Лингвистика.**
- **ru:** «Вишвей», ударение скорее на первый слог, но может плавать; написание не единственное — возможно «Вишвэй». Поисковик исправляет на «вишней», возникает ассоциация с вишней. «Вей» — повелительное наклонение от «веять»/«вить» ([Викисловарь: вей](https://ru.wiktionary.org/wiki/%D0%B2%D0%B5%D0%B9) [20]); плохого значения нет. *Оценка.*
- **en:** /ˈwɪʃweɪ/, «WISH-way»; прозрачно `wish` + `way` = «путь желаний», но почти совпадает с **wish away** — «надеяться, что что-то не случится» ([Wiktionary: wish away](https://en.wiktionary.org/wiki/wish_away) [20]). Для вишлиста это негативная оговорка. Слова `wishway` в Wiktionary нет (404).
- **es:** `way` читается как **güey** [ˈɡwej] — «чувак», но также «дурак, придурок», ругательство ([Wiktionary: güey](https://en.wiktionary.org/wiki/g%C3%BCey) [20]). В Мексике имя может вызвать смех. *Оценка.*
- **de:** читают «виш-вай/виш-вей»; `Weg` = «путь», часть услышит «wish-weg» — «желание прочь». Плохого значения нет. *Оценка.*
- **fr:** «уиш-уэ»; `ouais` — фамильярное «да», плохого значения нет. *Оценка.*
- **pt:** «уиш-уэй»; самостоятельного значения нет. *Оценка.*
- **Флаг:** сильный смысл «путь желаний», но `wish away`, «вишней» и `güey`; плюс почти близнец Wishwave.

**Вывод: не финалист.** 20 из 34. Точное имя занято `wishway.app` в смежной нише, а в нашей — почти близнец Wishwave; брендовая выдача занята, свободен только `.io`. Формально уникальность не 0 (точного вишлиста подарков с именем WishWay нет), но для шорт-листа этого мало. Полный разбор — [wishway.md](wishway.md).

---

### 1.7 Сводная таблица

В каждой ячейке статус и сноска; расшифровка — в конце файла. «нп» — не проверено, причина в сноске.

| # | Имя | .com | .app | .io | .ru | Google Play | App Store | RuStore | USPTO | Instagram | TikTok | X | Telegram | Лингвистика | Быстрый вывод |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wishomi | **свободен** [1] | **свободен** [1] | **свободен** [1] | **свободен** [1] | точного нет, 0 результатов [2] | точного нет [2] | точного нет [11] | чисто в 9/35/42 [7] | нп [3] | **свободен** [3] | **свободен** [3] | нп, похоже свободен [3] | хвост `-omi` пустой [10] | **кандидат в шорт-лист**: все 4 домена свободны, имени нет в сторах и вебе [9] [12] |
| 2 | Wishumi | занят [4] | занят, живой вишлист [4] [5] | **свободен** [4] | **свободен** [4] | точного нет [5] | точного нет [5] | точного нет [11] | чисто в 9/35/42 [7] | нп [6] | занят [6] | занят [6] | нп [6] | «ви шуми» [10] | **отсев**: wishumi.app — вишлист с резервированием [5] |
| 3 | Wishine | занят, $13 095 [3a] [13] | **свободен** [3a] | **свободен** [3a] | **свободен** [3a] | точного нет [8a] | рядом WishinList [8a] [14] | точного нет [11] | WISHINE кл. 25 [7] | нп [9a] | занят [9a] | занят [9a] | нп [9a] | «wishing»/«vishing» [10] | **кандидат с оговорками**: домены есть, но чтение и знак мешают [3a] [8a] |
| 4 | Wishub | занят, Sedo [4a] [13] | **свободен** [4a] | **свободен** [4a] | **свободен** [4a] | рядом Wishhub и WispHub [8b] | точного нет [8b] | точного нет [11] | чисто в 9/35/42 [7] | нп [6a] | занят [6a] | занят [6a] | нп [6a] | «wish hub» сильное, «ви шаб» пустое [10] | **отсев**: thewishub.com и `wishub.app` — вишлисты [5a] [12] |
| 5 | Glowish | занят, мёртвый магазин [5b] | **свободен** [5b] | **свободен** [5b] | **свободен** [5b] | точного нет [8c] | точного нет [8c] | точного нет [11] | GLOWISH кл. 3, Huda Beauty [7] | нп [6b] | занят [6b] | занят [6b] | нп, возможно канал [6b] | «glow-ish» = «светящийся» [10] | **кандидат**: домены есть, но бренд Huda и смысл не про желания [5b] [8c] |
| 6 | Kiwish | занят, продаётся [5c] [13] | занят, живой KiWish [5c] | **свободен** [5c] | **свободен** [5c] | точного нет [8d] | **точное совпадение** [8d] | точного нет [11] | KIWISH кл. 11 [7] | нп [6c] | занят [6c] | занят [6c] | нп [6c] | «kiwi-ish» [10] | **отсев**: kiwish.me — вишлист [5c], плюс приложение Kiwish [8d] |
| 7 | WishWay | занят, продаётся [15] [17] | занят, живой wishway.app [15] [17] | **свободен** [15] | занят, игра «Путь Желаний» [15] [17] | точного нет; рядом Wishwave [16] | точного нет [16] | точного нет [16] | WISHWAY кл. 9 отменён в 2019; в 9/35/42 чисто [19] | нп [18] | занят [18] | занят [18] | занят [18] | «wish away», «вишней», `güey` [20] | **не финалист**: exact-name wishway.app и близнец Wishwave [17] |

### 1.8 Что не проверено

- **EUIPO / TMview, WIPO Global Brand Database, ФИПС — по всем семи именам.** TMview отвечает «Request Rejected» (антибот), eSearch рвёт соединение, WIPO отдаёт капчу altcha, поиск ФИПС не отдался. Классы 9, 35, 42 в этих базах не проверялись. Ни один знак блокер не закрывает [8] [20].
- **Сходные знаки по префиксу `wishin*`.** USPTO отдаёт 272 записи; просмотрены только первые 10, полный перебор не делался. Точный WISHINE и YUEN KEE WISHINE разобраны отдельно.
- **Instagram — по всем семи.** `instagram.com/{имя}/` отдаёт одинаковую страницу-заглушку с логином и для существующего, и для случайного имени. У WishWay близкие хэндлы `@wishway_store_`, `@wishway.oficial`, `@mywishway`, `@wishway_product` существуют, но сам `@wishway` не подтверждён [18].
- **Страница appshunter.io «Glowish app».** Yahoo находит её по запросу `"Glowish" app`, но сайт отдаёт Cloudflare-заглушку; что за приложение — не проверено. В US App Store приложения со словом Glowish нет (131 результат, 0 совпадений).
- **Telegram — по всем семи.** `t.me/{имя}` отдаёт «Contact @имя» без имени владельца и подписчиков; у Glowish — «View @glowish», у WishWay — занятый канал «Путь желаний» на 4 подписчика. По правилу задания свободные страницы без владельца — «не проверено», хотя у Wishomi, Wishub, Wishine, Wishumi, Kiwish страница выглядит как свободный хэндл [18].
- **WishWay: цена `wishway.com`.** Домен выставлен на продажу через GoDaddy, но страница отдаёт 403, цена не видна [17].
- **WishWay: юридическое лицо `wishway.app` и заявленные «10,000+ Adventurers».** На сайте только копирайт «© 2025 WishWay» и почта на домене `wishpath.com`; владелец и цифра не подтверждены [17].
- **WishWay: нативные приложения `wishway.app`.** В Google Play и App Store точного имени нет; на сайте — PWA-манифест и обещание «mobile app access». Есть ли нативные сборки, не проверено.
- **WishWay: китайские реестры знаков.** WISHWAY-телефоны (HK Wishway Industrial Limited, Шэньчжэнь) в USPTO действующего знака не имеют, но CNIPA и другие реестры не проверялись [19].
- **WishWay: владелец `wishway.ru`.** В WHOIS только RU-CENTER и «Private Person»; сайт «Путь Желаний» называет только телефон 8 (800) 800-80-08 [15] [17].
- **Цены `wishub.com` и `kiwish.com`.** Оба выставлены на продажу (Sedo и GoDaddy for-sale), но страницы не отдают цену: Sedo — JS-оболочка, GoDaddy — 403.
- **Владельцы занятых доменов.** В RDAP раскрыт только регистратор, владельцы скрыты приватностью.
- **Кто стоит за kiwish.me.** На сайте только копирайт «©2026 JackWire»; юридическое лицо не раскрыто.
- **Связаны ли kiwish.me, kiwish.app и приложение Kiwish в App Store.** Совпадение имени и темы видно, общий владелец не подтверждён.
- **Полные выдачи сторов.** Google Play — первая страница, iTunes — первые 5–8 результатов на страну (для Glowish — 131 результат с фильтром по имени, для WishWay — 176 результатов с limit=200 и 0 совпадений), RuStore — первая выдача API.
- **Поисковый спрос** (Wordstat, Google Trends) не смотрелся.
- **Чтение по-испански, по-немецки, по-французски и по-португальски** — оценка автора, по словарям этих языков не проверял.
- **Японский.** Проверено только словарное значение `umi`/`omi`; носители не опрашивались.

---

## Этап 2. Оценка

Оценка только по [criteria.md](criteria.md), веса не менял. Сумма — **из 34**, потому что товарный знак ни по одному имени не проверен полностью (EUIPO/WIPO/ФИПС закрыты); USPTO проверен и указан отдельно. Блокер уникальности закрыт только у имён со значением 2.

### 2.1 Правила баллов

Правила, по которым ставил баллы:

- **Уникальность.** 0 — в нише вишлиста/подарков есть продукт с тем же именем (сайт или приложение); 1 — точное имя занято в смежной нише или вплотную стоят близкие написания в нашей; 2 — ни в сторах, ни в вебе точного имени в нашей нише нет.
- **Домен.** 0 — все три зоны `.com/.app/.io` заняты; 1 — `.com` занят, но `.app` или `.io` свободен; 2 — `.com` свободен.
- **Соответствие продукту.** 2 — «wish» плюс то, что читается как список, центр или желание владельца; 1 — «wish» плюс хвост со своим значением, который надо объяснять; 0 — не про желания.
- **Произносимость и значения.** По шкале `criteria.md`: 2 — оба целевых языка, устойчивые написания, нет плохих значений; 1 — спотыкается на одном языке, латиница неоднозначна или есть плохое созвучие; 0 — не читается / плохое значение.
- **ASO и SEO.** 0 — брендовая выдача занята сильным конкурентом с тем же именем; 1 — рядом чужие приложения или бренды, но не точный конкурент в топе; 2 — бренд в выдаче свободен.
- **Масштабируемость.** 2 — латиница, читается за пределами русского, не привязано к одному языку.

### 2.2 Блокеры

Блокеры — уникальность (вес 4) и товарный знак (вес 3). Уникальность 0 отклоняет кандидата независимо от суммы — это случилось у **Wishumi, Wishub и Kiwish**: у каждого есть точный продукт-вишлист. **WishWay** не отклонён: у него уникальность 1 — точное имя занято в смежной нише (`wishway.app`), а в нашей нише почти близнец Wishwave, но точного вишлиста подарков с именем WishWay нет. При этом у WishWay ASO 0, поэтому 20 из 34 и место вне шорт-листа. Товарный знак 0 не поставил никому: в USPTO в классах 9, 35, 42 действующих знаков нет. Но ни один знак и не «пройден»: EUIPO, WIPO и ФИПС не открылись, поэтому балл за знак не ставится, а сумма считается из 34. USPTO проверен и указан в таблице отдельно.

### 2.3 Таблица баллов

| Имя | Уник. (4) | Знак (3) | Домен (3) | Соответ. (3) | Произн. (3) | ASO (2) | Масштаб (2) | Сумма | Статус | Главная причина |
|---|---|---|---|---|---|---|---|---|---|---|
| **Wishomi** | 2 → 8 | USPTO чисто в 9/35/42; EUIPO/WIPO нп | 2 → 6 | 1 → 3 | 2 → 6 | 2 → 4 | 2 → 4 | **31 из 34** | **кандидат в шорт-лист**, блокер по знаку не закрыт | все четыре домена свободны, имени нет в сторах, вебе и на GitHub; хвост `-omi` ничего не значит |
| **Glowish** | 2 → 8 | USPTO: GLOWISH кл. 3 (Huda Beauty), в 9/35/42 чисто; EUIPO/WIPO нп | 1 → 3 | 1 → 3 | 2 → 6 | 1 → 2 | 2 → 4 | **26 из 34** | кандидат, блокер по знаку не закрыт | свободны `.app/.io/.ru`, но имя занято косметическим брендом, а смысл — «светиться», не «желать» |
| **Wishine** | 2 → 8 | USPTO: WISHINE кл. 25, в 9/35/42 чисто; EUIPO/WIPO нп | 1 → 3 | 1 → 3 | 1 → 3 | 1 → 2 | 2 → 4 | **23 из 34** | кандидат, блокер по знаку не закрыт | домены почти свободны, но чтение плавает между «wish-shine», «wishing» и «vishing»; рядом WishinList |
| **WishWay** | 1 → 4 | USPTO: WISHWAY кл. 9 отменён в 2019, в 9/35/42 чисто; EUIPO/WIPO нп | 1 → 3 | 2 → 6 | 1 → 3 | **0 → 0** | 2 → 4 | **20 из 34** | кандидат с оговорками, блокер по знаку не закрыт, вне шорт-листа | exact-name `wishway.app` в смежной нише и почти близнец Wishwave в нашей; брендовая выдача занята, свободен только `.io` |
| **Wishub** | **0 → 0** | USPTO чисто в 9/35/42; EUIPO/WIPO нп | 1 → 3 | 2 → 6 | 2 → 6 | 0 → 0 | 2 → 4 | 19 из 34 | **отклонён** | блокер уникальности 0: thewishub.com и `wishub.app` — вишлисты с резервированием |
| **Kiwish** | **0 → 0** | USPTO: KIWISH кл. 11, в 9/35/42 чисто; EUIPO/WIPO нп | 1 → 3 | 1 → 3 | 2 → 6 | 0 → 0 | 2 → 4 | 16 из 34 | **отклонён** | блокер уникальности 0: kiwish.me — вишлист, плюс приложение Kiwish в App Store |
| **Wishumi** | **0 → 0** | USPTO чисто в 9/35/42; EUIPO/WIPO нп | 1 → 3 | 1 → 3 | 1 → 3 | 0 → 0 | 2 → 4 | 13 из 34 | **отклонён** | блокер уникальности 0: wishumi.app — вишлист с резервированием; по-русски «ви шуми» |

У всех семи в графе «Товарный знак» — «блокер не закрыт»: EUIPO, WIPO и ФИПС не открылись (раздел 1.8). Поэтому ни одно имя не может получить статус «финалист», даже Wishomi с 31 баллом.

### 2.4 Ранжирование всех семи

1. **Wishomi — 31 из 34.** Единственное имя со свободными `.com`, `.app`, `.io`, `.ru`; точных совпадений нет в Google Play, App Store, RuStore, Yahoo и GitHub. Слабые места: пустой хвост `-omi`, плавающее ударение, блокер по знаку не закрыт.
2. **Glowish — 26 из 34.** Домены `.app/.io/.ru` свободны, приложений с именем нет в US App Store. Но имя — косметический бренд Huda Beauty, а `-ish` читается как «примерно светящийся»; к вишлисту не ведёт.
3. **Wishine — 23 из 34.** `.app/.io/.ru` свободны, в нашей нише точного продукта нет. Минусы: `.com` за $13 095, три чтения, ассоциация с `vishing`, рядом WishinList и действующий знак WISHINE в одежде.
4. **WishWay — 20 из 34, вне шорт-листа.** Сильный смысл «путь желаний», но exact-name `wishway.app` в смежной нише, почти близнец **Wishwave** в нашей, ASO 0 и свободен только `.io`. Формально не отклонён блокером, фактически не проходит.
5. **Wishub — 19 из 34, отклонён.** По-английски лучшее соответствие продукту («wish hub»), домены есть, но имя уже занято вишлистом thewishub.com и проектом `wishub.app`.
6. **Kiwish — 16 из 34, отклонён.** В App Store есть точный Kiwish, а kiwish.me — вишлист во французском сегменте. Плюс `kiwish.com` и `kiwish.app` заняты.
7. **Wishumi — 13 из 34, отклонён.** Прямой конкурент wishumi.app, тот же класс продукта; по-русски «ви шуми».

### 2.5 О сравнении с прошлыми прогонами

Сравнивать 31 из 34 с числами `ideas.md` (31, 30, 26, 23) и `screen-15.md` (26, 22, 19) нельзя как с равными: часть баллов посчитана по прежней таблице критериев, без обязательного английского и без требования устойчивой латиницы (пометка в `ideas.md`). Wishomi сравнивается по существу — домены, сторы, смысл, — а не по старой шкале.

---

## Сноски

Все ссылки открыты **2026-11-05**, если в сноске не сказано иное.

[1] Wishomi, домены: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishomi.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishomi.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishomi.io), [WHOIS .ru](https://api.whois.vu/?q=wishomi.ru), [RDAP getwishomi.com](https://rdap.verisign.com/com/v1/domain/getwishomi.com), [RDAP wishomiapp.com](https://rdap.verisign.com/com/v1/domain/wishomiapp.com)
[2] Wishomi, сторы: [Google Play, `wishomi`](https://play.google.com/store/search?q=wishomi&c=apps&hl=ru&gl=RU), [Google Play, `wishomi wishlist`](https://play.google.com/store/search?q=wishomi%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `wishomi`, us](https://itunes.apple.com/search?term=wishomi&entity=software&country=us), [iTunes, `wishomi`, ru](https://itunes.apple.com/search?term=wishomi&entity=software&country=ru)
[3] Wishomi, хэндлы: [tiktok.com/@wishomi](https://www.tiktok.com/@wishomi), [x.com/wishomi](https://x.com/wishomi), [t.me/wishomi](https://t.me/wishomi), [instagram.com/wishomi](https://www.instagram.com/wishomi/)
[4] Wishumi, домены: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishumi.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishumi.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishumi.io), [WHOIS .ru](https://api.whois.vu/?q=wishumi.ru), [RDAP getwishumi.com](https://rdap.verisign.com/com/v1/domain/getwishumi.com), [RDAP wishumiapp.com](https://rdap.verisign.com/com/v1/domain/wishumiapp.com)
[5] Wishumi, сторы и сайт: [Google Play, `wishumi`](https://play.google.com/store/search?q=wishumi&c=apps&hl=ru&gl=RU), [Google Play, `wishumi wishlist`](https://play.google.com/store/search?q=wishumi%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `wishumi`, us](https://itunes.apple.com/search?term=wishumi&entity=software&country=us), [iTunes, `wishumi`, ru](https://itunes.apple.com/search?term=wishumi&entity=software&country=ru), [wishumi.app](https://wishumi.app/), [wishumi.app/login](https://wishumi.app/login), [wishumi.app/impressum](https://wishumi.app/impressum)
[6] Wishumi, хэндлы: [tiktok.com/@wishumi](https://www.tiktok.com/@wishumi), [x.com/wishumi](https://x.com/wishumi), [t.me/wishumi](https://t.me/wishumi), [instagram.com/wishumi](https://www.instagram.com/wishumi/)
[4a] Wishub, домены: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishub.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishub.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishub.io), [WHOIS .ru](https://api.whois.vu/?q=wishub.ru), [RDAP getwishub.com](https://rdap.verisign.com/com/v1/domain/getwishub.com), [RDAP wishubapp.com](https://rdap.verisign.com/com/v1/domain/wishubapp.com)
[5a] Wishub, веб: [thewishub.com](https://www.thewishub.com/), [github.com/romanslonov/wishub.app](https://github.com/romanslonov/wishub.app)
[6a] Wishub, хэндлы: [tiktok.com/@wishub](https://www.tiktok.com/@wishub), [x.com/wishub](https://x.com/wishub), [t.me/wishub](https://t.me/wishub), [instagram.com/wishub](https://www.instagram.com/wishub/)
[3a] Wishine, домены: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishine.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishine.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishine.io), [WHOIS .ru](https://api.whois.vu/?q=wishine.ru), [RDAP getwishine.com](https://rdap.verisign.com/com/v1/domain/getwishine.com), [RDAP wishineapp.com](https://rdap.verisign.com/com/v1/domain/wishineapp.com)
[8a] Wishine, сторы: [Google Play, `wishine`](https://play.google.com/store/search?q=wishine&c=apps&hl=ru&gl=RU), [Google Play, `wishine wishlist`](https://play.google.com/store/search?q=wishine%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `wishine`, us](https://itunes.apple.com/search?term=wishine&entity=software&country=us), [iTunes, `wishine`, ru](https://itunes.apple.com/search?term=wishine&entity=software&country=ru)
[8b] Wishub, сторы: [Google Play, `wishub`](https://play.google.com/store/search?q=wishub&c=apps&hl=ru&gl=RU), [Google Play, `wishub wishlist`](https://play.google.com/store/search?q=wishub%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `wishub`, us](https://itunes.apple.com/search?term=wishub&entity=software&country=us), [iTunes, `wishub`, ru](https://itunes.apple.com/search?term=wishub&entity=software&country=ru), [Google Play, Wishhub](https://play.google.com/store/apps/details?id=com.room6.wishhub), [Google Play, WispHub](https://play.google.com/store/apps/details?id=io.int2.wisphub_app)
[9a] Wishine, хэндлы: [tiktok.com/@wishine](https://www.tiktok.com/@wishine), [x.com/wishine](https://x.com/wishine), [t.me/wishine](https://t.me/wishine), [instagram.com/wishine](https://www.instagram.com/wishine/)
[5b] Glowish, домены и сайт .com: [RDAP .com](https://rdap.verisign.com/com/v1/domain/glowish.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/glowish.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/glowish.io), [WHOIS .ru](https://api.whois.vu/?q=glowish.ru), [RDAP getglowish.com](https://rdap.verisign.com/com/v1/domain/getglowish.com), [RDAP glowishapp.com](https://rdap.verisign.com/com/v1/domain/glowishapp.com), [glowish.com](https://glowish.com/)
[8c] Glowish, сторы: [Google Play, `glowish`](https://play.google.com/store/search?q=glowish&c=apps&hl=ru&gl=RU), [Google Play, `glowish wishlist`](https://play.google.com/store/search?q=glowish%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `glowish`, us](https://itunes.apple.com/search?term=glowish&entity=software&country=us), [iTunes, `glowish`, ru](https://itunes.apple.com/search?term=glowish&entity=software&country=ru)
[6b] Glowish, хэндлы: [tiktok.com/@glowish](https://www.tiktok.com/@glowish), [x.com/glowish](https://x.com/glowish), [t.me/glowish](https://t.me/glowish), [instagram.com/glowish](https://www.instagram.com/glowish/)
[5c] Kiwish, домены и сайты: [RDAP .com](https://rdap.verisign.com/com/v1/domain/kiwish.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/kiwish.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/kiwish.io), [WHOIS .ru](https://api.whois.vu/?q=kiwish.ru), [RDAP getkiwish.com](https://rdap.verisign.com/com/v1/domain/getkiwish.com), [RDAP kiwishapp.com](https://rdap.verisign.com/com/v1/domain/kiwishapp.com), [kiwish.me](https://kiwish.me/), [kiwish.app](https://kiwish.app/), [kiwish.com](https://kiwish.com/)
[8d] Kiwish, сторы: [Google Play, `kiwish`](https://play.google.com/store/search?q=kiwish&c=apps&hl=ru&gl=RU), [Google Play, `kiwish wishlist`](https://play.google.com/store/search?q=kiwish%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `kiwish`, us](https://itunes.apple.com/search?term=kiwish&entity=software&country=us), [iTunes, `kiwish`, ru](https://itunes.apple.com/search?term=kiwish&entity=software&country=ru), [App Store, Kiwish](https://apps.apple.com/us/app/kiwish/id6756278027)
[6c] Kiwish, хэндлы: [tiktok.com/@kiwish](https://www.tiktok.com/@kiwish), [x.com/kiwish](https://x.com/kiwish), [t.me/kiwish](https://t.me/kiwish), [instagram.com/kiwish](https://www.instagram.com/kiwish/)
[7] USPTO Trademark Search, JSON-эндпоинт `https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch`, интерфейс [tmsearch.uspto.gov](https://tmsearch.uspto.gov/). Запросы по полю `wordmark`: точные `wishomi`, `wishumi`, `wishine`, `wishub`, `glowish`, `kiwish`; префиксные `wishom*`, `wishum*`, `wishin*`, `wishub*`, `glowish*`, `kiwish*` — 2026-11-05
[8] Товарные знаки, закрытые базы: [TMview](https://www.tmdn.org/tmview/) — «Request Rejected»; [EUIPO eSearch](https://euipo.europa.eu/eSearch/) — обрыв соединения; [WIPO Global Brand Database](https://branddb.wipo.int/) — капча altcha; [ФИПС](https://www1.fips.ru/registers-web/) — только оболочка, поиск не отдался — 2026-11-05
[9] Веб-поиск Yahoo: [по `"Wishomi"`](https://search.yahoo.com/search?p=%22Wishomi%22), [по `"Wishumi"`](https://search.yahoo.com/search?p=%22Wishumi%22), [по `"Wishine"`](https://search.yahoo.com/search?p=%22Wishine%22), [по `"Wishub"`](https://search.yahoo.com/search?p=%22Wishub%22), [по `"Glowish"`](https://search.yahoo.com/search?p=%22Glowish%22), [по `"Kiwish"`](https://search.yahoo.com/search?p=%22Kiwish%22) — 2026-11-05
[10] Словари: [Wiktionary: umi](https://en.wiktionary.org/wiki/umi), [Wiktionary: 海](https://en.wiktionary.org/wiki/%E6%B5%B7), [Wiktionary: vishing](https://en.wiktionary.org/wiki/vishing), [Wiktionary: -ish](https://en.wiktionary.org/wiki/-ish), [Wiktionary: kiwi](https://en.wiktionary.org/wiki/kiwi), [Викисловарь: шуметь](https://ru.wiktionary.org/wiki/%D1%88%D1%83%D0%BC%D0%B5%D1%82%D1%8C); страницы `wishomi`, `wishumi`, `wishine`, `wishub`, `glowish`, `kiwish` в Wiktionary отсутствуют (404) — 2026-11-05
[11] RuStore: [поиск `wishomi`](https://www.rustore.ru/catalog/search?query=wishomi), [`wishumi`](https://www.rustore.ru/catalog/search?query=wishumi), [`wishine`](https://www.rustore.ru/catalog/search?query=wishine), [`wishub`](https://www.rustore.ru/catalog/search?query=wishub), [`glowish`](https://www.rustore.ru/catalog/search?query=glowish), [`kiwish`](https://www.rustore.ru/catalog/search?query=kiwish); API `https://backapi.rustore.ru/applicationData/apps?query={имя}&page=0&pageSize=10` — 2026-11-05
[12] GitHub: [поиск `wishomi`](https://api.github.com/search/repositories?q=wishomi+in:name) — 0; [`wishub`](https://api.github.com/search/repositories?q=wishub+in:name) — 27, в том числе [romanslonov/wishub.app](https://github.com/romanslonov/wishub.app) — 2026-11-05
[13] Цены доменов: [HugeDomains, wishine.com](https://www.hugedomains.com/domain_profile.cfm?d=wishine.com) — $13 095; [Sedo, wishub.com](https://sedo.com/search/details/?domain=wishub.com) — цена не видна; [kiwish.com](https://kiwish.com/) переадресует на for-sale страницу GoDaddy — 403 — 2026-11-05
[14] Приложения: [WishinList, App Store](https://apps.apple.com/us/app/wishinlist/id6786354315) — B2 Ventures, Shopping, выпущен 25.08.2026; [Kiwish, App Store](https://apps.apple.com/us/app/kiwish/id6756278027) — Mystwish Meet S.L, Social Networking, выпущен 22.01.2026 — 2026-11-05
[15] WishWay, домены: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishway.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishway.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishway.io), [WHOIS .ru](https://api.whois.vu/?q=wishway.ru), [RDAP getwishway.com](https://rdap.verisign.com/com/v1/domain/getwishway.com), [RDAP wishwayapp.com](https://rdap.verisign.com/com/v1/domain/wishwayapp.com), [RDAP wishway-app.com](https://rdap.verisign.com/com/v1/domain/wishway-app.com), [RDAP getwishway.app](https://pubapi.registry.google/rdap/domain/getwishway.app), [RDAP wishwayapp.app](https://pubapi.registry.google/rdap/domain/wishwayapp.app), [WHOIS .by](https://api.whois.vu/?q=wishway.by) — 2026-11-05
[16] WishWay, сторы: [Google Play, `wishway`](https://play.google.com/store/search?q=wishway&c=apps&hl=ru&gl=RU), [Google Play, `wishway wishlist`](https://play.google.com/store/search?q=wishway%20wishlist&c=apps&hl=ru&gl=RU), [iTunes, `wishway`, us](https://itunes.apple.com/search?term=wishway&entity=software&country=us&limit=200), [iTunes, `wishway`, ru](https://itunes.apple.com/search?term=wishway&entity=software&country=ru), [RuStore, `wishway`](https://www.rustore.ru/catalog/search?query=wishway), [Google Play, Wishwave](https://play.google.com/store/apps/details?id=com.wishwave.app), [App Store, Wishwave](https://apps.apple.com/us/app/wishwave-wish-list-registry/id6762080684) — 2026-11-05
[17] WishWay, веб и конкуренты: [wishway.app](https://www.wishway.app/), [about](https://www.wishway.app/about), [pricing](https://www.wishway.app/pricing), [contact](https://www.wishway.app/contact), [wishway.com](https://wishway.com/), [GoDaddy for-sale](https://www.godaddy.com/forsale/wishway.com), [wishway.ru](https://wishway.ru/), [wishwave.com](https://www.wishwave.com/), [wishwave.app](https://wishwave.app/en), [SourceReady: HK Wishway Industrial](https://www.sourceready.com/supplier/detail/hk-wishway-industrial-limited), [FCCID.io: WISHWAY N639](https://fccid.io/TAC/86508000), [VesselFinder: WISH WAY](https://www.vesselfinder.com/vessels/details/9578531) — 2026-11-05
[18] WishWay, хэндлы: [tiktok.com/@wishway](https://www.tiktok.com/@wishway), [x.com/wishway](https://x.com/wishway), [t.me/wishway](https://t.me/wishway), [instagram.com/wishway](https://www.instagram.com/wishway/) — 2026-11-05
[19] WishWay, USPTO: JSON-эндпоинт `https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch`, интерфейс [tmsearch.uspto.gov](https://tmsearch.uspto.gov/); запросы по полю `wordmark`: `wishway`, `wishwa*`, `wishwave`, `wishaway`, `"wish way"` — 2026-11-05
[20] WishWay, закрытые базы и словари: [TMview](https://www.tmdn.org/tmview/) — «Request Rejected»; [EUIPO eSearch](https://euipo.europa.eu/eSearch/) — обрыв соединения; [WIPO Global Brand Database](https://branddb.wipo.int/) — капча altcha; [ФИПС](https://www1.fips.ru/registers-web/) — только оболочка; [Wiktionary: wish away](https://en.wiktionary.org/wiki/wish_away), [Wiktionary: way](https://en.wiktionary.org/wiki/way), [Wiktionary: güey](https://en.wiktionary.org/wiki/g%C3%BCey), [Викисловарь: вей](https://ru.wiktionary.org/wiki/%D0%B2%D0%B5%D0%B9); страница `wishway` в Wiktionary отсутствует (404) — 2026-11-05
[21] WishWay, GitHub: [поиск `wishway in:name`](https://api.github.com/search/repositories?q=wishway+in:name) — 10 репозиториев — 2026-11-05

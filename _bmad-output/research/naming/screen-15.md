# Скрининг 15 названий на Wish-: Wishly, Wishbee, Wishee, Wishie, Wishlane, Wishlink, Wishio, Wishpeer, Wishday, Wishparty, Wishmoon, Wishberry, Wishme, Wishto, Wisho

Дата проверки: **5 ноября 2026**. Проверял агент по заданию [opencode-naming-15.md](opencode-naming-15.md). Метод: BMAD research a decision, критерии — [criteria.md](criteria.md). Код продукта не менялся, ничего не коммитилось.

## Этап 0. Подготовка

Прочитаны: [README.md](README.md), [criteria.md](criteria.md), [ideas.md](ideas.md), [dreamly.md](dreamly.md) (образец формы), [opencode-prompt.md](opencode-prompt.md). Веса взяты из `criteria.md`, максимум — 40 баллов; блокеры — уникальность (вес 4) и товарный знак (вес 3). Пометка в `ideas.md` про старые баллы учтена: чужие баллы не пересчитывались, с ними кандидаты не сравниваются как с равными.

### Инструменты и источники, которыми пользовался

| Что | Инструмент | Работал ли |
|---|---|---|
| Домены `.com` | RDAP Verisign: `https://rdap.verisign.com/com/v1/domain/{имя}.com` | да, JSON с регистратором и датами |
| Домены `.app` | RDAP Google Registry: `https://pubapi.registry.google/rdap/domain/{имя}.app` | да |
| Домены `.io` | RDAP Identity Digital: `https://rdap.identitydigital.services/rdap/domain/{имя}.io` | да |
| Домены `.ru` | WHOIS TCI через прокси `https://api.whois.vu/?q={имя}.ru` | да, отдаёт сырой ответ TCI |
| Домены `.by` | `https://api.whois.vu/?q={имя}.by`; прямой `whois.cctld.by` (порт 43) недоступен из браузерного запроса | только прокси |
| Google Play | `https://play.google.com/store/search?q={имя}&c=apps&hl=ru&gl=RU` + страницы приложений | да |
| App Store | iTunes Search API: `https://itunes.apple.com/search?term={имя}&entity=software&country=us` и `country=ru`; `https://itunes.apple.com/lookup?id={id}` | да |
| RuStore | `https://backapi.rustore.ru/applicationData/apps?query={имя}` и `https://www.rustore.ru/catalog/search?query={имя}` | да |
| Товарные знаки EUIPO / TMview | `https://www.tmdn.org/tmview/`, `https://euipo.europa.eu/eSearch/` | **нет**: TMview отдаёт антибот-заглушку (Akamai), eSearch — JS-оболочку, API eSearch отвечает заглушкой «It works!» |
| Товарные знаки WIPO | `https://branddb.wipo.int/` | **нет**: капча altcha вместо поиска |
| Товарные знаки USPTO | `https://tmsearch.uspto.gov/` | **нет**: интерфейс требует JS; API-пути `api-v1-0-0/tmsearch`, `api/v1/search` вернули 404/405 |
| ФИПС (только этап 3) | `https://www1.fips.ru/registers-web/` | открылась только оболочка, поиск не отдался |
| Хэндлы X | `https://x.com/{имя}` | да: 200 — профиль есть, 404 — «User Profile Not Found» |
| Хэндлы TikTok | `https://www.tiktok.com/@{имя}` | да: `"statusCode":0` — профиль есть, `10221` — имени нет |
| Хэндлы Telegram | `https://t.me/{имя}` | частично: у занятых видно имя и подписчиков, у свободных — заглушка без явного «не найдено» |
| Хэндлы Instagram | `https://www.instagram.com/{имя}/` | **нет**: и для существующего, и для случайного имени отдаёт одинаковую страницу-заглушку с логином |
| Веб-поиск | DuckDuckGo HTML, Bing, Google, Qwant API | **нет** (с 6-го запроса): DuckDuckGo — 202 с антибот-страницей, Bing — нерелевантная выдача, Google и Qwant требуют JS/ключ. Успели пройти только первые запросы по `wishly` и `wishbee` |

Из-за недоступности веб-поиска уникальность оценивается по сторам (Google Play, App Store, RuStore) и по прямым заходам на найденные сайты. Всё, что нельзя было проверить, помечено «не проверено» с причиной.

---

## Этап 1. Быстрый скрининг

### 1. Wishly (Вишли)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishly.com | занят | GoDaddy.com, LLC; создан 13.10.2005, оплачен до 13.10.2030; сайт отдаёт 503 «Application Error» | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishly.com) — 2026-11-05 |
| wishly.app | занят | GoDaddy.com, LLC; создан 04.09.2023, оплачен до 04.09.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishly.app) — 2026-11-05 |
| wishly.io | занят | GoDaddy.com, LLC; создан 26.01.2025, оплачен до 26.01.2028; неймсерверы Afternic — вероятно, выставлен на продажу, цену не смотрел | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishly.io) — 2026-11-05 |

**Google Play** ([выдача по `wishly`](https://play.google.com/store/search?q=wishly&c=apps&hl=ru&gl=RU), 2026-11-05). Точные совпадения есть:
- **Wishly** — [com.ia.wishapp](https://play.google.com/store/apps/details?id=com.ia.wishapp), разработчик Infusion Analysts, «Best wishes & greetings app for WhatsApp, Instagram», 500+ скачиваний. Ниша — поздравления, не вишлист.
- **Wishly - Manifest anything** — [com.shapley.wishly](https://play.google.com/store/apps/details?id=com.shapley.wishly), Shapley, «Manifest your dream life», 5 тыс.+ скачиваний. Ниша — манифестация желаний.
- Похожие в вишлистах: **Wishy: Списки и Secret Santa** ([com.getwishy.app](https://play.google.com/store/apps/details?id=com.getwishy.app)), **Wishlists & Gifts - WishOwl** ([com.wishowl.app](https://play.google.com/store/apps/details?id=com.wishowl.app)).
- В выдаче по `wishly wishlist` самого Wishly нет, но вишлистов с похожими именами много: Things To Get Me, Listful, WishList.com, WishOwl.

**App Store** ([iTunes Search API, us](https://itunes.apple.com/search?term=wishly&entity=software&country=us), 2026-11-05). Пять приложений с точным именем, из них четыре — про вишлист:
- **Wishly - Wishlist** — Sori Games, категория Shopping: «capture and organize everything you want to buy» ([id6753673932](https://apps.apple.com/us/app/wishly-wishlist/id6753673932)).
- **Wishly - Your go-to wishlist** — Ansat Kossakov ([id6822583598](https://apps.apple.com/us/app/wishly-your-go-to-wishlist/id6822583598)).
- **Wishlist & Gift List - Wishly** — Dmitriy Toropkin ([id6474563124](https://apps.apple.com/us/app/wishlist-gift-list-wishly/id6474563124)).
- **Wishly - Social Wishing** — Abdullah Hassoun, «create, share, and manage wishlists for every occasion» ([id6756578687](https://apps.apple.com/us/app/wishly-social-wishing/id6756578687)).
- **Wishly - Manifest anything** — Shapley Tech Limited ([id6800266100](https://apps.apple.com/us/app/wishly-manifest-anything/id6800266100)).
- В российской витрине первым идёт «Вишлист и подарки - Wishly» ([id6474563124, ru](https://apps.apple.com/ru/app/%D0%B2%D0%B8%D1%88%D0%BB%D0%B8%D1%81%D1%82-%D0%B8-%D0%BF%D0%BE%D0%B4%D0%B0%D1%80%D0%BA%D0%B8-wishly/id6474563124)).

**RuStore** ([поиск по `wishly`](https://www.rustore.ru/catalog/search?query=wishly), 2026-11-05): **Wishly — список покупок и избранные товары** (`com.kirkazarin.wishly`).

**Веб.** [wishly.net](https://www.wishly.net/) — «Free Wishlist Maker, Create & Share Online, No Sign-Up» (открыт 2026-11-05): прямой конкурент в нашей нише. [wishlyapps.com](https://wishlyapps.com/) — сайт с заголовком «Wishly».

**Товарные знаки.**

| База | Результат |
|---|---|
| EUIPO / TMview | не проверено: TMview отдаёт антибот-заглушку, eSearch — JS-оболочку, API отвечает заглушкой «It works!» (2026-11-05) |
| WIPO Global Brand Database | не проверено: капча altcha вместо поиска (2026-11-05) |
| USPTO | не проверено: интерфейс требует JS, API-путь вернул 404 (2026-11-05) |

Классы 9, 35, 42 не проверялись, номеров и владельцев нет.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: страница отдаёт заглушку с логином одинаково для существующего и случайного имени | [instagram.com/wishly](https://www.instagram.com/wishly/) |
| TikTok | занят: профиль с ником «Soy» | [tiktok.com/@wishly](https://www.tiktok.com/@wishly) |
| X | занят: «wishly bzezi (@wishly)» | [x.com/wishly](https://x.com/wishly) |
| Telegram | не проверено (заглушка без владельца, похоже свободен): `t.me/wishly` отдаёт «Telegram: Contact @wishly» без имени и подписчиков | [t.me/wishly](https://t.me/wishly) |

**Лингвистика.**
- **ru:** «Вишли», ударение на первый слог. Читается и пишется устойчиво. Плохих значений нет. *Оценка, по словарю не проверял.*
- **en:** /ˈwɪʃli/ «WISH-lee», прозрачно: wish + -ly. Произносится с первого раза. *Оценка.*
- **es:** «Uisli/Вишли» — читается как английское, без плохих значений. *Оценка.*
- **de:** «Wischli» — ближайшее немецкое чтение; без плохих значений. *Оценка.*
- **fr:** «Ouisli» — без плохих значений; созвучно с anglais, не с французским. *Оценка.*
- **pt:** «Uisli» — без плохих значений. *Оценка.*
- **Флаг:** в сторах и в вебе имя уже занято вишлистами (см. выше) — это главная проблема, а не язык.

**Вывод: отсев** — в нише вишлистов есть минимум четыре продукта с точным именем (App Store), отдельный wishly.net и приложение в RuStore. Блокер уникальности = 0.

---

### 2. Wishbee (Вишби)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishbee.com | занят | Ascio Technologies (Дания); создан 31.01.2005, оплачен до 31.01.2027, статус active; неймсерверы `registrant-verification.com`, сайт — страница «Verification of Contact Information» | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishbee.com) — 2026-11-05 |
| wishbee.app | занят | Namecheap Inc.; создан 09.07.2026, оплачен до 09.07.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishbee.app) — 2026-11-05 |
| wishbee.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishbee.io) — 2026-11-05 |

**Google Play** ([выдача по `wishbee`](https://play.google.com/store/search?q=wishbee&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения в первой выдаче нет — пришли wlw: B2B Wholesale Marketplace, Buybee.app, WishOwl, WishQue, Wildberries. Приложение «Wishbee» в этой выдаче не появилось.

**App Store** ([us](https://itunes.apple.com/search?term=wishbee&entity=software&country=us), 2026-11-05): **WishBee** — Sofmen Inc, категория Utilities, «Never miss a special moment again… birthdays and anniversaries» ([id6475587345](https://apps.apple.com/us/app/wishbee/id6475587345)). В российской витрине — то же приложение ([ru](https://apps.apple.com/ru/app/wishbee/id6475587345)).

**RuStore** ([поиск по `wishbee`](https://www.rustore.ru/catalog/search?query=wishbee), 2026-11-05): приложений с таким именем в первой выдаче нет.

**Веб.** [wishbee.ai](https://wishbee.ai/) — «Wishbee.ai — Gift Together. Give Better. The modern wishlist that pools money for the perfect group gift» (открыт 2026-11-05). Это **прямой конкурент**: современный вишлист со сбором денег на групповой подарок.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено по тем же причинам, что у Wishly (антибот, капча, JS), 2026-11-05. Классы 9, 35, 42 не проверялись.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishbee](https://www.instagram.com/wishbee/) |
| TikTok | занят: профиль «UmutCan Arık» | [tiktok.com/@wishbee](https://www.tiktok.com/@wishbee) |
| X | занят: «かぴばらと共に🌽Together with a capybara (@wishbee)» | [x.com/wishbee](https://x.com/wishbee) |
| Telegram | занят: «𝓵𝓲𝓽𝓽𝓵𝓮: wishbeè.», 15 подписчиков | [t.me/wishbee](https://t.me/wishbee) |

**Лингвистика.**
- **ru:** «Вишби», ударение на первый слог. Устойчиво, плохих значений нет. *Оценка.*
- **en:** /ˈwɪʃbiː/ «WISH-bee», прозрачно wish + bee. Произносится с первого раза, но «bee» даёт милый, а не подарочный образ. *Оценка.*
- **es/de/fr/pt:** читается как английское «уишби/вишби», плохих значений не найдено. *Оценка.*
- **Флаг:** «bee» уже занято в подарочной теме — см. wishbee.ai.

**Вывод: отсев** — точное имя занято в нашей нише (wishbee.ai — вишлист) и в сторах (WishBee). Блокер уникальности = 0.

---

### 3. Wishee (Виши)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishee.com | занят | GoDaddy.com, LLC; создан 27.06.2011, оплачен до 27.06.2027; сайт не отвечает | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishee.com) — 2026-11-05 |
| wishee.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishee.app) — 2026-11-05 |
| wishee.io | занят | GoDaddy.com, LLC; создан 30.01.2026, оплачен до 30.01.2027 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishee.io) — 2026-11-05 |

**Google Play** ([`wishee`](https://play.google.com/store/search?q=wishee&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет — WishQue, Wishwave, WishOwl, Etsy, Weverse, Wishy.

**App Store** ([us](https://itunes.apple.com/search?term=wishee&entity=software&country=us), 2026-11-05): точного «Wishee» нет, но есть **wishe.app** — Umor LLC, Lifestyle, «wishe is changing gifting culture» ([id6778999964](https://apps.apple.com/us/app/wishe-app/id6778999964)) и **Wi-She** — Keitaro Miyano, приложение для обмена Wi-Fi ([id6757724445](https://apps.apple.com/us/app/wi-she/id6757724445)).

**RuStore** ([`wishee`](https://www.rustore.ru/catalog/search?query=wishee), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishee](https://www.instagram.com/wishee/) |
| TikTok | занят: профиль «rusisgzmbmp» | [tiktok.com/@wishee](https://www.tiktok.com/@wishee) |
| X | занят: «Mano (@wishee)» | [x.com/wishee](https://x.com/wishee) |
| Telegram | занят: «Big Chopper Chang @wishee» | [t.me/wishee](https://t.me/wishee) |

**Лингвистика.**
- **ru:** «Виши» — омофон французского косметического бренда **Vichy** ([vichy.com](https://www.vichy.com/) открыт 2026-11-05, заголовок «Vichy»). В аптеке и в косметике это имя означает бренд, а не вишлист. Это же касается написания: по-русски «Wishee» и «Wishie» дают одно и то же «Виши».
- **en:** /ˈwɪʃiː/ «WISH-ee». Произносится легко, но на слух неотличимо от «wishy» и близко к «Vichy» /ˈvɪʃi/. *Оценка.*
- **es:** «Vishi/Uishi» — плохих значений нет, но созвучие с Vichy сохраняется. *Оценка.*
- **de/fr/pt:** во французском «Vichy» — ещё и город и известная вода; созвучие сильное. *Оценка.*
- **Флаг:** Vichy + соседство с «Wishy»/«Wishi»/«wishe.app» в сторах.

**Вывод: в шорт-лист не идёт** — блокер уникальности не 0 (точного «Wishee» в нише нет), но имя теряет на созвучии с Vichy и на занятых хэндлах. Слабый кандидат.

---

### 4. Wishie (Виши)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishie.com | занят | Tucows Domains Inc.; создан 07.10.2004, оплачен до 07.10.2027; статус **client hold** (домен на удержании); сайт не отвечает | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishie.com) — 2026-11-05 |
| wishie.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishie.app) — 2026-11-05 |
| wishie.io | занят | NameCheap, Inc.; создан 07.11.2025, оплачен до 07.11.2026 — срок истекает в ближайшие дни | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishie.io) — 2026-11-05 |

**Google Play** ([`wishie`](https://play.google.com/store/search?q=wishie&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет — Ygii, WishQue, I Wish, Википедия, Callie.

**App Store** ([us](https://itunes.apple.com/search?term=wishie&entity=software&country=us), 2026-11-05): точного «Wishie» нет; рядом **Wishi: Wishlist & Gift List** — Safa Shams ([id6818293688](https://apps.apple.com/us/app/wishi-wishlist-gift-list/id6818293688)), **Wishi - Jewelry Wish List** ([id6755151254](https://apps.apple.com/us/app/wishi-jewelry-wish-list/id6755151254)), **Wishy: Wishlist & Secret Santa** ([id6760491762](https://apps.apple.com/us/app/wishy-wishlist-secret-santa/id6760491762)).

**RuStore** ([`wishie`](https://www.rustore.ru/catalog/search?query=wishie), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishie](https://www.instagram.com/wishie/) |
| TikTok | свободен (`"statusCode":10221`) | [tiktok.com/@wishie](https://www.tiktok.com/@wishie) |
| X | занят: «ayesha gordon (@wishie)» | [x.com/wishie](https://x.com/wishie) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishie](https://t.me/wishie) |

**Лингвистика.**
- **ru:** «Виши» — та же проблема, что у Wishee: омофон **Vichy** ([vichy.com](https://www.vichy.com/), 2026-11-05). Два разных имени (Wishee, Wishie) читаются по-русски одинаково — это ломает и различение, и поиск.
- **en:** /ˈwɪʃi/ «WISH-ee»; на письме человек с равной вероятностью напишет Wishee, Wishi, Wishy — латиница неустойчива. *Оценка.*
- **es/de/fr/pt:** см. Wishee, созвучие с Vichy сохраняется. *Оценка.*
- **Флаг:** Vichy + неустойчивое написание.

**Вывод: в шорт-лист не идёт** — уникальность 1 (вплотную стоят «Wishi: Wishlist & Gift List» и «Wishy»), а произносимость и написание слабые из-за Vichy.

---

### 5. Wishlane (Вишлейн)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishlane.com | занят | Network Solutions, LLC; создан 10.08.2002, оплачен до 10.08.2027; неймсерверы Vercel, сайт отдаёт «Not Available in Your Region — WISHLane» — то есть по адресу живёт продукт с этим именем | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishlane.com) — 2026-11-05 |
| wishlane.app | занят | INWX GmbH; создан 25.04.2026, оплачен до 25.04.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishlane.app) — 2026-11-05 |
| wishlane.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishlane.io) — 2026-11-05 |

**Google Play** ([`wishlane`](https://play.google.com/store/search?q=wishlane&c=apps&hl=ru&gl=RU), 2026-11-05): **Wish Lane - Cosy Logic Puzzles** — Small Hours Software ([com.WishLane](https://play.google.com/store/apps/details?id=com.WishLane)). Ниша — головоломки, но имя совпадает.

**App Store** ([us](https://itunes.apple.com/search?term=wishlane&entity=software&country=us), 2026-11-05): точного совпадения нет (Wish: Shop and Save, 11:11, Lil Wish Lanterns).

**RuStore** ([`wishlane`](https://www.rustore.ru/catalog/search?query=wishlane), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishlane](https://www.instagram.com/wishlane/) |
| TikTok | занят: профиль «wishlane» | [tiktok.com/@wishlane](https://www.tiktok.com/@wishlane) |
| X | занят: «Wish Lane (@WishLane)» | [x.com/wishlane](https://x.com/wishlane) |
| Telegram | занят: «The Wishlane Channel», 6 участников | [t.me/wishlane](https://t.me/wishlane) |

**Лингвистика.**
- **ru:** «Вишлейн» — пишется с «ей», а на слух возможно «Вишлэйн»; ударение на второй слог. *Оценка.*
- **en:** /ˈwɪʃleɪn/ «WISH-lane» — «дорожка желаний», понятно, но lane — про дорогу, а не про список. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** по адресу wishlane.com уже работает продукт WISHLane, а в Google Play есть игра Wish Lane.

**Вывод: в шорт-лист не идёт** — .com занят живым продуктом с тем же именем, все хэндлы заняты.

---

### 6. Wishlink (Вишлинк)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishlink.com | занят | Squarespace Domains II LLC; создан 07.09.2003, оплачен до 07.09.2033; неймсерверы Google Domains; по адресу работает **Wishlink** — «Empowering creators to grow, collaborate and earn» | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishlink.com) — 2026-11-05 |
| wishlink.app | занят | GoDaddy.com, LLC; создан 01.10.2022, оплачен до 01.10.2029 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishlink.app) — 2026-11-05 |
| wishlink.io | занят | NameCheap, Inc.; создан 03.11.2026 — за два дня до проверки | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishlink.io) — 2026-11-05 |

**Google Play** ([`wishlink`](https://play.google.com/store/search?q=wishlink&c=apps&hl=ru&gl=RU), 2026-11-05), точные совпадения:
- **Wishlink Shopping App** — Creatormon Private Limited, «Shop your favourite trends, trusted by creators», **5 млн+ скачиваний** ([com.wishlink.userapp](https://play.google.com/store/apps/details?id=com.wishlink.userapp)).
- **Wishlink Creator** — Creatormon Private Limited ([com.wishlink.creator](https://play.google.com/store/apps/details?id=com.wishlink.creator)).
- **WishLink：SNSで見つけた店・モノ・レシピを保存** — giltz ([com.hum.bookmark](https://play.google.com/store/apps/details?id=com.hum.bookmark)), сохранение ссылок.

**App Store** ([us](https://itunes.apple.com/search?term=wishlink&entity=software&country=us), 2026-11-05): Wishlink Creator ([id6458532575](https://apps.apple.com/us/app/wishlink-creator/id6458532575)), Wishlink Shopping App ([id6497169655](https://apps.apple.com/us/app/wishlink-shopping-app/id6497169655)), WishLink — SAMET YILMAZ ([id6754720817](https://apps.apple.com/us/app/wishlink/id6754720817)), WishLink: Save Links & Places — GILTZ ([id6757192158](https://apps.apple.com/us/app/wishlink-save-links-places/id6757192158)).

**RuStore** ([`wishlink`](https://www.rustore.ru/catalog/search?query=wishlink), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishlink](https://www.instagram.com/wishlink/) |
| TikTok | занят: профиль «Wish Link» | [tiktok.com/@wishlink](https://www.tiktok.com/@wishlink) |
| X | занят: «e (@wishlink)» | [x.com/wishlink](https://x.com/wishlink) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishlink](https://t.me/wishlink) |

**Лингвистика.**
- **ru:** «Вишлинк» — устойчиво, читается как «ссылка на желание». Плохих значений нет. *Оценка.*
- **en:** /ˈwɪʃlɪŋk/ «WISH-link» — прозрачно. Но link — про ссылку, а не про список подарков. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** имя принадлежит компании с 5 млн+ установок в Google Play.

**Вывод: в шорт-лист не идёт** — бренд Wishlink в сторах уже занят крупным продуктом (5 млн+), плюс все три домена и три хэндла заняты.

---

### 7. Wishio (Вишио)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishio.com | занят | Tucows Domains Inc.; создан 01.04.2006, оплачен до 01.04.2027; неймсерверы `ipower-expired.domainparkingserver.net` — парковка истёкшего домена, сайт отдаёт 502 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishio.com) — 2026-11-05 |
| wishio.app | занят | Squarespace Domains II LLC; создан 29.03.2022, оплачен до 29.03.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishio.app) — 2026-11-05 |
| wishio.io | занят | GoDaddy.com, LLC; создан 29.01.2020, оплачен до 29.01.2028 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishio.io) — 2026-11-05 |

**Google Play** ([`wishio`](https://play.google.com/store/search?q=wishio&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет — Followish, Ohmywishes, wantic, Wishes, Wishy.

**App Store** ([us](https://itunes.apple.com/search?term=wishio&entity=software&country=us), 2026-11-05): **Wishio Birthday Reminder** — Interware SAS, Lifestyle, «Never miss a birthday again… birthdays, important dates, holidays» ([id6757369255](https://apps.apple.com/us/app/wishio-birthday-reminder/id6757369255)). В российской витрине — то же приложение ([ru](https://apps.apple.com/ru/app/wishio-birthday-reminder/id6757369255)).

**RuStore** ([`wishio`](https://www.rustore.ru/catalog/search?query=wishio), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishio](https://www.instagram.com/wishio/) |
| TikTok | занят: профиль «Wishio» | [tiktok.com/@wishio](https://www.tiktok.com/@wishio) |
| X | занят: «Wishio (@wishio)» | [x.com/wishio](https://x.com/wishio) |
| Telegram | занят: «Wish @wishio» | [t.me/wishio](https://t.me/wishio) |

**Лингвистика.**
- **ru:** «Вишио» — на слух неотличимо от «Вишиё», окончание «-ио» в русском неустойчиво (ср. «радио», «видео» — но там ударение иное). *Оценка.*
- **en:** /ˈwɪʃioʊ/ «WISH-ee-oh» — произносится, но окончание -io читается и как /aɪoʊ/. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** все три домена и все три хэндла заняты; в App Store есть Wishio.

**Вывод: в шорт-лист не идёт** — домены и хэндлы заняты целиком, имя уже есть в App Store (напоминания о днях рождения).

---

### 8. Wishpeer (Вишпир)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishpeer.com | занят | Amazon Registrar, Inc.; создан 24.02.2025, оплачен до 24.02.2027, статус active; неймсерверы AWS | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishpeer.com) — 2026-11-05 |
| wishpeer.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishpeer.app) — 2026-11-05 |
| wishpeer.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishpeer.io) — 2026-11-05 |

**Google Play** ([`wishpeer`](https://play.google.com/store/search?q=wishpeer&c=apps&hl=ru&gl=RU), 2026-11-05): **WishPeer** — Sinan Uçar, «The social way to wish» ([com.snn.mywishlist.app](https://play.google.com/store/apps/details?id=com.snn.mywishlist.app)). Единственное точное совпадение в выдаче, скачиваний мало (на странице не указано).

**App Store** ([us](https://itunes.apple.com/search?term=wishpeer&entity=software&country=us), 2026-11-05): **WishPeer: Wishlist & Gift List** — Sinan Ucar ([id6757866936](https://apps.apple.com/us/app/wishpeer-wishlist-gift-list/id6757866936)). Это тот же разработчик и тот же продукт — вишлист.

**RuStore** ([`wishpeer`](https://www.rustore.ru/catalog/search?query=wishpeer), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishpeer](https://www.instagram.com/wishpeer/) |
| TikTok | занят: профиль «𓅸» | [tiktok.com/@wishpeer](https://www.tiktok.com/@wishpeer) |
| X | **свободен**: «User Profile Not Found» (404) | [x.com/wishpeer](https://x.com/wishpeer) |
| Telegram | занят: аккаунт без подписчиков | [t.me/wishpeer](https://t.me/wishpeer) |

**Лингвистика.**
- **ru:** «Вишпир» — читается как «виш» + «пир», то есть «пир желаний»; вторая часть сильная и праздничная, но английская логика «peer = сверстник, друг» по-русски не считывается. *Оценка.*
- **en:** /ˈwɪʃpɪər/ «WISH-peer» — peer значит «равный, друг»; для социального вишлиста смысл хороший. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** по-русски и по-английски имя значит разное; смысл теряется в одном из двух целевых языков.

**Вывод: отсев** — точное имя занято в нашей нише тем же продуктом WishPeer (Google Play и App Store). Блокер уникальности = 0, несмотря на свободные `.app` и `.io`.

---

### 9. Wishday (Вишдей)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishday.com | занят | GoDaddy.com, LLC; создан 31.05.2019, оплачен до 31.05.2027; сайт не отвечает | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishday.com) — 2026-11-05 |
| wishday.app | занят | GoDaddy.com, LLC; создан 11.11.2025, оплачен до **11.11.2026** — срок истекает через шесть дней | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishday.app) — 2026-11-05 |
| wishday.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishday.io) — 2026-11-05 |

**Google Play** ([`wishday`](https://play.google.com/store/search?q=wishday&c=apps&hl=ru&gl=RU), 2026-11-05), два точных совпадения:
- **WishDay: AI Birthday Reminder** — «Manage birthdays easily with reminders, calendar and AI greetings», 10 тыс.+ скачиваний ([app.wishday](https://play.google.com/store/apps/details?id=app.wishday)).
- **WishDay: Birthdays & Events** — Krayknot Labs ([com.krayknot.wishday](https://play.google.com/store/apps/details?id=com.krayknot.wishday)).

**App Store** ([us](https://itunes.apple.com/search?term=wishday&entity=software&country=us), 2026-11-05): **WishDay: AI Birthday Reminder** — Udit Chugh ([id6759999345](https://apps.apple.com/us/app/wishday-ai-birthday-reminder/id6759999345)).

**RuStore** ([`wishday`](https://www.rustore.ru/catalog/search?query=wishday), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishday](https://www.instagram.com/wishday/) |
| TikTok | занят: профиль «wishday» | [tiktok.com/@wishday](https://www.tiktok.com/@wishday) |
| X | занят: «Good morning , I wis (@WishDay)» | [x.com/wishday](https://x.com/wishday) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishday](https://t.me/wishday) |

**Лингвистика.**
- **ru:** «Вишдей» — неустойчиво: на слух «вишдэй», «вишдей», «виш-дей». *Оценка.*
- **en:** /ˈwɪʃdeɪ/ «WISH-day» — прозрачно, произносится легко. Day — про дату праздника, а не про список желаний. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** две одинаково названные программы в Google Play и одна в App Store; смысл смещается к напоминаниям о днях рождения.

**Вывод: слабый кандидат** — в сторах уже два «WishDay» в соседней нише (дни рождения), но в вишлистах совпадения нет. Держу как запасной вариант.

---

### 10. Wishparty (Вишпати)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishparty.com | занят | TurnCommerce, Inc. (NameBright.com); создан 26.07.2012, оплачен до 26.07.2027; сайт — заглушка «NameBright - Coming Soon», то есть домен припаркован и, вероятно, продаётся | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishparty.com) — 2026-11-05 |
| wishparty.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishparty.app) — 2026-11-05 |
| wishparty.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishparty.io) — 2026-11-05 |

**Google Play** ([`wishparty`](https://play.google.com/store/search?q=wishparty&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет; в выдаче только чужие приложения (Poster Maker, Share a Wish, Wishy, WISHUPON и т. п.). В выдаче по `wishparty wishlist` — тоже только общие вишлисты.

**App Store** ([us](https://itunes.apple.com/search?term=wishparty&entity=software&country=us), 2026-11-05): точного совпадения нет; рядом Wish: Shop and Save, Wishlists - online wishlist, GiftList, Wishdeck.

**RuStore** ([`wishparty`](https://www.rustore.ru/catalog/search?query=wishparty), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishparty](https://www.instagram.com/wishparty/) |
| TikTok | занят: профиль «🌈 웃자» | [tiktok.com/@wishparty](https://www.tiktok.com/@wishparty) |
| X | занят: «ChinGY (@Wishparty)» | [x.com/wishparty](https://x.com/wishparty) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishparty](https://t.me/wishparty) |

**Лингвистика.**
- **ru:** «Вишпати» — устойчиво, читается как «вечеринка желаний». Плохих значений нет. *Оценка.*
- **en:** /ˈwɪʃpɑːrti/ «WISH-par-tee» — прозрачно, но party сужает до праздников и вечеринок; для вишлиста на каждый день смысл узковат. *Оценка.*
- **es/de/fr/pt:** читается как английское; во французском «party» — заимствование из английского, понятное. *Оценка.*
- **Флаг:** сужение до праздничного сценария; в сторах точных совпадений нет.

**Вывод: кандидат в шорт-лист** — нет ни одного продукта с этим именем в сторах, `.app` и `.io` свободны, блокер уникальности закрыт (2). Минус — праздничное сужение и припаркованный `.com`.

---

### 11. Wishmoon (Вишмун)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishmoon.com | занят | TurnCommerce, Inc. (NameBright.com); создан 09.10.2014, оплачен до 09.10.2027; неймсерверы `atom.com` — доменный маркетплейс Atom, цену не смотрел (сайт отдаёт 403) | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishmoon.com) — 2026-11-05 |
| wishmoon.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishmoon.app) — 2026-11-05 |
| wishmoon.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishmoon.io) — 2026-11-05 |

**Google Play** ([`wishmoon`](https://play.google.com/store/search?q=wishmoon&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет; ближайшие — **WishMo** (Dare Digital, [ro.daredigital.wishmo](https://play.google.com/store/apps/details?id=ro.daredigital.wishmo)), WISHUPON, WishOwl, WishQue.

**App Store** ([us](https://itunes.apple.com/search?term=wishmoon&entity=software&country=us), 2026-11-05): точного совпадения нет; выдача уходит в лунные приложения и эзотерику — MoonX: Moon Calendar, Moonly: Your Spiritual Guide, Face Seer, Lucky Life.

**RuStore** ([`wishmoon`](https://www.rustore.ru/catalog/search?query=wishmoon), 2026-11-05): точного совпадения нет; в выдаче Moon Calendar, Moon Phases, Moon Pioneer.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishmoon](https://www.instagram.com/wishmoon/) |
| TikTok | занят: профиль «Wishmoon» | [tiktok.com/@wishmoon](https://www.tiktok.com/@wishmoon) |
| X | занят: «wishmoon (@wishmoon)» | [x.com/wishmoon](https://x.com/wishmoon) |
| Telegram | занят: «Wish🌙», 79 подписчиков | [t.me/wishmoon](https://t.me/wishmoon) |

**Лингвистика.**
- **ru:** «Вишмун» — читается легко, но на слух неотличимо от «виш мун»; ассоциации — луна, ночь, эзотерика. *Оценка.*
- **en:** /ˈwɪʃmuːn/ «WISH-moon» — прозрачно, звучит сказочно. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** сказочно-эзотерическое звучание: выдача по имени уходит в лунные календари и сонники, а не в подарки. Смыслу вишлиста не помогает.

**Вывод: кандидат в шорт-лист** — в сторах точного имени нет, `.app` и `.io` свободны. Минус — эзотерический оттенок и припаркованный `.com` на Atom.

---

### 12. Wishberry (Вишберри)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishberry.com | занят | Squarespace Domains II LLC; создан 27.03.2000, оплачен до 27.03.2027; неймсерверы Google Domains; сайт отдаёт страницу с заголовком «:)» — содержимого нет | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishberry.com) — 2026-11-05 |
| wishberry.app | занят | CloudFlare, Inc.; создан 23.04.2025, оплачен до 23.04.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishberry.app) — 2026-11-05 |
| wishberry.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishberry.io) — 2026-11-05 |

**Google Play** ([`wishberry`](https://play.google.com/store/search?q=wishberry&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет — WishOwl, Etsy, Share a Wish, Wishr, Wildberries.

**App Store** ([us](https://itunes.apple.com/search?term=wishberry&entity=software&country=us), 2026-11-05): точного совпадения нет; единственный близкий результат — Pinkberry (Kahala Management, сеть йогуртов). В российской витрине по `wishberry` результатов нет.

**RuStore** ([`wishberry`](https://www.rustore.ru/catalog/search?query=wishberry), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishberry](https://www.instagram.com/wishberry/) |
| TikTok | занят: профиль «WishBerry» | [tiktok.com/@wishberry](https://www.tiktok.com/@wishberry) |
| X | занят: «wish berry (@wishberry)» | [x.com/wishberry](https://x.com/wishberry) |
| Telegram | занят: «Anna @wishberry» | [t.me/wishberry](https://t.me/wishberry) |

**Лингвистика.**
- **ru:** «Вишберри» — длинно, но произносится; по-русски ягода «берри» не значит ничего, кроме ягодного десерта. *Оценка.*
- **en:** /ˈwɪʃberi/ «WISH-berry» — милое, «ягода желаний». Написание рискованное: две «r» и «y» на конце легко теряются (Wishbery, Wishberry, Wisberry). *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** нестабильное написание и «ягодный» оттенок, далёкий от подарков.

**Вывод: кандидат в шорт-лист** — в сторах точного имени нет, `.io` свободен. Минус — `.app` занят с 2025 года, написание неустойчиво.

---

### 13. Wishme (Вишми)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishme.com | занят | GoDaddy.com, LLC; создан 20.03.2004, оплачен до 20.03.2027; сайт отдаёт 404 | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishme.com) — 2026-11-05 |
| wishme.app | занят | 1&1 Internet SE; создан 01.09.2025, оплачен до 01.09.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishme.app) — 2026-11-05 |
| wishme.io | занят | Spaceship, Inc.; создан 26.06.2026, оплачен до 26.06.2027 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishme.io) — 2026-11-05 |

**Google Play** ([`wishme`](https://play.google.com/store/search?q=wishme&c=apps&hl=ru&gl=RU), 2026-11-05), точные совпадения:
- **WishMe AI: Greetings & Cards** — Arseniy Boyko, «AI greeting cards & wishes», 10+ скачиваний ([com.hwx.wishme](https://play.google.com/store/apps/details?id=com.hwx.wishme)).
- **WishMe: Дни рождения и AI** — AI Chat & Voice Systems ([ai.wishme.reminder](https://play.google.com/store/apps/details?id=ai.wishme.reminder)).
- **WishMe Store** — APPYANTRA ([com.wishmestore.appyantra](https://play.google.com/store/apps/details?id=com.wishmestore.appyantra)).

**App Store** ([us](https://itunes.apple.com/search?term=wishme&entity=software&country=us), 2026-11-05):
- **WishMe: Christmas Gift Planner** — JAN HORAK, Lifestyle: «remembers the birthdays of everyone you love — and helps you find the perfect gift» ([id6755149953](https://apps.apple.com/us/app/wishme-christmas-gift-planner/id6755149953)). Ближе всего к нашей нише.
- **Wish Me: Birthday Reminder** — Chibuzo Okafor ([id6789769618](https://apps.apple.com/us/app/wish-me-birthday-reminder/id6789769618)).
- **WishMe AI: Greetings & Cards** и **Wish Me : Aroma Supplies** — поздравления и товары ([ru](https://apps.apple.com/ru/app/wishme-ai-greetings-cards/id6763071855)).

**RuStore** ([`wishme`](https://www.rustore.ru/catalog/search?query=wishme), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishme](https://www.instagram.com/wishme/) |
| TikTok | занят: профиль «몽스타» | [tiktok.com/@wishme](https://www.tiktok.com/@wishme) |
| X | занят: «wish (@Wishme)» | [x.com/wishme](https://x.com/wishme) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishme](https://t.me/wishme) |

**Лингвистика.**
- **ru:** «Вишми» — по-русски читается и как «виш ми», и как «вишме»; проверка задания подтвердилась: «Wishme» без пробела тянет прочитать «вишме», что звучит как обрубок. *Оценка.*
- **en:** /ˈwɪʃmiː/ «WISH-mee» — понятно (wish + me), но без пробела на письме распознаётся хуже, чем «Wish me». *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** «вишме» + три чужих приложения с этим именем в Google Play.

**Вывод: слабый кандидат** — все три домена заняты, в сторах четыре «WishMe» в смежных нишах (поздравления, подарки, дни рождения). Уникальность 1, в шорт-лист не идёт.

---

### 14. Wishto (Вишто)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wishto.com | занят | eNom, LLC; создан 19.05.1999, оплачен до 19.05.2027; сайт не отвечает | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wishto.com) — 2026-11-05 |
| wishto.app | **свободен** | RDAP 404 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wishto.app) — 2026-11-05 |
| wishto.io | **свободен** | RDAP 404 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wishto.io) — 2026-11-05 |

**Google Play** ([`wishto`](https://play.google.com/store/search?q=wishto&c=apps&hl=ru&gl=RU), 2026-11-05): **wishTo** — «Create your Wishlist. Share it and receive the exact gifts you dream of», 10+ скачиваний ([pro.wishto.wishto](https://play.google.com/store/apps/details?id=pro.wishto.wishto)). Это ровно наша ниша.

**App Store** ([us](https://itunes.apple.com/search?term=wishto&entity=software&country=us), 2026-11-05): точного совпадения нет — Wish: Shop and Save, Wishlists, Sortd, Moonsift.

**RuStore** ([`wishto`](https://www.rustore.ru/catalog/search?query=wishto), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wishto](https://www.instagram.com/wishto/) |
| TikTok | свободен (`"statusCode":10221`) | [tiktok.com/@wishto](https://www.tiktok.com/@wishto) |
| X | занят: «Wishto (@wishto)» | [x.com/wishto](https://x.com/wishto) |
| Telegram | не проверено (заглушка без владельца, похоже свободен) | [t.me/wishto](https://t.me/wishto) |

**Лингвистика.**
- **ru:** «Вишто» — проверка задания подтвердилась: на слух разваливается на «вишь, что…» («вишь» — разговорная частица, [ru.wiktionary.org/wiki/вишь](https://ru.wiktionary.org/wiki/%D0%B2%D0%B8%D1%88%D1%8C), 2026-11-05). Как бренд звучит как обрывок фразы. *Оценка чтения.*
- **en:** /ˈwɪʃtuː/ «WISH-too» — читается, но «to» в конце тянет продолжение («wish to…»), бренд-ощущения нет. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** «вишь, что» + точное имя уже занято вишлистом.

**Вывод: отсев** — в Google Play есть `wishTo`, вишлист ровно в нашей нише. Блокер уникальности = 0, хотя `.app` и `.io` свободны.

---

### 15. Wisho (Вишо)

**Домены.**

| Домен | Статус | Данные регистратора | Источник |
|---|---|---|---|
| wisho.com | занят | GoDaddy.com, LLC; создан 22.12.2004, оплачен до 22.12.2028; неймсерверы Cloudflare, сайт отдаёт 403 «Attention Required» | [RDAP Verisign](https://rdap.verisign.com/com/v1/domain/wisho.com) — 2026-11-05 |
| wisho.app | занят | Spaceship, Inc.; создан 13.08.2026, оплачен до 13.08.2027 | [RDAP Google Registry](https://pubapi.registry.google/rdap/domain/wisho.app) — 2026-11-05 |
| wisho.io | занят | Dynadot Inc; создан 05.06.2026, оплачен до 05.06.2027 | [RDAP Identity Digital](https://rdap.identitydigital.services/rdap/domain/wisho.io) — 2026-11-05 |

**Google Play** ([`wisho`](https://play.google.com/store/search?q=wisho&c=apps&hl=ru&gl=RU), 2026-11-05): точного совпадения нет — WISHUPON, Swwisho, WishMo, WishQue, слоты. В выдаче по `wisho wishlist` рядом появляется **Wishdo: Wishlist & Gift List** — Andrei Romaha ([io.wishdo.app](https://play.google.com/store/apps/details?id=io.wishdo.app)), но это другое имя.

**App Store** ([us](https://itunes.apple.com/search?term=wisho&entity=software&country=us), 2026-11-05): **Wisho** — Mohammad Alturbaq, категория Games: арабская игра-угадайка логотипов ([id6749068972](https://apps.apple.com/us/app/wisho/id6749068972)). В российской витрине та же игра плюс открытки и словарь wishoTouch ([ru](https://apps.apple.com/ru/app/wisho/id6749068972)).

**RuStore** ([`wisho`](https://www.rustore.ru/catalog/search?query=wisho), 2026-11-05): точного совпадения нет.

**Товарные знаки.** EUIPO/TMview, WIPO, USPTO — не проверено (антибот, капча, JS), 2026-11-05.

**Хэндлы** (2026-11-05).

| Платформа | Статус | Источник |
|---|---|---|
| Instagram | не проверено: заглушка с логином | [instagram.com/wisho](https://www.instagram.com/wisho/) |
| TikTok | занят: профиль «Wisho» | [tiktok.com/@wisho](https://www.tiktok.com/@wisho) |
| X | **свободен**: «User Profile Not Found» (404) | [x.com/wisho](https://x.com/wisho) |
| Telegram | занят: «wisho», 1 подписчик | [t.me/wisho](https://t.me/wisho) |

**Лингвистика.**
- **ru:** «Вишо» — неустойчиво; читается и «Вишо», и «Вишу», и «Вишио». Короткое имя без опоры на слово. *Оценка.*
- **en:** /ˈwɪʃoʊ/ «WISH-oh» — коротко, но окончание -o читается по-разному; в сторах уже есть игра Wisho. *Оценка.*
- **es/de/fr/pt:** читается как английское, плохих значений нет. *Оценка.*
- **Флаг:** неустойчивое чтение и все домены заняты.

**Вывод: слабый кандидат** — в нише вишлистов имени нет, но все три домена заняты, написание и чтение неустойчивы.

---

### 1.7 Сводная таблица

В каждой ячейке статус и сноска; расшифровка сносок — в конце файла. «нп» — не проверено, причина в сноске.

| # | Имя | .com | .app | .io | Google Play | App Store | EUIPO | WIPO | USPTO | Instagram | TikTok | X | Telegram | Лингвистика | Быстрый вывод |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wishly | занят [1] | занят [1] | занят [1] | точное совпадение, 2 приложения [1] | точное совпадение, 4 вишлиста [1] [18] | нп [16] | нп [16] | нп [16] | нп [1] | занят [1] | занят [1] | нп, похоже свободен [1] | флагов нет [17] | **отсев**: имя уже носят четыре вишлиста в App Store, wishly.net [18] и приложение в RuStore [31] |
| 2 | Wishbee | занят [2] | занят [2] | **свободен** [2] | точного нет [2] | занят [2] [22] | нп [16] | нп [16] | нп [16] | нп [2] | занят [2] | занят [2] | занят [2] | «bee» милое, не подарочное [17] | **отсев**: wishbee.ai — вишлист [21], плюс приложение WishBee [22] |
| 3 | Wishee | занят [3] | **свободен** [3] | занят [3] | точного нет [3] | рядом wishe.app [3] [23] | нп [16] | нп [16] | нп [16] | нп [3] | занят [3] | занят [3] | занят [3] | Vichy [17] | **слабый**: созвучие с Vichy, все хэндлы заняты |
| 4 | Wishie | занят [4] | **свободен** [4] | занят [4] | точного нет [4] | рядом Wishi и Wishy [4] [24] | нп [16] | нп [16] | нп [16] | нп [4] | **свободен** [4] | занят [4] | нп, похоже свободен [4] | Vichy + неустойчивое написание [17] | **слабый**: по-русски то же «Виши», что и Wishee |
| 5 | Wishlane | занят, живой продукт WISHLane [5] [32] | занят [5] | **свободен** [5] | точное совпадение, игра [5] [25] | точного нет [5] | нп [16] | нп [16] | нп [16] | нп [5] | занят [5] | занят [5] | занят [5] | флагов нет [17] | **слабый**: .com занят продуктом с тем же именем, хэндлы заняты |
| 6 | Wishlink | занят, 5 млн+ установок [6] [26] | занят [6] | занят [6] | точное совпадение, 5 млн+ [6] [26] | точное совпадение, 2 продукта [6] | нп [16] | нп [16] | нп [16] | нп [6] | занят [6] | занят [6] | нп, похоже свободен [6] | флагов нет [17] | **слабый**: бренд занят крупным продуктом |
| 7 | Wishio | занят, парковка [7] | занят [7] | занят [7] | точного нет [7] | занят [7] [29] | нп [16] | нп [16] | нп [16] | нп [7] | занят [7] | занят [7] | занят [7] | окончание -io [17] | **слабый**: все домены и хэндлы заняты, есть приложение Wishio |
| 8 | Wishpeer | занят [8] | **свободен** [8] | **свободен** [8] | точное совпадение, вишлист [8] [19] | точное совпадение, вишлист [8] [19] | нп [16] | нп [16] | нп [16] | нп [8] | занят [8] | **свободен** [8] | занят [8] | смысл разный в ru и en [17] | **отсев**: WishPeer — вишлист с тем же именем в Play и App Store |
| 9 | Wishday | занят [9] | занят, истекает 11.11.2026 [9] | **свободен** [9] | точное совпадение, 2 приложения [9] [27] | занят [9] [27] | нп [16] | нп [16] | нп [16] | нп [9] | занят [9] | занят [9] | нп, похоже свободен [9] | «Вишдей» неустойчиво [17] | **слабый**: два WishDay в Play в нише дней рождения |
| 10 | Wishparty | занят, припаркован [10] [33] | **свободен** [10] | **свободен** [10] | точного нет [10] | точного нет [10] | нп [16] | нп [16] | нп [16] | нп [10] | занят [10] | занят [10] | нп, похоже свободен [10] | сужение до праздника [17] | **кандидат в шорт-лист**: в сторах точного имени нет |
| 11 | Wishmoon | занят, маркетплейс Atom [11] [34] | **свободен** [11] | **свободен** [11] | точного нет [11] | точного нет [11] | нп [16] | нп [16] | нп [16] | нп [11] | занят [11] | занят [11] | занят [11] | эзотерическое звучание [17] | **кандидат в шорт-лист**: в сторах точного имени нет |
| 12 | Wishberry | занят, пустая заглушка [12] | занят [12] | **свободен** [12] | точного нет [12] | точного нет [12] | нп [16] | нп [16] | нп [16] | нп [12] | занят [12] | занят [12] | занят [12] | нестабильное написание [17] | **кандидат в шорт-лист**: в сторах точного имени нет |
| 13 | Wishme | занят [13] | занят [13] | занят [13] | точное совпадение, 3 приложения [13] [28] | точное совпадение, 4 приложения [13] [28] | нп [16] | нп [16] | нп [16] | нп [13] | занят [13] | занят [13] | нп, похоже свободен [13] | «вишме» [17] | **слабый**: имя занято в смежных нишах, все домены заняты |
| 14 | Wishto | занят [14] | **свободен** [14] | **свободен** [14] | точное совпадение, вишлист [14] [20] | точного нет [14] | нп [16] | нп [16] | нп [16] | нп [14] | **свободен** [14] | занят [14] | нп, похоже свободен [14] | «вишь, что» [17] | **отсев**: wishTo — вишлист ровно в нашей нише |
| 15 | Wisho | занят, Cloudflare [15] | занят [15] | занят [15] | точного нет [15] | занят, игра Wisho [15] [30] | нп [16] | нп [16] | нп [16] | нп [15] | занят [15] | **свободен** [15] | занят [15] | неустойчивое чтение [17] | **слабый**: все домены заняты, чтение размыто |

### 1.8 Что не проверено

- **Товарные знаки по всем 15 именам.** EUIPO/TMview отдаёт антибот-заглушку (Akamai), API TMview — ту же страницу; eSearch — JS-оболочку, а его API на запрос отдаёт заглушку «It works!» от Apache. WIPO Global Brand Database — капча altcha вместо поиска. USPTO — интерфейс требует JS, а API-пути `api-v1-0-0/tmsearch` и `api/v1/search` вернули 404/405. Классы 9, 35, 42 не проверялись. Ни один знак блокер не закрывает [16].
- **Instagram по всем 15 именам.** `instagram.com/{имя}/` отдаёт одинаковую страницу-заглушку с логином и для существующего профиля, и для случайного имени: отличить занятый хэндл от свободного без логина нельзя.
- **Telegram по части имён.** У занятых видно имя и число подписчиков. У свободных `t.me` отдаёт не «страница не найдена», а страницу «Telegram: Contact @имя» без владельца — по правилу задания это «не проверено», хотя выглядит как свободный хэндл.
- **Веб-поиск.** С шестого запроса DuckDuckGo отдаёт 202 с антибот-страницей, Bing — нерелевантную выдачу (на запрос про wishparty пришли статьи о Швейцарии и ЕС), Google и Qwant требуют JS/ключ. Успели пройти только запросы по `wishly` и `wishbee`; по ним факты взяты с самих сайтов, а не из выдачи. Поэтому «в вебе ничего нет» ни по одному имени не утверждается: уникальность оценивалась по сторам и по прямым заходам на найденные сайты.
- **Полные первые выдачи сторов.** Смотрел первую страницу поиска Google Play и первые 5 результатов iTunes Search API на страну; глубже первой страницы не листал.
- **RuStore.** Смотрел только первую выдачу поиска, без карточек приложений и без проверки числа скачиваний.
- **Цены доменов.** У wishly.io (Afternic), wishparty.com (NameBright) и wishmoon.com (Atom) видны признаки продажи, но цену не открывал: wishly.io не отвечает, wishparty.com — заглушка «Coming Soon», wishmoon.com — 403 Cloudflare.
- **Владельцы занятых доменов.** В RDAP раскрыт только регистратор, владельцы скрыты приватностью.
- **Чтение по-испански, по-немецки, по-французски и по-португальски** — оценка автора разбора, по словарям этих языков не проверял.

---

## Этап 2. Оценка

Оценка только по [criteria.md](criteria.md), веса не менял. Сумма — из 34, потому что товарный знак ни по одному имени не проверен и балл за него не ставится (как в `dreamly.md`). Блокер уникальности закрыт только у имён со значением 2.

Правила, по которым ставил баллы в этом разборе:

- **Уникальность.** 0 — в нише вишлиста/подарков есть продукт с тем же именем; 1 — точное имя занято в смежной нише или вплотную стоят близкие написания в нашей; 2 — ни в Google Play, ни в App Store, ни в RuStore точного имени в нашей нише нет.
- **Домен.** 0 — все три зоны заняты; 1 — `.com` занят, но `.app` или `.io` свободен; 2 — `.com` свободен. Двойку не получил никто: все 15 `.com` заняты.
- **Соответствие продукту.** 2 — «wish» плюс то, что читается как список или желание владельца; 1 — «wish» плюс хвост со своим значением, который надо объяснять; 0 — не про желания.
- **ASO и SEO.** 0 — брендовая выдача занята сильным конкурентом; 1 — рядом чужие приложения, но не в топе; 2 — бренд в выдаче свободен.

### 2.1–2.3 Таблица баллов

| Имя | Уник. (4) | Знак (3) | Домен (3) | Соответ. (3) | Произн. (3) | ASO (2) | Масштаб (2) | Сумма | Статус | Главная причина |
|---|---|---|---|---|---|---|---|---|---|---|
| Wishparty | 2 → 8 | блокер не закрыт | 1 → 3 | 1 → 3 | 2 → 6 | 1 → 2 | 2 → 4 | **26 из 34** | кандидат в шорт-лист | точного имени нет в сторах, `.app` и `.io` свободны; сужает до праздников |
| Wishmoon | 2 → 8 | блокер не закрыт | 1 → 3 | 1 → 3 | 2 → 6 | 1 → 2 | 2 → 4 | **26 из 34** | кандидат в шорт-лист | точного имени нет в сторах; эзотерическое звучание уводит от подарков |
| Wishberry | 2 → 8 | **0: USPTO рег. 7665996, кл. 35, действует [35]** | 1 → 3 | 1 → 3 | 1 → 3 | 1 → 2 | 2 → 4 | **23 из 34** | **отклонён (2026-11-05)** | точного имени нет в сторах; написание неустойчиво, `.app` занят |
| Wishly | 0 → 0 | блокер не закрыт | 0 → 0 | 2 → 6 | 2 → 6 | 0 → 0 | 2 → 4 | 16 из 34 | **отклонён** | блокер уникальности 0: четыре вишлиста с этим именем в App Store [1] [18] |
| Wishbee | 0 → 0 | блокер не закрыт | 1 → 3 | 2 → 6 | 2 → 6 | 0 → 0 | 2 → 4 | 19 из 34 (испр. 2026-11-05: `.io` свободен [2]) | **отклонён** | блокер уникальности 0: wishbee.ai — вишлист, плюс WishBee [21] [22] |
| Wishpeer | 0 → 0 | блокер не закрыт | 1 → 3 | 2 → 6 | 1 → 3 | 1 → 2 | 2 → 4 | 18 из 34 | **отклонён** | блокер уникальности 0: WishPeer — вишлист в Play и App Store [19] |
| Wishto | 0 → 0 | блокер не закрыт | 1 → 3 | 2 → 6 | 0 → 0 | 0 → 0 | 2 → 4 | 13 из 34 | **отклонён** | блокер уникальности 0 и произносимости 0: wishTo — вишлист [20], по-русски «вишь, что» [17] |
| Wishee | 1 → 4 | **0: USPTO рег. 7444474, кл. 9 [35]** | 1 → 3 | 2 → 6 | 1 → 3 | 1 → 2 | 2 → 4 | 22 из 34 | **отклонён (2026-11-05)** | омофон Vichy [17], все хэндлы заняты [3] |
| Wishie | 1 → 4 | блокер не закрыт | 1 → 3 | 2 → 6 | 1 → 3 | 1 → 2 | 2 → 4 | 22 из 34 | слабый | то же «Виши», вплотную стоят Wishi и Wishy [24] |
| Wishlink | 1 → 4 | блокер не закрыт | 0 → 0 | 2 → 6 | 2 → 6 | 0 → 0 | 2 → 4 | 20 из 34 | слабый | бренд занят продуктом с 5 млн+ установок [26] |
| Wishlane | 1 → 4 | блокер не закрыт | 1 → 3 | 1 → 3 | 1 → 3 | 1 → 2 | 2 → 4 | 19 из 34 | слабый | `.com` занят живым продуктом WISHLane [32] |
| Wishio | 1 → 4 | блокер не закрыт | 0 → 0 | 2 → 6 | 1 → 3 | 1 → 2 | 2 → 4 | 19 из 34 | слабый | все домены и хэндлы заняты [7] |
| Wishday | 1 → 4 | блокер не закрыт | 1 → 3 | 1 → 3 | 1 → 3 | 1 → 2 | 2 → 4 | 19 из 34 | слабый | два WishDay в Play в нише дней рождения [27] |
| Wishme | 1 → 4 | блокер не закрыт | 0 → 0 | 1 → 3 | 1 → 3 | 0 → 0 | 2 → 4 | 14 из 34 | слабый | имя занято в смежных нишах [28], все домены заняты [13] |
| Wisho | 2 → 8 | блокер не закрыт | 0 → 0 | 1 → 3 | 1 → 3 | 1 → 2 | 2 → 4 | 20 из 34 | слабый | все домены заняты [15], чтение размыто [17] |

У всех 15 в графе «Товарный знак» — «блокер не закрыт»: базы не открылись (раздел 1.8). Поэтому ни одно имя не может получить статус «финалист», даже с закрытым блокером уникальности.

### 2.4 Шорт-лист из 3 имён

> Устарело 2026-11-05: Wishberry отклонён по знаку USPTO, шорт-лист пересмотрен до 5 финалистов — см. «Дополнение 2026-11-05» в конце файла.

**1. Wishparty — 26 из 34.**
- Ни в Google Play, ни в App Store, ни в RuStore нет продукта с этим именем: выдача по `wishparty` состоит из чужих приложений [10]. Блокер уникальности закрыт.
- `.app` и `.io` свободны по ответу регистраторов [10] — можно начать с них, не покупая домен; `.com` не занят продуктом, а припаркован на NameBright [33].
- Произносится и пишется с первого раза в обеих письменностях: «Вишпати» / `wishparty` [17].

**2. Wishmoon — 26 из 34.**
- Точного имени нет ни в одном сторе; выдача по `wishmoon` уходит в лунные календари, а не в чужие вишлисты [11]. Блокер уникальности закрыт.
- `.app` и `.io` свободны [11], `.com` на маркетплейсе Atom — можно поторговаться, а не искать обход [34].
- В обеих письменностях читается однозначно, «Вишмун» / `wishmoon` [17].

**3. Wishberry — 23 из 34.**
- Точного имени нет ни в одном сторе, в App Store по `wishberry` вообще нет результатов [12]. Блокер уникальности закрыт.
- `.io` свободен [12], а `wishberry.com` с 2000 года отдаёт пустую заглушку «:)» — домен занят, но не продуктом [12].
- Балл ниже из-за произносимости и написания: двойная «r» и «y» теряются при наборе по памяти [17].

**Почему не прошли остальные:**

- **Wishly** — четыре вишлиста с этим именем в App Store, ещё один в RuStore [31], плюс wishly.net [18]; блокер уникальности 0.
- **Wishbee** — wishbee.ai прямо про вишлист [21], плюс приложение WishBee [22]; блокер уникальности 0.
- **Wishpeer** — WishPeer: Wishlist & Gift List в Play и App Store [19]; блокер уникальности 0.
- **Wishto** — `wishTo` в Play с описанием «Create your Wishlist. Share it and receive the exact gifts» [20]; блокер уникальности 0, плюс чтение «вишь, что» [17].
- **Wishee** — по-русски «Виши» = Vichy [17], все хэндлы заняты [3].
- **Wishie** — то же «Виши», на письме путается с Wishee, Wishi, Wishy [24] [17].
- **Wishlink** — бренд занят продуктом с 5 млн+ установок [26], все домены и хэндлы заняты [6].
- **Wishlane** — `.com` занят живым продуктом WISHLane [32], все хэндлы заняты [5].
- **Wishio** — все домены и хэндлы заняты, в App Store есть Wishio [29] [7].
- **Wishday** — два приложения WishDay в Play и одно в App Store в нише дней рождения [27].
- **Wishme** — четыре WishMe в смежных нишах [28], все домены заняты [13].
- **Wisho** — все домены заняты [15], чтение размыто [17], в App Store есть игра Wisho [30].

### 2.5 О сравнении

Победитель не объявляется: у всех трёх имён шорт-листа блокер по товарному знаку открыт. Сравнивать 26 из 34 с числами `ideas.md` (31, 30, 26, 23) нельзя как с равными: те баллы посчитаны по прежней таблице критериев, без обязательного английского и без требования устойчивой латиницы (пометка в `ideas.md`). Поэтому в этапе 3 альтернативы B (Gift List) и C (финалист из `ideas.md`) сравниваются по существу — по доменам, стору и смыслу, — а не по старым числам.

---

## Сноски

Все ссылки открыты **2026-11-05**, если в сноске не сказано иное.

[1] Wishly: [rdap.verisign.com/com/v1/domain/wishly.com](https://rdap.verisign.com/com/v1/domain/wishly.com), [pubapi.registry.google/rdap/domain/wishly.app](https://pubapi.registry.google/rdap/domain/wishly.app), [rdap.identitydigital.services/rdap/domain/wishly.io](https://rdap.identitydigital.services/rdap/domain/wishly.io), [Google Play, поиск `wishly`](https://play.google.com/store/search?q=wishly&c=apps&hl=ru&gl=RU), [iTunes Search, `wishly`, us](https://itunes.apple.com/search?term=wishly&entity=software&country=us), [RuStore, поиск `wishly`](https://www.rustore.ru/catalog/search?query=wishly), [t.me/wishly](https://t.me/wishly), [tiktok.com/@wishly](https://www.tiktok.com/@wishly), [x.com/wishly](https://x.com/wishly), [instagram.com/wishly](https://www.instagram.com/wishly/)
[2] Wishbee: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishbee.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishbee.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishbee.io), [Google Play, `wishbee`](https://play.google.com/store/search?q=wishbee&c=apps&hl=ru&gl=RU), [iTunes, `wishbee`, us](https://itunes.apple.com/search?term=wishbee&entity=software&country=us), [RuStore, `wishbee`](https://www.rustore.ru/catalog/search?query=wishbee), [t.me/wishbee](https://t.me/wishbee), [tiktok.com/@wishbee](https://www.tiktok.com/@wishbee), [x.com/wishbee](https://x.com/wishbee), [instagram.com/wishbee](https://www.instagram.com/wishbee/)
[3] Wishee: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishee.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishee.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishee.io), [Google Play, `wishee`](https://play.google.com/store/search?q=wishee&c=apps&hl=ru&gl=RU), [iTunes, `wishee`, us](https://itunes.apple.com/search?term=wishee&entity=software&country=us), [RuStore, `wishee`](https://www.rustore.ru/catalog/search?query=wishee), [t.me/wishee](https://t.me/wishee), [tiktok.com/@wishee](https://www.tiktok.com/@wishee), [x.com/wishee](https://x.com/wishee), [instagram.com/wishee](https://www.instagram.com/wishee/)
[4] Wishie: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishie.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishie.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishie.io), [Google Play, `wishie`](https://play.google.com/store/search?q=wishie&c=apps&hl=ru&gl=RU), [iTunes, `wishie`, us](https://itunes.apple.com/search?term=wishie&entity=software&country=us), [RuStore, `wishie`](https://www.rustore.ru/catalog/search?query=wishie), [t.me/wishie](https://t.me/wishie), [tiktok.com/@wishie](https://www.tiktok.com/@wishie), [x.com/wishie](https://x.com/wishie), [instagram.com/wishie](https://www.instagram.com/wishie/)
[5] Wishlane: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishlane.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishlane.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishlane.io), [Google Play, `wishlane`](https://play.google.com/store/search?q=wishlane&c=apps&hl=ru&gl=RU), [iTunes, `wishlane`, us](https://itunes.apple.com/search?term=wishlane&entity=software&country=us), [RuStore, `wishlane`](https://www.rustore.ru/catalog/search?query=wishlane), [t.me/wishlane](https://t.me/wishlane), [tiktok.com/@wishlane](https://www.tiktok.com/@wishlane), [x.com/wishlane](https://x.com/wishlane), [instagram.com/wishlane](https://www.instagram.com/wishlane/)
[6] Wishlink: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishlink.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishlink.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishlink.io), [Google Play, `wishlink`](https://play.google.com/store/search?q=wishlink&c=apps&hl=ru&gl=RU), [iTunes, `wishlink`, us](https://itunes.apple.com/search?term=wishlink&entity=software&country=us), [RuStore, `wishlink`](https://www.rustore.ru/catalog/search?query=wishlink), [t.me/wishlink](https://t.me/wishlink), [tiktok.com/@wishlink](https://www.tiktok.com/@wishlink), [x.com/wishlink](https://x.com/wishlink), [instagram.com/wishlink](https://www.instagram.com/wishlink/)
[7] Wishio: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishio.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishio.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishio.io), [Google Play, `wishio`](https://play.google.com/store/search?q=wishio&c=apps&hl=ru&gl=RU), [iTunes, `wishio`, us](https://itunes.apple.com/search?term=wishio&entity=software&country=us), [RuStore, `wishio`](https://www.rustore.ru/catalog/search?query=wishio), [t.me/wishio](https://t.me/wishio), [tiktok.com/@wishio](https://www.tiktok.com/@wishio), [x.com/wishio](https://x.com/wishio), [instagram.com/wishio](https://www.instagram.com/wishio/)
[8] Wishpeer: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishpeer.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishpeer.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishpeer.io), [Google Play, `wishpeer`](https://play.google.com/store/search?q=wishpeer&c=apps&hl=ru&gl=RU), [iTunes, `wishpeer`, us](https://itunes.apple.com/search?term=wishpeer&entity=software&country=us), [RuStore, `wishpeer`](https://www.rustore.ru/catalog/search?query=wishpeer), [t.me/wishpeer](https://t.me/wishpeer), [tiktok.com/@wishpeer](https://www.tiktok.com/@wishpeer), [x.com/wishpeer](https://x.com/wishpeer), [instagram.com/wishpeer](https://www.instagram.com/wishpeer/)
[9] Wishday: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishday.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishday.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishday.io), [Google Play, `wishday`](https://play.google.com/store/search?q=wishday&c=apps&hl=ru&gl=RU), [iTunes, `wishday`, us](https://itunes.apple.com/search?term=wishday&entity=software&country=us), [RuStore, `wishday`](https://www.rustore.ru/catalog/search?query=wishday), [t.me/wishday](https://t.me/wishday), [tiktok.com/@wishday](https://www.tiktok.com/@wishday), [x.com/wishday](https://x.com/wishday), [instagram.com/wishday](https://www.instagram.com/wishday/)
[10] Wishparty: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishparty.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishparty.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishparty.io), [Google Play, `wishparty`](https://play.google.com/store/search?q=wishparty&c=apps&hl=ru&gl=RU), [iTunes, `wishparty`, us](https://itunes.apple.com/search?term=wishparty&entity=software&country=us), [RuStore, `wishparty`](https://www.rustore.ru/catalog/search?query=wishparty), [t.me/wishparty](https://t.me/wishparty), [tiktok.com/@wishparty](https://www.tiktok.com/@wishparty), [x.com/wishparty](https://x.com/wishparty), [instagram.com/wishparty](https://www.instagram.com/wishparty/)
[11] Wishmoon: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishmoon.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishmoon.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishmoon.io), [Google Play, `wishmoon`](https://play.google.com/store/search?q=wishmoon&c=apps&hl=ru&gl=RU), [iTunes, `wishmoon`, us](https://itunes.apple.com/search?term=wishmoon&entity=software&country=us), [RuStore, `wishmoon`](https://www.rustore.ru/catalog/search?query=wishmoon), [t.me/wishmoon](https://t.me/wishmoon), [tiktok.com/@wishmoon](https://www.tiktok.com/@wishmoon), [x.com/wishmoon](https://x.com/wishmoon), [instagram.com/wishmoon](https://www.instagram.com/wishmoon/)
[12] Wishberry: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishberry.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishberry.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishberry.io), [Google Play, `wishberry`](https://play.google.com/store/search?q=wishberry&c=apps&hl=ru&gl=RU), [iTunes, `wishberry`, us](https://itunes.apple.com/search?term=wishberry&entity=software&country=us), [iTunes, `wishberry`, ru](https://itunes.apple.com/search?term=wishberry&entity=software&country=ru), [RuStore, `wishberry`](https://www.rustore.ru/catalog/search?query=wishberry), [t.me/wishberry](https://t.me/wishberry), [tiktok.com/@wishberry](https://www.tiktok.com/@wishberry), [x.com/wishberry](https://x.com/wishberry), [instagram.com/wishberry](https://www.instagram.com/wishberry/)
[13] Wishme: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishme.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishme.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishme.io), [Google Play, `wishme`](https://play.google.com/store/search?q=wishme&c=apps&hl=ru&gl=RU), [iTunes, `wishme`, us](https://itunes.apple.com/search?term=wishme&entity=software&country=us), [RuStore, `wishme`](https://www.rustore.ru/catalog/search?query=wishme), [t.me/wishme](https://t.me/wishme), [tiktok.com/@wishme](https://www.tiktok.com/@wishme), [x.com/wishme](https://x.com/wishme), [instagram.com/wishme](https://www.instagram.com/wishme/)
[14] Wishto: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wishto.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wishto.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wishto.io), [Google Play, `wishto`](https://play.google.com/store/search?q=wishto&c=apps&hl=ru&gl=RU), [iTunes, `wishto`, us](https://itunes.apple.com/search?term=wishto&entity=software&country=us), [RuStore, `wishto`](https://www.rustore.ru/catalog/search?query=wishto), [t.me/wishto](https://t.me/wishto), [tiktok.com/@wishto](https://www.tiktok.com/@wishto), [x.com/wishto](https://x.com/wishto), [instagram.com/wishto](https://www.instagram.com/wishto/)
[15] Wisho: [RDAP .com](https://rdap.verisign.com/com/v1/domain/wisho.com), [RDAP .app](https://pubapi.registry.google/rdap/domain/wisho.app), [RDAP .io](https://rdap.identitydigital.services/rdap/domain/wisho.io), [Google Play, `wisho`](https://play.google.com/store/search?q=wisho&c=apps&hl=ru&gl=RU), [iTunes, `wisho`, us](https://itunes.apple.com/search?term=wisho&entity=software&country=us), [RuStore, `wisho`](https://www.rustore.ru/catalog/search?query=wisho), [t.me/wisho](https://t.me/wisho), [tiktok.com/@wisho](https://www.tiktok.com/@wisho), [x.com/wisho](https://x.com/wisho), [instagram.com/wisho](https://www.instagram.com/wisho/)
[16] Товарные знаки: [TMview](https://www.tmdn.org/tmview/) — антибот-заглушка, [EUIPO eSearch](https://euipo.europa.eu/eSearch/) — JS-оболочка, [WIPO Global Brand Database](https://branddb.wipo.int/) — капча altcha, [USPTO Trademark Search](https://tmsearch.uspto.gov/) — JS, API вернул 404/405
[17] Произношение и значения — оценка автора разбора по разделу 1; словарные справки: [«вишь» в Викисловаре](https://ru.wiktionary.org/wiki/%D0%B2%D0%B8%D1%88%D1%8C), [vichy.com](https://www.vichy.com/)
[18] [wishly.net](https://www.wishly.net/) — «Free Wishlist Maker, Create & Share Online, No Sign-Up»
[19] WishPeer: [Google Play](https://play.google.com/store/apps/details?id=com.snn.mywishlist.app) — «The social way to wish»; [App Store](https://apps.apple.com/us/app/wishpeer-wishlist-gift-list/id6757866936)
[20] wishTo: [Google Play](https://play.google.com/store/apps/details?id=pro.wishto.wishto) — «Create your Wishlist. Share it and receive the exact gifts you dream of»
[21] [wishbee.ai](https://wishbee.ai/) — «The modern wishlist that pools money for the perfect group gift»
[22] WishBee: [App Store](https://apps.apple.com/us/app/wishbee/id6475587345), Sofmen Inc
[23] wishe.app: [App Store](https://apps.apple.com/us/app/wishe-app/id6778999964), Umor LLC — «wishe is changing gifting culture»
[24] Wishi и Wishy: [Wishi: Wishlist & Gift List](https://apps.apple.com/us/app/wishi-wishlist-gift-list/id6818293688), [Wishy: Wishlist & Secret Santa](https://apps.apple.com/us/app/wishy-wishlist-secret-santa/id6760491762)
[25] Wish Lane: [Google Play](https://play.google.com/store/apps/details?id=com.WishLane) — «Cosy Logic Puzzles», Small Hours Software
[26] Wishlink: [wishlink.com](https://wishlink.com/) — «Empowering creators to grow, collaborate and earn»; [Google Play, Wishlink Shopping App](https://play.google.com/store/apps/details?id=com.wishlink.userapp) — 5 млн+ скачиваний
[27] WishDay: [Play, AI Birthday Reminder](https://play.google.com/store/apps/details?id=app.wishday), [Play, Birthdays & Events](https://play.google.com/store/apps/details?id=com.krayknot.wishday), [App Store](https://apps.apple.com/us/app/wishday-ai-birthday-reminder/id6759999345)
[28] WishMe: [App Store, Christmas Gift Planner](https://apps.apple.com/us/app/wishme-christmas-gift-planner/id6755149953), [Play, AI Greetings & Cards](https://play.google.com/store/apps/details?id=com.hwx.wishme), [Play, Дни рождения и AI](https://play.google.com/store/apps/details?id=ai.wishme.reminder)
[29] Wishio: [App Store](https://apps.apple.com/us/app/wishio-birthday-reminder/id6757369255), Interware SAS
[30] Wisho: [App Store](https://apps.apple.com/us/app/wisho/id6749068972), Mohammad Alturbaq — игра
[31] RuStore: [поиск `wishly`](https://www.rustore.ru/catalog/search?query=wishly) — «Wishly — список покупок и избранные товары», `com.kirkazarin.wishly`
[32] [wishlane.com](https://wishlane.com/) — «Not Available in Your Region — WISHLane»
[33] [wishparty.com](https://wishparty.com/) — заглушка «NameBright - Coming Soon»
[34] [wishmoon.com](https://wishmoon.com/) — 403 Cloudflare; неймсерверы `atom.com` в RDAP


---

---

## Дополнение 2026-11-05: USPTO по всем 15 и пересмотр шорт-листа

Проверку дописал Grok Bot 5 ноября 2026 года, после аудита этого файла. Цель поменялась: Евгений хочет дать Сергею на выбор около 5 финалистов, а не одного.

### USPTO: точные и сходные знаки

Источник [35]: публичный JSON-эндпоинт поиска USPTO `https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch` (тот же, что использует веб-интерфейс https://tmsearch.uspto.gov/), POST-запрос `query_string` по полю `wordmark`. Дата обращения 2026-11-05. На каждое имя три запроса: точное (`wishparty`), раздельное (`"wish party"`), префиксное (`wishparty*`). Контроль: по `wishlink` поиск находит 2 записи, то есть эндпоинт работает. «Действует» — поле `alive=true`. Блокирующими считаются действующие знаки в классах 9, 35, 42.

| Имя | Точное совпадение | Сходные (раздельно / префикс) | Блокер по USPTO |
|---|---|---|---|
| Wishly | **WISHLY, рег. 6822085, сер. 90453846, кл. 9 и 45, действует**, IgivUgive LLC (Калифорния); WISHLY сер. 97152718, кл. 9, не действует | TERRA WISHLY (не действует); WISHLYSTIT рег. 8521439, кл. 42, действует | **да, кл. 9** |
| Wishbee | нет | WISH BEEP WISHBEEP.COM (кл. 35, не действует), WISHBEEN (не действует) | нет |
| Wishee | **WISHEE, рег. 7444474, сер. 97642589, кл. 9, действует**, Wishee Corporation (Китай); WISHEE кл. 21 не действует | WISHEEN (кл. 9, не действует), WISHEED (кл. 29) | **да, кл. 9** |
| Wishie | нет | WISHIES и др. (кл. 16, 28, 29, все не действуют) | нет |
| Wishlane | нет | нет | нет |
| Wishlink | WISHLINK рег. 5643278, кл. 8, действует; WISHLINK кл. 9, не действует | — | нет в 9/35/42, но сходство с кл. 8 |
| Wishio | WISHIO кл. 25, не действует | WISHIOT рег. 5897012, кл. 9, действует (сходное, не тождественное) | спорно: сходный знак в кл. 9 |
| Wishpeer | нет | нет | нет |
| Wishday | WISHDAY рег. 6858473, кл. 3, действует | WORLD WISH DAY рег. 3865841, кл. 36 и 45, Make-A-Wish Foundation | нет в 9/35/42 |
| Wishparty | нет | WISH PARTY GOODS рег. 5448338, кл. 28, не действует | нет |
| Wishmoon | нет | нет | нет |
| Wishberry | **WISHBERRY, рег. 7665996, сер. 97068658, кл. 35, 5, 10, действует**, ООО «Тонар-Экспорт» (Россия); WISHBERRY сер. 85318248, кл. 35, не действует | — | **да, кл. 35** |
| Wishme | нет | WISH ME рег. 5681595, кл. 28, действует; WISHMEWELL рег. 5672083, кл. 35 (не действует) | нет в 9/35/42 |
| Wishto | нет | префиксные WISHTORY, WISHTOP и др., ни одного действующего в 9/35/42 | нет |
| Wisho | нет | WISHOLY рег. 7432860, кл. 9, действует; WISHOPEN рег. 7776650, кл. 9, действует (сходные) | спорно: сходные в кл. 9 |

EUIPO/TMview, WIPO Global Brand Database и ФИПС по-прежнему не проверены: TMview отвечает «Request Rejected», публичный API EUIPO требует client id (401), API WIPO Brand DB требует токен (403 «Missing Authentication Token»), веб-WIPO закрыт капчей altcha, поиск Роспатента (`searchplatform.rospatent.gov.ru`) отдаёт только JS-оболочку. Проверено 2026-11-05.

### Исправления к этапу 2

- **Wishbee:** домен должен быть 1 → 3, а не 0: `wishbee.io` свободен по RDAP [2]. Сумма **19 из 34**, а не 16. Статус «отклонён» не меняется: блокер уникальности 0 (wishbee.ai, WishBee [21] [22]).
- **Wishberry:** знак **0, блокер** — действующий знак WISHBERRY в USPTO, рег. 7665996, класс 35 [35]. Статус меняется на **отклонён**, из шорт-листа исключён. Владелец российский, поэтому вероятен знак и в ФИПС (оценка, ФИПС не проверялся).
- **Wishly и Wishee:** знак **0, блокер** — действующие знаки в классе 9 [35]. Wishly и так отклонён по уникальности; Wishee переходит из «слабый» в **отклонён**.
- **Wishio и Wisho:** действующие сходные знаки в классе 9 (WISHIOT; WISHOLY, WISHOPEN) [35]. Не тождественные, но риск возражения повышен; оба остаются «слабый».

### Пересмотренный шорт-лист: 5 финалистов на выбор

Приоритеты: нет блокирующего знака по USPTO, нет приложения с тем же именем в нише вишлистов, свободны `.app` или `.io`, имя звучит на нескольких языках. Все четыре имени, отклонённые по уникальности (Wishly, Wishbee, Wishpeer, Wishto), остаются вне списка: у каждого конфликт сильный — продукт с тем же именем именно в нише вишлиста ([18] [21] [22] [19] [20]), а у Wishly ещё и знак.

| Место | Имя | Сумма | USPTO | Свободные домены | Конфликт в сторах | Почему в списке |
|---|---|---|---|---|---|---|
| 1 | Wishparty | 26/34 | чисто | .app, .io; `wishparty.ru` занят (Selectel, 05.06.2026) [36] | нет | уникален, оба домена свободны |
| 2 | Wishmoon | 26/34 | чисто | .app, .io, **.ru** [36] | нет | уникален, единственный со свободным .ru |
| 3 | Wishie | 22/34 | чисто | .app, .ru [36]; TikTok свободен | рядом Wishi и Wishy (вишлисты) [24] | читается ласково, но близкие написания и Vichy |
| 4 | Wishlane | 19/34 | чисто, даже сходных нет | .io, .ru [36] | Wish Lane — головоломка (другая ниша) [25]; wishlane.com — живой продукт WISHLane [32] | чистый знак, спокойное звучание |
| 5 | Wishday | 19/34 | WISHDAY только кл. 3 | .io; `wishday.ru` занят (Timeweb, 2022) [36] | WishDay — напоминалки о днях рождения (смежная ниша) [27] | понятное «день желаний», знак в наших классах свободен |

Не вошли: Wishberry, Wishee, Wishly (блокер по знаку); Wishbee, Wishpeer, Wishto (тот же продукт в нише); Wishlink (крупный бренд, 5 млн+ [26]); Wishio, Wisho, Wishme (все `.com/.app/.io` заняты, у Wishio/Wisho сходные знаки в кл. 9).

[35] USPTO Trademark Search, JSON-эндпоинт `https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch`, интерфейс https://tmsearch.uspto.gov/ — 2026-11-05
[36] `.ru`: [whois.vu](https://api.whois.vu/?q=wishmoon.ru) (прокси WHOIS TCI) — 2026-11-05; дополнительные написания `get{имя}.com`, `{имя}app.com`, `get{имя}.app`, `{имя}app.app` — RDAP Verisign и Google Registry, 2026-11-05: все свободны, кроме `getwishday.com` и `getwishie.com` (заняты)

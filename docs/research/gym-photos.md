# Фотографии тренажёров в словаре

Снимки словаря в `assets/gym/` — каталожные рендеры Technogym (`technogym.com/en-IL`,
пользователь получил разрешение 11 сентября 2026) там, где рендер понятнее снимка из зала,
и фото из зала там, где нет. Размер и обработка файла — в `CLAUDE.md`, раздел про термины.

## Как доставать рендеры с technogym.com

С браузерным `User-Agent` сайт отвечает 200.

1. `https://www.technogym.com/en-IL/products-sitemap.xml` — весь каталог, около сотни
   адресов вида `/en-IL/product/<slug>_<код>.html`.
2. Картинки на странице товара лежат на `webapi-prod.technogym.com/dw/image/v2/.../product/<код>/<имя>.jpg`,
   размер задаётся параметром `?sw=900`. Рендер квадратный, на белом фоне.
3. Цветовые версии — кнопки в блоке `id="color-version"`, у каждой свой `<img alt="Diamond Black">`.
   У линии ARTIS чёрный вариант лежит в файле `*_related_9.jpg`, песочный — в `*-hero-white.jpg`.
4. `robots.txt` запрещает только параметры `?refine=`, `?reason=`, `?product=`.

## Какие линии стоят в зале

| Признак на фото | Линия |
|---|---|
| Жёлтый логотип на трубчатой раме, табличка с пиктограммами, экрана нет | SELECTION 700 (стековые) |
| Гранёный монолитный кожух, тёмно-серый логотип | ARTIS |
| Чёрная рама с бледно-жёлтыми рычагами и блинами | PURE STRENGTH (блинные) |
| Белая рама | SELECTION MED — в зале нет |

Цвет логотипа различает линии надёжнее силуэта. Arm Curl — ARTIS `MK92EH`, подтверждён
снимком наклейки. Скамьи — линия Element (коды `PA…`), гребной — Skillrow.

## Ключ словаря → модель

Стоят рендером:

| Ключ | Термин | Модель |
|---|---|---|
| `armcurl` | Arm Curl | ARTIS Arm Curl `MK92EH`, Diamond Black |
| `chestpress` | Chest press | SELECTION 700 Chest Press `MNFC` |
| `pecdeck` | Бабочка и Reverse fly | SELECTION 700 Dual Pectoral Reverse Fly `MNNC` |
| `legpress` | Жим ногами | SELECTION 700 Leg Press `MNAC` |
| `legcurl` | Leg curl | SELECTION 700 Leg Curl `MNIC` |
| `lat` | Lat machine | SELECTION 700 Lat Machine `MNLC` |
| `cross` | Мультистанция (кроссовер) | Cable Station 8 `MQ0D` |
| `shoulder` | Жим над головой | PURE STRENGTH Shoulder Press `MG3500` |
| `gravitron` | Kneeling Easy Chin Dip | Kneeling Easy Chin Dip `MB91` |
| `station15` | Стойка CHIN UP / DIP / LEG RAISE | Chin Up Dip Leg Raise `PA12` |
| `bench` | Регулируемая скамья | Adjustable Bench `PA04`, кадр `__2` |
| `cardio` | Эллипс, дорожка, велотренажёр | Excite Vario `DFF` |
| `skillrow` | Гребной Skillrow | Skillrow |

Остаются снимками из зала: `dumbbells` и `light` (рендер не понятнее, решение
пользователя), `row` и `scott` (есть ли в зале отдельный LOW ROW и скамья Скотта,
не выяснено; рендеры для них — SELECTION 700 Low Row `MNHC` и PURE STRENGTH Scott
Bench `PG06`).

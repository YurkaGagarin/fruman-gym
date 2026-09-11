# Замена фотографий тренажёров в словаре

Задача от 11 сентября 2026: `assets/gym/*.jpg` — снимки из зала, часть заблюрена или
непонятна. Заменить на каталожные фото Technogym (`technogym.com/en-IL`, пользователь
получил разрешение на использование), а где у Technogym нет похожего по функционалу —
на чистое фото из открытых источников.

## Как доставать фото с technogym.com

`technogym.com` больше не отвечает 403 на программный запрос — с браузерным
`User-Agent` отдаёт 200. Порядок:

1. `https://www.technogym.com/en-IL/products-sitemap.xml` — весь каталог, около сотни
   адресов вида `/en-IL/product/<slug>_<код>.html`.
2. На странице товара картинки лежат на `webapi-prod.technogym.com/dw/image/v2/.../product/<код>/<имя>.jpg`.
   Размер задаётся параметром `?sw=900`.
3. Цветовые версии — кнопки в блоке `id="color-version"`, у каждой свой `<img alt="Diamond Black">`.
   У линии ARTIS чёрный вариант лежит в файле `*_related_9.jpg`, песочный — в `*-hero-white.jpg`.
4. `robots.txt` запрещает только параметры `?refine=`, `?reason=`, `?product=`; страницы товаров открыты.

## Чем оснащён зал (разобрано по фотографиям пользователя)

| Признак на фото | Что это значит |
|---|---|
| Жёлтый логотип TECHNOGYM на трубчатой раме, табличка с пиктограммами, экрана нет | SELECTION 700 |
| Гранёный монолитный кожух, тёмно-серый логотип | ARTIS |
| Чёрная рама с бледно-жёлтыми рычагами и блинами | PURE STRENGTH |
| Белая рама | SELECTION MED — в зале такого нет |

Логотип цветом различает линии надёжнее силуэта: у SELECTION он жёлтый, у ARTIS серый.

Вывод: **стековые тренажёры — SELECTION 700, блинные — PURE STRENGTH, бицепс — ARTIS
Arm Curl MK92EH (подтверждён снимком наклейки и формой крестообразной спинки), скамьи —
линия Element (коды `PA…`), гребной — Skillrow.**

## Что с чем сопоставлено

| Ключ | Термин | Замена |
|---|---|---|
| `cross` | Мультистанция (кроссовер) | Cable Station 8 `MQ0D` |
| `lat` | Lat machine | SELECTION 700 Lat Machine `MNLC` |
| `row` | Нижняя тяга сидя | SELECTION 700 Low Row `MNHC` |
| `chestpress` | Chest press | SELECTION 700 Chest Press `MNFC` |
| `pecdeck` | Бабочка и Reverse fly | SELECTION 700 Dual Pectoral Reverse Fly `MNNC` |
| `shoulder` | Жим над головой | PURE STRENGTH Shoulder Press `MG3500` |
| `legcurl` | Leg curl | SELECTION 700 Leg Curl `MNIC` |
| `legpress` | Жим ногами | SELECTION 700 Leg Press `MNAC` |
| `armcurl` | Arm Curl | ARTIS Arm Curl `MK92EH`, Diamond Black |
| `gravitron` | Kneeling Easy Chin Dip | Kneeling Easy Chin Dip `MB91` |
| `station15` | Стойка CHIN UP / DIP / LEG RAISE | Chin Up Dip Leg Raise `PA12` |
| `scott` | Скамья Скотта | PURE STRENGTH Scott Bench `PG06` |
| `bench` | Регулируемая скамья | Adjustable Bench `PA04`, кадр `__2` |
| `dumbbells` | Гантельный ряд | Dumbbells Complete Set `A000UDCS`, кадр `__1` |
| `light` | Лёгкие гантели | Chrome Dumbbell `KAA0-CD`, кадр `__1` |
| `cardio` | Эллипс, дорожка, велотренажёр | Excite Vario `DFF` |
| `skillrow` | Гребной Skillrow | не трогаем: там уже каталожный рендер |

## Замеченное попутно

`cardio.jpg` показывает не кардио-тренажёр, а чёрный тренажёр с валиками — снимок
не соответствует термину «Эллипс, дорожка, велотренажёр». Замена заодно чинит и это.

## Стандарт файла

Словарные снимки — 360 × 270 (4:3), JPEG, 9–20 КБ. Каталожный рендер приходит
квадратным 900 × 900 на белом фоне. Его **дополняют** до 4:3 белым, а не обрезают:

```sh
sips -p 900 1200 --padColor FFFFFF <файл>      # 900×900 → 1200×900, поля по бокам
sips --resampleWidth 360 -s formatOptions 62 <файл>
```

Первый заход делал центральный кроп 4:3 (`sips -c`) и срезал верх у высоких рам —
у Lat Machine уходила верхняя перекладина. Рендер снят так, что машина занимает кадр
целиком, обрезать там нечего.

## Где лежат готовые кандидаты

Шестнадцать подготовленных файлов 360 × 270 — в `docs/images/tg-candidates/`
(папка в `.gitignore`, в публичный репозиторий не уезжает). Там же `pairs.json`
(ключ → исходный рендер) и скрипты `fetch_tg.py` / `dl_tg.py`, которыми они добыты.
Страница сравнения «сейчас / предлагаю» по всем шестнадцати парам:
https://claude.ai/code/artifact/e1e20e69-18ca-4119-a194-5cfb185223e7

Нумерация строк на странице сравнения — по ней пользователь называет неподходящие:

| № | Ключ | № | Ключ |
|---|---|---|---|
| 01 | `armcurl` | 09 | `shoulder` |
| 02 | `chestpress` | 10 | `gravitron` |
| 03 | `pecdeck` | 11 | `station15` |
| 04 | `legpress` | 12 | `scott` |
| 05 | `legcurl` | 13 | `bench` |
| 06 | `lat` | 14 | `dumbbells` |
| 07 | `row` | 15 | `light` |
| 08 | `cross` | 16 | `cardio` |

Ставить в `assets/gym/` ещё нечего: ждём от пользователя номера строк, которые
не подходят.

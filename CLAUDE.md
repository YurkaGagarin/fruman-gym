# CLAUDE.md

The repository is written in English, the conversation is in Russian: the user writes in Russian and expects Russian replies. UI strings, test output and exercise data stay in Russian — quote them verbatim, never translate them in code.

## Where the rest is written down

- `README.md` — the file tree and the build commands, in Russian, for a human visitor.
- `HANDOFF.md` — who the user is, decisions not to reopen, how he communicates, and open tasks when there are any: what the
  code does not record. Outside git: the repository is public and the file carries personal
  detail. Read it when a session starts.
- `docs/device.md` — Web Inspector on the iPhone, and how to write a measurement or a check for the user's phone. Read it before any on-device run or instruction.
- `docs/research/` — the two studies this file points at: `audio-session-matrix.md` (signal
  and screen lock) and `gym-photos.md` (catalogue renders, which model is which machine).

## Build and checks

```bash
npm install              # once: installs jsdom, every check is written against it
python3 build.py         # rebuild index.html from the template and the data
npm test                 # all four suites; its exit code reflects only `audio` and crashes, read the summary lines below

node tests/basic.js      # startup, set marks, saving, switching days
node tests/edge.js       # broken data, storage failure, races, accessibility
node tests/progress.js   # automatic move to the next day
node tests/audio.js      # background signal: start inside a touch, behaviour in the background
```

The summary lines of all four suites at once, without scrolling the output:

```bash
for t in basic edge progress audio; do printf '%-9s ' "$t"; node tests/$t.js 2>&1 | grep -E 'провалов:|ошибок:' | tail -1; done
```

**Exit codes cannot be trusted:** `basic`, `edge` and `progress` exit with zero even when checks fail; only `audio` returns a non-zero code. The result has to be read by eye from the line starting «провалов: N» for `basic`, `edge`, `audio` and «ошибок: N» for `progress`.

### Writing a throwaway jsdom check

Put it in `tests/` next to the others, because `jsdom` does not resolve from anywhere else, and delete it once it has been run. Print what actually landed on the card — the attributes, the values, the classes, the text — and read that instead of assuming.

**A countdown cannot be waited out in a test.** Rest is 60 seconds and the suites run on real timers. Start the timer through the interface, then replace `win.Date.now` with a function returning an hour ahead: the next tick (every 200 ms) finds the phase over and runs the whole ending — signal, «готово», the return to the card. Restore `Date.now` immediately afterwards, the rest of the app reads the same clock.

Four mechanics that cost a run each: a top-level `const` never lands on `window`, so `win.GLOSS` is `undefined` and the script dies on its first line — read those names with `win.eval('GLOSS')`; without a `win.storage` mock in `beforeParse` the day never renders and every count comes back zero, which reads as a defect rather than as a broken harness; `getComputedStyle` does not resolve `var()` inside the `border` shorthand and returns `medium none`, so compare an element against the neighbour it is supposed to match instead of against an expected value; and a number changed in `data/` is usually written out in prose somewhere too — the page header promised «отдых 60–90 сек» long after no such rest existed, and no `grep` for `rest` would ever have shown it.

## How the build works

`index.html` is a build artefact and **must never be edited by hand**: any edit is overwritten by the next `python3 build.py`. The interface, the styles and the script live in `template.html`, the content lives in `data/*.py`.

`build.py` cuts only the `DAYS = [ … ]` literal out of `data/program.py` (ending at the first `]` in column 0; anything else in the file is ignored) and reads it through `ast.literal_eval`, executes `data/terms.py` through `exec`, and substitutes three placeholders in `template.html`:

- `__DAYS__` — the programme by day, from `DAYS`
- `__GLOSS__` — the glossary, from `TERMS`; an image key expands into the path `assets/gym/<key>.jpg`, and `ref:<key>` shows the start frame of the exercise illustration `assets/exercises/<key>`
- `__IMGKEYS__` — the list of illustration keys, collected from the file names in `assets/exercises/`

The tests read the built `index.html`, not the template. So an edit to `template.html` or `data/*.py` is invisible to the tests until the project is rebuilt.

### Exercise format in `data/program.py`

**Position is identity.** Set marks and the weight journal are keyed `day:index`, so inserting, removing or reordering an exercise hands every later card its neighbour's weight history; append at the end of the day, or migrate the journal. The number of set squares is the leading number of `l` (`parseInt`, 3 if there is none). A day is `{title, focus, ex}`, and `focus` gets glossary highlighting like a cue. Warm-ups form one block at the top of `ex`: the «Разминка» and «Тренировка» headers go in at the first of each, so a warm-up placed later lands under «Тренировка».

The keys are short: `n` — name, `l` — the sets line («4 × 8»), `c` — cue, `img` — illustration key from `assets/exercises/` without the frame suffix (`_0` start, `_1` finish) — see **Illustrations** below, `rest` — rest in seconds, `t` — countdown length for warm-ups and cardio, `hold` — hold, `iv` — intervals `[work, easy, rounds]`, `w: 1` — a warm-up exercise, `wt: 1` — a warm-up that still carries a weight, `nw: 1` — a strength exercise done with body weight only, so it gets no weight field, `s: 'ok'` — the machine is confirmed by its sticker (rule 2); a missing or any other value shows «? проверить в зале» on the card. A confirmed machine carries no label at all — the user asked for the mark only where something is wrong.

An exercise counts as a strength exercise (the one that gets set marks) when it has none of `w`, `t`, `iv` — this check is duplicated in the code and in the tests.

**`rest` cannot be set to nothing.** The countdown after a set mark starts as `e.rest || 60`, so `rest: 0` and a missing `rest` both give sixty seconds. A movement that should flow straight into the next one without a pause needs a new flag and a code change.

**The weight field is decided separately**, by `hasWeight()`: every strength exercise has one except those marked `nw: 1`, and so does a warm-up marked `wt: 1` — a warm-up set done on a stack machine, where the number set on the stack is worth remembering from one session to the next. `wt` changes nothing else: the card keeps its countdown button, stays under «Разминка», gets no set square and does not move the day's set count. The weight lands in the journal under the usual `day:index` key, so the placeholder, export and import pick it up with no extra code. In the full-screen card the countdown button then moves to its own line (`.extimer.full`) instead of squeezing in beside the input.

**The weight field holds today's entry only** — one record per exercise per date. At the start of a session it is therefore empty, which already read once as «журнал потерялся»; the previous weight is shown greyed out as the field's placeholder, and nowhere else on the card: a «прошлый раз N кг» button was removed at the user's request, since the placeholder already says it. The full history is behind «Показать весь журнал весов» at the bottom of the page. Never write a record the user did not type: prefilling the field with the last weight and saving it would fill the journal with days he never trained, and the journal keeps only the last 12 dates per exercise.

**A tap on the weight field clears it,** because iOS drops the caret wherever the finger lands. The handler sits on `focus` and `click` alike — a second tap on a focused field fires no focus event — and is idempotent, so the first tap firing both does not wipe the stash. The cleared value becomes the placeholder and returns on `blur` if nothing was typed. Only `input` writes to the journal. The full-screen `#exweight` is one reused element: its handlers are assigned as `onfocus`/`onclick`/`oninput`/`onblur` and nulled when unused, never stacked.

**Every journal write goes through `saveLog()`.** It is debounced by 400 ms, and `flushPending()` on `visibilitychange`/`pagehide` writes it at once when the app leaves the screen — a write that bypasses `saveLog()` loses that and can vanish when the app is swiped away. Section 13а of `tests/edge.js` covers it.

`nw: 1` removes the weight field and nothing else: the card keeps its set squares, its rest timer and its place in the day's set count — the plank and the reverse crunch are still three sets each. Use it for movements carrying body weight only; a counterweight machine is not one of them, the number set on the stack there is worth remembering even though a bigger number means an easier set. Section 10 of `tests/basic.js` walks all three days and compares the rendered field against the flags, so a new exercise that needs no weight fails the test until it is marked.

Mind the name collision: `w` on an exercise means warm-up, while `w` in a weight-journal entry is the weight itself.

**The cue `c` is one dry line**, parts separated by ` · `: how the machine is set, the metric to watch, the pace. Nothing else. Keep at least one glossary word in it — `basic` warns when the first card of the day has no clickable term left. Explanation, theory and drills belong in the glossary, which is one tap away from the highlighted word — a cue written as an encyclopedia entry has already been rewritten once. The cue must not repeat what the card already shows: the sets line and the timer button both display the duration. This applies to cues written or edited from now on; most existing cues are several sentences and stay as they are until the user asks.

### Illustrations

The two frames under `assets/exercises/` come from `yuhonas/free-exercise-db` (public domain, 876 exercises, the same photo studio throughout) — that is where to look first for a new movement, and staying inside that one set is what keeps the cards a single visual system.

**The card must show the machine that is actually in the gym.** A generic illustration of the right movement on the wrong machine has already failed the user in the gym: he looks for the machine in the picture. Branded machines (this gym is Technogym) exist in no open exercise set. The manufacturer's own catalogue renders may be used — Technogym gave permission; how to pull them, and which model answers to which machine in this gym, is written down in `docs/research/gym-photos.md`. When neither the open set nor the catalogue has the real machine, use the gym photo from `assets/gym/` instead: copy it into `assets/exercises/` under a new key as both `_0` and `_1`. The frame is `aspect-ratio: 4/3`, so a 4:3 photo fits with no letterboxing. The cost is that the card loses its start-finish flip, and the `alt` text still says «начальная фаза» / «конечная фаза» for what is one picture.

The whole set is one JSON file — `raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`, with name, equipment, muscles and frame paths for each entry — so searching it for a replacement movement is a single request, and the frames themselves come from `.../main/exercises/<id>/0.jpg` and `1.jpg`.

A frame brought in from the open set is normalised before it is committed: `sips --resampleWidth 320` and a re-encode at quality ~62, which lands it beside the others at 320 px wide and 5–15 KB. A raw download is 850 px and twice the weight, and the cards are served over a phone connection.

The build collects keys from the file names (`IMG_KEYS` in `build.py` strips the last six characters), so any new key works with no other edit. **A key is in use if it appears in `data/program.py` or in `data/terms.py`:** a glossary term illustrates itself with `ref:<key>`, which points at the same frames — that is why `Cable_Crossover` and `Leg_Press`, on no card at all, must stay: a check against `DAYS` alone would call them orphans. Dropping `img` altogether is not the answer: every exercise has an illustration, and a card without a frame is the only one of its kind on the screen.

### Term format in `data/terms.py`

A tuple `(key, title, explanation, image key or None, [patterns])`. The patterns are regular expressions that highlight the term inside the card text; `\w` in them is replaced by a character class that includes Cyrillic. Matching ignores case, and the patterns of all terms are tried longest first, so where two terms' patterns overlap the longer pattern takes the word.

Terms are highlighted in the cue and in the day's focus text, **never in a card name**: a highlighted term is a `<button>`, and inside `.name` it broke the title's colour, size and typeface on iOS. So a name carries no clickable word — keep the term the card needs in its cue instead, and note that each term highlights only once per day, first occurrence wins.

A pattern must belong to one term only: the same pattern on two terms makes `whichTerm()` resolve by list order, so the highlighted word opens whichever term comes first.

A glossary photo is 360 × 270 (4:3), JPEG, 7–20 KB. A term with its own image key gets `object-fit: cover` on its card automatically — `openTerm()` in `template.html` sets it; a `ref:` term shows that exercise's start frame, uncropped. A catalogue render arrives square on white: pad it to 4:3 with white (`sips -p <h> <w> --padColor FFFFFF`) rather than crop it — cropping a square render takes the top off a tall machine — then `--resampleWidth 360`.

A bare `http(s)://` address inside the explanation becomes a link when the term card is opened; the visible label is the domain. That is the only markup allowed in an explanation — everything else is escaped.

## Rules learned the hard way

1. **Run all four test suites after any change.**
2. **Machines are identified only by the sticker on the machine itself,** never by how they look — that mistake has been made twice already. The reference is the text on the sticker (LEG PRESS, LAT MACHINE, ARM CURL, KNEELING EASY CHIN DIP, PECTORAL / REVERSE FLY), not the machine number. No sticker in the photo — ask for a photo of the sticker instead of guessing. **Posture is asked about, not read off a photograph.** The sticker's seating pictogram and a catalogue photo of the same model (see `docs/research/gym-photos.md`) show the hardware, not which way the user faces: on the Arm Curl a pad, a headrest and two side pads read as a preacher bench from the front and as a backrest from behind, and the wrong reading was published once already. Use the photographs to name the parts, and ask the user for the one sentence that says which of them his back, head and arms touch. Read a gym photo zoomed: there is no `PIL` on this machine, `sips -c <h> <w> --cropOffset <top> <left>` followed by `--resampleWidth` is what makes a sticker pictogram legible.
3. **Never inline images into `index.html`;** they stay as files in `assets/`. As base64 the file weighed 2.1 MB and the preview cut it off in the middle of the script.
4. **The repository is public:** no recognisable bystanders in the gym photos.
5. **Check the programme's numbers and facts against authoritative sources** before entering them.
6. **The four suites do not see the interface.** They check behaviour, not layout: a highlighted term wrecking a card title and a weight field that looked empty were both found by the user on the phone while all four suites were green. After any change to the interface, write a throwaway jsdom check (see **Writing a throwaway jsdom check**) and read what it prints.
7. **The order of the fixed layers is load-bearing:** exercise card 42, timer bar 44, full-screen countdown 45, glossary sheet 50. Anything new that is `position: fixed` picks its number inside this scale deliberately, and while the bar is on screen the card needs its bottom padding (`.exview.withbar`) or the bar covers «Назад» and «Следующее упражнение». Section 11 of `tests/basic.js` reads the four numbers out of the built CSS and fails if the order breaks.
8. **The countdown returns to the card it was started from.** `armReturn(i)` records the exercise and the day at all four places a timer can start — the card's own button and set marks, the list's warm-up and hold buttons — and `returnToEx()` opens that card when the last phase runs out. In the gym the next thing needed is the next set, not the place in the list where the phone was left. It stays put when the day has been switched meanwhile or the right card is already open, and **«Стоп» never navigates**: that is a deliberate exit.
9. **One visual system: nothing new may look different from what is already on the screen.** The same kind of element carries the same typeface, case, size and colour on every card — before adding or renaming anything, look at the cards next to it, and if the change makes one card stand out, it is a defect, not a style.
10. **The «done» border is driven by the marks array, and warm-ups are marked by the clock.** A card gets `.done` when its `state['<day>:<index>']` array is non-empty and every element is true. Strength exercises fill it by tapping set squares; warm-up, cardio and interval cards have no squares, so `markTimedDone()` fills theirs when their countdown reaches its end — and only then. «Стоп» never marks: a warm-up abandoned halfway is not a warm-up done. The trap this walked into: `markedSets()` sums every array in `state`, while `totalSets()` counts strength exercises only, so the first marked warm-up read as «отмечено 26 из 23 подходов». Both now filter on the same condition (`!e.w && !e.t && !e.iv`); change one and the other has to change with it.

## Platform constraints that shape the code

The app lives on an iPhone as a home screen icon, and the shell is WebKit.

- **The primary path to the signal is keeping the screen on.** Rest runs with `wakeLock` held, requested by `keepAwake()` when a countdown starts. The system drops the lock when the app goes to the background, and nothing re-requests it on return — WebKit grants it only inside a touch — so after leaving mid-rest the screen is held again only from the next countdown. The audio session type is set to `transient` when the countdown starts (`playback` instead while the background track runs) and returned to `SESS_IDLE` (`'auto'`) by `stopTimer()`: on «Стоп», or 6 s after the countdown ends. `transient` plays over someone else's music without pausing it; it stays silent in the background, but that is not needed — the app remains on screen. Verified on the device — signal, music left playing, screen held, speaker, headphones and loudness in the gym — so it needs no re-measuring; see `docs/research/audio-session-matrix.md`.
- **A gesture is mandatory both for sound and for the screen lock.** WebKit rejects `navigator.wakeLock.request()` with `NotAllowedError` outside a user gesture, even though the W3C specification has no such requirement; an `AudioContext` will not come up outside a gesture either. From the Web Inspector console both calls give a false negative — they can only be measured from inside a touch.
- **The stalled `AudioContext`.** After switching to another app and back, the context stays in state `running` while `currentTime` stands still and the speaker is silent; `resume()` does not help. The only cure is `close()` plus a new context, reliably so inside a touch. That is why the countdown always starts with a fresh context (`audioReady(true)` in `startPhases`), and `beep()` detects the stopped clock and recreates the context itself.
- **The background track is a switched-off fallback.** A WAV of «silence of the right length plus the signals» behind the `cfg().bg` toggle, with the session type hard-wired to `playback`: only that type keeps playing after a switch to another app, at the cost of pausing other music for the whole rest period. The track must be started inside a touch and must not be stopped when the tab is hidden — WebKit does not allow playback to start on an already-hidden page, and `play()` is rejected silently. While the track is playing, `beep()` does not duplicate its sound. **Off by default**, and it should stay off: silence instead of music on every rest period is worse than having no signal in the background.
- **The second path to a signal in the background** is `fireExternal()`: hand the countdown to the system timer through the Shortcuts app (`cfg().ext`, also off by default). The system timer rings with the screen locked and only ducks the music.
- **Notifications.** Web Push for home screen apps exists on iOS from version 16.4, so the platform allows them. The project has no `manifest.json`, no service worker and no scheduling server, so the path is closed by our own technical debt, not by WebKit.
- **The home screen cache.** The icon serves the page it loaded earlier, so a new build is tested only after the app is swiped out of the app switcher and reopened; see **Publishing**.
- **The file preview inside the Claude chat has neither network nor persistent storage.** Weights are only saved on the published site.
- **Browser storage** is unavailable to pages served from the `file:` scheme — saving weights can only be checked over `https://`.

## Publishing

GitHub Pages, repository `YurkaGagarin/fruman-gym`, branch `main`, folder `/ (root)`. What gets published is `index.html` together with the `assets` folder — the images are separate files.

Pages does not rebuild instantly: right after a push the site still serves the previous build for a few dozen seconds. Check for a string from the new build, and check any new file under `assets/` separately — a fresh `index.html` with a missing image gives a broken card on the phone.

A confirmed publication is not yet a visible change on the phone. The app sits on the home screen as a web clip with its own cache, and Pages sends `cache-control: max-age=600` on top of that, so the old page can keep showing for minutes after the check over HTTP has passed. When the user reports that a change is missing, verify the live file first, and only then treat it as a cache: swiping the app out of the task switcher and reopening it is what usually clears it; opening the address in Safari with a `?v=N` parameter is the fallback.

## Communication

A yes/no question starts with «yes» or «no». Say what changed — restating the work and explaining what things are for are both unasked. A useful observation goes in one line at the end, and only when it changes a decision. When there is any doubt about the task, ask instead of filling the gap with a guess.

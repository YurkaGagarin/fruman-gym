# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The repository is written in English, the conversation is in Russian: the user writes in Russian and expects Russian replies. UI strings, test output and exercise data stay in Russian — quote them verbatim, never translate them in code.

## Build and checks

```bash
npm install              # once: installs jsdom, every check is written against it
python3 build.py         # rebuild index.html from the template and the data
npm test                 # all four suites in a row

node tests/basic.js      # startup, set marks, saving, switching days
node tests/edge.js       # broken data, storage failure, races, accessibility
node tests/progress.js   # automatic move to the next day
node tests/audio.js      # background signal: start inside a touch, behaviour in the background
```

The summary lines of all four suites at once, without scrolling the output:

```bash
for t in basic edge progress audio; do printf '%-9s ' "$t"; node tests/$t.js 2>&1 | grep -E 'провалов:|ошибок:' | tail -1; done
```

**Exit codes cannot be trusted:** `basic`, `edge` and `progress` exit with zero even when checks fail; only `audio` returns a non-zero code. The result has to be read by eye from the last line: «провалов: N» for `basic`, `edge`, `audio` and «ошибок: N» for `progress`.

## How the build works

`index.html` is a build artefact and **must never be edited by hand**: any edit is overwritten by the next `python3 build.py`. The interface, the styles and the script live in `template.html`, the content lives in `data/*.py`.

`build.py` reads `data/program.py` through `ast.literal_eval`, executes `data/terms.py` through `exec`, and substitutes three placeholders in `template.html`:

- `__DAYS__` — the programme by day, from `DAYS`
- `__GLOSS__` — the glossary, from `TERMS`; an image key expands into the path `assets/gym/<key>.jpg`, and `ref:<key>` into a link to another term
- `__IMGKEYS__` — the list of illustration keys, collected from the file names in `assets/exercises/`

The tests read the built `index.html`, not the template. So an edit to `template.html` or `data/*.py` is invisible to the tests until the project is rebuilt.

### Exercise format in `data/program.py`

The keys are short: `n` — name, `l` — the sets line («4 × 8–12»), `c` — cue, `img` — illustration key from `assets/exercises/` without the frame suffix (`_0` start, `_1` finish), `rest` — rest in seconds, `t` — duration for cardio, `hold` — hold, `iv` — intervals `[work, easy, rounds]`, `w: 1` — a warm-up exercise, `wt: 1` — a warm-up that still carries a weight.

An exercise counts as a strength exercise (the one that gets set marks) when it has none of `w`, `t`, `iv` — this check is duplicated in the code and in the tests.

**The weight field is decided separately**, by `hasWeight()`: every strength exercise has one, and so does a warm-up marked `wt: 1` — a warm-up set done on a stack machine, where the number set on the stack is worth remembering from one session to the next. `wt` changes nothing else: the card keeps its countdown button, stays under «Разминка», gets no set square and does not move the day's set count. The weight lands in the journal under the usual `day:index` key, so history, «прошлый раз», export and import pick it up with no extra code. In the full-screen card the countdown button then moves to its own line (`.extimer.full`) instead of squeezing in beside the input.

**The weight field holds today's entry only** — one record per exercise per date. At the start of a session it is therefore empty, which already read once as «журнал потерялся»; the previous weight is shown greyed out as the field's placeholder and in full behind the «прошлый раз N кг» button. Never write a record the user did not type: prefilling the field with the last weight and saving it would fill the journal with days he never trained, and the journal keeps only the last 12 dates per exercise.

**A tap on the weight field clears it.** iOS drops the caret wherever the finger lands, which made correcting a number already in the field awkward. The clearing hangs on `focus` **and** on `click`, because a second tap on a field that never lost focus fires no focus event at all — the keyboard stays up and only the caret moves, which is exactly the case the change was made for. The handler is idempotent: it does nothing when the field is already empty, so the two events firing together on the first tap do not wipe the stashed value. Clearing sets the value it held as the placeholder, so the greyed-out number is always what comes back if nothing is typed; on `blur` without any `input` event since the last clearing the value is restored. The journal is never touched by focus or blur — only an `input` event writes, so typing overwrites today's record and clearing the field by hand still deletes it. Both weight inputs behave this way, the one on the card and `#exweight` in the full-screen view; the full-screen one is a single reused element, so its handlers are assigned as `onfocus`/`oninput`/`onblur` and nulled in the `else` branch rather than stacked with `addEventListener`.

Mind the name collision: `w` on an exercise means warm-up, while `w` in a weight-journal entry is the weight itself.

**The cue `c` is one dry line**, parts separated by ` · `: how the machine is set, the metric to watch, the pace. Nothing else. Keep at least one glossary word in it — `basic` warns when the first card of the day has no clickable term left. Explanation, theory and drills belong in the glossary, which is one tap away from the highlighted word — a cue written as an encyclopedia entry has already been rewritten once. The cue must not repeat what the card already shows: the sets line and the timer button both display the duration.

### Term format in `data/terms.py`

A tuple `(key, title, explanation, image key or None, [patterns])`. The patterns are regular expressions that highlight the term inside the card text; `\w` in them is replaced by a character class that includes Cyrillic.

Terms are highlighted in the cue and in the day's focus text, **never in a card name**: a highlighted term is a `<button>`, and inside `.name` it broke the title's colour, size and typeface on iOS. So a name carries no clickable word — keep the term the card needs in its cue instead, and note that each term highlights only once per day, first occurrence wins.

A pattern must belong to one term only: the same pattern on two terms makes `whichTerm()` resolve by list order, so the highlighted word opens whichever term comes first.

A bare `http(s)://` address inside the explanation becomes a link when the term card is opened; the visible label is the domain. That is the only markup allowed in an explanation — everything else is escaped.

## Rules learned the hard way

1. **Run all four test suites after any change.** They have already caught a variable used before initialisation, the whole app crashing on a single broken journal entry, and the timer drifting out of sync with the set mark.
2. **Machines are identified only by the sticker on the machine itself,** never by how they look — that mistake has been made twice already. The reference is the text on the sticker (LEG PRESS, LAT MACHINE, ARM CURL, KNEELING EASY CHIN DIP, PECTORAL / REVERSE FLY), not the machine number. No sticker in the photo — ask for a photo of the sticker instead of guessing.
3. **Never inline images into `index.html`.** When they were stored as base64 the file weighed 2.1 MB and the preview cut it off in the middle of the script. It is 89 KB now.
4. **The repository is public:** no recognisable bystanders in the gym photos.
5. **Check the programme's numbers and facts against authoritative sources** before entering them.
6. **One visual system: nothing new may look different from what is already on the screen.** The same kind of element carries the same typeface, case, size and colour on every card — before adding or renaming anything, look at the cards next to it, and if the change makes one card stand out, it is a defect, not a style. The trap that caught it: a name beginning with a glossary term turns the first words of the title into an orange dotted button, while the titles around it stay plain.

## Platform constraints that shape the code

The app lives on an iPhone as a home screen icon, and the shell is WebKit. Hence the non-obvious decisions in `template.html`:

- **The primary path to the signal is keeping the screen on.** Rest runs with `wakeLock` held; the audio session type is set to `transient` when the countdown starts and returned to `auto` when it ends. `transient` plays over someone else's music without pausing it; it stays silent in the background, but that is not needed — the app remains on screen. Measured on iOS 26.3 and confirmed by a field run on 10 September 2026: the triple signal at the end of rest plays, other music is not interrupted, the screen does not go dark with auto-lock set to 30 seconds. Verified both through the speaker and through headphones; the only open question left is whether the signal is loud enough in a noisy gym. See `docs/research/audio-session-matrix.md`.
- **A gesture is mandatory both for sound and for the screen lock.** WebKit rejects `navigator.wakeLock.request()` with `NotAllowedError` outside a user gesture, even though the W3C specification has no such requirement; an `AudioContext` will not come up outside a gesture either. From the Web Inspector console both calls give a false negative — they can only be measured from inside a touch.
- **The stalled `AudioContext`.** After switching to another app and back, the context stays in state `running` while `currentTime` stands still and the speaker is silent; `resume()` does not help. The only cure is `close()` plus a new context, reliably so inside a touch. That is why the countdown always starts with a fresh context (`audioReady(true)` in `startPhases`), and `beep()` detects the stopped clock and recreates the context itself.
- **The background track is a switched-off fallback.** A WAV of «silence of the right length plus the signals» behind the `cfg().bg` toggle, with the session type hard-wired to `playback`: only that type keeps playing after a switch to another app, at the cost of pausing other music for the whole rest period. The track must be started inside a touch and must not be stopped when the tab is hidden — WebKit does not allow playback to start on an already-hidden page, and `play()` is rejected silently. While the track is playing, `beep()` does not duplicate its sound. **Off by default**, and it should stay off: silence instead of music on every rest period is worse than having no signal in the background.
- **The second path to a signal in the background** is `fireExternal()`: hand the countdown to the system timer through the Shortcuts app (`cfg().ext`, also off by default). The system timer rings with the screen locked and only ducks the music.
- **Notifications.** Web Push for home screen apps on iOS exists from version 16.4 — the earlier note saying «notifications are unavailable» was wrong. But the project has no `manifest.json`, no service worker and no scheduling server, so the path is closed for technical reasons, not by the platform.
- **The home screen cache.** An app launched from the icon holds on to the page it loaded earlier. Before testing a new build on the device it has to be closed from the app switcher and opened again — otherwise the old code is what gets tested.
- **The set mark in a card is a square,** not a circle — worth knowing when writing step-by-step instructions for the phone.
- **The file preview inside the Claude chat has neither network nor persistent storage.** Weights are only saved on the published site.
- **Browser storage** is unavailable to pages served from the `file:` scheme — saving weights can only be checked over `https://`.

## Debugging on the device

Safari Web Inspector gives a console into the live app opened from the home screen. It is the only way to see the real `actx.state`, `navigator.audioSession.type` and the actual reason for a rejection instead of guessing.

On the iPhone: Settings → Apps → Safari → Advanced → Web Inspector (on iOS 18 and later, per-app settings live under «Apps»). Connect by cable, unlock the phone, answer «Trust».

On the Mac: Safari → Settings → Advanced → «Show features for web developers», then in the menu bar Develop → the iPhone's name → the app's entry. The app has to be in the foreground at the moment of connecting; the connection survives backgrounding but breaks when the app is closed from the switcher.

The console has access to the script's top-level names: `cfg()`, `actx`, `wake`, `bgAudio`, `bgUrl`, `beep()`, `startTimer()`. Any measurement that needs a gesture must be wrapped in a one-shot handler on `touchend` and `click` in the capture phase, otherwise the result is false.

## Testing on the device

**A measurement is written out step by step, an ordinary check is not.** A measurement — anything where an omitted step invalidates the result: audio and `wakeLock` runs, a Web Inspector session, a console command, a protocol that has to be repeated identically later. There nothing is left implied: what has to be playing, whether the timer needs starting by hand, exactly where to tap, what to listen for, what not to touch.

A check of a published change is the opposite: name what to look at and what would count as wrong, in a few lines. The user knows his own app — «посмотри карточку 03 во втором дне: под кнопкой отсчёта должна быть строка с весом» is the right size, a numbered list of taps is not. The one step worth keeping even here is closing the app from the switcher, because the icon serves the old page. Full detail on a practical check only when the user asks for it.

Phone settings that affect the measurements: auto-lock is normally set to «Никогда» (it has to be set to 30 seconds to prove that the screen is being held), Low Power Mode is off, and the default browser is Chrome. The last one does not affect debugging — an app launched from the icon runs in the system WebKit, and that is exactly what Web Inspector attaches to.

## Publishing

GitHub Pages, repository `YurkaGagarin/fruman-gym`, branch `main`, folder `/ (root)`. What gets published is `index.html` together with the `assets` folder — the images are separate files.

Pages does not rebuild instantly: right after a push the site still serves the previous build for a few dozen seconds. Check for a string from the new build, and check any new file under `assets/` separately — a fresh `index.html` with a missing image gives a broken card on the phone.

## Communication

Short and to the point: the answer first, the details after. A yes/no question starts with «yes» or «no». Do not restate what was done and do not explain what things are for unless asked. When there is any doubt about the task, ask instead of filling the gap with a guess.

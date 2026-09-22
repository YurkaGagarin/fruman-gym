# Work on the device

What the project's `CLAUDE.md` does not carry every session: attaching a console to the live app, and writing measurements and checks for the user's phone. What the console names mean and which calls work only inside a touch: `CLAUDE.md`, «Platform constraints that shape the code», and `docs/research/audio-session-matrix.md`. «The switcher» below is the iOS app switcher: swiping the app away there closes it.

## Debugging on the device

Safari Web Inspector gives a console into the live app opened from the home screen. It is the only way to see the real `actx.state`, `navigator.audioSession.type` and the actual reason for a rejection instead of guessing.

On the iPhone: Settings → Apps → Safari → Advanced → Web Inspector (on iOS 18 and later, per-app settings live under «Apps»). Connect by cable, unlock the phone, answer «Trust».

On the Mac: Safari → Settings → Advanced → «Show features for web developers», then in the menu bar Develop → the iPhone's name → the app's entry. The app has to be in the foreground at the moment of connecting; the connection survives backgrounding but breaks when the app is closed from the switcher.

The console has access to the script's top-level names: `cfg()`, `actx`, `wake`, `bgAudio`, `bgUrl`, `beep()`, `startTimer()`. Any measurement that needs a gesture must be wrapped in a one-shot handler on `touchend` and `click` in the capture phase, otherwise the result is false.

## Testing on the device

**A measurement is written out step by step, an ordinary check is not.** A measurement — anything where an omitted step invalidates the result: audio and `wakeLock` runs, a Web Inspector session, a console command, a protocol that has to be repeated identically later. There nothing is left implied: what has to be playing, whether the timer needs starting by hand, exactly where to tap, what to listen for, what not to touch.

A check of a published change is the opposite: name what to look at and what would count as wrong, in a few lines. The user knows his own app — «посмотри карточку 03 во втором дне: под кнопкой отсчёта должна быть строка с весом» is the right size, a numbered list of taps is not. The one step worth keeping even here is closing the app from the switcher, because the icon serves the old page. Full detail on a practical check only when the user asks for it.

Phone settings that affect the measurements: auto-lock is normally set to «Никогда» (it has to be set to 30 seconds to prove that the screen is being held), Low Power Mode is off. The set mark in a card is a square, not a circle.

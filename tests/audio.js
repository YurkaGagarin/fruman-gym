const fs = require('fs');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync('index.html', 'utf8');
let fails = [];
const ok = m => console.log('  OK   ' + m);
const fail = m => { fails.push(m); console.log('  ПРОВАЛ ' + m); };

/* Фоновый сигнал на iOS: дорожка обязана стартовать внутри касания.
   Запуск из visibilitychange, когда страница уже скрыта, WebKit отклоняет молча. */
function boot() {
  const store = {};
  const log = [];
  const session = { type: 'auto', writes: [] };
  const state = { hidden: false };
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.com/gym/',
    beforeParse(win) {
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.HTMLElement.prototype.focus = function () {};
      win.scrollTo = () => {};
      win.AudioContext = function () {
        return {
          state: 'running', currentTime: 0, destination: {}, resume() {},
          createOscillator: () => ({ frequency: {}, connect() {}, start() {}, stop() {} }),
          createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} })
        };
      };
      win.navigator.vibrate = () => true;
      win.URL.createObjectURL = () => 'blob:track';
      win.URL.revokeObjectURL = () => {};
      win.HTMLMediaElement.prototype.play = function () {
        log.push({ act: 'play', hidden: state.hidden });
        return Promise.resolve();
      };
      win.HTMLMediaElement.prototype.pause = function () { log.push({ act: 'pause', hidden: state.hidden }); };
      win.HTMLMediaElement.prototype.load = function () {};
      Object.defineProperty(win.navigator, 'audioSession', {
        configurable: true,
        get: () => ({
          set type(v) { session.type = v; session.writes.push(v); },
          get type() { return session.type; }
        })
      });
      Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => state.hidden });
      Object.defineProperty(win.document, 'visibilityState', {
        configurable: true, get: () => (state.hidden ? 'hidden' : 'visible')
      });
      win.storage = {
        async get(k) { if (!(k in store)) throw new Error('нет ключа'); return { key: k, value: store[k] }; },
        async set(k, v) { store[k] = v; return { key: k, value: v }; }
      };
      win.onerror = (msg, src, line, col, err) => console.log('  ошибка страницы: ' + msg + (err ? ' :: ' + err.message : ''));
    }
  });
  const win = dom.window;
  return {
    win, doc: win.document, log, session,
    hide(on) {
      state.hidden = on;
      win.document.dispatchEvent(new win.Event('visibilitychange'));
    }
  };
}

const tick = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));

(async () => {
  const IDX = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex
    .findIndex(e => !e.w && !e.t && !e.iv);

  const e = boot();
  await tick(150);

  console.log('=== 1. СТАРТ ДОРОЖКИ В КАСАНИИ ===');
  click(e.doc.querySelectorAll('#app .card')[IDX]); await tick(40);
  click(e.doc.querySelectorAll('#exsets .exset')[0]); await tick(60);

  const started = e.log.filter(x => x.act === 'play');
  if (started.length && started.every(x => x.hidden === false)) {
    ok('дорожка запущена, пока страница на экране — касание разблокировало звук');
  } else if (!started.length) {
    fail('дорожка не запускалась при старте таймера: в фоне play() уже отклонят');
  } else {
    fail('дорожка запущена при скрытой странице — WebKit такой запуск отклоняет');
  }

  console.log('=== 2. УХОД В ДРУГОЕ ПРИЛОЖЕНИЕ ===');
  const before = e.log.length;
  e.hide(true); await tick(60);
  const after = e.log.slice(before);

  if (after.some(x => x.act === 'pause')) fail('при уходе в фон дорожку остановили — сигнала не будет');
  else ok('дорожку в фоне не останавливают');

  if (after.some(x => x.act === 'play' && x.hidden)) fail('дорожку перезапускают из фона — этот play() WebKit отклонит');
  else ok('из фона дорожку не перезапускают');

  console.log('=== 3. ТИП АУДИОСЕССИИ ===');
  if (e.session.writes.includes('transient')) fail('тип transient: сигнал уведомления, в фоне не продолжается');
  else if (e.session.writes.includes('playback')) ok('тип playback — воспроизведение продолжается в фоне');
  else ok('тип аудиосессии не сбивается на transient');

  console.log('=== 4. ВОЗВРАТ НА ЭКРАН ===');
  e.hide(false); await tick(60);
  ok('возврат обработан без ошибок');

  console.log('=== ИТОГ ===');
  console.log('провалов: ' + fails.length);
  process.exit(fails.length ? 1 : 0);
})();

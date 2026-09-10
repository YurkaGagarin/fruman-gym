const fs = require('fs');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync('index.html', 'utf8');
let fails = [];
const ok = m => console.log('  OK   ' + m);
const fail = m => { fails.push(m); console.log('  ПРОВАЛ ' + m); };

/* Фоновый сигнал на iOS: дорожка обязана стартовать внутри касания.
   Запуск из visibilitychange, когда страница уже скрыта, WebKit отклоняет молча.
   Но играющая дорожка занимает аудиосессию и ставит музыку на паузу,
   поэтому она под переключателем и по умолчанию выключена. */
function boot() {
  const store = {};
  const log = [];
  const session = { type: 'auto', writes: [] };
  const state = { hidden: false, tones: 0, contexts: 0, closed: 0, locks: 0, issued: [] };
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.com/gym/',
    beforeParse(win) {
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.HTMLElement.prototype.focus = function () {};
      win.scrollTo = () => {};
      win.AudioContext = function () {
        state.contexts++;
        return {
          state: 'running', currentTime: 0, destination: {}, resume() {}, close() { state.closed++; },
          createOscillator: () => { state.tones++; return { frequency: {}, connect() {}, start() {}, stop() {} }; },
          createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} })
        };
      };
      win.navigator.vibrate = () => true;
      Object.defineProperty(win.navigator, 'wakeLock', {
        configurable: true,
        get: () => ({
          request: async () => {
            const lock = { type: 'screen', released: false, release() { this.released = true; } };
            state.locks++; state.issued.push(lock); return lock;
          }
        })
      });
      win.URL.createObjectURL = () => 'blob:track';
      win.URL.revokeObjectURL = () => {};
      win.HTMLMediaElement.prototype.play = function () {
        log.push({ act: 'play', hidden: state.hidden });
        Object.defineProperty(this, 'paused', { configurable: true, get: () => false });
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
    win, doc: win.document, log, session, state, store,
    hide(on) {
      state.hidden = on;
      if (on) state.issued.forEach(l => { l.released = true; });
      win.document.dispatchEvent(new win.Event('visibilitychange'));
    }
  };
}

const tick = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));

const IDX = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex
  .findIndex(e => !e.w && !e.t && !e.iv);

async function markSet(e) {
  click(e.doc.querySelectorAll('#app .card')[IDX]); await tick(40);
  click(e.doc.querySelectorAll('#exsets .exset')[0]); await tick(60);
}

(async () => {
  console.log('=== 1. ПО УМОЛЧАНИЮ: МУЗЫКА НЕ СТРАДАЕТ ===');
  const a = boot();
  await tick(150);
  if (a.doc.getElementById('bgToggle').getAttribute('aria-pressed') === 'false') ok('переключатель фонового сигнала выключен');
  else fail('переключатель включён по умолчанию — музыка встанет на паузу без спроса');

  await markSet(a);
  if (a.log.some(x => x.act === 'play')) fail('дорожка играет при выключенном переключателе — аудиосессия занята зря');
  else ok('дорожка не запускается, аудиосессия свободна');
  if (a.state.tones > 0) ok('на экране сигнал звучит как раньше, через веб-аудио');
  else fail('на экране пропал звук таймера');

  console.log('=== 2. ПЕРЕКЛЮЧАТЕЛЬ ВКЛЮЧЁН: СТАРТ В КАСАНИИ ===');
  const b = boot();
  await tick(150);
  click(b.doc.getElementById('bgToggle')); await tick(40);
  if (b.doc.getElementById('bgToggle').getAttribute('aria-pressed') === 'true') ok('переключатель включился');
  else fail('переключатель не включается');

  await markSet(b);
  const started = b.log.filter(x => x.act === 'play');
  if (started.length && started.every(x => x.hidden === false)) ok('дорожка запущена, пока страница на экране — касание разблокировало звук');
  else if (!started.length) fail('дорожка не запускалась при старте таймера: в фоне play() уже отклонят');
  else fail('дорожка запущена при скрытой странице — WebKit такой запуск отклоняет');

  console.log('=== 3. УХОД В ДРУГОЕ ПРИЛОЖЕНИЕ ===');
  const before = b.log.length;
  b.hide(true); await tick(60);
  const after = b.log.slice(before);
  if (after.some(x => x.act === 'pause')) fail('при уходе в фон дорожку остановили — сигнала не будет');
  else ok('дорожку в фоне не останавливают');
  if (after.some(x => x.act === 'play' && x.hidden)) fail('дорожку перезапускают из фона — этот play() WebKit отклонит');
  else ok('из фона дорожку не перезапускают');

  console.log('=== 4. ТИП АУДИОСЕССИИ ===');
  /* Два разных источника звука — два разных типа. На экране сигнал даёт веб-аудио
     и объявляется transient: звучит поверх чужой музыки, не ставя её на паузу.
     Дорожке для фона нужен playback, и она за это платит паузой в музыке. */
  if (a.session.writes.includes('transient')) ok('без дорожки объявлен transient — сигнал не прерывает чужую музыку');
  else fail('без дорожки тип не transient: сигнал либо не прозвучит, либо остановит музыку');
  if (a.session.writes.includes('playback')) fail('без дорожки объявлен playback — чужая музыка встанет на паузу зря');
  else ok('playback без дорожки не объявляется');
  if (b.session.writes.includes('playback')) ok('с дорожкой объявлен playback — воспроизведение продолжается в фоне');
  else fail('с дорожкой тип не playback, в фоне звук может не продолжиться');

  console.log('=== 5. СЕССИЯ ВОЗВРАЩАЕТСЯ СИСТЕМЕ ===');
  /* Страница, оставшаяся помеченной playback, ставит чужую музыку на паузу
     при каждом возврате в приложение — этим отличался прежний код. */
  const c = boot();
  await tick(150);
  await markSet(c);
  click(c.doc.getElementById('tstop')); await tick(40);
  if (c.session.type === 'auto') ok('после отсчёта тип сессии возвращён в auto');
  else fail('после отсчёта страница осталась с типом ' + c.session.type + ' — вернётся и оборвёт чужую музыку');

  console.log('=== 6. КОНТЕКСТ И БЛОКИРОВКА ЭКРАНА ===');
  /* На iOS контекст возвращается из фона в состоянии running с остановившимся
     currentTime: resume() его не чинит, помогает только пересоздание, и только
     внутри касания. Старт отсчёта — единственное такое место. */
  const d = boot();
  await tick(150);
  const ctxBefore = d.state.contexts;
  await markSet(d);
  if (d.state.contexts > ctxBefore) ok('отсчёт стартует со свежим аудиоконтекстом');
  else fail('контекст не пересоздан на старте — после возврата из фона сигнал будет молчать');
  if (d.state.locks > 0) ok('блокировка экрана запрошена при старте отсчёта');
  else fail('блокировка экрана не запрашивается — экран погаснет посреди отдыха');
  const locksBefore = d.state.locks;
  d.hide(true); await tick(40);          // система снимает блокировку сама
  d.hide(false); await tick(40);
  d.win.startTimer(60, 'отдых'); await tick(40);
  if (d.state.locks > locksBefore) ok('снятую системой блокировку запрашивают заново');
  else fail('после снятия блокировки повторный запрос не уходит — экран погаснет');

  console.log('=== 7. НАСТРОЙКА ПЕРЕЖИВАЕТ ПЕРЕЗАПУСК ===');
  b.hide(false);
  await tick(600);                       // saveLog пишет с задержкой в 400 мс
  const raw = b.store['weightlog:v1'] || b.win.localStorage.getItem('weightlog_v1') || '{}';
  const saved = JSON.parse(raw);
  if (saved.__cfg && saved.__cfg.bg === true) ok('выбор сохранён в журнале настроек');
  else fail('выбор не сохранился, после перезапуска переключатель сбросится');

  console.log('=== ИТОГ ===');
  console.log('провалов: ' + fails.length);
  process.exit(fails.length ? 1 : 0);
})();

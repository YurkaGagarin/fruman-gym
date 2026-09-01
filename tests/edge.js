const fs = require('fs');
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync('index.html', 'utf8');
let fails = [], warns = [];
const ok = m => console.log('  OK   ' + m);
const fail = m => { fails.push(m); console.log('  ПРОВАЛ ' + m); };
const warn = m => { warns.push(m); console.log('  ВНИМАНИЕ ' + m); };

function boot(opts = {}) {
  const store = opts.store || {};
  const errors = [];
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/gym/',
    beforeParse(win) {
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.HTMLElement.prototype.focus = () => {};
      win.scrollTo = () => {};
      win.AudioContext = function () { return { state: 'running', currentTime: 0, destination: {}, resume() {},
        createOscillator: () => ({ frequency: {}, connect() {}, start() {}, stop() {} }),
        createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }) }; };
      win.navigator.vibrate = () => true;
      if (opts.storage !== false) {
        win.storage = {
          async get(k) { if (opts.getThrows) throw new Error('get сломан'); if (!(k in store)) throw new Error('нет ключа'); return { key: k, value: store[k] }; },
          async set(k, v) { if (opts.setThrows) throw new Error('Storage set failed: Unexpected response type'); store[k] = v; return { key: k, value: v }; }
        };
      }
      win.onerror = (m, s, l, c, e) => errors.push(m + (e ? ' :: ' + e.message : ''));
      win.addEventListener('unhandledrejection', e => errors.push('промис: ' + (e.reason && e.reason.message)));
    }
  });
  return { dom, win: dom.window, doc: dom.window.document, store, errors };
}
const tick = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));
const setVal = (el, v) => { el.value = v; el.dispatchEvent(new (el.ownerDocument.defaultView.Event)('input', { bubbles: true })); };

(async () => {
  // первая карточка с подходами: разминку и кардио пропускаем
  const IDX = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex
    .findIndex(e => !e.w && !e.t && !e.iv);

  console.log('\n=== 11. ХРАНИЛИЩЕ ОТКАЗЫВАЕТ НА ЗАПИСИ (как в просмотрщике) ===');
  let e = boot({ setThrows: true });
  await tick(150);
  const b = e.doc.getElementById('banner');
  if (b.hidden) fail('плашка не показана при отказе записи');
  else ok('плашка: ' + b.textContent.slice(0, 60) + '…');
  const cards = e.doc.querySelectorAll('#app .card');
  click(cards[IDX]); await tick(40);
  const sets = e.doc.querySelectorAll('#exsets .exset');
  for (let i = 0; i < 5; i++) { click(sets[0]); await tick(15); }
  if (e.errors.length) fail('ошибки при отказе хранилища: ' + e.errors.join(' | '));
  else ok('интерфейс работает, ошибок в консоль не сыплет');

  console.log('\n=== 12. ПОВРЕЖДЁННЫЕ ДАННЫЕ В ХРАНИЛИЩЕ ===');
  const broken = [
    ['не JSON', 'это не json'],
    ['день вне диапазона', JSON.stringify({ __prog: { day: 99, date: '2026-08-28', sets: {}, done: false } })],
    ['sets строкой', JSON.stringify({ __prog: { day: 0, date: '2026-08-28', sets: 'ой', done: false } })],
    ['веса объектом', JSON.stringify({ '0:0': { плохо: true } })],
    ['null внутри', JSON.stringify({ '0:0': [null, { d: '2026-01-01', w: 5 }] })],
    ['prog массивом', JSON.stringify({ __prog: [1, 2, 3] })],
    ['день строкой', JSON.stringify({ __prog: { day: 'два', date: '2026-08-28', sets: {}, done: false } })],
  ];
  for (const [name, payload] of broken) {
    const env = boot({ store: { 'weightlog:v1': payload } });
    await tick(140);
    const cnt = env.doc.querySelectorAll('#app .card').length;
    const err = env.errors.length ? ' ОШИБКИ: ' + env.errors[0] : '';
    const want = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex.length;
    if (cnt !== want || env.errors.length) fail(name + ' -> карточек ' + cnt + err);
    else ok(name + ' -> пережевал, карточек ' + cnt);
  }

  console.log('\n=== 13. МУСОР В ПОЛЕ ВЕСА ===');
  let env = boot(); await tick(140);
  click(env.doc.querySelectorAll('#app .card')[IDX]); await tick(40);
  const w = env.doc.getElementById('exweight');
  const inputs = ['12kg', '1e9', '--5', '  ', '0', '999999', '12.5.5', '<script>', '١٢'];
  for (const v of inputs) { setVal(w, v); await tick(20); }
  await tick(600);
  const stored = JSON.parse(env.store['weightlog:v1'] || '{}');
  ok('после мусорного ввода записано: ' + JSON.stringify(stored['0:0'] || null));
  if (stored['0:0'] && stored['0:0'].some(x => x.w > 1000)) warn('в журнал попал вес больше 1000 кг');
  if (env.errors.length) fail('ошибки при вводе мусора: ' + env.errors.join(' | ')); else ok('без ошибок');

  console.log('\n=== 14. ГОНКИ: БЫСТРЫЕ НАЖАТИЯ ===');
  const sets2 = env.doc.querySelectorAll('#exsets .exset');
  for (let i = 0; i < 12; i++) click(sets2[0]);
  await tick(60);
  const pressed = sets2[0].getAttribute('aria-pressed');
  ok('после 12 быстрых нажатий состояние: ' + pressed);
  const tf = env.doc.getElementById('tfull');
  ok('таймер ' + (tf.hidden ? 'закрыт' : 'открыт') + ' — согласовано с отметкой: ' + ((pressed === 'true') === !tf.hidden ? 'да' : 'НЕТ'));
  if (env.errors.length) fail('ошибки в гонке: ' + env.errors.join(' | '));

  console.log('\n=== 15. ПЕРЕКЛЮЧЕНИЕ ДНЯ ВО ВРЕМЯ ТРЕНИРОВКИ ===');
  const tabs = env.doc.querySelectorAll('.tab');
  click(tabs[2]); await tick(60);
  const before = JSON.parse(env.store['weightlog:v1'] || '{}');
  const IDX3 = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[2].ex
    .findIndex(e => !e.w && !e.t && !e.iv);
  const c3 = env.doc.querySelectorAll('#app .card');
  click(c3[IDX3]); await tick(40);
  const s3 = env.doc.querySelectorAll('#exsets .exset');
  click(s3[0]); await tick(700);
  const after = JSON.parse(env.store['weightlog:v1'] || '{}');
  ok('прогресс переехал на день ' + (after.__prog.day + 1));
  const leftovers = Object.keys(after.__prog.sets).filter(k => k.indexOf(after.__prog.day + ':') !== 0);
  if (leftovers.length) fail('в отметках остались чужие дни: ' + leftovers.join(','));
  else ok('отметки прошлого дня очищены');
  const weightsKept = Object.keys(after).filter(k => /^\d+:\d+$/.test(k)).length;
  ok('записи весов сохранились: ' + weightsKept);

  console.log('\n=== 16. ИМПОРТ ЖУРНАЛА ЧЕРЕЗ ИНТЕРФЕЙС ===');
  const progBefore = JSON.parse(env.store['weightlog:v1']).__prog;
  click(env.doc.getElementById('restore')); await tick(50);
  const ta = env.doc.getElementById('sheetInput');
  ta.value = '0:0|Жим|2026-08-01=20,2026-08-08=22';
  click(env.doc.getElementById('sheetLoad')); await tick(700);
  const afterImp = JSON.parse(env.store['weightlog:v1']);
  if (!afterImp.__prog) fail('импорт стёр прогресс');
  else ok('прогресс уцелел: день ' + (afterImp.__prog.day + 1));
  if (!afterImp['0:0'] || afterImp['0:0'].length !== 2) fail('импорт не записал историю');
  else ok('импортировано записей: ' + afterImp['0:0'].length);

  console.log('\n=== 17. ЗАВЕРШЕНИЕ ДНЯ И ЦИКЛ ===');
  let env5 = boot(); await tick(140);
  click(env5.doc.querySelectorAll('#app .card')[IDX]); await tick(40);
  click(env5.doc.querySelectorAll('#exsets .exset')[0]); await tick(40);
  click(env5.doc.getElementById('fstop')); await tick(30);
  click(env5.doc.getElementById('exclose')); await tick(350);
  click(env5.doc.getElementById('finishDay')); await tick(600);
  const st5 = JSON.parse(env5.store['weightlog:v1']);
  ok('день помечен завершённым: ' + st5.__prog.done);
  st5.__prog.date = '2020-01-01';
  env5.store['weightlog:v1'] = JSON.stringify(st5);
  let env6 = boot({ store: env5.store }); await tick(150);
  const selected = [...env6.doc.querySelectorAll('.tab')].map(t => t.getAttribute('aria-selected')).indexOf('true') + 1;
  ok('следующий запуск открыл день ' + selected);
  if (selected !== 2) fail('ожидался день 2');

  console.log('\n=== 18. ПРОИЗВОДИТЕЛЬНОСТЬ ПЕРЕРИСОВКИ ===');
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    const tb = env6.doc.querySelectorAll('.tab');
    click(tb[i % 3]);
  }
  await tick(100);
  const dt = Date.now() - t0;
  ok('60 переключений дня за ' + dt + ' мс (' + (dt / 60).toFixed(1) + ' мс на перерисовку)');
  if (dt / 60 > 60) warn('перерисовка медленнее 60 мс');
  if (env6.errors.length) fail('ошибки при перерисовках: ' + env6.errors.join(' | '));

  console.log('\n=== 19. ДОСТУПНОСТЬ ===');
  const doc = env6.doc;
  const imgs = [...doc.querySelectorAll('#app img')];
  const noAlt = imgs.filter(i => !i.getAttribute('alt'));
  if (noAlt.length) fail('картинок без описания: ' + noAlt.length); else ok('у всех ' + imgs.length + ' картинок есть alt');
  const btns = [...doc.querySelectorAll('button')];
  const noName = btns.filter(x => !(x.textContent.trim() || x.getAttribute('aria-label')));
  if (noName.length) fail('кнопок без названия: ' + noName.length); else ok('у всех ' + btns.length + ' кнопок есть название');
  const nested = [...doc.querySelectorAll('[role="button"] button, button button')];
  if (nested.length) fail('вложенные интерактивные элементы: ' + nested.length); else ok('вложенных кнопок нет');
  const ids = [...HTML.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) fail('дубли id: ' + [...new Set(dup)].join(', ')); else ok('дублей id нет');

  console.log('\n=== 20. ИТОГ ===');
  console.log('провалов: ' + fails.length + ', предупреждений: ' + warns.length);
  fails.forEach(f => console.log('  ✗ ' + f));
  warns.forEach(f => console.log('  ! ' + f));
  process.exit(0);
})();

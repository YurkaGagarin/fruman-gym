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
      if (opts.storage !== false) {
        win.storage = {
          async get(k) { if (!(k in store)) throw new Error('нет ключа'); return { key: k, value: store[k] }; },
          async set(k, v) { store[k] = v; return { key: k, value: v }; }
        };
      }
      win.onerror = (msg, src, line, col, err) => { errors.push(msg + (err ? ' :: ' + err.message : '')); };
      win.addEventListener('unhandledrejection', e => errors.push('промис: ' + (e.reason && e.reason.message)));
    }
  });
  return { dom, win: dom.window, doc: dom.window.document, store, errors };
}
const tick = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));

(async () => {
  // первая карточка, где есть вес и отдых (не разминка и не кардио)
  const DAYS0 = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex;
  const idx = DAYS0.findIndex(e => !e.w && !e.t && !e.iv);

  console.log('\n=== 1. ЗАПУСК ===');
  let env = boot();
  await tick(120);
  if (env.errors.length) fail('ошибки при старте: ' + env.errors.join(' | ')); else ok('старт без ошибок');
  const cards = env.doc.querySelectorAll('#app .card');
  ok('карточек отрисовано: ' + cards.length);
  const expect = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex.length;
  if (cards.length !== expect) fail('ожидалось ' + expect + ' карточек');
  const banner = env.doc.getElementById('banner');
  if (!banner.hidden) warn('плашка видна при старте: ' + banner.textContent.slice(0, 60));

  console.log('\n=== 2. ОТКРЫТИЕ УПРАЖНЕНИЯ ===');
  click(cards[idx]);
  await tick(60);
  const exview = env.doc.getElementById('exview');
  if (exview.hidden) fail('экран упражнения не открылся'); else ok('экран открылся');
  ok('название: ' + env.doc.getElementById('exname').textContent);
  const sets = env.doc.querySelectorAll('#exsets .exset');
  ok('кнопок подходов: ' + sets.length + ' (схема ' + env.doc.getElementById('exload').textContent + ')');

  console.log('\n=== 3. ОТМЕТКА ПОДХОДОВ И ТАЙМЕР ===');
  click(sets[0]);
  await tick(40);
  const tfull = env.doc.getElementById('tfull');
  if (tfull.hidden) fail('таймер отдыха не запустился'); else ok('таймер отдыха запустился: ' + env.doc.getElementById('tphase').textContent);
  ok('подсказка: ' + env.doc.getElementById('tnext').textContent);
  const ring = env.doc.getElementById('trfg').style.strokeDashoffset;
  ok('кольцо инициализировано: ' + (ring || 'пусто'));
  click(env.doc.getElementById('fstop'));
  await tick(30);
  if (!tfull.hidden) fail('таймер не закрылся по «Стоп»'); else ok('таймер закрылся');

  console.log('\n=== 4. ПОСЛЕДНИЙ ПОДХОД ЗАКРЫВАЕТ ЭКРАН ===');
  for (let i = 1; i < sets.length; i++) { click(sets[i]); await tick(20); }
  await tick(1000);
  if (!exview.hidden) fail('экран не закрылся после последнего подхода'); else ok('экран закрылся сам');
  if (env.errors.length) fail('ошибки в сценарии: ' + env.errors.join(' | '));

  console.log('\n=== 5. СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ===');
  const first = env.doc.querySelectorAll('#app .card')[idx];
  click(first); await tick(40);
  const w = env.doc.getElementById('exweight');
  w.value = '17,5';
  w.dispatchEvent(new env.win.Event('input', { bubbles: true }));
  await tick(600);
  const saved = env.store['weightlog:v1'];
  if (!saved) fail('журнал не записался в хранилище');
  else {
    const parsed = JSON.parse(saved);
    ok('в хранилище ключей: ' + Object.keys(parsed).length);
    const key = '0:' + idx;
    if (!parsed[key] || parsed[key][0].w !== 17.5) fail('вес записан неверно: ' + JSON.stringify(parsed[key]));
    else ok('вес 17,5 записан как число ' + parsed[key][0].w);
    if (!parsed['__prog']) fail('прогресс не сохранён'); else ok('прогресс: день ' + (parsed['__prog'].day + 1) + ', дата ' + parsed['__prog'].date);
  }

  console.log('\n=== 6. ПЕРЕЗАПУСК В ТОТ ЖЕ ДЕНЬ ===');
  let env2 = boot({ store: env.store });
  await tick(150);
  if (env2.errors.length) fail('ошибки при восстановлении: ' + env2.errors.join(' | '));
  const line = env2.doc.getElementById('progline').textContent;
  ok('строка прогресса: ' + line);
  const tabs = [...env2.doc.querySelectorAll('.tab')].map(t => t.getAttribute('aria-selected'));
  ok('выбранная вкладка: день ' + (tabs.indexOf('true') + 1));
  const c2 = env2.doc.querySelectorAll('#app .card');
  click(c2[idx]); await tick(40);
  const restored = env2.doc.getElementById('exweight').value;
  if (String(restored) !== '17.5') fail('вес не восстановился: «' + restored + '»'); else ok('вес восстановлен: ' + restored);

  console.log('\n=== 7. ПЕРЕХОД НА СЛЕДУЮЩИЙ ДЕНЬ ===');
  const st = JSON.parse(JSON.stringify(env.store));
  const p = JSON.parse(st['weightlog:v1']);
  p['__prog'].done = true;
  p['__prog'].date = '2020-01-01';
  st['weightlog:v1'] = JSON.stringify(p);
  let env3 = boot({ store: st });
  await tick(150);
  const sel = [...env3.doc.querySelectorAll('.tab')].map(t => t.getAttribute('aria-selected')).indexOf('true') + 1;
  if (sel !== 2) fail('ожидался день 2, открылся ' + sel); else ok('после завершённого дня 1 открылся день 2');
  ok('строка: ' + env3.doc.getElementById('progline').textContent);

  console.log('\n=== 8. ГЛОССАРИЙ И ОПИСАНИЕ ===');
  const terms = env3.doc.querySelectorAll('#app .term');
  ok('терминов подсвечено в списке: ' + terms.length);
  if (terms.length) {
    click(terms[0]); await tick(40);
    const sheet = env3.doc.getElementById('sheet');
    if (sheet.hidden) fail('карточка термина не открылась');
    else ok('термин открылся: ' + env3.doc.getElementById('sheetTitle').textContent);
    click(env3.doc.querySelector('.sheet-close')); await tick(30);
    if (!sheet.hidden) fail('карточка не закрылась');
  }
  const cards3 = env3.doc.querySelectorAll('#app .card');
  click(cards3[0]); await tick(40);
  click(env3.doc.getElementById('excue')); await tick(40);
  const body = env3.doc.getElementById('sheetText');
  const inner = body.querySelectorAll('.term').length;
  if (inner === 0) warn('в описании упражнения нет кликабельных терминов');
  else ok('в описании упражнения терминов: ' + inner);

  console.log('\n=== 9. БЕЗ ХРАНИЛИЩА ===');
  let env4 = boot({ storage: false });
  await tick(150);
  const b4 = env4.doc.getElementById('banner');
  if (b4.hidden) warn('плашка о недоступном сохранении не показана');
  else ok('плашка показана: ' + b4.textContent.slice(0, 70) + '…');
  if (env4.errors.length) fail('ошибки без хранилища: ' + env4.errors.join(' | ')); else ok('без хранилища работает без ошибок');

  console.log('\n=== 10. ПОЛЕ ВЕСА ТАМ, ГДЕ ОНО НУЖНО ===');
  const ALL = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1]);
  const env5 = boot();
  await tick(150);
  let mismatch = 0;
  for (let d = 0; d < ALL.length; d++) {
    click(env5.doc.querySelectorAll('.tab')[d]); await tick(60);
    const cs = env5.doc.querySelectorAll('#app .card');
    ALL[d].ex.forEach((e, i) => {
      const want = !e.nw && (!!e.wt || (!e.w && !e.t && !e.iv));
      const got = !!cs[i].querySelector('.log');
      if (want !== got) {
        mismatch++;
        fail('день ' + (d + 1) + ', карточка ' + (i + 1) + ' «' + e.n + '»: поле веса '
          + (got ? 'есть, а не должно быть' : 'отсутствует, а должно быть'));
      }
    });
  }
  if (!mismatch) ok('поле веса стоит ровно там, где его ждёт hasWeight, во всех трёх днях');
  const own = [];
  ALL.forEach((d, di) => d.ex.forEach(e => { if (e.nw) own.push('день ' + (di + 1) + ' · ' + e.n); }));
  ok('по собственному весу, без поля: ' + (own.length ? own.join(', ') : 'таких нет'));

  console.log('\n=== 11. ИТОГ ===');
  console.log('провалов: ' + fails.length + ', предупреждений: ' + warns.length);
  if (fails.length) fails.forEach(f => console.log('  ✗ ' + f));
  if (warns.length) warns.forEach(f => console.log('  ! ' + f));
  process.exit(0);
})();

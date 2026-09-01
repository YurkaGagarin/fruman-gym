const fs=require('fs'); const {JSDOM}=require('jsdom');
const HTML=fs.readFileSync('index.html','utf8');
function boot(store){const errors=[];const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://e.com/g/',
 beforeParse(w){w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.focus=()=>{};w.scrollTo=()=>{};
 w.AudioContext=function(){return{state:'running',currentTime:0,destination:{},resume(){},createOscillator:()=>({frequency:{},connect(){},start(){},stop(){}}),createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}})};};
 w.navigator.vibrate=()=>true;
 w.storage={async get(k){if(!(k in store))throw new Error('нет');return{key:k,value:store[k]}},async set(k,v){store[k]=v;return{key:k,value:v}}};
 w.onerror=(m)=>errors.push(m);}});return{doc:dom.window.document,win:dom.window,errors,store};}
const tick=ms=>new Promise(r=>setTimeout(r,ms));
const click=el=>el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click',{bubbles:true}));
const sel=doc=>[...doc.querySelectorAll('.tab')].map(t=>t.getAttribute('aria-selected')).indexOf('true')+1;
(async()=>{
 const IDX = JSON.parse(HTML.match(/const DAYS = (\[.*?\]);\n/s)[1])[0].ex
   .findIndex(e => !e.w && !e.t && !e.iv);

 const store={};
 const e=boot(store); await tick(150);
 console.log('открылся день', sel(e.doc));
 click(e.doc.querySelectorAll('#app .card')[IDX]); await tick(40);
 click(e.doc.querySelectorAll('#exsets .exset')[0]); await tick(40);
 click(e.doc.getElementById('fstop')); await tick(30);
 click(e.doc.getElementById('exclose')); await tick(350);
 console.log('строка:', e.doc.getElementById('progline').textContent);
 click(e.doc.getElementById('finishDay')); await tick(600);
 console.log('после «Завершить день» на экране день', sel(e.doc));
 console.log('строка:', e.doc.getElementById('progline').textContent);
 const st=JSON.parse(store['weightlog:v1']);
 console.log('в хранилище день', st.__prog.day+1, '| отметок', Object.keys(st.__prog.sets).length);
 const e2=boot(store); await tick(150);
 console.log('после перезапуска сегодня же:', sel(e2.doc));
 // последний подход последнего упражнения
 const cards=e2.doc.querySelectorAll('#app .card');
 click(cards[cards.length-1]); await tick(40);
 const sets=e2.doc.querySelectorAll('#exsets .exset');
 for(const s of sets){ click(s); await tick(20); }
 await tick(1500);
 console.log('после закрытия последнего упражнения день', sel(e2.doc));
 console.log('ошибок:', e.errors.length+e2.errors.length);
 process.exit(0);
})();

import { aircraft, airframe, newFlight } from './profiles.js';
import { calculate, fromLbs, parseWeight } from './calculate.js';
import { cabinSvg, envelopeSvg, escapeHtml as e } from './graphics.js';
import { STORAGE_KEY, serialize, restore } from './storage.js';
import { printSheet } from './print.js';

const $ = selector => document.querySelector(selector);
let storageAvailable = true;
let state;
try { state = restore(localStorage.getItem(STORAGE_KEY)) ?? newFlight(true); } catch { storageAvailable = false; state = newFlight(true); }
let result, installPrompt, resetExample = false, toastTimer;
const format=(value,d=0)=>Number.isFinite(value)?value.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const weight=value=>format(Number.isFinite(value)?fromLbs(value,state.unit):NaN,state.unit==='kg'?1:0);
const unit=()=>state.unit==='kg'?'кг':'lbs';
const editValue=value=>Number.isFinite(value)?String(Number(fromLbs(value,state.unit).toFixed(3))):'';

function weightField(id,label,value,helper='',compact=false) {
  return `<div class="weight-field ${compact?'compact-field':''}">${compact?'':`<label for="weight-${id}">${e(label)}</label>`}<div class="weight-input-wrap"><input id="weight-${id}" data-weight="${id}" inputmode="decimal" autocomplete="off" type="text" value="${editValue(value)}" placeholder="${id==='remaining'?'Введите остаток':'0'}" aria-describedby="error-${id}${helper?` help-${id}`:''}"><span>${unit()}</span></div>${helper?`<span class="field-helper" id="help-${id}">${e(helper)}</span>`:''}<span class="field-error" id="error-${id}"></span></div>`;
}

function renderForm() {
  $('#flight-fields').innerHTML = [['date','Дата','date'],['number','Номер рейса','text'],['route','Маршрут полёта','text'],['captain','КВС','text']].map(([id,label,type])=>`<div class="flight-field"><label for="flight-${id}">${label}</label><input id="flight-${id}" data-flight="${id}" type="${type}" value="${e(state.flight[id])}" placeholder="${{number:'Например, RА027',route:'Откуда — куда',captain:'Фамилия, инициалы'}[id]??''}" ${type==='text'?'maxlength="100"':''}></div>`).join('');
  const groups=[['crew','ЭКИПАЖ','01'],['passenger','ПАССАЖИРЫ','02'],['baggage','БАГАЖ И ГАРДЕРОБ','03']];
  $('#load-fields').innerHTML=groups.map(([group,label,index])=>`<div class="load-group"><div class="load-group-title"><span>${label}</span><span>${index}</span></div>${aircraft.stations.filter(s=>s.group===group).map(s=>`<div class="load-row" data-row="${s.id}"><div class="station-label"><span class="station-symbol ${state.loads[s.id]>0?'occupied':''}" data-symbol="${s.id}">${s.short}</span><div><label for="weight-${s.id}">${e(s.label)}</label><small>${s.max?`Макс. ${weight(s.max)} ${unit()} · `:''}плечо ${format(s.arm,1)} ft</small></div></div>${weightField(s.id,s.label,state.loads[s.id],'',true)}</div>`).join('')}</div>`).join('');
  $('#fuel-fields').innerHTML=weightField('wing','Крыльевые баки',state.fuel.wing,`Максимум ${weight(aircraft.tanks.wing.max)} ${unit()}`)+weightField('ventral','Подфюзеляжный бак',state.fuel.ventral,`Максимум ${weight(aircraft.tanks.ventral.max)} ${unit()}`);
  $('#remaining-field').innerHTML=weightField('remaining','Общий остаток топлива',state.fuel.remaining,'Остаток во всех баках к моменту посадки');
  document.querySelectorAll('[data-unit]').forEach(button=>{const active=button.dataset.unit===state.unit;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  $('#empty-weight').textContent=`${weight(airframe.emptyWeight)} ${unit()}`;
}

function pointCard(key,title,subtitle,icon) {
  const p=result[key], max=aircraft.limits[key], over=p&&p.weight>max;
  const percent=p?Math.min(100,p.weight/max*100):0;
  return `<div class="result-point ${key==='takeoff'?'featured':''} ${over?'over-limit':''}"><div class="result-phase"><span><span class="result-icon">${icon}</span>${title}</span><span class="result-code">${subtitle}</span></div><div class="result-weight">${p?weight(p.weight):'—'} <small>${unit()}</small></div><div class="limit-track"><div style="width:${percent}%"></div></div><div class="result-limit"><span>${over?'Превышение':'Максимум'} ${over?weight(p.weight-max):weight(max)} ${unit()}</span><span>${p?format(p.weight/max*100,1)+'%':'—'}</span></div><div class="result-details"><div><span>Плечо ЦТ</span><strong>${p?format(p.arm,3):'—'} <small>ft</small></strong></div><div><span>Центровка ≈</span><strong>${p?format(p.mac,1):'—'} <small>% САХ</small></strong></div></div>${key==='landing'&&!p?`<p class="pending-note">${state.fuel.remaining===null?'Введите остаток топлива для расчёта':'Проверьте исходные данные'}</p>`:''}</div>`;
}

function renderDerived() {
  result=calculate(state,aircraft,airframe);
  $('#cabin').innerHTML=cabinSvg(state.loads,true);
  let payload=0,count=0;
  for (const s of aircraft.stations) {const v=state.loads[s.id];if(Number.isFinite(v))payload+=v;if(s.group==='passenger'&&v>0)count++;const symbol=document.querySelector(`[data-symbol="${s.id}"]`);symbol?.classList.toggle('occupied',v>0);}
  $('#passenger-count').textContent=`· ${count} пасс.`;
  $('#payload-weight').textContent=`${weight(payload)} ${unit()}`;
  $('#results').innerHTML=pointCard('takeoff','Взлёт','TAKEOFF','↗')+pointCard('landing','Посадка','LANDING','↘')+`<div class="zero-fuel-summary"><span>Без топлива <small>ZFW</small></span><strong>${weight(result.zeroFuel?.weight)} ${unit()}</strong></div><div class="zfw-limit">Лимит ${weight(aircraft.limits.zeroFuel)} ${unit()}</div>${result.warnings.length?`<div class="warnings" role="status">${result.warnings.map(w=>`<p><span>!</span>${e(w.message)}</p>`).join('')}</div>`:''}${Object.keys(result.errors).length?'<div class="calculation-errors">Проверьте отмеченные поля. Неполные результаты не рассчитываются.</div>':''}`;
  $('#balance-chart').innerHTML=envelopeSvg(aircraft,result);
  $('#fuel-breakdown').innerHTML=result.burn?`<div class="fuel-breakdown"><div><span>Расход за полёт</span><strong>${weight(result.burn.total)} ${unit()}</strong></div><div><span>Из подфюзеляжного</span><span>${weight(result.burn.ventral)} ${unit()}</span></div><div><span>Из крыльевых</span><span>${weight(result.burn.wing)} ${unit()}</span></div><div class="remaining-breakdown"><span>Остаток: крыло / подфюз.</span><span>${weight(result.landingFuel.wing)} / ${weight(result.landingFuel.ventral)} ${unit()}</span></div></div>`:'';
  document.querySelectorAll('[data-unit-label]').forEach(el=>el.textContent=unit());
  document.querySelectorAll('[data-weight]').forEach(el=>{const id=el.dataset.weight, message=result.errors[id]??'';el.setAttribute('aria-invalid',String(Boolean(message)));$(`#error-${id}`).textContent=message;});
  const invalid=Object.keys(result.errors).length>0;
  for(const id of ['print-button','dialog-print']) {$( '#'+id).disabled=invalid;$('#'+id).title=invalid?'Исправьте ошибки ввода перед печатью':'';}
  $('#print-output').innerHTML=printSheet(state,result,aircraft,airframe);
  if($('#preview-dialog').open) $('#preview-sheet').innerHTML=printSheet(state,result,aircraft,airframe,'preview');
}

function save() {
  try {localStorage.setItem(STORAGE_KEY,serialize(state));storageAvailable=true;} catch {storageAvailable=false;}
  $('#save-state').textContent=storageAvailable?'Сохранено на устройстве':'Сохранение недоступно';
  $('#save-state').classList.toggle('save-error',!storageAvailable);
}
function refresh() {renderForm();renderDerived();save();}
function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}

document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.flight){state.flight[el.dataset.flight]=el.value;save();return;}
  if(el.dataset.weight){const id=el.dataset.weight,value=parseWeight(el.value,state.unit);if(id in state.fuel)state.fuel[id]=value;else state.loads[id]=value;renderDerived();save();}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-unit]');
  if(button&&button.dataset.unit!==state.unit){state.unit=button.dataset.unit;refresh();}
  const seat=event.target.closest('[data-seat]');
  if(seat){const field=$(`#weight-${seat.dataset.seat}`);field.scrollIntoView({behavior:'smooth',block:'center'});field.focus({preventScroll:true});field.select();}
});
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-seat]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
function preview() {$('#preview-sheet').innerHTML=printSheet(state,result,aircraft,airframe,'preview');$('#preview-dialog').showModal();}
$('#preview-button').addEventListener('click',preview);$('#nav-preview').addEventListener('click',preview);$('#close-preview').addEventListener('click',()=>$('#preview-dialog').close());
function print(){if(Object.keys(result.errors).length){toast('Исправьте ошибки перед печатью');return;}window.print();}
$('#print-button').addEventListener('click',print);$('#dialog-print').addEventListener('click',print);
window.addEventListener('beforeprint',()=>$('#print-output').innerHTML=printSheet(state,result,aircraft,airframe));
function requestReset(example){resetExample=example;$('#reset-title').textContent=example?'Загрузить пример с фото?':'Новый расчёт?';$('#reset-confirm').textContent=example?'Загрузить пример':'Новый расчёт';$('#reset-dialog').showModal();}
$('#new-flight').addEventListener('click',()=>requestReset(false));$('#restore-example').addEventListener('click',()=>requestReset(true));$('#reset-cancel').addEventListener('click',()=>$('#reset-dialog').close());
$('#reset-confirm').addEventListener('click',()=>{const currentUnit=state.unit;state=newFlight(resetExample);state.unit=currentUnit;refresh();$('#reset-dialog').close();toast(resetExample?'Пример из исходного листа загружен':'Новый расчёт создан');});

let offlineReady=false;
function offlineStatus(){const el=$('#offline-state');el.classList.toggle('ready',offlineReady);el.classList.toggle('is-offline',!navigator.onLine);el.innerHTML=`<i></i> ${offlineReady?(navigator.onLine?'Офлайн готов':'Работаем офлайн'):(navigator.onLine?'Подготовка офлайн':'Нет сети · кеш не готов')}`;}
window.addEventListener('online',offlineStatus);window.addEventListener('offline',offlineStatus);
async function prepareOffline(){
  if(!('serviceWorker' in navigator)){ $('#offline-state').textContent='Офлайн недоступен';return; }
  try{
    const registration=await navigator.serviceWorker.register('./sw.js');
    const checkReady=async()=>{const cacheNames=await caches.keys();offlineReady=cacheNames.some(n=>n.startsWith('balance-flight-'));offlineStatus();};
    await navigator.serviceWorker.ready;await checkReady();
    navigator.serviceWorker.addEventListener('controllerchange',checkReady);
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')checkReady();});});
  }catch{ $('#offline-state').textContent='Офлайн не подготовлен'; }
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-button').hidden=false;});
$('#install-button').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;$('#install-button').hidden=true;installPrompt=null;}});
window.addEventListener('appinstalled',()=>{$('#install-button').hidden=true;toast('Balance установлено');});
refresh();offlineStatus();prepareOffline();

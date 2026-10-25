import { cabinSvg, envelopeSvg, fuelSvg, escapeHtml as e } from './graphics.js';
const n=(v,d=0)=>Number.isFinite(v)?(v===0?0:v).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export function printSheet(input,result,model,profile,context='output') {
  const cell=(v,d=0)=>`<td>${n(v,d)}</td>`;
  const summary=(label,point,limit)=>`<tr class="sheet-summary"><td>${label} <span>(max ${limit} lbs)</span></td>${cell(point?.weight)}${cell(point?.arm,3)}${cell(point?.moment)}${cell(point?.mac,1)}</tr>`;
  const labels={attendant:'Бортпроводник',row1left:'Один пас. на лев. кресле ряд 1 лицом назад',row1right:'Один пас. на прав. кресле ряд 1 лицом назад',row2left:'Один пас. на лев. кресле ряд 2 лицом вперёд',row2right:'Один пас. на прав. кресле ряд 2 лицом вперёд',row3right:'Один пас. на прав. кресле ряд 3 лицом вперёд',sofaFront:'Один пассажир на диване переднее место',sofaMiddle:'Один пассажир на диване среднее место',sofaRear:'Один пассажир на диване заднее место',frontBag:'Загрузка переднего багажника (max 250 lbs)',wardrobe:'Задний гардероб (max 100 lbs)',rearBag:'Загрузка заднего багажника (max 45 lbs)'};
  const fuelRow=(label,key)=>`<tr><td>${label}</td>${cell(input.fuel[key])}${cell(model.tanks[key].arm,2)}${cell(Number.isFinite(input.fuel[key])?input.fuel[key]*model.tanks[key].arm:NaN)}<td></td></tr>`;
  const date=input.flight.date?input.flight.date.split('-').reverse().join('.') : '';
  return `<article class="sheet"><h1>Центровочный график ${e(model.name)} ${e(profile.registration)} SN: ${e(profile.serial)}</h1>
    <div class="sheet-meta"><div class="sheet-flight"><div>Дата <span>${e(date)}</span></div><div>Номер рейса <span>${e(input.flight.number)}</span></div><div>Маршрут полёта <span>${e(input.flight.route)}</span></div><div>КВС <span>${e(input.flight.captain)}</span></div></div><div class="sheet-cabin">${cabinSvg()}<p>FRONT BAGGAGE · GALLEY · WARDROBE · TOILET</p></div></div>
    <div class="sheet-graphs"><div>${envelopeSvg(model,result,true,context)}</div><div>${fuelSvg(input.fuel.wing)}</div></div>
    <table class="sheet-table"><colgroup><col style="width:54%"><col style="width:11%"><col style="width:13%"><col style="width:13%"><col style="width:9%"></colgroup><thead><tr><th>Весовые данные</th><th>Вес<br>(lbs)</th><th>Расстояние<br>от ЦТ (ft)</th><th>Момент<br>(ft·lbs)</th><th>Ц-ка<br>(%) ≈</th></tr></thead><tbody>
    <tr class="base-row"><td>А. Вес снаряжённого самолёта</td>${cell(profile.emptyWeight)}${cell(profile.emptyArm,3)}${cell(profile.emptyWeight*profile.emptyArm)}${cell(model.mac.referencePercent,1)}</tr>
    ${model.stations.map(s=>{const v=input.loads[s.id];return `<tr${s.id==='frontBag'?' class="sheet-divider"':''}><td>${e(labels[s.id]??s.label)}</td>${cell(v)}${cell(s.arm,1)}${cell(Number.isFinite(v)?v*s.arm:NaN)}<td></td></tr>`;}).join('')}
    ${summary('В. Вес снаряжённого самолёта + коммерческая загрузка без топлива',result.zeroFuel,model.limits.zeroFuel)}
    ${fuelRow('Топливо в крыльевых баках (max 8 446 lbs)','wing')}${fuelRow('Топливо в подфюзеляжном баке (max 1 496 lbs)','ventral')}
    ${summary('С. Взлётный вес',result.takeoff,model.limits.takeoff)}
    <tr><td>Использованное в полёте топливо</td>${cell(result.burn?.total)}<td></td>${cell(result.burn?.moment)}<td></td></tr>
    ${summary('D. Посадочный вес',result.landing,model.limits.landing)}
    </tbody></table>
    <div class="sheet-under-table"><div class="sheet-formula"><span><b>Total Moment</b><b>Takeoff Weight</b></span><strong>= CG DATUM</strong></div><div class="sheet-landing-note">Остаток: ${n(input.fuel.remaining)} lbs${result.landingFuel?`<br>Крыло: ${n(result.landingFuel.wing)} · Подфюзеляжный: ${n(result.landingFuel.ventral)}`:''}</div></div>
    <div class="sheet-demo"><strong>ДЕМО · НЕ ДЛЯ ВЫПОЛНЕНИЯ ПОЛЁТОВ.</strong> Плечи топлива: 0,69 / 8,36 ft. Шкала САХ и контуры графиков приближены по фото. Топливная кривая справочная; расчёт использует постоянные плечи.</div>
    ${result.warnings.length||Object.keys(result.errors).length?`<div class="sheet-warnings">${[...Object.values(result.errors),...result.warnings.map(w=>w.message)].map(e).join(' · ')}</div>`:''}
    <div class="sheet-signature"><span>КВС</span><div><i></i><small>подпись</small></div><span>/</span><div><i>${e(input.flight.captain)}</i><small>Ф.И.О.</small></div><span>/</span></div>
  </article>`;
}

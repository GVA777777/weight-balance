export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (n,d=0) => Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits:d, minimumFractionDigits:d }) : '—';

export function cabinSvg(loads = {}, interactive = false) {
  const seats = [ ['row1left',230,50,'1Л',true],['row1right',230,139,'1П',true],['row2left',320,50,'2Л',false],['row2right',320,139,'2П',false],['row3right',410,139,'3П',false],['sofaFront',402,50,'Д1',false],['sofaMiddle',452,50,'Д2',false],['sofaRear',502,50,'Д3',false] ];
  return `<svg class="cabin-svg" viewBox="0 0 660 225" role="img" aria-label="Схема салона HS-125-800XP. Нос самолёта слева.">
    <path d="M20 110 Q65 62 135 33 Q155 25 180 25 H558 Q616 28 626 110 Q616 195 558 198 H180 Q130 198 20 110Z" fill="var(--cabin-fill,#fafafa)" stroke="currentColor" stroke-width="1.8"/>
    <path d="M145 36Q113 110 145 188 M183 26V198 M555 26V198 M594 44V180" fill="none" stroke="currentColor" opacity=".38"/>
    <path d="M44 110H615" stroke="currentColor" stroke-dasharray="4 7" opacity=".12"/>
    <path d="M166 55h31v43h-31z M166 128h31v43h-31z" fill="none" stroke="currentColor" opacity=".5"/>
    <text x="102" y="116" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55">НОС</text>
    <text x="201" y="216" font-size="9" fill="currentColor" opacity=".6">ВХОД</text>
    ${seats.map(([id,x,y,label,reverse]) => { const active = loads[id] > 0; return `<g ${interactive ? `class="seat-target" role="button" tabindex="0" data-seat="${id}" aria-label="Место ${label}${active ? ', занято' : ', свободно'}"` : ''}><rect x="${x}" y="${y}" width="40" height="36" rx="6" fill="${active ? '#26766a' : '#fff'}" stroke="${active ? '#26766a' : '#9daeb1'}"/><path d="M${x+5} ${reverse ? y+7 : y+29}h30" stroke="${active ? '#a7d0c8' : '#9daeb1'}" stroke-width="3"/><text x="${x+20}" y="${y+22}" text-anchor="middle" font-size="10" font-weight="600" fill="${active ? '#fff' : '#6a7b80'}">${label}</text></g>`; }).join('')}
    <path d="M568 47h21v43h-21z M565 139h29v39h-29z" fill="none" stroke="currentColor" opacity=".4"/>
    <text x="577" y="117" font-size="8" text-anchor="middle" fill="currentColor" opacity=".55">ГАРДЕРОБ</text>
  </svg>`;
}

export function envelopeSvg(model, result, print = false, context = 'screen') {
  const clipId = `balance-clip-${context}`;
  const w=510,h=370, l=60,r=25,t=38,b=42;
  const x = arm => l+(arm+.5)/1.9*(w-l-r), y = weight => h-b-(weight-13000)/16000*(h-t-b);
  const colors = print ? ['#444','#111','#666'] : ['#8998a3','#26766a','#d89345'];
  const ticksX = Array.from({length:20},(_,i)=> -.5+i*.1);
  const ticksY = Array.from({length:17},(_,i)=>13000+i*1000);
  const points = [['zeroFuel',result.zeroFuel,'Без топлива'],['takeoff',result.takeoff,'Взлёт'],['landing',result.landing,'Посадка']].filter(([,p])=>p);
  const validPoints=points.filter(([,p])=>p.arm>=-.5 && p.arm<=1.4 && p.weight>=13000 && p.weight<=29000);
  const outOfRange=points.length-validPoints.length;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Приближённый график центровки, демо. Ось X: плечо ft, ось Y: масса lbs.">
    <defs><clipPath id="${clipId}"><rect x="${l}" y="${t}" width="${w-l-r}" height="${h-t-b}"/></clipPath></defs>
    ${ticksX.map(a=>`<path d="M${x(a)} ${t}V${h-b}" stroke="#c5cdcd" stroke-width=".6"/>${Math.round(a*10)%2===0?`<text x="${x(a)}" y="${h-b+16}" text-anchor="middle" font-size="9" fill="currentColor">${number(a,1)}</text>`:''}`).join('')}
    ${ticksY.map(a=>`<path d="M${l} ${y(a)}H${w-r}" stroke="#c5cdcd" stroke-width=".6"/>${a%2000===0?`<text x="${l-8}" y="${y(a)+3}" text-anchor="end" font-size="9" fill="currentColor">${number(a)}</text>`:''}`).join('')}
    <rect x="${l}" y="${t}" width="${w-l-r}" height="${h-t-b}" fill="none" stroke="#71838a"/>
    <path d="${model.envelope.map(([a,v],i)=>`${i?'L':'M'}${x(a)} ${y(v)}`).join('')}Z" fill="${print?'none':'#26766a0c'}" stroke="${print?'#222':'#6b8e87'}" stroke-width="2"/>
    ${[['takeoff',28000,'MAX T/O'],['landing',23350,'MAX LDG'],['zeroFuel',18450,'MAX ZFW']].map(([,a,label])=>`<path d="M${l} ${y(a)}H${w-r}" stroke="#a2aaa7" stroke-dasharray="4 4"/><text x="${l+8}" y="${y(a)-4}" font-size="8" fill="currentColor" opacity=".7">${label} ${number(a)}</text>`).join('')}
    <text x="${w/2}" y="13" font-size="9" text-anchor="middle" fill="currentColor">ПРОЦЕНТ САХ · ПРИБЛИЖЁННО</text>
    ${[-.4,0,.4,.8,1.2].map(a=>`<text x="${x(a)}" y="29" text-anchor="middle" font-size="9" fill="currentColor">${number(model.mac.referencePercent+(a-model.mac.referenceArm)/model.mac.length*100,1)}</text>`).join('')}
    <g clip-path="url(#${clipId})">${validPoints.length>1?`<polyline points="${validPoints.map(([,p])=>`${x(p.arm)},${y(p.weight)}`).join(' ')}" fill="none" stroke="${print?'#444':'#26766a'}" stroke-dasharray="4 4" opacity=".7"/>`:''}
    ${points.map(([id,p,label],i)=>p.arm>=-.5 && p.arm<=1.4 && p.weight>=13000 && p.weight<=29000?`<circle cx="${x(p.arm)}" cy="${y(p.weight)}" r="5" fill="${colors[i]}" stroke="${print?'#111':'white'}" stroke-width="2"><title>${label}: ${number(p.weight)} lbs / ${number(p.arm,3)} ft</title></circle>${print?`<text x="${x(p.arm)+8}" y="${y(p.weight)-6}" font-size="10" fill="#111">${{zeroFuel:'B',takeoff:'C',landing:'D'}[id]}</text>`:''}`:'').join('')}</g>
    <text x="${w/2}" y="${h-6}" font-size="9" text-anchor="middle" fill="currentColor">ПЛЕЧО ЦЕНТРОВКИ, ft ${outOfRange?'· ЕСТЬ ТОЧКИ ВНЕ ШКАЛЫ':''}</text>
    <text transform="translate(13 ${h/2}) rotate(-90)" font-size="9" text-anchor="middle" fill="currentColor">МАССА САМОЛЁТА, lbs</text>
  </svg>`;
}

export function fuelSvg(fuel = null) {
  const l=58,r=290,t=30,b=328;
  const x=m=>l+(m+2500)/9500*(r-l),y=w=>b-w/9000*(b-t);
  const curve=[[0,0],[533,0],[1200,-1000],[2200,-1700],[3300,-1540],[4500,-1100],[6000,0],[7200,2300],[7799,5381],[8446,5899]];
  return `<svg viewBox="0 0 320 370" role="img" aria-label="Топливная кривая по фото, приближённо. Расчёт демо использует постоянное плечо.">
  ${Array.from({length:10},(_,i)=>`<path d="M${l} ${y(i*1000)}H${r}" stroke="#aaa" stroke-width=".6"/><text x="${l-6}" y="${y(i*1000)+3}" font-size="8" text-anchor="end">${i*1000}</text>`).join('')}
  ${[-2000,0,2000,4000,6000].map(m=>`<path d="M${x(m)} ${t}V${b}" stroke="#aaa" stroke-width=".6"/><text x="${x(m)}" y="${b+15}" font-size="8" text-anchor="middle">${m}</text>`).join('')}
  <rect x="${l}" y="${t}" width="${r-l}" height="${b-t}" fill="none" stroke="#333"/>
  <path d="${curve.map(([w,m],i)=>`${i?'L':'M'}${x(m)} ${y(w)}`).join('')}" fill="none" stroke="#333" stroke-width="2"/>
  <text x="${l+8}" y="${t+16}" font-size="8">Full wing fuel 8,446 lb</text>
  <text x="${l+8}" y="${t+28}" font-size="8">Moment 5,899 ft·lb (по фото)</text>
  ${fuel!==null && Number.isFinite(fuel)&&fuel>=0&&fuel<=8446?`<circle cx="${x(fuel*.69)}" cy="${y(fuel)}" r="4" fill="#111"/><text x="${l+8}" y="${b-12}" font-size="8">● Демо: плечо 0,69 ft</text>`:''}
  <text x="${(l+r)/2}" y="365" font-size="8" text-anchor="middle">МОМЕНТ ТОПЛИВА, ft·lbs</text>
  <text transform="translate(14 180) rotate(-90)" font-size="9" text-anchor="middle">ТОПЛИВО В КРЫЛЕ, lbs</text>
  </svg>`;
}

/** @typedef {{id:string,label:string,short:string,arm:number,group:string,max?:number}} Station */
/** @typedef {{id:string,name:string,stations:Station[],limits:{zeroFuel:number,takeoff:number,landing:number},tanks:{wing:{arm:number,max:number},ventral:{arm:number,max:number}},mac:{referenceArm:number,referencePercent:number,length:number},envelope:number[][]}} AircraftModel */
/** @typedef {{id:string,modelId:string,registration:string,serial:string,emptyWeight:number,emptyArm:number}} AirframeProfile */

/** Source: user-supplied photograph. Curves and MAC calibration are approximate demo data. @type {AircraftModel} */
export const aircraft = {
  id: 'hs125-800xp', name: 'HS-125-800XP',
  stations: [
    { id: 'attendant', label: 'Бортпроводник', short: 'БП', arm: -14, group: 'crew' },
    { id: 'row1left', label: 'Ряд 1 · левое, лицом назад', short: '1Л', arm: -8, group: 'passenger' },
    { id: 'row1right', label: 'Ряд 1 · правое, лицом назад', short: '1П', arm: -8, group: 'passenger' },
    { id: 'row2left', label: 'Ряд 2 · левое, лицом вперёд', short: '2Л', arm: -3.8, group: 'passenger' },
    { id: 'row2right', label: 'Ряд 2 · правое, лицом вперёд', short: '2П', arm: -4.1, group: 'passenger' },
    { id: 'row3right', label: 'Ряд 3 · правое, лицом вперёд', short: '3П', arm: .3, group: 'passenger' },
    { id: 'sofaFront', label: 'Диван · переднее место', short: 'Д1', arm: -1.2, group: 'passenger' },
    { id: 'sofaMiddle', label: 'Диван · среднее место', short: 'Д2', arm: .5, group: 'passenger' },
    { id: 'sofaRear', label: 'Диван · заднее место', short: 'Д3', arm: 2.2, group: 'passenger' },
    { id: 'frontBag', label: 'Передний багажник', short: 'Б1', arm: -11.6, group: 'baggage', max: 250 },
    { id: 'wardrobe', label: 'Задний гардероб', short: 'Г', arm: 2.5, group: 'baggage', max: 100 },
    { id: 'rearBag', label: 'Задний багажник', short: 'Б2', arm: 4.6, group: 'baggage', max: 45 },
  ],
  limits: { zeroFuel: 18450, takeoff: 28000, landing: 23350 },
  // Wing maximum is the printed full-wing value on the graph; 7,799 is the handwritten example.
  tanks: { wing: { arm: .69, max: 8446 }, ventral: { arm: 8.36, max: 1496 } },
  // Demo linear scale anchored to the empty aircraft (0.513 ft / 24.8%). Not AFM geometry.
  mac: { referenceArm: .513, referencePercent: 24.8, length: 6.8 },
  // Approximate digitisation of the photographed silhouette, [arm ft, weight lbs].
  envelope: [[-.37,16000],[-.31,23000],[-.2,24500],[.02,26800],[.43,26800],[.52,28000],[1.05,28000],[1.3,27000],[1.3,24000],[1.15,22600],[.79,22200],[.69,21500],[.69,20500],[.74,19900],[.88,18300],[.93,17500],[.86,16900],[.83,14200],[-.04,14200]],
};

/** @type {AirframeProfile} */
export const airframe = { id: 'ra-02734', modelId: aircraft.id, registration: 'RA-02734', serial: '258719', emptyWeight: 16321, emptyArm: .513 };

export const profileRegistry = [{ model: aircraft, airframes: [airframe] }];

export function newFlight(example = false) {
  const date = new Date();
  const localDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return {
    version: 1, airframeId: airframe.id, unit: 'lbs',
    flight: { date: localDate, number: '', route: '', captain: '' },
    loads: Object.fromEntries(aircraft.stations.map(s => [s.id, example ? ({ attendant:166, row2left:176, row2right:176, row3right:176, frontBag:55 }[s.id] ?? 0) : 0])),
    fuel: { wing: example ? 7799 : 0, ventral: example ? 1496 : 0, remaining: null },
  };
}

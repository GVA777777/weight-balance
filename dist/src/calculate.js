/** @typedef {{version:number,airframeId:string,unit:'kg'|'lbs',flight:{date:string,number:string,route:string,captain:string},loads:Record<string,number>,fuel:{wing:number,ventral:number,remaining:number|null}}} FlightInput */
/** @typedef {{weight:number,moment:number,arm:number,mac:number}} BalancePoint */
/** @typedef {{errors:Record<string,string>,warnings:Array<{id:string,message:string}>,zeroFuel:BalancePoint|null,takeoff:BalancePoint|null,landing:BalancePoint|null,landingFuel:object|null,burn:object|null,rows:object[]}} CalculationResult */

export const KG_PER_LB = .45359237;
export const fromLbs = (value, unit) => unit === 'kg' ? value * KG_PER_LB : value;
export const toLbs = (value, unit) => unit === 'kg' ? value / KG_PER_LB : value;

export function parseWeight(raw, unit) {
  if (String(raw).trim() === '') return null;
  const normalized = String(raw).trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return NaN;
  const value = Number(normalized);
  return Number.isFinite(value) ? toLbs(value, unit) : NaN;
}

export function balancePoint(weight, moment, model) {
  const arm = moment / weight;
  return { weight, moment, arm, mac: model.mac.referencePercent + (arm - model.mac.referenceArm) / model.mac.length * 100 };
}

/** Fuel order supplied by user: ventral first, then wings. All values are lbs. */
export function distributeRemaining(wing, ventral, remaining) {
  if (![wing, ventral, remaining].every(n => Number.isFinite(n) && n >= 0) || remaining > wing + ventral + 1e-7) throw new RangeError('Некорректный остаток топлива');
  return { wing: Math.min(wing, remaining), ventral: Math.max(0, remaining - wing) };
}

/** @returns {CalculationResult} */
export function calculate(input, model, profile) {
  const errors = {}, warnings = [], rows = [];
  const valid = (value, id, label) => {
    if (value === null || !Number.isFinite(value) || value < 0 || value > 1000000) {
      errors[id] = `${label}: введите вес от 0 до 1 000 000 lbs`; return false;
    }
    return true;
  };
  let weight = profile.emptyWeight, moment = profile.emptyWeight * profile.emptyArm;
  let loadsValid = true;
  for (const station of model.stations) {
    const value = input.loads[station.id];
    if (!valid(value, station.id, station.label)) { loadsValid = false; continue; }
    const stationMoment = value * station.arm;
    rows.push({ ...station, weight: value, moment: stationMoment });
    weight += value; moment += stationMoment;
    if (station.max && value > station.max + 1e-7) warnings.push({ id: station.id, message: `${station.label}: превышен лимит ${station.max} lbs` });
  }
  const zeroFuel = loadsValid ? balancePoint(weight, moment, model) : null;
  let fuelValid = true;
  for (const key of ['wing', 'ventral']) {
    if (!valid(input.fuel[key], key, key === 'wing' ? 'Крыльевые баки' : 'Подфюзеляжный бак')) fuelValid = false;
    else if (input.fuel[key] > model.tanks[key].max + 1e-7) warnings.push({ id: key, message: `${key === 'wing' ? 'Крыльевые баки' : 'Подфюзеляжный бак'}: превышен лимит ${model.tanks[key].max} lbs` });
  }
  const takeoff = zeroFuel && fuelValid ? balancePoint(weight + input.fuel.wing + input.fuel.ventral, moment + input.fuel.wing * model.tanks.wing.arm + input.fuel.ventral * model.tanks.ventral.arm, model) : null;
  let landing = null, landingFuel = null, burn = null;
  if (input.fuel.remaining !== null) {
    if (valid(input.fuel.remaining, 'remaining', 'Остаток топлива') && fuelValid) {
      if (input.fuel.remaining > input.fuel.wing + input.fuel.ventral + 1e-7) errors.remaining = 'Остаток больше запаса топлива на взлёте';
      else {
        landingFuel = distributeRemaining(input.fuel.wing, input.fuel.ventral, input.fuel.remaining);
        const fuelMoment = landingFuel.wing * model.tanks.wing.arm + landingFuel.ventral * model.tanks.ventral.arm;
        if (zeroFuel) landing = balancePoint(weight + input.fuel.remaining, moment + fuelMoment, model);
        burn = { wing: input.fuel.wing - landingFuel.wing, ventral: input.fuel.ventral - landingFuel.ventral, total: input.fuel.wing + input.fuel.ventral - input.fuel.remaining, moment: input.fuel.wing * model.tanks.wing.arm + input.fuel.ventral * model.tanks.ventral.arm - fuelMoment };
      }
    }
  }
  for (const [key, point, label] of [['zeroFuel',zeroFuel,'Масса без топлива'],['takeoff',takeoff,'Взлётная масса'],['landing',landing,'Посадочная масса']]) {
    if (point && point.weight > model.limits[key] + 1e-7) warnings.push({ id: key, message: `${label}: превышен лимит ${model.limits[key]} lbs` });
  }
  return { errors, warnings, rows, zeroFuel, takeoff, landing, landingFuel, burn };
}

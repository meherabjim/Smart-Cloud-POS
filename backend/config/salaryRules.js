// Salary deduction rules — edit these numbers anytime.
// One day's pay = monthly salary / WORKING_DAYS_DIVISOR

module.exports = {
  WORKING_DAYS_DIVISOR: 30,   // 1 day = salary / 30
  ABSENT_FREE_DAYS: 3,        // 4th absent day onward: 1 day cut each
  LATE_GRACE_MINUTES: 15,     // guidance when marking late
  LATE_FREE_COUNT: 4,         // 5th late onward counts
  LATE_UNIT_FOR_ONE_DAY: 3,   // every 3 extra lates = 1 day cut
};

module.exports.calculateSalary = function calculateSalary(
  baseSalary,
  absentDays,
  lateDays
) {
  const rules = module.exports;

  const base = Number(baseSalary) || 0;
  const absent = Number(absentDays) || 0;
  const late = Number(lateDays) || 0;

  const perDay = base / rules.WORKING_DAYS_DIVISOR;

  const extraAbsent = Math.max(0, absent - rules.ABSENT_FREE_DAYS);
  const absentDeduction = round2(extraAbsent * perDay);

  const extraLate = Math.max(0, late - rules.LATE_FREE_COUNT);
  const lateUnits = Math.floor(extraLate / rules.LATE_UNIT_FOR_ONE_DAY);
  const lateDeduction = round2(lateUnits * perDay);

  const netPaid = Math.max(0, round2(base - absentDeduction - lateDeduction));

  return {
    base_salary: round2(base),
    per_day: round2(perDay),
    absent_days: absent,
    late_days: late,
    absent_deduction: absentDeduction,
    late_deduction: lateDeduction,
    net_paid: netPaid,
  };
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
// Salary deduction rules — edit these numbers anytime.
// One day's pay = monthly salary / WORKING_DAYS_DIVISOR

module.exports = {
  WORKING_DAYS_DIVISOR: 30,   // 1 day = salary / 30
  ABSENT_FREE_DAYS: 3,        // 4th absent day onward: 1 day cut each
  LATE_GRACE_MINUTES: 15,     // guidance when marking late
  LATE_FREE_COUNT: 4,         // 5th late onward counts
  LATE_UNIT_FOR_ONE_DAY: 3,   // every 3 extra lates = 1 day cut
  WEEKLY_HOLIDAY: 5,          // 0 = Sunday ... 5 = Friday (no attendance / close-day)
  TIMEZONE_OFFSET_HOURS: 6,   // Bangladesh time (UTC+6)
};

// Today's date in shop time as "YYYY-MM-DD"
module.exports.todayLocal = function todayLocal() {
  const offset = module.exports.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(Date.now() + offset).toISOString().slice(0, 10);
};

// A month can be paid only after it is over (from the 1st of next month)
module.exports.isMonthFinished = function isMonthFinished(year, month) {
  const [y, m] = module.exports.todayLocal().split("-").map(Number);
  return Number(year) < y || (Number(year) === y && Number(month) < m);
};

// "YYYY-MM-DD" is the weekly holiday?
module.exports.isWeeklyHoliday = function isWeeklyHoliday(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === module.exports.WEEKLY_HOLIDAY;
};

// presentDays: Present + Late days. If someone has absents but never
// came to work in the month, the salary is 0.
module.exports.calculateSalary = function calculateSalary(
  baseSalary,
  absentDays,
  lateDays,
  presentDays = null
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

  const workedDays = presentDays === null ? null : Number(presentDays) + late;
  const absentWholeMonth = workedDays === 0 && absent > 0;

  const netPaid = absentWholeMonth
    ? 0
    : Math.max(0, round2(base - absentDeduction - lateDeduction));

  return {
    base_salary: round2(base),
    per_day: round2(perDay),
    absent_days: absent,
    late_days: late,
    absent_deduction: absentDeduction,
    late_deduction: lateDeduction,
    net_paid: netPaid,
    absent_whole_month: absentWholeMonth,
  };
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
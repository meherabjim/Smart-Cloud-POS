const db = require("../config/db");
const { todayLocal, isWeeklyHoliday } = require("../config/salaryRules");

// Salary already paid for this user's month? Then attendance is locked.
const isMonthPaid = async (userId, dateStr) => {
  const [y, m] = String(dateStr).split("-").map(Number);
  const [rows] = await db.query(
    "SELECT id FROM salary_payments WHERE user_id = ? AND year = ? AND month = ? LIMIT 1",
    [userId, y, m]
  );
  return rows.length > 0;
};

// Only Admin can read every store; others locked to their own store.
const hasAllStoreAccess = (role) => role === "Admin";

const resolveStore = (req, bodyOrQueryStoreId) => {
  if (hasAllStoreAccess(req.user.role)) {
    return bodyOrQueryStoreId ? Number(bodyOrQueryStoreId) : null;
  }
  return req.user.store_id;
};

// GET /api/attendance?date=&store_id=
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date || todayLocal();
    const scopedStore = resolveStore(req, req.query.store_id);

    let sql = `
      SELECT
        u.id AS user_id, u.name, u.role, u.store_id,
        a.id AS attendance_id, a.status, a.check_in_time, a.note
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
      WHERE (u.status IS NULL OR u.status = 'Active')
        AND u.role <> 'Admin'
    `;
    const params = [date];
    if (scopedStore) { sql += " AND u.store_id = ?"; params.push(scopedStore); }
    sql += " ORDER BY u.name ASC";

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, date, staff: rows });
  } catch (error) {
    console.error("Get Attendance Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance   body: { user_id, date, status, check_in_time?, note? }
exports.markAttendance = async (req, res) => {
  try {
    const { user_id, date, status, check_in_time, note } = req.body;
    if (!user_id || !date || !status) {
      return res.status(400).json({ success: false, message: "user_id, date and status are required." });
    }
    const allowed = ["Present", "Late", "Absent", "Leave"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: "Date must be YYYY-MM-DD." });
    }
    if (String(date) > todayLocal()) {
      return res.status(400).json({ success: false, message: "Attendance cannot be marked for a future date." });
    }
    // Nobody marks their own attendance by hand.
    // Only a face-camera check-in for today (Present/Late) is allowed for yourself.
    const isSelf = Number(user_id) === Number(req.user.id);
    const faceCheckIn =
      req.body.source === "face" &&
      String(date) === todayLocal() &&
      (status === "Present" || status === "Late");
    if (isSelf && !faceCheckIn) {
      return res.status(403).json({ success: false, message: "You cannot mark your own attendance. Use the face camera or ask the Admin." });
    }
    const [userRows] = await db.query(
      "SELECT id, store_id, role FROM users WHERE id = ? LIMIT 1",
      [user_id]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    if (userRows[0].role === "Admin") {
      return res.status(400).json({ success: false, message: "Admin attendance is not tracked." });
    }
    if (await isMonthPaid(user_id, date)) {
      return res.status(400).json({
        success: false,
        message: "Salary for this month is already paid, so attendance is locked.",
      });
    }
    const staffStore = userRows[0].store_id;
    if (!hasAllStoreAccess(req.user.role) && Number(staffStore) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: "This staff member is not in your store." });
    }
    await db.query(
      `
      INSERT INTO attendance
        (user_id, store_id, date, status, check_in_time, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        check_in_time = VALUES(check_in_time),
        note = VALUES(note)
      `,
      [user_id, staffStore, date, status, check_in_time || null, note || null, req.user.id]
    );
    return res.json({ success: true, message: "Attendance saved." });
  } catch (error) {
    console.error("Mark Attendance Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/summary?year=&month=&store_id=
exports.getMonthlySummary = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const scopedStore = resolveStore(req, req.query.store_id);

    let sql = `
      SELECT
        u.id AS user_id, u.name, u.role, u.store_id, u.salary,
        IFNULL(SUM(a.status = 'Present'), 0) AS present_days,
        IFNULL(SUM(a.status = 'Late'), 0)    AS late_days,
        IFNULL(SUM(a.status = 'Absent'), 0)  AS absent_days,
        IFNULL(SUM(a.status = 'Leave'), 0)   AS leave_days
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND YEAR(a.date) = ? AND MONTH(a.date) = ?
      WHERE (u.status IS NULL OR u.status = 'Active')
        AND u.role <> 'Admin'
    `;
    const params = [year, month];
    if (scopedStore) { sql += " AND u.store_id = ?"; params.push(scopedStore); }
    sql += " GROUP BY u.id ORDER BY u.name ASC";

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true, year, month,
      staff: rows.map((r) => ({
        ...r,
        salary: Number(r.salary) || 0,
        present_days: Number(r.present_days) || 0,
        late_days: Number(r.late_days) || 0,
        absent_days: Number(r.absent_days) || 0,
        leave_days: Number(r.leave_days) || 0,
      })),
    });
  } catch (error) {
    console.error("Attendance Summary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance/close-day   body: { date, store_id? }
// Marks active staff with NO row for the date as Absent.
exports.closeDay = async (req, res) => {
  try {
    const date = req.body.date || todayLocal();
    const scopedStore = resolveStore(req, req.body.store_id);
    if (String(date) > todayLocal()) {
      return res.status(400).json({ success: false, message: "You cannot close a future day." });
    }
    if (isWeeklyHoliday(date)) {
      return res.status(400).json({ success: false, message: "This is the weekly holiday. Nobody is marked absent." });
    }
    if (!scopedStore) {
      return res.status(400).json({ success: false, message: "A store is required to close the day." });
    }
    const [missing] = await db.query(
      `
      SELECT u.id AS user_id, u.store_id
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
      WHERE u.store_id = ?
        AND (u.status IS NULL OR u.status = 'Active')
        AND u.role <> 'Admin'
        AND a.id IS NULL
      `,
      [date, scopedStore]
    );
    let marked = 0;
    for (const m of missing) {
      // Month already paid -> attendance locked, skip
      if (await isMonthPaid(m.user_id, date)) continue;
      await db.query(
        `
        INSERT INTO attendance (user_id, store_id, date, status, created_by)
        VALUES (?, ?, ?, 'Absent', ?)
        ON DUPLICATE KEY UPDATE status = status
        `,
        [m.user_id, m.store_id, date, req.user.id]
      );
      marked += 1;
    }
    return res.json({
      success: true,
      message: `Day closed. ${marked} staff marked Absent for ${date}.`,
      date, marked_absent: marked,
    });
  } catch (error) {
    console.error("Close Day Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
const db = require("../config/db");

const hasAllStoreAccess = (role) => role === "Admin" || role === "Viewer";

const resolveStore = (req, bodyOrQueryStoreId) => {
  if (hasAllStoreAccess(req.user.role)) {
    return bodyOrQueryStoreId ? Number(bodyOrQueryStoreId) : null;
  }
  return req.user.store_id;
};

// GET /api/attendance?date=YYYY-MM-DD&store_id=
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const scopedStore = resolveStore(req, req.query.store_id);

    let sql = `
      SELECT
        u.id AS user_id, u.name, u.role, u.store_id,
        a.id AS attendance_id, a.status, a.check_in_time, a.note
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
      WHERE (u.status IS NULL OR u.status = 'Active')
    `;
    const params = [date];

    if (scopedStore) {
      sql += " AND u.store_id = ?";
      params.push(scopedStore);
    }
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
      return res.status(400).json({
        success: false,
        message: "user_id, date and status are required.",
      });
    }

    const allowed = ["Present", "Late", "Absent", "Leave"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const [userRows] = await db.query(
      "SELECT id, store_id FROM users WHERE id = ? LIMIT 1",
      [user_id]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    const staffStore = userRows[0].store_id;

    if (
      !hasAllStoreAccess(req.user.role) &&
      Number(staffStore) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({
        success: false,
        message: "This staff member is not in your store.",
      });
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
    `;
    const params = [year, month];

    if (scopedStore) {
      sql += " AND u.store_id = ?";
      params.push(scopedStore);
    }
    sql += " GROUP BY u.id ORDER BY u.name ASC";

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      year,
      month,
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
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    console.log("✅ MySQL database-এর সাথে সফলভাবে কানেক্ট হয়েছে!");
  } catch (error) {
    console.error("❌ Database Connection Error:", error.code || error.message);
  } finally {
    if (connection) connection.release();
  }
}

testConnection();

module.exports = pool;
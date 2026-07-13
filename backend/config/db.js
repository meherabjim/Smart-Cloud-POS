const mysql = require("mysql2/promise");
require("dotenv").config();

const useSSL =
  String(process.env.DB_SSL || "false").toLowerCase() === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  ...(useSSL
    ? {
        ssl: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
        },
      }
    : {}),
});

async function testConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();
    console.log("✅ Database connection successful");
  } catch (error) {
    console.error(
      "❌ Database connection failed:",
      error.code || error.message
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

testConnection();

module.exports = pool;
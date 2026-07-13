const mysql = require("mysql2/promise");
require("dotenv").config();

const poolConfig = {
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
};

if (String(process.env.DB_SSL).toLowerCase() === "true") {
  poolConfig.ssl = {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  };
}

const pool = mysql.createPool(poolConfig);

async function testConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();

    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Errno:", error.errno);
    console.error("SQL State:", error.sqlState);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

testConnection();

module.exports = pool;
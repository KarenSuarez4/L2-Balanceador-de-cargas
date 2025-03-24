import mysql2 from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const connectiondb = mysql2.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connectiondb.connect((error) => {
  if (error) {
    console.error("Connection error:", error);
    return;
  }
  console.log("Connected to the database!");
});

export default connectiondb;
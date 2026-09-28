const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool(
    {
        host: env.dbHost,
        port: env.dbPort,
        database: env.dbName,
        user: env.dbUser,
        password: env.dbPassword
    });

module.exports = pool;
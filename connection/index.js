const { Sequelize } = require("sequelize");
const pg = require("pg");
pg.defaults.parseInputDatesAsUTC = true;
const { types } = pg;

const sequelize = new Sequelize("db_middleware", "zuhri", "JuaraMobile", {
  host: "103.229.161.187",
  port: 7432,
  // host: "localhost",
  // port: 5432,
  dialect: "postgres",
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
  },
});

module.exports = { sequelize };
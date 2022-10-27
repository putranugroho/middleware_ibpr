const db = require("../connection");

const date = async () => {
  const dateTimeDb = await db.sequelize.query(`SELECT NOW()`, {
    type: db.sequelize.QueryTypes.SELECT,
  });

  return dateTimeDb;
};

module.exports = {
  date,
};

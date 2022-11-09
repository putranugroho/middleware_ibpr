const axios = require("axios").default;

module.exports = axios.create({
  baseURL: "https://integration-dev.oyindonesia.com",

  headers: {
    "Content-Type": "application/json",
    "X-OY-Username": process.env.X_OY_Username,
    "X-Api-Key": process.env.X_Api_Key,
  },
});

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require("cors");
const gateway_atm = require("./router/gateway_atm");
const middleware = require("./router/middleware");
const oy = require("./router/oy");
// require("./utility/redis");

const { sequelize } = require("./connection");

sequelize
  .authenticate()
  .then((db) => {
    console.log("CONNECTION ESTABLISHED! ");
  })
  .catch((err) => {
    console.error("UNABLE TO ESTABLISH CONNECTION: ", err);
  });

const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.raw());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/gateway_atm", gateway_atm);
app.use("/mdw", middleware);
app.use("/oy", oy);

app.get("/", (req, res) => {
  res.send("middleware-api");
});

app.listen(port, () => {
  console.log(`Middleware-API listening at http://localhost:${port}`);
});

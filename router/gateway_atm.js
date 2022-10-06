const express = require("express");
const { tarik_tunai } = require("../controller/gateway_atm");

const router = express.Router();

router.post("/tariktunai", tarik_tunai);

module.exports = router;
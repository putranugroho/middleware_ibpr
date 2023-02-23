const express = require("express");
const { list_bpr, get_gl, get_trans, get_konsol } = require("../controller/dashboard");

const router = express.Router();

router.get("/list_bpr", list_bpr);
router.get("/get_gl", get_gl);
router.get("/get_trans", get_trans);
router.get("/get_konsol", get_konsol);

module.exports = router;
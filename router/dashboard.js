const express = require("express");
const { list_bpr, get_gl, get_trans, all_trans, get_konsol, list_atm, release_status } = require("../controller/dashboard");

const router = express.Router();

router.get("/list_bpr", list_bpr);
router.get("/get_gl", get_gl);
router.get("/get_trans", get_trans);
router.get("/all_trans", all_trans);
router.get("/get_konsol", get_konsol);
router.get("/list_atm", list_atm);
// router.post("/release_status", release_status);

module.exports = router;
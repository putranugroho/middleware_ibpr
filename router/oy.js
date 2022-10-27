const express = require("express");
const { webview, webview2, validate_mpin, bill_payment, check_status_ppob, reversal_ppob} = require("../controller/oy/ppob");
const { release_withdrawal, request_withdrawal, check_status_withdrawal, reversal_withdrawal } = require("../controller/oy/withdrawal");

const router = express.Router();

// router.post("/inquiry_acc", inquiry_account);
// router.post("/validate_user", validate_user);
router.get("/webview", webview);
router.get("/webview2", webview2);
router.post("/bill_payment", bill_payment);
router.post("/check_status_ppob", check_status_ppob);
router.post("/reversal_ppob", reversal_ppob);
router.post("/request_withdrawal", request_withdrawal);
router.post("/release_withdrawal", release_withdrawal);
// router.post("/validate_token", validate_token);
router.post("/check_status_withdrawal", check_status_withdrawal);
router.post("/reversal_withdrawal", reversal_withdrawal);

module.exports = router;

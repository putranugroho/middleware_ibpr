const express = require("express");
const { inquiry_account, validate_user, otp_mpin} = require("../controller/oy/onboarding");
const { inquiry_account_trf, transfer_db_cr, check_status_trf, reversal_trf} = require("../controller/oy/transfer");
const { webview, validate_mpin, bill_payment, check_status_ppob, reversal_ppob} = require("../controller/oy/ppob");
const { request_withdrawal, release_withdrawal, check_status_withdrawal, check_status_token, reversal_withdrawal } = require("../controller/oy/withdrawal");

const router = express.Router();

router.post("/inquiry_acc", inquiry_account);
router.post("/validate_user", validate_user);
router.post("/otp_mpin", otp_mpin);
router.post("/inquiry_acc_trf", inquiry_account_trf);
router.post("/transfer_db_cr", transfer_db_cr);
router.post("/check_status_trf", check_status_trf);
router.post("/reversal_trf", reversal_trf);
router.get("/webview", webview);
router.post("/validate_mpin", validate_mpin);
router.post("/bill_payment", bill_payment);
router.post("/check_status_ppob", check_status_ppob);
router.post("/reversal_ppob", reversal_ppob);
router.post("/request_withdrawal", request_withdrawal);
router.post("/release_withdrawal", release_withdrawal);
router.post("/check_status_withdrawal", check_status_withdrawal);
router.post("/check_status_token", check_status_token);
router.post("/reversal_withdrawal", reversal_withdrawal);

module.exports = router;

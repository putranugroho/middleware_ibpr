const express = require("express");
const { inquiry_account, inquiry_balance, inquiry_transaction, cash_transfer } = require("../controller/oy");

const router = express.Router();

router.post("/inquiry_acc", inquiry_account);
router.post("/inquiry_bal", inquiry_balance);
router.post("/inquiry_trans", inquiry_transaction);
router.post("/cash_transfer", cash_transfer);

module.exports = router;
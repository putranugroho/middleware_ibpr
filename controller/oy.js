// const axios = require("../Services/API");
const db = require("../connection");
const moment = require("moment");
moment.locale("id");

// API untuk Inquiry Account
const inquiry_account = async (req, res) => {
    let {AccountNumber, BankCode} = req.body;
    try {
        let request = await db.sequelize.query(
            `SELECT nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
            {
                replacements: [BankCode, AccountNumber],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            res.status(200).send({
                code: "999",
                status: "ok",
                message: "Gagal Account Tidak Ditemukan",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: request,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Inquiry Balance
const inquiry_balance = async (req, res) => {
    let {CorporateID, AccessCode, BranchCode, UserID, LocalID} = req.body.Authentication;
    let {BankCodeType, BankCodeValue, AccountNumber} = req.body.BeneficiaryDetails;
    try {
        let request = await db.sequelize.query(
            `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
            {
                replacements: [BranchCode, AccountNumber],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            let response = {}
            response['BeneficiaryDetails'] = {
                CurrencyID : "",
                AccountBalance : ""
            }
            response['StatusTransaction'] = "9999"
            response['StatusMessage'] = "Failed"
            res.status(200).send(
                response
            );
        } else {
            let balance = await db.sequelize.query(
                `SELECT saldo FROM dummy_rek_tabungan WHERE no_rek = ? AND nama_rek = ? AND status_rek = '1'` ,
                {
                    replacements: [request[0].no_rek, request[0].nama_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            let response = {}
            response['BeneficiaryDetails'] = {
                CurrencyID : "IDR",
                AccountBalance : balance[0]
            }
            response['StatusTransaction'] = "0000"
            response['StatusMessage'] = "Success"
            res.status(200).send(
                response
            );
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Inquiry Transaction
const inquiry_transaction = async (req, res) => {
    let {CorporateID, AccessCode, BranchCode, UserID, LocalID} = req.body.Authentication;
    let {InquiryBy, InquiryValue} = req.body.TransactionDetails;
    try {
        // let request = await db.sequelize.query(
        //     `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
        //     {
        //         replacements: [BranchCode, AccountNumber],
        //         type: db.sequelize.QueryTypes.SELECT,
        //     }
        // )
        // if (!request.length) {
        //     response['BeneficiaryDetails'] = {
        //         CurrencyID : "",
        //         AccountBalance : ""
        //     }
        //     response['StatusTransaction'] = "9999"
        //     response['StatusMessage'] = "Failed"
        //     res.status(200).send(
        //         response
        //     );
        // } else {
            let response = {}
            response['SenderDetails'] = {
                FirstName : "ERWINA TAUFIK",
                LastName : ""
            }
            response['BeneficiaryDetails'] = {
                Name : "ERWINA TAUFIK",
                BankCodeType : "BIC",
                BankCodeValue : "CENAIDJAXXX",
                AccountNumber : "0012323008"
            }
            response['TransactionDetails'] = {
                AmountPaid : "2110000",
                CurencyID : "IDR",
                ReleaseDateTime : "",
                LocalID : "EBNMEECT",
                FormNumber : "CT17 IDR3A",
                ReferenceNumber : "ABNMAE01000NON16010000120",
                PIN : "0247986327",
                Description1 : "DNP1.3",
                Description2 : ""
            }
            response['StatusTransaction'] = "0003"
            response['StatusMessage'] = "Ready to Encash"
            res.status(200).send(
                response
            );
        // }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Cash Transfer
const cash_transfer = async (req, res) => {
    let {CorporateID, AccessCode, BranchCode, UserID, LocalID} = req.body.Authentication;
    let {FirstName, Address1, City, CountryID} = req.body.SenderDetails;
    let {Name, Country} = req.body.BeneficiaryDetails;
    let {CurrencyID, Amount, PurposeCode, DetailOfCharges, SourceOfFund, FormNumber} = req.body.TransactionDetails;
    try {
        // let request = await db.sequelize.query(
        //     `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
        //     {
        //         replacements: [BranchCode, AccountNumber],
        //         type: db.sequelize.QueryTypes.SELECT,
        //     }
        // )
        // if (!request.length) {
        //     response['BeneficiaryDetails'] = {
        //         CurrencyID : "",
        //         AccountBalance : ""
        //     }
        //     response['StatusTransaction'] = "9999"
        //     response['StatusMessage'] = "Failed"
        //     res.status(200).send(
        //         response
        //     );
        // } else {
            let response = {}
            response['BeneficiaryDetails'] = {
                Name : "SANTIAGO 7"
            }
            response['TransactionDetails'] = {
                PIN : "SBCD123456789",
                CurencyID : "USD",
                Amount : "236",
                Description1 : "DCP1.3",
                Description2 : "",
                FormNumber : "CT074 VLS3C",
                ReferenceNumber : "CITIID01000NON1604000099",
                ReleaseDateTime : "",
            }
            response['StatusTransaction'] = "0003"
            response['StatusMessage'] = "Ready to Encash"
            res.status(200).send(
                response
            );
        // }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

module.exports = {
    inquiry_account,
    inquiry_balance,
    inquiry_transaction,
    cash_transfer
};
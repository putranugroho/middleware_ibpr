// const api_offline = require("../Services/API/api_offline");
// const api_crm = require("../Services/API/api_crm");
const axios = require("axios").default;
var https = require('https');
const db = require("../../connection");
const moment = require("moment");
moment.locale("id");
const { date } = require("../../utility/getDate");
const hmacSHA256 = require('crypto-js/hmac-sha256');
const Base64 = require("crypto-js/enc-base64");

const api_crm = "https://integration-stg.oyindonesia.com"
const api_offline = "https://api-stg.oyindonesia.com"
const timestampMs = moment().format('YYYYMMDDHHmmss')

// Generate random ref number
function generateString(length) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

const agent = new https.Agent({  
    rejectUnauthorized: false
  });
  
  
// API untuk Inquiry Account
const inquiry_account = async (req, res) => {
    let {no_rek, no_hp, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        let number = Math.random() * 30
        let request = await db.sequelize.query(
            `SELECT no_hp, no_rek, bpr_id, nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
            {
                replacements: [bpr_id, no_hp, no_rek],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            res.status(200).send({
                rcode: "999",
                status: "ok",
                message: "Gagal Account Tidak Ditemukan",
                data: null,
            });
        } else {
            request[0]["tgl_trans"] = moment().format('YYYY-MM-DD HH:mm:ss'),
            request[0]["tgl_transmis"] = moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
            request[0]["rrn"] = rrn
            res.status(200).send({
                rcode: "000",
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

// API untuk Inquiry Account
const validate_user = async (req, res) => {
    let {no_rek, no_hp, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        let number = Math.random() * 30
        let request = await db.sequelize.query(
            `SELECT no_hp, bpr_id, no_rek, nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
            {
                replacements: [bpr_id, no_hp, no_rek],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            res.status(200).send({
                rcode: "999",
                status: "ok",
                message: "Gagal Account Tidak Ditemukan",
                data: null,
            });
        } else {
            request[0]["tgl_trans"] = moment().format('YYYY-MM-DD HH:mm:ss'),
            request[0]["tgl_transmis"] = moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
            request[0]["rrn"] = rrn
            res.status(200).send({
                rcode: "000",
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

module.exports = {
    inquiry_account,
    validate_user
};



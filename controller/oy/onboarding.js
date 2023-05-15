// const api_offline = require("../Services/API/api_offline");
// const api_crm = require("../Services/API/api_crm");
const axios = require("axios").default;
var https = require('https');
const db = require("../../connection");
const db1 = require("../../connection/ibprdev");
const moment = require("moment");
moment.locale("id");
const { date } = require("../../utility/getDate");
const hmacSHA256 = require('crypto-js/hmac-sha256');
// var SHA256 = require("crypto-js/sha256");
const Base64 = require("crypto-js/enc-base64");

const api_crm = "https://integration-stg.oyindonesia.com"
const api_offline = "https://api-stg.oyindonesia.com"
const timestampMs = moment().format('YYYYMMDDHHmmss')

// Generate random ref number
function generateNumber(length) {
    const characters ='0123456789';
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

const connect_axios = async (url, route, data) => {
    try {
        let Result = ""
        console.log(`${url}${route}`);
        await axios({
            method: 'post',
            url: `${url}${route}`,
            timeout: 50000, //milisecond
            data
        }).then(res => {
            Result = res.data
        }).catch(error => {
            if (error.code == 'ECONNABORTED'){
                Result = {
                    code: "088",
                    status: "ECONNABORTED",
                    message: "Gateway Connection Timeout"
                }
            } else {
                Result = error
            }
        });
        return Result
    } catch (error) {
        res.status(200).send({
            code: "099",
            status: "Failed",
            message: error.message
        });      
    }
}
  
  
// API untuk Inquiry Account
const inquiry_account = async (req, res) => {
    let {no_rek, no_hp, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        console.log("REQ BODY INQUIRY");
        console.log(req.body);
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR Tidak Ditemukan",
                data: [],
            });
        } else {
            // let request = await db.sequelize.query(
            //     `SELECT no_hp, no_rek, bpr_id, nama_rek, status FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
            //     {
            //         replacements: [bpr_id, no_hp, no_rek],
            //         type: db.sequelize.QueryTypes.SELECT,
            //     }
            // )
            // if (!request.length) {
            //     res.status(200).send({
            //         code: "004",
            //         status: "Failed",
            //         message: "Gagal Account Tidak Ditemukan",
            //         data: null,
            //     });
            const trx_code = "0100"
            const trx_type = "TRX"
            const tgl_transmis = moment().format('YYMMDDHHmmss')
            // let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            //     `INSERT INTO log_mdw(no_hp,bpr_id,no_rek,trx_code,trx_type,tgl_trans,tgl_transmis,rrn,messages_type) VALUES (?,?,?,?,?,?,?,?,'REQUEST')`,
            //     {
            //         replacements: [
            //             no_rek, no_hp, bpr_id, trx_code, trx_type, tgl_trans, tgl_transmis, rrn
            //         ],
            //     }
            //     );
            const data = {no_rek, no_hp, bpr_id, trx_code, trx_type, tgl_trans, tgl_transmis, rrn}
            const request = await connect_axios(bpr[0].gateway,"gateway_bpr/inquiry_account",data)
            if (request.code !== "000") {
                console.log(request);
                res.status(200).send(request);
            } else {
                response = request.data
                if (trx_code == "0100") {
                    if (response.status == "0") {
                        response.status = "AKUN NON AKTIF"
                    } else if (response.status == "1") {
                        response.status = "AKUN AKTIF"
                    } else if (response.status == "2") {
                        response.status = "AKUN BLOCKED"
                    } else {
                        response.status_rek = "UNKNOWN STATUS"
                    }
                } else if (trx_code == "0200") {
                    if (response.status_rek == "0") {
                        response.status_rek = "AKUN NON AKTIF"
                    } else if (response.status_rek == "1") {
                        response.status_rek = "AKUN AKTIF"
                    } else if (response.status_rek == "2") {
                        response.status_rek = "AKUN BLOCKED"
                    } else {
                        response.status_rek = "UNKNOWN STATUS"
                    }
                }
                console.log({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    data: response,
                });
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    data: response,
                });
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.status(200).send({
        code: "099",
        status: "Failed",
        message: error.message
    });
    }
};

// API untuk Inquiry Account
const validate_user = async (req, res) => {
    let {no_rek, no_hp, password, bpr_id, status, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        console.log("REQ BODY VALIDATE");
        console.log(req.body);
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR Tidak Ditemukan",
                data: [],
            });
        } else {
            let [results, metadata] = await db1.sequelize.query(
                `UPDATE acct_ebpr SET password = ? WHERE no_hp = ? AND bpr_id = ? AND status != '6'`,
                {
                    replacements: [password, no_hp, bpr_id],
                }
            );
            const trx_code = "0100"
            const data = {no_rek, no_hp, bpr_id, trx_code, status, tgl_trans, rrn}
            const request = await connect_axios(bpr[0].gateway,"gateway_bpr/inquiry_account",data)
            if (request.code !== "000") {
                    res.status(200).send(request);
            } else {
                response = request.data
                if (response.status == "0") {
                    response.status = "Akun telah dinon-aktifkan"
                } else if (response.status == "1") {
                    response.status = "Akun telah diaktifkan"
                } else if (response.status == "2") {
                    response.status = "Akun telah diblokir"
                } else {
                    response.status = "Status tidak diketahui"
                }
                response["tgl_trans"] = tgl_trans,
                response["tgl_transmis"] = moment().format('YYMMDDHHmmss'),
                response["rrn"] = rrn
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    data: response,
                });
            }
        }
    } catch (error) {
        //--error server--//
        console.log("erro get product", error);
        res.status(200).send({
            code: "099",
            status: "Failed",
            message: error.message
        });
    }
};

// API untuk OTP MPIN
const otp_mpin = async (req, res) => {
    // const data = req.body
    let {no_rek, no_hp, bpr_id, tgl_trans, rrn} = req.body;
    try {
        let response = {}
        let request_data = {}
        // let account = await db.sequelize.query(
        //     `SELECT no_hp, bpr_id, no_rek, nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
        //     {
        //         replacements: [bpr_id, no_hp, no_rek],
        //         type: db.sequelize.QueryTypes.SELECT,
        //     }
        // )
        // if (!account.length) {
        //     res.status(200).send({
        //         code: "999",
        //         status: "ok",
        //         message: "Gagal Account Tidak Ditemukan",
        //         data: null,
        //     });
        // } else {
            let random_number = await generateNumber(6)
            let [results, metadata] = await db.sequelize.query(
                `INSERT INTO sms_mpin(no_hp, bpr_id, no_rek, nama_rek, mpin, tgl_trans, status) VALUES (?,?,?,?,?,?,'0')`,
                {
                replacements: [
                    no_hp,
                    bpr_id,
                    no_rek,
                    // account[0].nama_rek,
                    "TEST",
                    random_number,
                    tgl_trans,
                ],
                }
            );
            if (!metadata) {
                response['code'] = "99"
                response['message'] = "Gagal input data mpin"

                res.status(200).send(
                    response,
                );
            } else {
                request_data['noacc'] = no_rek
                request_data['nohp'] = no_hp
                request_data['pesan'] = `MPIN ANDA ADALAH: ${random_number}`
                request_data["noreff"] = rrn.substring(rrn.length-6,rrn.length)
                    
                let mgp_request = await connect_axios("8020", "00000002", rrn, request_data, tgl_trans,)
                console.log(mgp_request);
                
                // data['kodetransaksi'] = data.KODETRX
                response['nohp'] = no_hp
                response['norek'] = no_rek
                // response['nama'] = account[0].nama_rek
                response['nama'] = "TEST"
                // response['saldo'] = `1002360C${saldo_kartu}`
                response['code'] = "000"
                response['message'] = "SUCCESS"
                
                console.log("========================================================================");
                console.log("Response sms mpin : ");
                console.log(response);
                console.log("========================================================================");
                
                res.send(response)
            }
        // }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
        res.status(200).send({
            code: "099",
            status: "Failed",
            message: error.message
        });
    }
};

module.exports = {
    inquiry_account,
    validate_user,
    otp_mpin
};



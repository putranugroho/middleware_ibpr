// const api_offline = require("../Services/API/api_offline");
// const api_crm = require("../Services/API/api_crm");
const axios = require("axios").default;
var https = require('https');
const db = require("../../connection");
const moment = require("moment");
moment.locale("id");
const { date } = require("../../utility/getDate");
// const hmacSHA256 = require('crypto-js/hmac-sha256');
var SHA256 = require("crypto-js/sha256");
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

var connect_axios = async (kd, userid, trcid, data, timestamp) => {
    try {
        const body = `{"kd":"${kd}","userid":"${userid}","trcid":"${trcid}","data":${JSON.stringify(data)}}`
        const signature = "ATMPNN"+body+timestamp
        const secret_key = `52TK3zfB")feeX};${trcid}`
        console.log(signature);
        console.log(secret_key);
        const api_signature = SHA256(signature,secret_key)
        // console.log(api_signature);
        let Result = ""
        await axios({
            method: 'post',
            url: 'http://112.78.38.250:21529/mgp/api-atm',
            // url: 'http://192.168.32.98:12211/mgp/api-atm',
            timeout: 25000, //milisecond
            headers: {
                'api-signature': api_signature,
                'api-timestamp': timestamp
                },
            data: {
                "kd": kd,
                "userid": userid,
                "trcid": trcid,
                "data": data
            }
        }).then(res => {
            Result = res.data
        }).catch(error => {
            Result = error
        });
        return Result
    } catch (error) {
        throw error       
    }
 
}

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
        //         rcode: "999",
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
                response['rcode'] = "99"
                response['message'] = "Gagal input data mpin"

                res.status(200).send(
                    response,
                );
            } else {
                request_data['noacc'] = no_rek
                request_data['nohp'] = no_hp
                request_data['pesan'] = `MPIN ANDA ADALAH: ${random_number}`
                // request_data["noreff"] = data.RESI
                    
                let mgp_request = await connect_axios("8020", "000000001", rrn, request_data, tgl_trans)
                console.log(mgp_request);
                
                // data['kodetransaksi'] = data.KODETRX
                response['nohp'] = no_hp
                response['norek'] = no_rek
                // response['nama'] = account[0].nama_rek
                // response['saldo'] = `1002360C${saldo_kartu}`
                response['rcode'] = "000"
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
      res.send(error);
    }
};

module.exports = {
    inquiry_account,
    validate_user,
    otp_mpin
};



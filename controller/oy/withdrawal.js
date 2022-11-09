const axios = require("axios").default;
var https = require('https');
const db = require("../../connection");
const moment = require("moment");
moment.locale("id");
const { date } = require("../../utility/getDate");
const hmacSHA256 = require('crypto-js/hmac-sha256');
const Base64 = require("crypto-js/enc-base64");

const api_crm = "https://integration-dev.oyindonesia.com/"
// const api_offline = "https://api-stg.oyindonesia.com"
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

const message_status = (status) => {
    let withdrawal_status, withdrawal_status_notes
    switch (status) {
        
        case "0":
            withdrawal_status = "PENDING"
            withdrawal_status_notes = "Withdrawal pending and have not been proses"
            break;

        case "2":
            withdrawal_status = "FAILED"
            withdrawal_status_notes = "Withdrawal expired or encounter problem"
            break;
    
        default:
            withdrawal_status = "SUCCESS",
            withdrawal_status_notes = "Withdrawal success and has been completed"
            break;
    }

    return {withdrawal_status,withdrawal_status_notes}
}

// API untuk Request Transaction
const request_withdrawal = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        amount,
        trans_fee,
        trx_code,
        trx_type,
        tgl_trans,
        tgl_transmis,
        rrn} = req.body;
    try {
        console.log(`tgl_trans OY : ${tgl_trans}`);
        tgl_trans = moment(tgl_trans).format("YYMMDDHHmmss")
        let check_bpr = await db.sequelize.query(
            `SELECT bpr_id, nama_bpr FROM kd_bpr WHERE bpr_id = ?`,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!check_bpr.length) {
            res.status(200).send({
                code: "099",
                status: "ok",
                message: "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
                data: null,
            });
        } else {
            let check_saldo = await db.sequelize.query(
                `SELECT saldo,saldo_min,nama_rek FROM dummy_rek_tabungan WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                {
                    replacements: [no_rek, no_hp, bpr_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!check_saldo.length) {
                res.status(200).send({
                    code: "099",
                    status: "ok",
                    message: "Gagal, Terjadi Kesalahan Pencarian Rekening!!!",
                    data: null,
                });
            } else {
                let saldo = parseInt(check_saldo[0].saldo);
                let saldo_min = parseInt(check_saldo[0].saldo_min);
                if (saldo - amount > saldo_min) {
                    const dateTimeDb = await date()
                    let receiptNo = generateString(4);
                    const tgl_expired = moment(dateTimeDb[0].now)
                        .add(1, "hours")
                        .format('YYYY-MM-DD HH:mm:ss');
            
                    let reff =  `${receiptNo}${rrn}${bpr_id}${no_hp}`
            
                    let ket_trans = `${check_saldo[0].nama_rek} tarik tunai ${moment(
                        dateTimeDb[0].now
                    ).format()} nominal ${amount}`;
            
                    let [results, metadata] = await db.sequelize.query(
                        `INSERT INTO dummy_hold_dana(no_hp, bpr_id, no_rek, nama_rek, tcode, ket_trans, reff, amount, tgl_trans, status) VALUES (?,?,?,?,?,?,?,?,?,'0')`,
                        {
                        replacements: [
                            no_hp,
                            bpr_id,
                            no_rek,
                            check_saldo[0].nama_rek,
                            trx_code,
                            ket_trans,
                            reff,
                            amount,
                            tgl_trans,
                        ],
                        }
                    );
        
                    if (!metadata) {
                        res.status(200).send({
                        code: "099",
                        status: "ok",
                        message: "Gagal, Terjadi Kesalahan Hold Dana!!!",
                        data: null,
                        });
                    } else {
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, tgl_trans, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,'0')`,
                            {
                            replacements: [
                                no_hp,
                                bpr_id,
                                no_rek,
                                check_saldo[0].nama_rek,
                                trx_code,
                                "tariktunai",
                                ket_trans,
                                reff,
                                amount,
                                tgl_trans,
                            ],
                            }
                        );
                        if (!metadata) {
                            res.status(200).send({
                            code: "099",
                            status: "ok",
                            message: "Gagal, Terjadi Kesalahan Insert Transaksi!!!",
                            data: null,
                            });
                        } else {
                            let [results, metadata] = await db.sequelize.query(
                            `UPDATE dummy_rek_tabungan SET saldo = saldo - ? WHERE no_rek = ? AND bpr_id = ? AND status_rek = '1'`,
                            {
                                replacements: [amount, no_rek, bpr_id],
                            }
                            );
                            if (!metadata) {
                            res.status(200).send({
                                code: "099",
                                status: "ok",
                                message: "Gagal, Terjadi Kesalahan Update Saldo!!!",
                                data: null,
                            });
                            } else {
                                let response = {
                                    no_hp,
                                    bpr_id,
                                    nama_rek: check_saldo[0].nama_rek,
                                    amount,
                                    trans_fee,
                                    reff,
                                    tgl_trans,
                                    tgl_transmis : moment().format('YYYY-MM-DD HH:mm:ss'),
                                    rrn
                                }
                                //--berhasil dapat list product update atau insert ke db --//
                                console.log("Success");
                                res.status(200).send({
                                    rcode: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: response,
                                });
                            }
                        }
                    }
                } else {
                    res.status(200).send({
                        code: "099",
                        status: "ok",
                        message: "Gagal, Terjadi Kesalahan Kurangin Saldo!!!",
                        data: null,
                    });
                }
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Check Status Withdrawal
const check_status_withdrawal = async (req, res) => {
    let {
        reference_number,
        request_timestamp} = req.body;
    try {
        console.log(req.body);
        let rrn = reference_number.substring(0,6)
        let bpr_id = reference_number.substring(6,10)
        let no_hp = reference_number.substring(10,reference_number.length)
        // timestamp = moment(timestamp).format('YYMMDDHHmmss')
        console.log(bpr_id);
        console.log(request_timestamp);
        console.log(no_hp);
        let transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_hp = ? AND bpr_id = ? AND reference_number = ?`,
            {
            replacements: [
                no_hp,
                bpr_id,
                reference_number
            ],
            type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!transaksi.length) {
            res.status(200).send({
                rcode: "099",
                status: "ok",
                message: "Gagal, Terjadi Kesalahan Pencarian reference_number!!!",
                data: null,
            });
        } else {
            let response_message = await message_status(transaksi[0].status)
            let response = {
                "withdrawal_status": response_message.withdrawal_status,
                "withdrawal_status_notes": response_message.withdrawal_status_notes,
                "amount": {
                    "value": transaksi[0].amount,
                    "currency": "IDR"
                },
                "fee": {
                    "value": transaksi[0].admin_fee,
                    "currency": "IDR"
                },
                "invoice_number": reference_number,
                "customer": {
                    "name": transaksi[0].nama_rek,
                    "account_number": no_hp
                }
            }
            //--berhasil dapat list product update atau insert ke db --//
            console.log("Success");
            res.status(200).send({
                rcode: "000",
                status: "ok",
                message: "Success",
                data: response,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Reversal Withdrawal
const reversal_withdrawal = async (req, res) => {
    let {
        no_hp,
        no_rek,
        bpr_id,
        amount,
        trans_fee,
        trx_code,
        trx_type,
        token,
        tgl_trans,
        tgl_transmis,
        rrn} = req.body;
    try {
        let number = Math.random() * 30
        // let request = await db.sequelize.query(
        //     `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
        //     {
        //         replacements: [BranchCode, no_rek],
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
            let response = {
                no_hp,
                no_rek,
                bpr_id,
                amount : 50000,
                trans_fee : 0,
                trx_code,
                trx_type,
                token,
                reff : "TT/TEST ACCOUNT/20220906/1662476661308",
                code : "000",
                status : "Success",
                tgl_trans,
                tgl_transmis : moment(tgl_trans).add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
                rrn
            }
            //--berhasil dapat list product update atau insert ke db --//
            console.log("Success");
            res.status(200).send({
                rcode: "000",
                status: "ok",
                message: "Success",
                data: response,
            });
        // }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

module.exports = {
    request_withdrawal,
    // release_withdrawal,
    // validate_token,
    check_status_withdrawal,
    reversal_withdrawal
};

// API untuk Request Transaction
// const request_withdrawal = async (req, res) => {
//     let {
//         no_hp,
//         bpr_id,
//         no_rek,
//         amount,
//         trans_fee,
//         trx_code,
//         trx_type,
//         tgl_trans,
//         tgl_transmis,
//         rrn} = req.body;
//     try {
//         const tgl_trans = moment().format("YYYY-MM-DD HH:mm:ss")
//         let check_bpr = await db.sequelize.query(
//             `SELECT bpr_id, nama_bpr FROM kd_bpr WHERE bpr_id = ?`,
//             {
//                 replacements: [bpr_id],
//                 type: db.sequelize.QueryTypes.SELECT,
//             }
//         );
//         if (!check_bpr.length) {
//             res.status(200).send({
//                 code: "099",
//                 status: "ok",
//                 message: "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
//                 data: null,
//             });
//         } else {
//             let check_saldo = await db.sequelize.query(
//                 `SELECT saldo,saldo_min,nama_rek FROM dummy_rek_tabungan WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
//                 {
//                     replacements: [no_rek, no_hp, bpr_id],
//                     type: db.sequelize.QueryTypes.SELECT,
//                 }
//             );
//             if (!check_saldo.length) {
//                 res.status(200).send({
//                     code: "099",
//                     status: "ok",
//                     message: "Gagal, Terjadi Kesalahan Pencarian Rekening!!!",
//                     data: null,
//                 });
//             } else {
//                 let saldo = parseInt(check_saldo[0].saldo);
//                 let saldo_min = parseInt(check_saldo[0].saldo_min);
//                 if (saldo - amount > saldo_min) {
//                     const dateTimeDb = await date()
//                     let receiptNo = generateString(20);
//                     const tgl_expired = moment(dateTimeDb[0].now)
//                         .add(1, "hours")
//                         .format('YYYY-MM-DD HH:mm:ss');
            
//                     let reff = `TT/${check_saldo[0].nama_rek}/${moment().format('YYYYMMDD')}/${receiptNo}`
            
//                     let ket_trans = `${check_saldo[0].nama_rek} tarik tunai ${moment(
//                         dateTimeDb[0].now
//                     ).format()} nominal ${amount}`;
            
//                     let [results, metadata] = await db.sequelize.query(
//                         `INSERT INTO dummy_hold_dana(no_hp, bpr_id, no_rek, nama_rek, tcode, ket_trans, reff, amount, tgl_trans, status) VALUES (?,?,?,?,?,?,?,?,?,'0')`,
//                         {
//                         replacements: [
//                             no_hp,
//                             bpr_id,
//                             no_rek,
//                             check_saldo[0].nama_rek,
//                             trx_code,
//                             ket_trans,
//                             reff,
//                             amount,
//                             tgl_trans,
//                         ],
//                         }
//                     );
        
//                     if (!metadata) {
//                         res.status(200).send({
//                         code: "099",
//                         status: "ok",
//                         message: "Gagal, Terjadi Kesalahan Hold Dana!!!",
//                         data: null,
//                         });
//                     } else {
//                         let [results, metadata] = await db.sequelize.query(
//                             `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, tgl_trans, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,'0')`,
//                             {
//                             replacements: [
//                                 no_hp,
//                                 bpr_id,
//                                 no_rek,
//                                 check_saldo[0].nama_rek,
//                                 trx_code,
//                                 "tariktunai",
//                                 ket_trans,
//                                 reff,
//                                 amount,
//                                 tgl_trans,
//                             ],
//                             }
//                         );
//                         if (!metadata) {
//                             res.status(200).send({
//                             code: "099",
//                             status: "ok",
//                             message: "Gagal, Terjadi Kesalahan Insert Transaksi!!!",
//                             data: null,
//                             });
//                         } else {
//                             let [results, metadata] = await db.sequelize.query(
//                             `UPDATE dummy_rek_tabungan SET saldo = saldo - ? WHERE no_rek = ? AND bpr_id = ? AND status_rek = '1'`,
//                             {
//                                 replacements: [amount, no_rek, bpr_id],
//                             }
//                             );
//                             if (!metadata) {
//                             res.status(200).send({
//                                 code: "099",
//                                 status: "ok",
//                                 message: "Gagal, Terjadi Kesalahan Update Saldo!!!",
//                                 data: null,
//                             });
//                             } else {
//                                 let requestData = {
//                                     "partner_id": "mtd",
//                                     "request_timestamp": timestampMs
//                                 }
//                                 let paramToCombine = [
//                                     "POST", 
//                                     "/internal-middleware/v2/generate-token",
//                                     timestampMs,
//                                     JSON.stringify(requestData)
//                                 ]
//                                 paramToCombine = paramToCombine.join(":").replace(/\s*|\t|\r|\n/gm, "");
//                                 const rawSignature = hmacSHA256(paramToCombine,process.env.SHA_KEY)
//                                 const Signature = Base64.stringify(rawSignature)
                        
//                                 let token_access = await axios({
//                                     method: 'post',
//                                     url: `${api_crm}/internal-middleware/v2/generate-token`,
//                                     httpsAgent: agent,
//                                     headers: {
//                                         "Content-Type": "application/json",
//                                         "Signature": Signature
//                                     },
//                                     data: requestData
//                                 }).then(res => {
//                                     let response = {
//                                         code : "success",
//                                         token : res.data.token_access
//                                     }
//                                     return response
//                                 }).catch(error => {
//                                     let err = {
//                                         code : error.code,
//                                         token : ""
//                                     }
//                                     return err
//                                 });
//                                 console.log(token_access);
//                                 if (token_access.code == "success" && token_access.token) {
//                                     let offline_create = await axios({
//                                         method: 'post',
//                                         url: `${api_crm}/api/offline-create`,
//                                         httpsAgent: agent,
//                                         headers: {
//                                             "Content-Type": "application/json",
//                                             "X-OY-Username": process.env.X_OY_Username,
//                                             "X-Api-Key": process.env.X_Api_Key,
//                                         },
//                                         data: {
//                                             "customer_id": "custid",
//                                             "partner_trx_id": receiptNo,
//                                             "receiver_phone_number": no_hp,
//                                             "amount": amount,
//                                             "transaction_type": "CASH_OUT",
//                                             "offline_channel": "CRM"
//                                         }
//                                     }).then(res => {
//                                         let response = {
//                                             status : res.data.status,
//                                             partner_trx_id : res.data.partner_trx_id,
//                                             code : res.data.code,
//                                             timestamp : res.data.timestamp,
//                                             name : res.data.name
//                                         }
//                                         return response
//                                     }).catch(error => {
//                                         return error
//                                     });
//                                     if (offline_create.status.code == "102") {        
//                                         let [results, metadata] = await db.sequelize.query(
//                                             `INSERT INTO token(no_hp, bpr_id, no_rek, tgl_trans, status, token_access) VALUES (?,?,?,?,'0',?)`,
//                                             {
//                                             replacements: [
//                                                 no_hp,
//                                                 bpr_id,
//                                                 no_rek,
//                                                 tgl_trans,
//                                                 token_access.token
//                                             ],
//                                             }
//                                         );
//                                         if (!metadata) {
//                                             res.status(200).send({
//                                             code: "099",
//                                             status: "ok",
//                                             message: "Gagal, Terjadi Kesalahan Membuat Token!!!",
//                                             data: null,
//                                             });
//                                         } else {
//                                             let [results, metadata] = await db.sequelize.query(
//                                                 `UPDATE dummy_hold_dana SET token = ? WHERE no_rek = ? AND nama_rek = ? AND reff = ?`,
//                                                 {
//                                                 replacements: [
//                                                     offline_create.code,
//                                                     no_rek,
//                                                     check_saldo[0].nama_rek,
//                                                     reff
//                                                 ],
//                                                 }
//                                             );
//                                             let response = {
//                                                 no_hp,
//                                                 bpr_id,
//                                                 nama_rek: check_saldo[0].nama_rek,
//                                                 amount,
//                                                 trans_fee,
//                                                 token: offline_create.code,
//                                                 reff,
//                                                 tgl_trans,
//                                                 tgl_transmis : moment().format('YYYY-MM-DD HH:mm:ss'),
//                                                 rrn
//                                             }
//                                             //--berhasil dapat list product update atau insert ke db --//
//                                             console.log("Success");
//                                             res.status(200).send({
//                                                 rcode: "000",
//                                                 status: "ok",
//                                                 message: "Success",
//                                                 data: response,
//                                             });
//                                         }
//                                     } else {
//                                         res.status(200).send({
//                                             rcode: "099",
//                                             status: "error",
//                                             message: offline_create.status.message,
//                                             data: offline_create,
//                                         });
//                                     }
//                                 } else {
//                                     res.status(200).send({
//                                         rcode: "099",
//                                         status: "error",
//                                         message: token_access.code,
//                                         data: token_access.token,
//                                     });
//                                 }
//                             }
//                         }
//                     }
//                 } else {
//                     res.status(200).send({
//                         code: "099",
//                         status: "ok",
//                         message: "Gagal, Terjadi Kesalahan Kurangin Saldo!!!",
//                         data: null,
//                     });
//                 }
//             }
//         }
//     } catch (error) {
//       //--error server--//
//       console.log("erro get product", error);
//       res.send(error);
//     }
// };

// API untuk Release Transaction
// const release_withdrawal = async (req, res) => {
//     let {
//         no_hp,
//         bpr_id,
//         no_rek,
//         amount,
//         trans_fee,
//         trx_code,
//         trx_type,
//         tgl_trans,
//         tgl_transmis,
//         token,
//         rrn} = req.body;
//     try {
//         let number = Math.random() * 30
//         // let request = await db.sequelize.query(
//         //     `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
//         //     {
//         //         replacements: [BranchCode, no_rek],
//         //         type: db.sequelize.QueryTypes.SELECT,
//         //     }
//         // )
//         // if (!request.length) {
//         //     response['BeneficiaryDetails'] = {
//         //         CurrencyID : "",
//         //         AccountBalance : ""
//         //     }
//         //     response['StatusTransaction'] = "9999"
//         //     response['StatusMessage'] = "Failed"
//         //     res.status(200).send(
//         //         response
//         //     );
//         // } else {
//             let response = {
//                 no_hp,
//                 bpr_id,
//                 token,
//                 amount,
//                 trans_fee,
//                 tgl_trans : moment().format('YYYY-MM-DD HH:mm:ss'),
//                 tgl_transmis : moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
//                 rrn
//             }
//             //--berhasil dapat list product update atau insert ke db --//
//             console.log("Success");
//             res.status(200).send({
//                 rcode: "000",
//                 status: "ok",
//                 message: "Success",
//                 data: response,
//             });
//         // }
//     } catch (error) {
//       //--error server--//
//       console.log("erro get product", error);
//       res.send(error);
//     }
// };

// API untuk Validate Token
// const validate_token = async (req, res) => {
//     let {
//         no_hp,
//         bpr_id,
//         token,
//         tgl_trans,
//         tgl_transmis,
//         rrn} = req.body;
//     try {
//         let number = Math.random() * 30
//         // let request = await db.sequelize.query(
//         //     `SELECT nama_rek, no_rek FROM acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status != '6'` ,
//         //     {
//         //         replacements: [BranchCode, no_rek],
//         //         type: db.sequelize.QueryTypes.SELECT,
//         //     }
//         // )
//         // if (!request.length) {
//         //     response['BeneficiaryDetails'] = {
//         //         CurrencyID : "",
//         //         AccountBalance : ""
//         //     }
//         //     response['StatusTransaction'] = "9999"
//         //     response['StatusMessage'] = "Failed"
//         //     res.status(200).send(
//         //         response
//         //     );
//         // } else {
//             let response = {
//                 no_hp,
//                 bpr_id,
//                 nama_rek: "TEST ACCOUNT",
//                 amount : 50000,
//                 trans_fee : 0,
//                 tgl_trans : moment().format('YYYY-MM-DD HH:mm:ss'),
//                 tgl_transmis : moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
//                 rrn
//             }
//             //--berhasil dapat list product update atau insert ke db --//
//             console.log("Success");
//             res.status(200).send({
//                 rcode: "000",
//                 status: "ok",
//                 message: "Success",
//                 data: response,
//             });
//         // }
//     } catch (error) {
//       //--error server--//
//       console.log("erro get product", error);
//       res.send(error);
//     }
// };
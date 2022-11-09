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

// API untuk Access Webview
const webview = async (req, res) => {
    let {no_rek, no_hp, bpr_id, rrn, amount, tgl_trans} = req.query;
	console.log(no_hp);
    try {
        let response = {
            no_hp,
            bpr_id,
            no_rek,
            rrn
        }
        res.redirect(`https://mpin.medtransdigital.com/${no_rek}/${no_hp}/${bpr_id}/${rrn}/${amount}/${tgl_trans}`)
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Bill Payment
const bill_payment = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        product_name,
        trx_code,
        trx_type,
        amount,
        trans_fee,
        tgl_trans,
        tgl_transmis,
        rrn
    } = req.body;
    let number = Math.random() * 30
//   const dateTimeDb = await date();
//   partner_tx_id = `INV/${moment(dateTimeDb[0].now).format(
//     "YYYYMMDD"
//   )}/${new Date().getTime()}`;
    try {
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
                    let [results, metadata] = await db.sequelize.query(
                        `UPDATE dummy_rek_tabungan SET saldo = saldo - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                        {
                            replacements: [amount, no_rek, no_hp, bpr_id],
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
                        let receiptNo = generateString(20);
                        let reff = `PPOB/${check_saldo[0].nama_rek}/${moment().format('YYMMDDHHmmss')}/${receiptNo}`
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, tgl_trans, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,'1')`,
                            {
                            replacements: [
                                no_hp,
                                bpr_id,
                                no_rek,
                                check_saldo[0].nama_rek,
                                trx_code,
                                "PPOB",
                                product_name,
                                reff,
                                amount,
                                tgl_trans
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
                            let response = {
                                no_hp,
                                bpr_id,
                                no_rek,
                                nama_rek: check_saldo[0].nama_rek,
                                product_name,
                                amount,
                                trans_fee,
                                trx_code,
                                trx_type,
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
        console.log("error inquiry", error);
        res.status(200).send({
        rcode: "E99",
        status: "error",
        message: error.message,
        data: null,
        });
    }
};

// API untuk Check Status PPOB
const check_status_ppob = async (req, res) => {
    let {
        no_hp,
        no_rek,
        bpr_id,
        trx_code,
        trx_type,
        date_trx,
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
                reff : "TT/TEST ACCOUNT/20220906/1662476661308",
                code : "000",
                status : "Success",
                date_trx,
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

// API untuk Reversal PPOB
const reversal_ppob = async (req, res) => {
    let {
        no_hp,
        no_rek,
        bpr_id,
        product_name,
        amount,
        trans_fee,
        trx_code,
        trx_type,
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
                product_name,
                amount : 50000,
                trans_fee : 0,
                trx_code,
                trx_type,
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
    webview,
    bill_payment,
    check_status_ppob,
    reversal_ppob
};


// API untuk Inquiry Account
// const inquiry_account = async (req, res) => {
//     let {no_rek, no_hp, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
//     try {
//         let number = Math.random() * 30
//         let request = await db.sequelize.query(
//             `SELECT no_hp, no_rek, bpr_id, nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
//             {
//                 replacements: [bpr_id, no_hp, no_rek],
//                 type: db.sequelize.QueryTypes.SELECT,
//             }
//         )
//         if (!request.length) {
//             res.status(200).send({
//                 rcode: "999",
//                 status: "ok",
//                 message: "Gagal Account Tidak Ditemukan",
//                 data: null,
//             });
//         } else {
//             request[0]["tgl_trans"] = moment().format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["tgl_transmis"] = moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["rrn"] = rrn
//             res.status(200).send({
//                 rcode: "000",
//                 status: "ok",
//                 message: "Success",
//                 data: request,
//             });
//         }
//     } catch (error) {
//       //--error server--//
//       console.log("erro get product", error);
//       res.send(error);
//     }
// };

// API untuk Inquiry Account
// const validate_user = async (req, res) => {
//     let {no_rek, no_hp, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
//     try {
//         let number = Math.random() * 30
//         let request = await db.sequelize.query(
//             `SELECT no_hp, bpr_id, no_rek, nama_rek FROM acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'` ,
//             {
//                 replacements: [bpr_id, no_hp, no_rek],
//                 type: db.sequelize.QueryTypes.SELECT,
//             }
//         )
//         if (!request.length) {
//             res.status(200).send({
//                 rcode: "999",
//                 status: "ok",
//                 message: "Gagal Account Tidak Ditemukan",
//                 data: null,
//             });
//         } else {
//             request[0]["tgl_trans"] = moment().format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["tgl_transmis"] = moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["rrn"] = rrn
//             res.status(200).send({
//                 rcode: "000",
//                 status: "ok",
//                 message: "Success",
//                 data: request,
//             });
//         }
//     } catch (error) {
//       //--error server--//
//       console.log("erro get product", error);
//       res.send(error);
//     }
// };

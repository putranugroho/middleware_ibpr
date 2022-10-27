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
    let {no_rek, no_hp, bpr_id, reff, amount, tgl_trans} = req.body;
    try {
        let response = {
            no_hp,
            bpr_id,
            no_rek,
            reff
        }
        res.redirect('https://mpin.medtransdigital.com')
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Access Webview
const webview2 = async (req, res) => {
    // let {no_rek, no_hp, bpr_id, reff, amount, tgl_trans} = req.body;
    try {
        res.status(200).redirect('https://mpin.medtransdigital.com')
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
        produk_id,
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
//     let Request = await axios.post("/api/v2/bill", {
//         customer_id : no_hp,
//         product_id : produk_id,
//         partner_tx_id,
//         amount,
//     });

//     // console.log(Request);

//     if (Request.data.status.code === "000") {
//       //--berhasil dapat list product update atau insert ke db --//

//       // console.log("data", Request.data.data);
//       const payload = {
//         trcode: trx_code,
//         no_rek,
//         no_hp,
//         bpr_id,
//         nama_rek: Request.data.data.customer_name,
//         produk_id: Request.data.data.product_id,
//         ket_trans: `${no_hp} ${produk_id} ${Request.data.data.customer_name}`,
//         reff: Request.data.data.partner_tx_id,
//         amount:
//           Request.data.data.amount + Request.data.data.admin_fee,
//         //   parseInt(JSON.parse(Request.data.data.additional_data).admin_fee),
//         tgljam_trans: moment(dateTimeDb[0].now).format("YYYY-MM-DD HH:mm:ss"),
//       };

//       let [results, metadata] = await db.sequelize.query(
//         `INSERT INTO dummy_transaksi(no_rek, tcode, produk_id, ket_trans, reff, amount, tgljam_trans, status_rek, nama_rek, no_hp, bpr_id) VALUES (?,?,?,?,?,?,?,'0',?,?,?)`,
//         {
//           replacements: [
//             payload.no_rek,
//             payload.tcode,
//             payload.produk_id,
//             payload.ket_trans,
//             payload.reff,
//             payload.amount,
//             payload.tgljam_trans,
//             payload.nama_rek,
//             payload.no_hp,
//             payload.bpr_id,
//           ],
//         }
//       );

//       // console.log(metadata);

//       if (!metadata) {
//         res.status(200).send({
//           rcode: "099",
//           status: "ok",
//           message: "Gagal, Terjadi Kesalahan Insert Transaksi!!!",
//           data: null,
//         });
//       } else {
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
                    let response = {
                        no_hp,
                        bpr_id,
                        no_rek,
                        nama_rek: check_saldo[0].nama_rek,
                        amount,
                        trans_fee,
                        trx_code,
                        trx_type,
                        reff : "TT/TEST ACCOUNT/20220906/1662476661308",
                        tgl_trans,
                        tgl_transmis : moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
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
    webview2,
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

// const api_offline = require("../Services/API/api_offline");
// const api_crm = require("../Services/API/api_crm");
const axios = require("axios").default;
var https = require('https');
const db = require("../../connection");
const moment = require("moment");
moment.locale("id");
const { date } = require("../../utility/getDate");
const hmacSHA256 = require('crypto-js/hmac-sha256');
// var SHA256 = require("crypto-js/sha256");
const Base64 = require("crypto-js/enc-base64");

const api_crm = "https://integration-stg.oyindonesia.com"
const api_offline = "https://api-stg.oyindonesia.com"
const timestampMs = moment().format('YYYYMMDDHHmmss')

const {
    update_gl_oy_kredit,
    update_gl_oy_debet,
    update_gl_oy_db_cr,
    split_sbb
} = require("../../utility/ledger");

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
            console.log("error mdw");
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
const inquiry_account_trf = async (req, res) => {
    let {no_rek, bpr_id, tgl_trans, rrn} = req.body;
    try {
        console.log("REQ INQ TRF");
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
                rrn: rrn,
                data: [],
            });
        } else {
            const data = {no_hp:"", no_rek, bpr_id, trx_code:"0200", trx_type:"TRX", tgl_trans, rrn}
            const request = await connect_axios(bpr[0].gateway,"gateway_bpr/inquiry_account",data)
            if (request.code !== "000") {
                console.log(request);
                res.status(200).send(request);
            } else {
                console.log("success");
                console.log(request.data);
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    rrn: rrn,
                    data: request.data,
                });
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Transfer Debit Credit Proses
const transfer_db_cr = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        bank_tujuan,
        rek_tujuan,
        nama_tujuan,
        token_mpin,
        amount,
        trans_fee,
        trx_code,
        trx_type,
        tgl_trans,
        rrn} = req.body;
    try {
        let kode_bpr, keterangan = ""
        if (trx_code == "2200") {
            console.log("REQ BODY TRANSFER IN");
            console.log(req.body);
            kode_bpr = bank_tujuan
            token_mpin = ""
            keterangan = "TRANSFER IN"
            let bpr = await db.sequelize.query(
                `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
                {
                    replacements: [kode_bpr],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!bpr.length) {
                res.status(200).send({
                    code: "002",
                    status: "Failed",
                    message: "Gagal, Inquiry BPR Tidak Ditemukan",
                    rrn: rrn,
                    data: [],
                });
            } else {
                const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, token_mpin, amount, trans_fee, trx_code, trx_type, keterangan, tgl_trans, rrn}
                const request = await connect_axios(bpr[0].gateway,"gateway_bpr/transfer",data)
                if (request.code !== "000") {
                    console.log("failed middleware");
                    // let status = 0
                    // if (request.code == "088") {
                    //     status = 4
                    // }
                    // let [results, metadata] = await db.sequelize.query(
                    //     `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                    //     {
                    //     replacements: [
                    //         no_hp,
                    //         bpr_id,
                    //         no_rek,
                    //         request.data.nama,
                    //         bank_tujuan,
                    //         rek_tujuan,
                    //         nama_tujuan,
                    //         trx_code,
                    //         keterangan,
                    //         request.message,
                    //         "",
                    //         amount,
                    //         trans_fee,
                    //         tgl_trans,
                    //         token_mpin,
                    //         rrn,
                    //         request.code
                    //     ],
                    //     }
                    // );
                    console.log(request);
                    res.status(200).send(request);
                } else {
                    console.log("request.data transfer");
                    console.log(request);
                    let [results, metadata] = await db.sequelize.query(
                        `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                        {
                        replacements: [
                            no_hp,
                            bpr_id,
                            no_rek,
                            request.data.nama,
                            bank_tujuan,
                            rek_tujuan,
                            nama_tujuan,
                            trx_code,
                            keterangan,
                            request.message,
                            "",
                            amount,
                            trans_fee,
                            tgl_trans,
                            token_mpin,
                            rrn,
                            request.code
                        ],
                        }
                    );
                    console.log({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: request.data,
                    });
                    console.log("MDW Transfer Out Timeout");
                    // res.status(200).send({
                    //     code: "000",
                    //     status: "ok",
                    //     message: "Success",
                    //     rrn: rrn,
                    //     data: request.data,
                    // });
                }
            }
        } else {
            if (trx_code == "2100"){
                console.log("REQ BODY TRANSFER OUT");
                console.log(req.body);
                kode_bpr = bpr_id
                keterangan = "TRANSFER OUT"
            } else if (trx_code == "2300") {
                console.log("REQ BODY PINDAH BUKU");
                console.log(req.body);
                kode_bpr = bpr_id
                keterangan = "TRANSFER PINDAH BUKU"
            }
            let bpr = await db.sequelize.query(
                `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
                {
                    replacements: [kode_bpr],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!bpr.length) {
                res.status(200).send({
                    code: "002",
                    status: "Failed",
                    message: "Gagal, Inquiry BPR Tidak Ditemukan",
                    rrn: rrn,
                    data: [],
                });
            } else {
                let check_token_mpin = await db.sequelize.query(
                    `SELECT * FROM token_mpin WHERE token_mpin = ? AND no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ?`,
                    {
                        replacements: [token_mpin, no_rek, no_hp, bpr_id, trx_code],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );
                if (!check_token_mpin.length) {
                    console.log({
                        code: "009",
                        status: "ok",
                        message: "Gagal, MPIN Belum Tervalidasi!!!",
                        rrn: rrn,
                        data: null,
                    });
                    res.status(200).send({
                        code: "009",
                        status: "ok",
                        message: "Gagal, MPIN Belum Tervalidasi!!!",
                        rrn: rrn,
                        data: null,
                    });
                } else {
                    if (check_token_mpin[0].status == "1") {
                        console.log({
                            code: "009",
                            status: "ok",
                            message: "Gagal, Token Validasi MPIN Sudah Digunakan!!!",
                            rrn: rrn,
                            data: null,
                        });
                        res.status(200).send({
                            code: "009",
                            status: "ok",
                            message: "Gagal, Token Validasi MPIN Sudah Digunakan!!!",
                            rrn: rrn,
                            data: null,
                        });
                    } else if (check_token_mpin[0].status == "0") {
                        const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, token_mpin, amount, trans_fee, trx_code, trx_type, keterangan, tgl_trans, rrn}
                        const request = await connect_axios(bpr[0].gateway,"gateway_bpr/transfer",data)
                        if (request.code !== "000") {
                            console.log("failed middleware");
                            // let status = 0
                            // if (request.code == "088") {
                            //     status = 4
                            // }
                            // let [results, metadata] = await db.sequelize.query(
                            //     `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                            //     {
                            //     replacements: [
                            //         no_hp,
                            //         bpr_id,
                            //         no_rek,
                            //         request.data.nama,
                            //         bank_tujuan,
                            //         rek_tujuan,
                            //         nama_tujuan,
                            //         trx_code,
                            //         keterangan,
                            //         request.message,
                            //         "",
                            //         amount,
                            //         trans_fee,
                            //         tgl_trans,
                            //         token_mpin,
                            //         rrn,
                            //         request.code
                            //     ],
                            //     }
                            // );
                            console.log(request);
                            res.status(200).send(request);
                        } else {
                            console.log("request.data transfer");
                            console.log(request);
                            let [results, metadata] = await db.sequelize.query(
                                `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                                {
                                replacements: [
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    request.data.nama,
                                    bank_tujuan,
                                    rek_tujuan,
                                    nama_tujuan,
                                    trx_code,
                                    keterangan,
                                    request.message,
                                    "",
                                    amount,
                                    trans_fee,
                                    tgl_trans,
                                    token_mpin,
                                    rrn,
                                    request.code
                                ],
                                }
                            );
                            console.log({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                rrn: rrn,
                                data: request.data,
                            });
                            console.log("MDW Transfer Out Timeout");
                            // res.status(200).send({
                            //     code: "000",
                            //     status: "ok",
                            //     message: "Success",
                            //     rrn: rrn,
                            //     data: request.data,
                            // });
                        }
                    }
                }
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Check Status TRF
const check_status_trf = async (req, res) => {
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
            let transfer
            if (trx_code == "2100") {
                transfer = "DB"
            } else if (trx_code == "2200") {
                transfer = "CR"                
            } else if (trx_code == "2300") {
                transfer = "DB CR"
            }
            let response = {
                no_hp,
                no_rek,
                bpr_id,
                amount : 50000,
                "bank_tujuan": "0533",
                "rek_tujuan": "333444555666777",
                "nama_tujuan": "NUR RIZAL",
                trx_code,
                trx_type,
                reff : `TRF ${transfer}/TEST ACCOUNT/20220906/1662476661308`,
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
                code: "000",
                status: "ok",
                message: "Success",
                rrn: rrn,
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
const reversal_trf = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        bank_tujuan,
        rek_tujuan,
        nama_tujuan,
        amount,
        trans_fee,
        trx_code,
        trx_type,
        tgl_trans,
        rrn} = req.body;
    try {
        let kode_bpr, keterangan = ""
        if (trx_code == "2100"){
            console.log("REQ BODY REV TRANSFER OUT");
            console.log(req.body);
            kode_bpr = bpr_id
            keterangan = "TRANSFER OUT"
        } else if (trx_code == "2200") {
            console.log("REQ BODY REV TRANSFER IN");
            console.log(req.body);
            kode_bpr = bank_tujuan
            token_mpin = ""
            keterangan = "TRANSFER IN"
        } else if (trx_code == "2300") {
            console.log("REQ BODY REV PINDAH BUKU");
            console.log(req.body);
            kode_bpr = bpr_id
            keterangan = "TRANSFER PINDAH BUKU"
        }
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
            {
                replacements: [kode_bpr],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR Tidak Ditemukan",
                rrn: rrn,
                data: [],
            });
        } else {
            let check_transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND admin_fee = ? AND rrn = ?`,
            {
                replacements: [no_rek, no_hp, bpr_id,trx_code,amount,trans_fee,rrn],
                type: db.sequelize.QueryTypes.SELECT,
            }
            );
            if (!check_transaksi.length) {
                console.log({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Original Not Found!!!",
                    rrn: rrn,
                    data: null,
                });
                res.status(200).send({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Original Not Found!!!",
                    rrn: rrn,
                    data: null,
                });
            } else {
                if (check_transaksi[0].status_rek === "1") {
                    const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, token_mpin:"", amount, trans_fee, trx_code, trx_type, keterangan, tgl_trans, rrn}
                    const request = await connect_axios(bpr[0].gateway,"gateway_bpr/transfer",data)
                    if (request.code !== "000") {
                        console.log(request);
                        res.status(200).send(request);
                    } else {
                        console.log({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            rrn: rrn,
                            data: request.data,
                        });
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            rrn: rrn,
                            data: request.data,
                        });
                    }
                } else {
                    console.log({
                        code: "012",
                        status: "Failed",
                        message: "Gagal, Duplicated Transmission!!!",
                        rrn: rrn,
                        data: null,
                    });
                    res.status(200).send({
                        code: "012",
                        status: "Failed",
                        message: "Gagal, Duplicated Transmission!!!",
                        rrn: rrn,
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

module.exports = {
    inquiry_account_trf,
    transfer_db_cr,
    check_status_trf,
    reversal_trf
};
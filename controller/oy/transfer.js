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
                // request.data.nama_rek = request.data.nama
                // if (request.data.status_rek === "AKTIF") {
                //     request.data.status_rek = "1"
                // } else {
                //     request.data.status_rek = "0"
                // }
                // const array = [request.data]
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
        amount,
        trans_fee,
        trx_code,
        trx_type,
        tgl_trans,
        user_id,
        xusername,
        xpassword,
        pin,
        rrn} = req.body;
    try {
        let kode_bpr, keterangan, ket_trans = ""
        if (trx_code == "2200") {
            console.log("REQ BODY TRANSFER IN");
            console.log(req.body);
            kode_bpr = bank_tujuan
            keterangan = "TRANSFER IN"
            ket_trans = `${keterangan} ${rek_tujuan} ${nama_tujuan}`
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
                const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, amount, trans_fee, trx_code, trx_type, keterangan, tgl_trans, rrn}
                const request = await connect_axios(bpr[0].gateway,"gateway_bpr/transfer",data)
                if (request.code !== "000") {
                    console.log("failed middleware");
                    let [results, metadata] = await db.sequelize.query(
                        `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgljam_trans, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                        {
                        replacements: [
                            no_hp,
                            bpr_id,
                            no_rek,
                            "",
                            bank_tujuan,
                            rek_tujuan,
                            nama_tujuan,
                            trx_code,
                            keterangan,
                            ket_trans,
                            "",
                            amount,
                            trans_fee,
                            tgl_trans,
                            rrn,
                            request.code,
                            request.message
                        ],
                        }
                    );
                    console.log(request);
                    // if (bank_tujuan === "602640" && trx_code === "2200") {
                    //     console.log("MDW Transfer In Timeout");
                    // } else {
                        res.status(200).send(request);
                    // }
                } else {
                    console.log("request.data transfer");
                    console.log(request);
                    let [results, metadata] = await db.sequelize.query(
                        `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgljam_trans, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
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
                            ket_trans,
                            request.data.noreff,
                            amount,
                            trans_fee,
                            tgl_trans,
                            rrn,
                            request.code,
                            request.message
                        ],
                        }
                    );
                    // if (bank_tujuan === "602640" && trx_code === "2200") {
                    //     console.log("MDW Transfer In Timeout");
                    // } else {
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
                    // }
                }
            }
        } else {
            if (trx_code == "2100"){
                console.log("REQ BODY TRANSFER OUT");
                console.log(req.body);
                kode_bpr = bpr_id
                keterangan = "TRANSFER OUT"
                ket_trans = `${keterangan} ${bpr_id} ${no_rek}`
            } else if (trx_code == "2300") {
                console.log("REQ BODY PINDAH BUKU");
                console.log(req.body);
                kode_bpr = bpr_id
                keterangan = "TRANSFER PINDAH BUKU"
                ket_trans = `${keterangan} ${rek_tujuan} ${nama_tujuan}`
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
                let nasabah = await db.sequelize.query(
                    `SELECT * FROM acct_ebpr WHERE user_id = ? AND no_hp = ? AND bpr_id = ?`,
                    {
                        replacements: [
                            user_id,
                            no_hp,
                            bpr_id
                        ],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!nasabah.length) {
                    res.status(200).send({
                        code: "999",
                        status: "ok",
                        message: "Gagal Account Tidak Ditemukan",
                        data: null,
                    });
                } else {
                    const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, amount, trans_fee, trx_code, trx_type, keterangan, pin, tgl_trans, xusername, xpassword, rrn}
                    console.log(data);
                    const request = await connect_axios(bpr[0].gateway,"gateway_bpr/transfer",data)
                    if (request.code !== "000") {
                        console.log("failed middleware");
                        console.log(request);
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgljam_trans, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                            {
                            replacements: [
                                no_hp,
                                bpr_id,
                                no_rek,
                                "",
                                bank_tujuan,
                                rek_tujuan,
                                nama_tujuan,
                                trx_code,
                                keterangan,
                                ket_trans,
                                "",
                                amount,
                                trans_fee,
                                tgl_trans,
                                rrn,
                                request.code,
                                request.message
                            ],
                            }
                        );
                        // if (bpr_id === "600001" && trx_code === "2100") {
                        //     console.log("MDW Transfer Out Timeout");
                        // } else if (bpr_id === "600001" && trx_code === "2300") {
                        //     console.log("MDW Pindah Buku Timeout");
                        // } else {
                            res.status(200).send(request);
                        // }
                    } else {
                        console.log("request.data transfer");
                        console.log(request);
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, bank_tujuan, rek_tujuan, nama_tujuan, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgljam_trans, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
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
                                ket_trans,
                                request.data.noreff,
                                amount,
                                trans_fee,
                                tgl_trans,
                                rrn,
                                request.code,
                                request.message
                            ],
                            }
                        );
                        // if (bpr_id === "600001" && trx_code === "2100") {
                        //     console.log("MDW Transfer Out Timeout");
                        // } else if (bpr_id === "600001" && trx_code === "2300") {
                        //     console.log("MDW Pindah Buku Timeout");
                        // } else {
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
                                data_keeping: request.data_keeping,
                            });
                        // }
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
        console.log("REQ BODY STATUS TRANSFER");
        console.log(req.body);
        let transfer
        if (trx_code == "2100") {
            transfer = "DB"
        } else if (trx_code == "2200") {
            transfer = "CR"                
        } else if (trx_code == "2300") {
            transfer = "DB CR"
        }
        let check_transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND rrn = ? AND tgljam_trans = ?`,
            {
                replacements: [no_rek, no_hp, bpr_id, trx_code, rrn, tgl_trans],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!check_transaksi.length) {
            console.log({
                code: "009",
                status: "Failed",
                message: "Gagal, Transaksi Tidak Ditemukan!!!",
                rrn: rrn,
                data: {
                    code: "009",
                    status: "ORIGINAL NOT FOUND"
                },
            });
            res.status(200).send({
                code: "009",
                status: "Failed",
                message: "Gagal, Transaksi Tidak Ditemukan!!!",
                rrn: rrn,
                data: {
                    code: "009",
                    status: "ORIGINAL NOT FOUND"
                },
            });
        } else {
            let status, status_message
            if (check_transaksi[0].status_rek == "1") {
                status_message = "SUCCESS"
            } else if (check_transaksi[0].status_rek == "R") {
                status_message = "REVERSE"
            } else if (check_transaksi[0].code == "088") {
                status_message = "TRANSACTION TIME OUT"
            } else {
                status_message = "FAILED"
            }
            let response = {
                no_hp: check_transaksi[0].no_hp,
                no_rek: check_transaksi[0].no_rek,
                bpr_id: check_transaksi[0].bpr_id,
                amount: check_transaksi[0].amount,
                trans_fee: check_transaksi[0].admin_fee,
                Keterangan: check_transaksi[0].ket_trans,
                trx_code: check_transaksi[0].tcode,
                trx_type,
                reff: check_transaksi[0].reff,
                tgl_trans: check_transaksi[0].tgl_trans,
                tgl_transmis: moment().format('YYMMDDHHmmss'),
                rrn,
                status: check_transaksi[0].status_rek,
                status_message,
                code: check_transaksi[0].code,
                message: check_transaksi[0].message,
            }
            //--berhasil dapat list product update atau insert ke db --//
            console.log("Success");
            console.log({
                code: "000",
                status: "ok",
                message: "Success",
                rrn: rrn,
                data: response,
            });
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                rrn: rrn,
                data: response,
            });
        }
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
                if (check_transaksi[0].status_rek !== "R") {
                    const data = {no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan:"", amount, trans_fee, trx_code, trx_type, keterangan, tgl_trans, rrn}
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
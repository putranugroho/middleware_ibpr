// const api_offline = require("../Services/API/api_offline");
// const api_crm = require("../Services/API/api_crm");
const {
    encryptStringWithRsaPublicKey,
  } = require("../../utility/encrypt");
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
    // const characters ='0123456789';
    let result = '';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

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

async function update_gl_oy_kredit(
    amount,
    trans_fee,
    bpr_id,
    trx_code,
    no_rek_pokok,
    no_rek_fee,
    nama_rek_pokok,
    nama_rek_fee,
    detail_trans) {
    let [res_pokok, meta_pokok] = await db.sequelize.query(
        `UPDATE gl_trans_core SET gl_kredit = gl_kredit + ?, saldo_akhir = saldo_akhir + ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
        {
        replacements: [
            amount,
            amount,
            bpr_id,
            trx_code,
            no_rek_pokok,
            nama_rek_pokok
        ],
        }
    );
    let [res_fee, meta_fee] = await db.sequelize.query(
        `UPDATE gl_trans_core SET gl_kredit = gl_kredit + ?, saldo_akhir = saldo_akhir + ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
        {
        replacements: [
            trans_fee,
            trans_fee,
            bpr_id,
            trx_code,
            no_rek_fee,
            nama_rek_fee
        ],
        }
    );
    let data_trans
    if (trx_code === "2100") {
        data_trans = `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`
    } else if (trx_code === "2300") {
        data_trans = `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`
        trx_code = detail_trans.trx_code
    } else {
        data_trans = `${detail_trans.nama_rek} ${detail_trans.no_rek}`
    }
    if (trx_code !== "2300") {
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                no_rek_pokok,
                bpr_id,
                trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                data_trans,
                0,
                amount,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
    if (trans_fee !== 0) {
        let [res_log_fee, meta_log_fee] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                no_rek_fee,
                bpr_id,
                trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                data_trans,
                0,
                trans_fee,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
    if (meta_pokok && meta_fee) {
        return true
    } else {
        return false
    }
}

function split_sbb(data,tcode) {
    let no_pokok = {}
    let no_fee = {}
    let tagihan = {}
    if (tcode == "1100") {
        for (let i = 0; i < data.length; i++) {
            // console.log(data[i]);
            if (data[i].ket_tcode == "Issuer") {
                tagihan = data[i]
            } else if (data[i].ket_tcode == "Acquirer") {
                if (data[i].jns_gl == "0") {
                    no_pokok['Acquirer'] = data[i]
                } else if (data[i].jns_gl == "1") {
                    no_fee['Acquirer'] = data[i]
                }
            } else if (data[i].ket_tcode == "On-Us") {
                if (data[i].jns_gl == "0") {
                    no_pokok['On_Us'] = data[i]
                } else if (data[i].jns_gl == "1") {
                    no_fee['On_Us'] = data[i]
                }
            }
        }
        return {no_pokok,no_fee,tagihan}
    } else {
        if (data[0].jns_gl == "0") {
            no_pokok = data[0]
            no_fee = data[1]
        } else if (data[0].jns_gl == "1") {
            no_pokok = data[1]
            no_fee = data[0]
        }   
        return {no_pokok,no_fee,tagihan}
    }
}

const agent = new https.Agent({  
    rejectUnauthorized: false
  });

// API untuk Access Webview
const webview = async (req, res) => {
    let {no_rek, no_hp, bpr_id, amount, trx_code, trans_fee, trx_type, tgl_trans, rrn} = req.query;
    console.log("REQ QUERY WEBVIEW");
    console.log(req.query);
    try {
        let reference_number = `${rrn}${bpr_id}${no_hp}`
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            console.log({
                code: "002",
                status: "Failed",
                message: "Gagal, BPR Tidak Terdaftar!!!",
                rrn: rrn,
                data: null,
            });
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, BPR Tidak Terdaftar!!!",
                rrn: rrn,
                data: null,
            });
        } else {
            console.log({
                code: "000",
                status: "Success",
                message: "Webview telah di generate",
                data: {
                    "url": `https://mpin.medtransdigital.com/${no_rek}/${no_hp}/${bpr_id}/${amount}/0/${trx_code}/${tgl_trans}/${rrn}`
                }
                });
            res.status(200).send({
            code: "000",
            status: "Success",
            message: "Webview telah di generate",
            data: {
                "url": `https://mpin.medtransdigital.com/${no_rek}/${no_hp}/${bpr_id}/${amount}/0/${trx_code}/${tgl_trans}/${rrn}`
            }
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.status(200).send({
            code: "099",
            status: "Failed",
            rrn: rrn,
            message: error.message
        });
    }
};

//API untuk validasi mpin
const validate_mpin = async (req, res) => {
    let {no_rek, no_hp, bpr_id, pin, amount, trans_fee, tgl_trans, trx_code, rrn} = req.body;
    try {
        console.log("REQ BODY MPIN");
        console.log(req.body);
        tgl_trans = moment().format("YYMMDDHHmmss")

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
            const data = {no_rek, no_hp, bpr_id, pin, amount, trans_fee, tgl_trans, trx_code, rrn}
            const request = await connect_axios(bpr[0].gateway,"gateway_bpr/mpin",data)
            if (request.code !== "000") {
                console.log(request);
                res.status(200).send(request);
            } else {
                let [results, metadata] = await db.sequelize.query(
                    `INSERT INTO token_mpin(no_hp, bpr_id, no_rek, token_mpin, tgl_trans, tcode, status) VALUES (?,?,?,?,?,?,'0')`,
                    {
                        replacements: [
                            no_hp,
                            bpr_id,
                            no_rek,
                            request.data.token_mpin,
                            tgl_trans,
                            trx_code
                        ],
                    }
                );
                if (!metadata) {
                    res.status(200).send({
                    code: "001",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Membuat Token mPIN!!!",
                    data: null,
                    });
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
            }
        }

    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.status(200).send({
            code: "099",
            status: "Failed",
            rrn: rrn,
            message: error.message
        });
    }
};

// API untuk Bill Payment
const bill_payment = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        product_name,
        token_mpin,
        trx_code,
        trx_type,
        amount,
        trans_fee,
        tgl_trans,
        tgl_transmis,
        rrn
    } = req.body;
    try {
        console.log("REQ BOODY OVERBOOKING");
        console.log(req.body);
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status = '1'` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            let [results, metadata] = await db.sequelize.query(
                `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                {
                replacements: [
                    no_hp,
                    bpr_id,
                    no_rek,
                    "",
                    trx_code,
                    "PPOB",
                    "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
                    "",
                    amount,
                    trans_fee,
                    tgl_trans,
                    token_mpin,
                    rrn,
                    "002"
                ],
                }
            );
            console.log({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR Tidak Ditemukan",
                rrn: rrn,
                data: [],
            });
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR Tidak Ditemukan",
                rrn: rrn,
                data: [],
            });
        } else {
            let check_token_mpin = await db.sequelize.query(
                `SELECT * FROM token_mpin WHERE token_mpin = ? AND no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                {
                    replacements: [token_mpin, no_rek, no_hp, bpr_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!check_token_mpin.length) {
                res.status(200).send({
                    code: "001",
                    status: "ok",
                    message: "Gagal, MPIN Belum Tervalidasi!!!",
                    rrn: rrn,
                    data: null,
                });
            } else {
                if (check_token_mpin[0].status == "1") {
                    res.status(200).send({
                        code: "009",
                        status: "ok",
                        message: "Gagal, Token Validasi MPIN Sudah Digunakan!!!",
                        rrn: rrn,
                        data: null,
                    });
                } else if (check_token_mpin[0].status == "0") {
                    const data = { no_hp, bpr_id, no_rek, product_name, token_mpin, trx_code, trx_type, amount, trans_fee, tgl_trans, tgl_transmis, rrn}
                    const request = await connect_axios(bpr[0].gateway,"gateway_bpr/ppob",data)
                    if (request.code !== "000") {
                        console.log(request);
                        let status = 0
                        if (request.code == "088") {
                            status = 4
                        }
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, trans_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                            {
                            replacements: [
                                no_hp,
                                bpr_id,
                                no_rek,
                                "",
                                trx_code,
                                "PPOB",
                                request.message,
                                "",
                                amount,
                                trans_fee,
                                tgl_trans,
                                token_mpin,
                                rrn,
                                request.code,
                                status
                            ],
                            }
                        );
                        res.status(200).send(request);
                    } else {
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                            {
                            replacements: [
                                no_hp,
                                bpr_id,
                                no_rek,
                                request.data.nama,
                                trx_code,
                                "PPOB",
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
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            rrn: rrn,
                            data: request.data,
                        });
                    }
                } else {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        message: "Gagal, Invalid Transaction!!!",
                        rrn: rrn,
                        data: null,
                    })
                }
            }
        }
    } catch (error) {
        //--error server--//
        console.log("error inquiry", error);
        res.status(200).send({
        code: "099",
        status: "error",
        message: error.message,
        rrn: rrn,
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
        tgl_trans,
        tgl_transmis,
        rrn} = req.body;
    try {
        console.log("REQ BODY STATUS PPOB");
        console.log(req.body);
        let check_transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tgl_trans = ?`,
            {
                replacements: [no_rek, no_hp, bpr_id, tgl_trans],
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
            let code, status
            if (check_transaksi[0].status_rek == "1") {
                status = "SUCCESS"
            } else if (check_transaksi[0].status_rek == "R") {
                status = "REVERSE"
            } else if (check_transaksi[0].status_rek == "4") {
                status = "TRANSACTION TIME OUT"
            } else if (check_transaksi[0].status_rek == "2") {
                status = "FAILED"
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
                code: check_transaksi[0].code,
                status,
                tgl_trans: check_transaksi[0].tgl_trans,
                tgl_transmis : moment().format('YYMMDDHHmmss'),
                rrn
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
      res.status(200).send({
            code: "099",
            status: "Failed",
            message: error.message,
            rrn: rrn,
        });
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
        console.log("REQ BODY REVERSAL PPOB");
        console.log(req.body);
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?`,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!bpr.length) {
            console.log({
                code: "002",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
                rrn: rrn,
                data: null,
            });
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
                rrn: rrn,
                data: null,
            });
        } else {
            let check_transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND admin_fee = ? AND tgl_trans = ?`,
            {
                replacements: [no_rek, no_hp, bpr_id,trx_code,amount,trans_fee,tgl_trans],
                type: db.sequelize.QueryTypes.SELECT,
            }
            );
            if (!check_transaksi.length) {
                console.log({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian Transaksi!!!",
                    rrn: rrn,
                    data: null,
                });
                res.status(200).send({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian Transaksi!!!",
                    rrn: rrn,
                    data: null,
                });
            } else {
                const data = { no_hp,
                    no_rek,
                    bpr_id,
                    product_name,
                    amount,
                    trans_fee,
                    token_mpin:"",
                    trx_code,
                    trx_type,
                    tgl_trans,
                    tgl_transmis,
                    rrn}
                const request = await connect_axios(bpr[0].gateway,"gateway_bpr/ppob",data)
                if (request.code !== "000") {
                    console.log(request);
                    res.status(200).send(request);
                } else {
                    let [results, metadata] = await db.sequelize.query(
                        `UPDATE dummy_transaksi SET status_rek = ? WHERE token = ? AND no_rek = ? AND no_hp = ? AND bpr_id = ? AND reff = ? AND tgl_trans = ?`,
                        {
                        replacements: [
                            "R",
                            check_transaksi[0].token,
                            check_transaksi[0].no_rek,
                            check_transaksi[0].no_hp,
                            check_transaksi[0].bpr_id,
                            check_transaksi[0].reff,
                            check_transaksi[0].tgl_trans
                        ],
                        }
                    );
                    if (!metadata) {
                        console.log({
                            code: "001",
                            status: "Failed",
                            message: "Gagal, Terjadi Kesalahan Update Transaksi!!!",
                            rrn: rrn,
                            data: null,
                            });
                        res.status(200).send({
                        code: "001",
                        status: "Failed",
                        message: "Gagal, Terjadi Kesalahan Update Transaksi!!!",
                        rrn: rrn,
                        data: null,
                        });
                    } else {
                        console.log({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            data: request.data,
                        });
                        let response = {
                            no_hp,
                            bpr_id,
                            no_rek,
                            nama_rek: check_transaksi[0].nama_rek,
                            product_name,
                            amount,
                            trans_fee,
                            trx_code,
                            trx_type,
                            reff: check_transaksi[0].reff,
                            tgl_trans: check_transaksi[0].tgl_trans,
                            tgl_transmis : moment().format('YYMMDDHHmmss'),
                            rrn
                        }
                        //--berhasil dapat list product update atau insert ke db --//
                        console.log("Success");
                        console.log({
                            code: "000",
                            status: "ok",
                            message: "Success",
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
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.status(200).send({
            code: "099",
            status: "Failed",
            rrn: rrn,
            message: error.message
        });
    }
};

module.exports = {
    webview,
    validate_mpin,
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
//                 code: "999",
//                 status: "ok",
//                 message: "Gagal Account Tidak Ditemukan",
//                 data: null,
//             });
//         } else {
//             request[0]["tgl_trans"] = moment().format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["tgl_transmis"] = moment().add(number, "minute").format('YYYY-MM-DD HH:mm:ss'),
//             request[0]["rrn"] = rrn
//             res.status(200).send({
//                 code: "000",
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

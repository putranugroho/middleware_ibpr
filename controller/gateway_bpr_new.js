const axios = require("axios").default;
const router = require('express').Router()
const {
    encryptStringWithRsaPublicKey,
    decryptStringWithRsaPrivateKey,
} = require("../utility/encrypt");
const db = require("../connection");
const moment = require("moment");
const { request } = require("https");
moment.locale("id");

// Generate random ref number
function generateString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    // const characters ='0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

// Generate random ref number
function generateNumber(length) {
    const characters = '0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}


const connect_axios = async (url, route, data) => {
    try {
        let Result = ""
        console.log(`${url}${route}`);
        console.log("DATA API CORE BANKING");
        console.log(data);
        await axios({
            method: 'post',
            url: `${url}${route}`,
            timeout: 25000, //milisecond
            data
        }).then(res => {
            Result = res.data
        }).catch(error => {
            console.log("error Core");
            // console.log(error);
            if (error.code == 'ECONNABORTED') {
                Result = {
                    code: "088",
                    status: "ECONNABORTED",
                    message: "Core Connection Timeout"
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
    let data_trans
    console.log(trx_code);
    if (trx_code === "2100") {
        data_trans = `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`
    } else if (trx_code === "2300") {
        data_trans = `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`
        trx_code = detail_trans.trx_code
    } else {
        data_trans = `${detail_trans.nama_rek} ${detail_trans.no_rek}`
    }
    console.log(data_trans);
    if (trx_code !== "2300") {
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
    }
    if (trans_fee !== 0) {
        let [res_log_fee, meta_log_fee] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
    }
}

async function update_gl_oy_debet(
    amount,
    trans_fee,
    bpr_id,
    trx_code,
    no_rek_pokok,
    no_rek_fee,
    nama_rek_pokok,
    nama_rek_fee,
    detail_trans) {
    let nominal = amount + trans_fee
    let data_trans
    if (detail_trans.trx_type == "TRX") {
        data_trans = `${detail_trans.bpr_id} ${detail_trans.no_rek}`
    } else {
        data_trans = `${detail_trans.nama_rek} ${detail_trans.no_rek}`
    }
    if (trx_code == "2200") {
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode,noreff) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    no_rek_pokok,
                    bpr_id,
                    trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    data_trans,
                    nominal,
                    0,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.tcode,
                    detail_trans.noreff
                ],
            }
        )
    } else {
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    no_rek_pokok,
                    bpr_id,
                    trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    data_trans,
                    amount,
                    0,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
        if (trans_fee !== 0) {
            let [res_log_fee, meta_log_fee] = await db.sequelize.query(
                `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                {
                    replacements: [
                        no_rek_fee,
                        bpr_id,
                        trx_code,
                        detail_trans.trx_type,
                        detail_trans.tgl_trans,
                        detail_trans.keterangan,
                        data_trans,
                        trans_fee,
                        0,
                        detail_trans.rrn,
                        detail_trans.status,
                        detail_trans.noreff,
                        detail_trans.tcode
                    ],
                }
            );
        }
    }
    // if (meta_pokok && meta_fee) {
    //     return true
    // } else {
    //     return false
    // }
}

async function update_gl_oy_db_cr(data_db, data_cr, detail_trans) {
    if (data_db.no_rek_pokok === "101208") {
        const nominal = data_db.amount + data_db.trans_fee
        let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    data_db.no_rek_pokok,
                    data_db.bpr_id,
                    data_db.trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                    nominal,
                    0,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
    } else {
        let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    data_db.no_rek_pokok,
                    data_db.bpr_id,
                    data_db.trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                    data_db.amount,
                    0,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
        if (data_db.trans_fee !== 0) {
            let [res_log_fee_db, meta_log_fee_db] = await db.sequelize.query(
                `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                {
                    replacements: [
                        data_db.no_rek_fee,
                        data_db.bpr_id,
                        data_db.trx_code,
                        detail_trans.trx_type,
                        detail_trans.tgl_trans,
                        detail_trans.keterangan,
                        `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                        data_db.trans_fee,
                        0,
                        detail_trans.rrn,
                        detail_trans.status,
                        detail_trans.noreff,
                        detail_trans.tcode
                    ],
                }
            );
        }
    }
    if (data_cr.no_rek_pokok === "101209") {
        const nominal = data_cr.amount + data_cr.trans_fee
        let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    data_cr.no_rek_pokok,
                    data_cr.bpr_id,
                    data_cr.trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                    0,
                    nominal,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
    } else {
        let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    data_cr.no_rek_pokok,
                    data_cr.bpr_id,
                    data_cr.trx_code,
                    detail_trans.trx_type,
                    detail_trans.tgl_trans,
                    detail_trans.keterangan,
                    `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                    0,
                    data_cr.amount,
                    detail_trans.rrn,
                    detail_trans.status,
                    detail_trans.noreff,
                    detail_trans.tcode
                ],
            }
        );
        if (data_cr.trans_fee !== 0) {
            let [res_log_fee_cr, meta_log_fee_cr] = await db.sequelize.query(
                `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,noreff,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                {
                    replacements: [
                        data_cr.no_rek_fee,
                        data_cr.bpr_id,
                        data_cr.trx_code,
                        detail_trans.trx_type,
                        detail_trans.tgl_trans,
                        detail_trans.keterangan,
                        `${detail_trans.nama_rek} ${detail_trans.no_rek}`,
                        0,
                        data_cr.trans_fee,
                        detail_trans.rrn,
                        detail_trans.status,
                        detail_trans.noreff,
                        detail_trans.tcode
                    ],
                }
            );
        }
    }
    // if (meta_pokok_db && meta_fee_db && meta_pokok_cr && meta_fee_cr) {
    //     return true
    // } else {
    //     return false
    // }
}

function split_sbb(data, tcode) {
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
        return { no_pokok, no_fee, tagihan }
    } else {
        if (data[0].jns_gl == "0") {
            if (data.length > 1) {
                no_pokok = data[0]
                no_fee = data[1]
            } else {
                return data[0]
            }
        } else if (data[0].jns_gl == "1") {
            if (data.length > 1) {
                no_pokok = data[1]
                no_fee = data[0]
            } else {
                return data[0]
            }
        }
        return { no_pokok, no_fee, tagihan }
    }
}

const url = process.env.CORE_URL//"https://gateway-devapi.medtransdigital.com/"

// API untuk Inquiry Account
const inquiry_account = async (req, res) => {
    let { user_id, no_hp, no_rek, bpr_id, trx_code, trx_type, status, pin, tgl_trans, tgl_transmis, rrn } = req.body;
    try {
        console.log("REQ INQ ACC GW");
        console.log(req.body);
        // let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
        //     `INSERT INTO log_core(no_hp,bpr_id,no_rek,trx_code,trx_type,tgl_trans,tgl_transmis,rrn,messages_type) VALUES (?,?,?,?,?,?,?,?,'REQUEST')`,
        //     {
        //         replacements: [
        //             no_rek, no_hp, bpr_id, trx_code, trx_type, tgl_trans, tgl_transmis, rrn
        //         ],
        //     }
        // );
        if (trx_code == "0100") {
            let acct = await db.sequelize.query(
                `SELECT bpr_id, no_hp, no_rek, nama_rek, status FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
                {
                    replacements: [bpr_id, no_hp, no_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Belum Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                if (acct[0].status != "0" && acct[0].status == "4") {
                    res.status(200).send({
                        code: "003",
                        status: "Failed",
                        message: "Gagal, Akun Sudah diaktivasi",
                        rrn: rrn,
                        data: null,
                    });
                } else {
                    acct[0]["tgl_trans"] = tgl_trans
                    acct[0]["tgl_transmis"] = moment().format('YYMMDDHHmmss')
                    acct[0]["rrn"] = rrn
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: acct[0],
                    });
                }
            }
        } else if (trx_code == "0200") {
            console.log("REQ ACTIVATE ACCOUNT");
            let acct = await db.sequelize.query(
                `SELECT bpr_id, no_hp, no_rek, nama_rek, mpin, mpin_salah, status FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
                {
                    replacements: [bpr_id, no_hp, no_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                console.log({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                let mpin_salah = parseInt(acct[0].mpin_salah)
  
                if (mpin_salah == 3 && acct[0].status == 2) {
                    res.status(200).send({
                        code: "007",
                        status: "Failed",
                        message: "Gagal, mPIN Terblokir!!!",
                        data: null,
                    });
                } else if (mpin_salah != 3 && acct[0].status == 2) {
                    res.status(200).send({
                        code: "007",
                        status: "Failed",
                        message: "Gagal, Akun Anda Telah diBlokir!!!",
                        data: null,
                    });
                } else if (acct[0].mpin == pin) {
                    let [results, metadata] = await db.sequelize.query(
                        `UPDATE cms_acct_ebpr SET status = ?, mpin_salah = '0' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                        {
                            replacements: [status, no_rek, no_hp, bpr_id]
                        }
                    );
                    if (!metadata) {
                        console.log({
                            code: "001",
                            status: "Failed",
                            message: "Gagal, Merubah Status Akun!!!",
                            rrn: rrn,
                            data: null,
                        });
                        res.status(200).send({
                            code: "001",
                            status: "Failed",
                            message: "Gagal, Merubah Status Akun!!!",
                            rrn: rrn,
                            data: null,
                        });
                    } else {
                        console.log({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            rrn: rrn,
                            data: acct[0],
                        });
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            rrn: rrn,
                            data: acct[0],
                        });
                    }
                } else {
                    mpin_salah = mpin_salah + 1
                    if (mpin_salah == 3) {
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE cms_acct_ebpr SET mpin_salah = ?, status = '2'  WHERE no_hp = ? AND no_rek = ?`,
                            {
                                replacements: [`${mpin_salah}`, no_hp, no_rek,]
                            }
                        );
                        res.status(200).send({
                            code: "007",
                            status: "Failed",
                            message: "Gagal, mPIN Terblokir!!!",
                            data: null,
                        });
                    } else {
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE cms_acct_ebpr SET mpin_salah = ? WHERE no_hp = ? AND no_rek = ?`,
                            {
                                replacements: [`${mpin_salah}`, no_hp, no_rek,]
                            }
                        );
                        res.status(200).send({
                            code: "003",
                            status: "Failed",
                            message: "Gagal, Pin Anda Salah!!!",
                            data: null,
                        });
                    }
                }
            }
        } else if (trx_code == "0300") {
            console.log("REQ SALDO");
            let gl = await db.sequelize.query(
                `SELECT * FROM master_kd_acct`,
                {
                    replacements: [bpr_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!gl.length) {
                res.status(200).send({
                    code: "004",
                    status: "Failed",
                    message: "Gagal Account Tidak Ditemukan",
                    data: null,
                });
            } else {
                const data_core = {
                    bpr_id,
                    trx_code,
                    trx_type,
                    tgl_trans,
                    tgl_transmis: moment().format('YYMMDDHHmmss'),
                    rrn,
                    data: gl
                }
                const request = await connect_axios(url, "Inquiry", data_core)
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    data: request.data.data,
                });
            }
        } else if (trx_code == "0400") {
            console.log("REQ VALIDATE NO_REK");
            let acct = await db.sequelize.query(
                `SELECT status FROM cms_acct_ebpr WHERE bpr_id = ? AND no_rek = ? AND status = '1' `,
                {
                    replacements: [bpr_id, no_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Belum Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                if (acct[0].status == "1") {
                    const data_core = {
                        // no_hp:rekening[0].no_hp,
                        bpr_id,
                        trx_code:"0300",
                        trx_type,
                        tgl_trans,
                        tgl_transmis:moment().format('YYMMDDHHmmss'),
                        rrn,
                        data: [{
                            no_rek,
                            gl_jns: "2",
                        }]
                    }
                    console.log("data_core");
                    console.log(data_core);
                    const request = await connect_axios(url, "Inquiry", data_core)
                    if (request.code !== "000") {
                        console.log(request);
                        res.status(200).send(request);
                    } else {
                        if (request.data.data[0].status_rek == "AKTIF") {
                            console.log(
                                {
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    rrn: rrn,
                                    data: [
                                        {
                                            no_rek,
                                            nama_rek: request.data.data[0].nama,
                                            saldo:`${parseInt(request.data.data[0].saldoakhir)}`,
                                            saldo_blokir:"0",
                                            saldo_min:"50000",
                                        }
                                    ],
                                });
                            res.status(200).send({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                rrn: rrn,
                                data: [
                                    {
                                        no_rek,
                                        nama_rek: request.data.data[0].nama,
                                        saldo:`${parseInt(request.data.data[0].saldoakhir)}`,
                                        saldo_blokir:"0",
                                        saldo_min:"50000",
                                    }
                                ],
                            });
                        } else {
                            res.status(200).send({
                                code: "008",
                                status: "Failed",
                                message: request.data.data[0].status_rek,
                                rrn: rrn,
                                data: [
                                    {
                                        no_rek,
                                        nama_rek: "",
                                        saldo:"0",
                                        saldo_blokir:"0",
                                        saldo_min:"0",
                                    }
                                ],
                            });
                        }
                    }   
                } else {console.log(
                    {
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: [
                            {
                                no_rek,
                                nama_rek: "",
                                saldo:"0",
                                saldo_blokir:"0",
                                saldo_min:"0",
                            }
                        ],
                    });
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: [
                            {
                                no_rek,
                                nama_rek: "",
                                saldo:"0",
                                saldo_blokir:"0",
                                saldo_min:"0",
                            }
                        ],
                    });
                }
            }
        } else if (trx_code == "0500") {
            console.log("REQ VALIDATE NO_HP");
            let acct = await db.sequelize.query(
                `SELECT bpr_id, no_hp, no_rek, nama_rek, status FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND status = '1'`,
                {
                    replacements: [bpr_id, no_hp],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    rrn: rrn,
                    data: acct[0],
                });
            }
        } else if (trx_code == "0600") {
            console.log("REQ UPDATE MPIN");
            let acct = await db.sequelize.query(
                `SELECT * FROM cms_acct_ebpr WHERE no_hp = ? AND no_rek = ? AND status = '1'`,
                {
                    replacements: [no_hp, no_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                let [results, metadata] = await db.sequelize.query(
                    `UPDATE cms_acct_ebpr SET mpin = ? WHERE no_hp = ? AND no_rek = ?`,
                    {
                      replacements: [pin, no_hp, no_rek],
                    }
                );
                console.log(metadata.rowCount);
                if (!metadata.rowCount) {
                res.status(200).send({
                    code: "002",
                    status: "ok",
                    message: "Gagal Update Mpin",
                    data: null,
                });
                } else {
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: acct[0],
                    });
                }

            }
        } else if (trx_code == "0700") {
            console.log("REQ VALIDATE NO_HP AND NO_REK");
            let acct = await db.sequelize.query(
                `SELECT * FROM cms_acct_ebpr WHERE no_rek = ? AND no_hp = ? AND status = '1'`,
                {
                    replacements: [no_rek, no_hp],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                if (acct[0].mpin === pin) {
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: acct[0],
                    });
                } else {
                    res.status(200).send({
                        code: "003",
                        status: "Failed",
                        message: "Gagal, MPin Salah",
                        rrn: rrn,
                        data: null,
                    });
                }

            }
        } else if (trx_code == "0800") {
            console.log("REQ VALIDATE NO_KTP");
            let acct = await db.sequelize.query(
                `SELECT bpr_id, no_hp, no_rek, nama_rek, no_ktp, status FROM cms_acct_ebpr WHERE bpr_id = ? AND no_ktp = ? AND status = '0'`,
                {
                    replacements: [bpr_id, no_ktp],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                console.log({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Nomer KTP Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Nomer KTP Tidak Terdaftar",
                    rrn: rrn,
                    data: null,
                });
            } else {
                    acct[0]["tgl_trans"] = tgl_trans
                    acct[0]["tgl_transmis"] = moment().format('YYMMDDHHmmss')
                    acct[0]["rrn"] = rrn
                    console.log({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: acct[0],
                    });
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        rrn: rrn,
                        data: acct[0],
                    });
            }
        }
    } catch (error) {
        //--error server--//
        console.log("erro get product", error);
        res.status(200).send({
            code: "099",
            status: "Failed",
            message: "INVALID DATA!!!",
            data: error,
        })
    }
};

// API untuk Transfer Proses
const transfer = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        nama_rek,
        bank_tujuan,
        rek_tujuan,
        nama_tujuan,
        amount,
        trans_fee,
        trx_code,
        trx_type,
        keterangan,
        tgl_trans,
        rrn } = req.body;
    try {
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_core(no_hp,bpr_id,no_rek,bank_tujuan,rek_tujuan,nama_tujuan,amount,trans_fee,trx_code,trx_type,tgl_trans,tgl_transmis,rrn) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    no_hp, bpr_id, no_rek, bank_tujuan, rek_tujuan, nama_tujuan, amount, trans_fee, trx_code, trx_type, tgl_trans, moment().format('YYMMDDHHmmss'), rrn,
                ],
            }
        );
        if (trx_code == "2100") {
            let acct = await db.sequelize.query(
                `SELECT * FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
                {
                    replacements: [bpr_id, no_hp, no_rek],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            )
            if (!acct.length) {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Belum Terdaftar",
                    data: null,
                });
            } else {
                if (acct[0].status == "1") {
                    let get_nosbb = await db.sequelize.query(
                        `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                        {
                            replacements: [trx_code, bpr_id],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (!get_nosbb.length) {
                        res.status(200).send({
                            code: "004",
                            status: "Failed",
                            message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                            data: null,
                        });
                    } else {
                        if (trx_type === "TRX") {
                            let status_core = await db.sequelize.query(
                                `SELECT * FROM status_core WHERE bpr_id = ?`,
                                {
                                    replacements: [bpr_id],
                                    type: db.sequelize.QueryTypes.SELECT,
                                }
                            );
                            if (status_core.status == "0") {
                                res.status(200).send({
                                    code: "099",
                                    status: "Failed",
                                    message: "Gagal, Core SIGN OFF!!!",
                                    data: null,
                                });
                            } else {
                                let nosbb = await split_sbb(get_nosbb, trx_code)
                                const data_core = {
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    nama_rek: acct[0].nama_rek,
                                    // nama_rek,
                                    bank_tujuan,
                                    nama_bank_tujuan: "",
                                    rek_tujuan,
                                    nama_tujuan,
                                    amount,
                                    trans_fee,
                                    trx_code,
                                    trx_type,
                                    keterangan,
                                    lokasi: "",
                                    tgl_trans,
                                    tgl_transmis: moment().format('YYMMDDHHmmss'),
                                    rrn,
                                    data: {
                                        gl_rek_db_1: no_rek,
                                        gl_jns_db_1: "2",
                                        gl_amount_db_1: amount,
                                        gl_rek_db_2: no_rek,
                                        gl_jns_db_2: "2",
                                        gl_amount_db_2: trans_fee,
                                        gl_rek_cr_1: nosbb.no_pokok.nosbb_cr,
                                        gl_jns_cr_1: nosbb.no_pokok.jns_sbb_cr,
                                        gl_amount_cr_1: amount,
                                        gl_rek_cr_2: nosbb.no_fee.nosbb_cr,
                                        gl_jns_cr_2: nosbb.no_fee.jns_sbb_cr,
                                        gl_amount_cr_2: trans_fee,
                                    }
                                }
                                const request = await connect_axios(url, "transfer", data_core)
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                    {
                                        replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                    }
                                );
                                if (request.code !== "000") {
                                    console.log("failed gateway");
                                    console.log(request);
                                    // if (bpr_id === "600998") {
                                    //     console.log("GW Transfer Out Timeout");
                                    // } else {
                                        res.status(200).send(request);
                                    // }
                                } else {
                                    const detail_trans = {
                                        no_rek,
                                        nama_rek: acct[0].nama_rek,
                                        // nama_rek,
                                        no_hp,
                                        bank_tujuan,
                                        rek_tujuan,
                                        nama_tujuan,
                                        keterangan,
                                        tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                        trx_type,
                                        status: "1",
                                        tcode: "000",
                                        noreff: request.data.noreff,
                                        rrn
                                    }
                                    await update_gl_oy_kredit(
                                        amount,
                                        trans_fee,
                                        bpr_id,
                                        trx_code,
                                        nosbb.no_pokok.nosbb_cr,
                                        nosbb.no_fee.nosbb_cr,
                                        nosbb.no_pokok.nmsbb_cr,
                                        nosbb.no_fee.nmsbb_cr,
                                        detail_trans
                                    )
                                    let [results, metadata] = await db.sequelize.query(
                                        `UPDATE cms_acct_ebpr SET transfer = transfer + ? + ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                        {
                                            replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                        }
                                    );
                                    if (!metadata) {
                                        console.log({
                                            code: "001",
                                            status: "Failed",
                                            message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                            data: null,
                                        });
                                        res.status(200).send({
                                            code: "001",
                                            status: "Failed",
                                            message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                            data: null,
                                        });
                                    } else {
                                        //--berhasil dapat list product update atau insert ke db --//
                                        console.log("Success");
                                        // if (bpr_id === "600998") {
                                        //     console.log("GW Transfer Out Timeout");
                                        // } else {
                                            res.status(200).send({
                                                code: "000",
                                                status: "ok",
                                                message: "Success",
                                                data: request.data,
                                            });
                                        // }
                                    }
                                }
                            }
                        } else if (trx_type === "REV") {
                            let status_core = await db.sequelize.query(
                                `SELECT * FROM status_core WHERE bpr_id = ?`,
                                {
                                    replacements: [bpr_id],
                                    type: db.sequelize.QueryTypes.SELECT,
                                }
                            );
                            let nosbb = await split_sbb(get_nosbb, trx_code)
                            const data_core = {
                                no_hp,
                                bpr_id,
                                no_rek,
                                nama_rek: acct[0].nama_rek,
                                // nama_rek,
                                bank_tujuan,
                                nama_bank_tujuan: "",
                                rek_tujuan,
                                nama_tujuan,
                                amount,
                                trans_fee,
                                trx_code,
                                trx_type,
                                keterangan,
                                lokasi: "",
                                tgl_trans,
                                tgl_transmis: moment().format('YYMMDDHHmmss'),
                                rrn,
                                data: {
                                    gl_rek_db_1: nosbb.no_pokok.nosbb_cr,
                                    gl_jns_db_1: nosbb.no_pokok.jns_sbb_cr,
                                    gl_amount_db_1: amount,
                                    gl_rek_db_2: nosbb.no_fee.nosbb_cr,
                                    gl_jns_db_2: nosbb.no_fee.jns_sbb_cr,
                                    gl_amount_db_2: trans_fee,
                                    gl_rek_cr_1: no_rek,
                                    gl_jns_cr_1: "2",
                                    gl_amount_cr_1: amount,
                                    gl_rek_cr_2: no_rek,
                                    gl_jns_cr_2: "2",
                                    gl_amount_cr_2: trans_fee,
                                }
                            }
                            if (status_core.status == "0") {
                                let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
                                    `INSERT INTO hold_transaction (data) VALUES (?)`,
                                    {
                                        replacements: [
                                            JSON.stringify(data_core),
                                        ],
                                    }
                                );
                                req.body["nama"] = acct[0].nama_rek
                                console.log("Success");
                                res.status(200).send({
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: req.body,
                                });
                            } else {
                                const request = await connect_axios(url, "transfer", data_core)
                                if (request.code !== "000") {
                                    console.log("failed gateway");
                                    console.log(request);
                                    res.status(200).send(request);
                                } else {
                                    const detail_trans = {
                                        no_rek,
                                        nama_rek: acct[0].nama_rek,
                                        // nama_rek,
                                        no_hp,
                                        bank_tujuan,
                                        rek_tujuan,
                                        nama_tujuan,
                                        keterangan,
                                        tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                        trx_type,
                                        status: "R",
                                        tcode: "000",
                                        noreff: request.data.noreff,
                                        rrn
                                    }
                                    await update_gl_oy_debet(
                                        amount,
                                        trans_fee,
                                        bpr_id,
                                        trx_code,
                                        nosbb.no_pokok.nosbb_cr,
                                        nosbb.no_fee.nosbb_cr,
                                        nosbb.no_pokok.nmsbb_cr,
                                        nosbb.no_fee.nmsbb_cr,
                                        detail_trans
                                    )
                                    let [results, metadata] = await db.sequelize.query(
                                        `UPDATE cms_acct_ebpr SET transfer = transfer - ? - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                        {
                                            replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                        }
                                    );
                                    if (!metadata) {
                                        console.log({
                                            code: "001",
                                            status: "Failed",
                                            message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                            data: null,
                                        });
                                        res.status(200).send({
                                            code: "001",
                                            status: "Failed",
                                            message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                            data: null,
                                        });
                                    } else {
                                        //--berhasil dapat list product update atau insert ke db --//
                                        console.log("Success");
                                        res.status(200).send({
                                            code: "000",
                                            status: "ok",
                                            message: "Success",
                                            data: request.data,
                                        });
                                    }
                                }
                            }
                        }
                    }
                } else {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                        data: null,
                    })
                }
            }
        } else if (trx_code == "2200") {
            if (trx_type == "TRX") {
                let status_core = await db.sequelize.query(
                    `SELECT * FROM status_core WHERE bpr_id = ?`,
                    {
                        replacements: [bpr_id],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );
                if (status_core.status == "0") {
                    res.status(200).send({
                        code: "099",
                        status: "Failed",
                        message: "Gagal, Core SIGN OFF!!!",
                        data: null,
                    });
                } else {
                    let get_nosbb = await db.sequelize.query(
                        `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                        {
                            replacements: [trx_code, bank_tujuan],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!get_nosbb.length) {
                        res.status(200).send({
                            code: "004",
                            status: "Failed",
                            message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                            data: null,
                        });
                    } else {
                        let nosbb = await split_sbb(get_nosbb, trx_code)
                        const data_core = {
                            no_hp,
                            bpr_id,
                            no_rek,
                            nama_rek: "",
                            // nama_rek,
                            bank_tujuan,
                            nama_bank_tujuan: "",
                            rek_tujuan,
                            nama_tujuan,
                            amount,
                            trans_fee,
                            trx_code,
                            trx_type,
                            keterangan,
                            lokasi: "",
                            tgl_trans,
                            tgl_transmis: moment().format('YYMMDDHHmmss'),
                            rrn,
                            data: {
                                gl_rek_db_1: nosbb.nosbb_db,
                                gl_jns_db_1: nosbb.jns_sbb_db,
                                gl_amount_db_1: amount,
                                gl_rek_db_2: nosbb.nosbb_db,
                                gl_jns_db_2: nosbb.jns_sbb_db,
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: rek_tujuan,
                                gl_jns_cr_1: "2",
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: rek_tujuan,
                                gl_jns_cr_2: "2",
                                gl_amount_cr_2: trans_fee
                            }
                        }
                        const request = await connect_axios(url, "transfer", data_core)
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                            {
                                replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                            }
                        );
                        if (request.code !== "000") {
                            console.log("failed gateway");
                            console.log(request);
                            // if (bank_tujuan === "600641") {
                            //     console.log("GW Transfer In Timeout");
                            // } else {
                                res.status(200).send(request);
                            // }
                        } else {
                            const detail_trans = {
                                bpr_id,
                                no_rek,
                                no_hp,
                                // nama_rek,
                                bank_tujuan,
                                rek_tujuan,
                                nama_tujuan,
                                keterangan,
                                tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                trx_type,
                                status: "1",
                                tcode: "000",
                                noreff: request.data.noreff,
                                rrn
                            }
                            await update_gl_oy_debet(
                                amount,
                                trans_fee,
                                bank_tujuan,
                                trx_code,
                                get_nosbb[0].nosbb_db,
                                get_nosbb[0].nosbb_db,
                                get_nosbb[0].nmsbb_db,
                                get_nosbb[0].nmsbb_db,
                                detail_trans
                            )
                            //--berhasil dapat list product update atau insert ke db --//
                            console.log("Success");
                            console.log(request.data);
                            // if (bank_tujuan === "600641") {
                            //     console.log("GW Transfer In Timeout");
                            // } else {
                                res.status(200).send({
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: request.data,
                                });   
                            // }
                        }
                    }
                }
            } else if (trx_type == "REV") {
                let status_core = await db.sequelize.query(
                    `SELECT * FROM status_core WHERE bpr_id = ?`,
                    {
                        replacements: [bpr_id],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );
                if (status_core.status == "0") {
                    res.status(200).send({
                        code: "099",
                        status: "Failed",
                        message: "Gagal, Core SIGN OFF!!!",
                        data: null,
                    });
                } else {
                    let get_nosbb = await db.sequelize.query(
                        `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                        {
                            replacements: [trx_code, bank_tujuan],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!get_nosbb.length) {
                        res.status(200).send({
                            code: "004",
                            status: "Failed",
                            message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                            data: null,
                        });
                    } else {
                        let nosbb = await split_sbb(get_nosbb, trx_code)
                        const data_core = {
                            no_hp,
                            bpr_id,
                            no_rek,
                            nama_rek: "",
                            // nama_rek,
                            bank_tujuan,
                            nama_bank_tujuan: "",
                            rek_tujuan,
                            nama_tujuan,
                            amount,
                            trans_fee,
                            trx_code,
                            trx_type,
                            keterangan,
                            lokasi: "",
                            tgl_trans,
                            tgl_transmis: moment().format('YYMMDDHHmmss'),
                            rrn,
                            data: {
                                gl_rek_db_1: rek_tujuan,
                                gl_jns_db_1: "2",
                                gl_amount_db_1: amount,
                                gl_rek_db_2: rek_tujuan,
                                gl_jns_db_2: "2",
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: nosbb.nosbb_db,
                                gl_jns_cr_1: nosbb.jns_sbb_db,
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: nosbb.nosbb_db,
                                gl_jns_cr_2: nosbb.jns_sbb_db,
                                gl_amount_cr_2: trans_fee,
                            }
                        }
                        const request = await connect_axios(url, "transfer", data_core)
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                            {
                                replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                            }
                        );
                        if (request.code !== "000") {
                            console.log("failed gateway");
                            console.log(request);
                            // if (bank_tujuan === "600641") {
                            //     console.log("GW Transfer In Timeout");
                            // } else {
                                res.status(200).send(request);
                            // }
                        } else {
                            const detail_trans = {
                                bpr_id,
                                no_rek,
                                no_hp,
                                // nama_rek,
                                bank_tujuan,
                                rek_tujuan,
                                nama_tujuan,
                                keterangan,
                                tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                trx_type,
                                status: "1",
                                tcode: "000",
                                noreff: request.data.noreff,
                                rrn
                            }
                            await update_gl_oy_debet(
                                amount,
                                trans_fee,
                                bank_tujuan,
                                trx_code,
                                get_nosbb[0].nosbb_db,
                                get_nosbb[0].nosbb_db,
                                get_nosbb[0].nmsbb_db,
                                get_nosbb[0].nmsbb_db,
                                detail_trans
                            )
                            //--berhasil dapat list product update atau insert ke db --//
                            console.log("Success");
                            console.log(request.data);
                            // if (bank_tujuan === "600641") {
                            //     console.log("GW Transfer In Timeout");
                            // } else {
                                res.status(200).send({
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: request.data,
                                });   
                            // }
                        }
                    }
                }
            }
        } else if (trx_code == "2300") {
            if (trx_type === "TRX") {
                let acct = await db.sequelize.query(
                    `SELECT * FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
                    {
                        replacements: [bpr_id, no_hp, no_rek],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!acct.length) {
                    res.status(200).send({
                        code: "003",
                        status: "Failed",
                        message: "Gagal, Akun Belum Terdaftar",
                        data: null,
                    });
                } else {
                    if (acct[0].status == "1") {
                        let status_core = await db.sequelize.query(
                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                            {
                                replacements: [bpr_id],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (status_core.status == "0") {
                            res.status(200).send({
                                code: "099",
                                status: "Failed",
                                message: "Gagal, Core SIGN OFF!!!",
                                data: null,
                            });
                        } else {
                            let get_nosbb = await db.sequelize.query(
                                `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                                {
                                    replacements: [trx_code, bpr_id],
                                    type: db.sequelize.QueryTypes.SELECT,
                                }
                            )
                            if (!get_nosbb.length) {
                                res.status(200).send({
                                    code: "004",
                                    status: "Failed",
                                    message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                                    data: null,
                                });
                            } else {
                                let nosbb = await split_sbb(get_nosbb, trx_code)
                                const data_core = {
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    nama_rek: acct[0].nama_rek,
                                    // nama_rek,
                                    bank_tujuan,
                                    nama_bank_tujuan: "",
                                    rek_tujuan,
                                    nama_tujuan,
                                    amount,
                                    trans_fee,
                                    trx_code,
                                    trx_type,
                                    keterangan,
                                    lokasi: "",
                                    tgl_trans,
                                    tgl_transmis: moment().format('YYMMDDHHmmss'),
                                    rrn,
                                    data: {
                                        gl_rek_db_1: no_rek,
                                        gl_jns_db_1: "2",
                                        gl_amount_db_1: amount,
                                        gl_rek_db_2: no_rek,
                                        gl_jns_db_2: "2",
                                        gl_amount_db_2: trans_fee,
                                        gl_rek_cr_1: rek_tujuan,
                                        gl_jns_cr_1: "2",
                                        gl_amount_cr_1: amount,
                                        gl_rek_cr_2: nosbb.no_fee.nosbb_cr,
                                        gl_jns_cr_2: nosbb.no_fee.jns_sbb_cr,
                                        gl_amount_cr_2: trans_fee,
                                    }
                                }
                                const request = await connect_axios(url, "transfer", data_core)
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                    {
                                        replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                    }
                                );
                                if (request.code !== "000") {
                                    console.log("failed gateway");
                                    console.log(request);
                                    // if (bpr_id === "600998") {
                                    //     console.log("GW Pindah Buku Timeout");
                                    // } else {
                                        res.status(200).send(request);
                                    // }
                                } else {
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    console.log(request.data);
                                    // if (bpr_id === "600998") {
                                    //     console.log("GW Pindah Buku Timeout");
                                    // } else {
                                        res.status(200).send({
                                            code: "000",
                                            status: "ok",
                                            message: "Success",
                                            data: request.data,
                                        });
                                    // }
                                }
                            }
                        }
                    } else {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                            data: null,
                        })
                    }
                }
            } else if (trx_type === "REV") {
                let acct = await db.sequelize.query(
                    `SELECT * FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
                    {
                        replacements: [bpr_id, no_hp, no_rek],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!acct.length) {
                    res.status(200).send({
                        code: "003",
                        status: "Failed",
                        message: "Gagal, Akun Belum Terdaftar",
                        data: null,
                    });
                } else {
                    if (acct[0].status == "1") {
                        let status_core = await db.sequelize.query(
                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                            {
                                replacements: [bpr_id],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (status_core.status == "0") {
                            res.status(200).send({
                                code: "099",
                                status: "Failed",
                                message: "Gagal, Core SIGN OFF!!!",
                                data: null,
                            });
                        } else {
                            let get_nosbb = await db.sequelize.query(
                                `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                                {
                                    replacements: [trx_code, bpr_id],
                                    type: db.sequelize.QueryTypes.SELECT,
                                }
                            )
                            if (!get_nosbb.length) {
                                res.status(200).send({
                                    code: "004",
                                    status: "Failed",
                                    message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                                    data: null,
                                });
                            } else {
                                let nosbb = await split_sbb(get_nosbb, trx_code)
                                const data_core = {
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    nama_rek: acct[0].nama_rek,
                                    // nama_rek,
                                    bank_tujuan,
                                    nama_bank_tujuan: "",
                                    rek_tujuan,
                                    nama_tujuan,
                                    amount,
                                    trans_fee,
                                    trx_code,
                                    trx_type,
                                    keterangan,
                                    lokasi: "",
                                    tgl_trans,
                                    tgl_transmis: moment().format('YYMMDDHHmmss'),
                                    rrn,
                                    data: {
                                        gl_rek_db_1: rek_tujuan,
                                        gl_jns_db_1: "2",
                                        gl_amount_db_1: amount,
                                        gl_rek_db_2: nosbb.no_fee.nosbb_cr,
                                        gl_jns_db_2: nosbb.no_fee.jns_sbb_cr,
                                        gl_amount_db_2: trans_fee,
                                        gl_rek_cr_1: no_rek,
                                        gl_jns_cr_1: "2",
                                        gl_amount_cr_1: amount,
                                        gl_rek_cr_2: no_rek,
                                        gl_jns_cr_2: "2",
                                        gl_amount_cr_2: trans_fee,
                                    }
                                }
                                const request = await connect_axios(url, "transfer", data_core)
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                    {
                                        replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                    }
                                );
                                if (request.code !== "000") {
                                    console.log("failed gateway");
                                    console.log(request);
                                    res.status(200).send(request);
                                } else {
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    console.log(request.data);
                                    res.status(200).send({
                                        code: "000",
                                        status: "ok",
                                        message: "Success",
                                        data: request.data,
                                    });
                                }
                            }
                        }
                    } else {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                            data: null,
                        })
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
            message: "INVALID DATA!!!",
            data: error,
        })
    }
};

// API untuk Withdrawal Proses
const withdrawal = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        nama_rek,
        amount,
        trans_fee,
        pin,
        trx_code,
        trx_type,
        keterangan,
        acq_id,
        terminal_id,
        token,
        lokasi,
        tgl_trans,
        tgl_transmis,
        rrn } = req.body;
    try {
        console.log("REQ GATEWAY WITHDRAWAL");
        console.log(req.body);
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_core(no_hp,bpr_id,no_rek,amount,trans_fee,trx_code,trx_type,tgl_trans,tgl_transmis,keterangan,acq_id,terminal_id,rrn) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    no_hp, bpr_id, no_rek, amount, trans_fee, trx_code, trx_type, tgl_trans, moment().format('YYMMDDHHmmss'), keterangan, acq_id, terminal_id, rrn,
                ],
            }
        );
        if (trx_code == "1000") {
            console.log("CREATE TOKEN");
            let check_status = await db.sequelize.query(
                `SELECT * FROM cms_acct_ebpr WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                {
                    replacements: [no_rek, no_hp, bpr_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!check_status.length) {
                console.log({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Akun Tidak Terdaftar!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Akun Tidak Terdaftar!!!",
                    data: null,
                });
            } else {
                let mpin_salah = parseInt(check_status[0].mpin_salah)

                if (check_status[0].status != 2 && check_status[0].status != 1) {
                    res.status(200).send({
                        code: "007",
                        status: "Failed",
                        message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                        data: null,
                    });
                } else if (mpin_salah == 3 && check_status[0].status == 2) {
                    res.status(200).send({
                        code: "007",
                        status: "Failed",
                        message: "Gagal, mPIN Terblokir!!!",
                        data: null,
                    });
                } else if (mpin_salah != 3 && check_status[0].status == 2) {
                    res.status(200).send({
                        code: "007",
                        status: "Failed",
                        message: "Gagal, Akun Anda Telah diBlokir!!!",
                        data: null,
                    });
                } else if ((check_status[0].mpin == pin || trx_type === "REV") && check_status[0].status == 1) {
                    let [results, metadata] = await db.sequelize.query(
                        `UPDATE cms_acct_ebpr SET mpin_salah = '0' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                        {
                            replacements: [no_rek, no_hp, bpr_id]
                        }
                    );
                    let check_limit = await db.sequelize.query(
                        `SELECT * FROM cms_accttype WHERE acct_type = ?`,
                        {
                            replacements: [check_status[0].acct_type],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (!check_limit.length) {
                        res.status(200).send({
                            code: "001",
                            status: "Failed",
                            message: "Gagal, Terjadi Kesalahan Pencarian Tipe Kartu!!!",
                            data: null,
                        });
                    } else {
                        let limit_trx, limit_harian, counter_transaksi
                        // let trx_amount, trx_trans_fee = 0
                        limit_trx = parseInt(check_limit[0].trk_tunai_trx)
                        limit_harian = parseInt(check_limit[0].trk_tunai_harian)
                        counter_transaksi = parseInt(check_status[0].tariktunai)
                        if (amount == undefined) amount = 0
                        if (trans_fee == undefined) trans_fee = 0
                        const total = parseInt(trans_fee) + parseInt(amount)
                        if (total <= limit_trx) {
                            if (counter_transaksi + total <= limit_harian) {
                                let get_nosbb = await db.sequelize.query(
                                    `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                                    {
                                        replacements: [trx_code, bpr_id],
                                        type: db.sequelize.QueryTypes.SELECT,
                                    }
                                );
                                if (!get_nosbb.length) {
                                    res.status(200).send({
                                        code: "004",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                                        data: null,
                                    });
                                } else {
                                    if (trx_type == "TRX") {
                                        let status_core = await db.sequelize.query(
                                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                                            {
                                                replacements: [bpr_id],
                                                type: db.sequelize.QueryTypes.SELECT,
                                            }
                                        );
                                        if (status_core.status == "0") {
                                            res.status(200).send({
                                                code: "099",
                                                status: "Failed",
                                                message: "Gagal, Core SIGN OFF!!!",
                                                data: null,
                                            });
                                        } else {
                                            let nosbb = await split_sbb(get_nosbb, trx_code)
                                            console.log(keterangan);
                                            const data_core = {
                                                no_hp,
                                                bpr_id,
                                                no_rek,
                                                trx_code,
                                                trx_type,
                                                amount,
                                                trans_fee,
                                                keterangan,
                                                token: "",
                                                acq_id: "",
                                                terminal_id: "",
                                                lokasi: "",
                                                tgl_trans,
                                                tgl_transmis: moment().format('YYMMDDHHmmss'),
                                                rrn,
                                                data: {
                                                    gl_rek_db_1: no_rek,
                                                    gl_jns_db_1: "2",
                                                    gl_amount_db_1: amount,
                                                    gl_rek_db_2: no_rek,
                                                    gl_jns_db_2: "2",
                                                    gl_amount_db_2: trans_fee,
                                                    gl_rek_cr_1: nosbb.no_pokok.nosbb_cr,
                                                    gl_jns_cr_1: nosbb.no_pokok.jns_sbb_cr,
                                                    gl_amount_cr_1: amount,
                                                    gl_rek_cr_2: nosbb.no_fee.nosbb_cr,
                                                    gl_jns_cr_2: nosbb.no_fee.jns_sbb_cr,
                                                    gl_amount_cr_2: trans_fee,
                                                }
                                            }
                                            const request = await connect_axios(url, "tariktunai", data_core)
                                            let [results, metadata] = await db.sequelize.query(
                                                `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                                {
                                                    replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                                }
                                            );
                                            if (request.code !== "000") {
                                                console.log(request);
                                                // if (bpr_id === "600001") {
                                                //     console.log("GW Token Timeout");
                                                // } else {
                                                    res.status(200).send(request);
                                                // }
                                            } else {
                                                const detail_trans = {
                                                    no_rek,
                                                    nama_rek: check_status[0].nama_rek,
                                                    no_hp,
                                                    keterangan,
                                                    tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                                    trx_type,
                                                    status: "1",
                                                    tcode: "000",
                                                    noreff: request.data.noreff,
                                                    rrn
                                                }
                                                await update_gl_oy_kredit(
                                                    amount,
                                                    trans_fee,
                                                    bpr_id,
                                                    trx_code,
                                                    nosbb.no_pokok.nosbb_cr,
                                                    nosbb.no_fee.nosbb_cr,
                                                    nosbb.no_pokok.nmsbb_cr,
                                                    nosbb.no_fee.nmsbb_cr,
                                                    detail_trans
                                                )
                                                let [results, metadata] = await db.sequelize.query(
                                                    `UPDATE cms_acct_ebpr SET tariktunai = tariktunai + ? + ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                                    {
                                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                                    }
                                                );
                                                if (!metadata) {
                                                    console.log({
                                                        code: "001",
                                                        status: "Failed",
                                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                                        data: null,
                                                    });
                                                    res.status(200).send({
                                                        code: "001",
                                                        status: "Failed",
                                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                                        data: null,
                                                    });
                                                } else {
                                                    request.data['keterangan'] = keterangan
                                                    //--berhasil dapat list product update atau insert ke db --//
                                                    console.log("Success");
                                                    // if (bpr_id === "600001") {
                                                    //     console.log("GW Token Timeout");
                                                    // } else {
                                                        res.status(200).send({
                                                            code: "000",
                                                            status: "ok",
                                                            message: "Success",
                                                            data: request.data,
                                                        });
                                                    // }
                                                }
                                            }
                                        }
                                    } else if (trx_type === "REV") {
                                        let status_core = await db.sequelize.query(
                                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                                            {
                                                replacements: [bpr_id],
                                                type: db.sequelize.QueryTypes.SELECT,
                                            }
                                        );
                                        let nosbb = await split_sbb(get_nosbb, trx_code)
                                        console.log(keterangan);
                                        const data_core = {
                                            no_hp,
                                            bpr_id,
                                            no_rek,
                                            trx_code,
                                            trx_type,
                                            amount,
                                            trans_fee,
                                            keterangan,
                                            token: "",
                                            acq_id: "",
                                            terminal_id: "",
                                            lokasi: "",
                                            tgl_trans,
                                            tgl_transmis: moment().format('YYMMDDHHmmss'),
                                            rrn,
                                            data: {
                                                gl_rek_db_1: nosbb.no_pokok.nosbb_cr,
                                                gl_jns_db_1: nosbb.no_pokok.jns_sbb_cr,
                                                gl_amount_db_1: amount,
                                                gl_rek_db_2: nosbb.no_fee.nosbb_cr,
                                                gl_jns_db_2: nosbb.no_fee.jns_sbb_cr,
                                                gl_amount_db_2: trans_fee,
                                                gl_rek_cr_1: no_rek,
                                                gl_jns_cr_1: "2",
                                                gl_amount_cr_1: amount,
                                                gl_rek_cr_2: no_rek,
                                                gl_jns_cr_2: "2",
                                                gl_amount_cr_2: trans_fee,
                                            }
                                        }
                                        if (status_core.status == "0") {
                                            let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
                                                `INSERT INTO hold_transaction (data) VALUES (?)`,
                                                {
                                                    replacements: [
                                                        JSON.stringify(data_core),
                                                    ],
                                                }
                                            );
                                            console.log("Success");
                                            res.status(200).send({
                                                code: "000",
                                                status: "ok",
                                                message: "Success",
                                                data: req.body,
                                            });
                                        } else {
                                            const request = await connect_axios(url, "tariktunai", data_core)
                                            let [results, metadata] = await db.sequelize.query(
                                                `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                                {
                                                    replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                                }
                                            );
                                            if (request.code !== "000") {
                                                console.log(request);
                                                res.status(200).send(request);
                                            } else {
                                                const detail_trans = {
                                                    no_rek,
                                                    nama_rek,
                                                    no_hp,
                                                    keterangan,
                                                    tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                                    trx_type,
                                                    status: "R",
                                                    tcode: "000",
                                                    noreff: request.data.noreff,
                                                    rrn
                                                }
                                                await update_gl_oy_debet(
                                                    amount,
                                                    trans_fee,
                                                    bpr_id,
                                                    trx_code,
                                                    nosbb.no_pokok.nosbb_cr,
                                                    nosbb.no_fee.nosbb_cr,
                                                    nosbb.no_pokok.nmsbb_cr,
                                                    nosbb.no_fee.nmsbb_cr,
                                                    detail_trans
                                                )
                                                let [results, metadata] = await db.sequelize.query(
                                                    `UPDATE cms_acct_ebpr SET tariktunai = tariktunai - ? - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                                    {
                                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                                    }
                                                );
                                                if (!metadata) {
                                                    console.log({
                                                        code: "001",
                                                        status: "Failed",
                                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                                        data: null,
                                                    });
                                                    res.status(200).send({
                                                        code: "001",
                                                        status: "Failed",
                                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                                        data: null,
                                                    });
                                                } else {
                                                    request.data['keterangan'] = keterangan
                                                    //--berhasil dapat list product update atau insert ke db --//
                                                    console.log("Success");
                                                    res.status(200).send({
                                                        code: "000",
                                                        status: "ok",
                                                        message: "Success",
                                                        data: request.data,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                res.status(200).send({
                                    code: "009",
                                    status: "Failed",
                                    message: "Gagal, Transaksi Sudah Melebihi Limit Harian!!!",
                                    data: null,
                                });
                            }
                        } else {
                            res.status(200).send({
                                code: "009",
                                status: "Failed",
                                message: "Gagal, Nominal Melebihi Limit Transaksi!!!",
                                data: null,
                            });
                        }
                    }
                } else {
                    mpin_salah = mpin_salah + 1
                    if (mpin_salah >= 3) {
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE cms_acct_ebpr SET mpin_salah = ?, status = '2'  WHERE no_hp = ? AND no_rek = ?`,
                            {
                                replacements: [`${mpin_salah}`, no_hp, no_rek,]
                            }
                        );
                        res.status(200).send({
                            code: "007",
                            status: "Failed",
                            message: "Gagal, mPIN Terblokir!!!",
                            data: null,
                        });
                    } else {
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE cms_acct_ebpr SET mpin_salah = ? WHERE no_hp = ? AND no_rek = ?`,
                            {
                                replacements: [`${mpin_salah}`, no_hp, no_rek,]
                            }
                        );
                        res.status(200).send({
                            code: "003",
                            status: "Failed",
                            message: "Gagal, Pin Anda Salah!!!",
                            data: null,
                        });
                    }
                }
            }
        } else if (trx_code == "1100") {
            let jurnal_bpr
            if (keterangan == "acquirer") {
                jurnal_bpr = acq_id
            } else {
                jurnal_bpr = bpr_id
            }
            let get_nosbb = await db.sequelize.query(
                `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                {
                    replacements: ["1100", jurnal_bpr],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!get_nosbb.length) {
                console.log({
                    code: "004",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "004",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                    data: null,
                });
            } else {
                let nosbb = await split_sbb(get_nosbb, "1100")
                let on_us = {}, issuer = {}, acquirer = {}
                if (trx_type === "TRX") {
                    console.log("TARIK TUNAI ATM TRX");
                    let status_core = await db.sequelize.query(
                        `SELECT * FROM status_core WHERE bpr_id = ?`,
                        {
                            replacements: [jurnal_bpr],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (status_core.status == "0") {
                        res.status(200).send({
                            code: "099",
                            status: "Failed",
                            message: "Gagal, Core SIGN OFF!!!",
                            data: null,
                        });
                    } else {
                        if (keterangan == "on_us") {
                            on_us = {
                                gl_rek_db_1: nosbb.no_pokok.On_Us.nosbb_db,
                                gl_jns_db_1: nosbb.no_pokok.On_Us.jns_sbb_db,
                                gl_amount_db_1: amount,
                                gl_rek_db_2: nosbb.no_fee.On_Us.nosbb_db,
                                gl_jns_db_2: nosbb.no_fee.On_Us.jns_sbb_db,
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: nosbb.no_pokok.On_Us.nosbb_cr,
                                // gl_jns_cr_1: nosbb.no_pokok.On_Us.jns_sbb_cr,
                                gl_jns_cr_1: "2",
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: nosbb.no_fee.On_Us.nosbb_cr,
                                // gl_jns_cr_2: nosbb.no_fee.On_Us.jns_sbb_cr,
                                gl_jns_cr_2: "2",
                                gl_amount_cr_2: trans_fee,
                            }
                        } else if (keterangan == "issuer") {
                            issuer = {
                                gl_rek_db_1: nosbb.no_pokok.On_Us.nosbb_db,
                                gl_jns_db_1: nosbb.no_pokok.On_Us.jns_sbb_db,
                                gl_amount_db_1: amount,
                                gl_rek_db_2: nosbb.no_fee.On_Us.nosbb_db,
                                gl_jns_db_2: nosbb.no_fee.On_Us.jns_sbb_db,
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: nosbb.tagihan.nosbb_cr,
                                gl_jns_cr_1: nosbb.tagihan.jns_sbb_cr,
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: nosbb.tagihan.nosbb_cr,
                                gl_jns_cr_2: nosbb.tagihan.jns_sbb_cr,
                                gl_amount_cr_2: trans_fee,
                            }
                        } else if (keterangan == "acquirer") {
                            acquirer = {
                                gl_rek_db_1: nosbb.no_pokok.Acquirer.nosbb_db,
                                gl_jns_db_1: nosbb.no_pokok.Acquirer.jns_sbb_db,
                                gl_amount_db_1: amount,
                                gl_rek_db_2: nosbb.no_pokok.Acquirer.nosbb_db,
                                gl_jns_db_2: nosbb.no_pokok.Acquirer.jns_sbb_db,
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: nosbb.no_pokok.Acquirer.nosbb_cr,
                                // gl_jns_cr_1: nosbb.no_pokok.Acquirer.jns_sbb_cr,
                                gl_jns_cr_1: "2",
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: nosbb.no_fee.Acquirer.nosbb_cr,
                                // gl_jns_cr_2: nosbb.no_fee.Acquirer.jns_sbb_cr,
                                gl_jns_cr_2: "2",
                                gl_amount_cr_2: trans_fee,
                            }
                        }
                        // const data_gateway = {no_hp, bpr_id, no_rek:data_nasabah.data.nama_rek, trx_code, trx_type, amount, trans_fee, token, keterangan, terminal_id, lokasi, tgl_trans, tgl_transmis, rrn}
                        const data_core = {
                            no_hp,
                            bpr_id,
                            no_rek,
                            trx_code: "1100",
                            trx_type: "TRX",
                            amount,
                            trans_fee,
                            acq_id,
                            terminal_id,
                            token,
                            keterangan,
                            lokasi,
                            tgl_trans,
                            tgl_transmis: moment().format('YYMMDDHHmmss'),
                            rrn,
                            data: {
                                on_us,
                                issuer,
                                acquirer,
                            }
                        }
                        const request = await connect_axios(url, "tariktunai", data_core)
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                            {
                                replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                            }
                        );
                        if (request.code !== "000") {
                            console.log(request);600931
                            res.status(200).send(request);
                        } else {
                            const detail_trans = {
                                no_rek,
                                nama_rek,
                                keterangan,
                                tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                trx_type,
                                status: "1",
                                tcode: "000",
                                noreff: request.data.noreff,
                                rrn
                            }
                            let nosbb = await split_sbb(get_nosbb, trx_code)
                            let data_db, data_cr = {}
                            if (keterangan === "on_us") {
                                data_db = {
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code: "1000",
                                    no_rek_pokok: nosbb.no_pokok.On_Us.nosbb_db,
                                    no_rek_fee: nosbb.no_fee.On_Us.nosbb_db,
                                    nama_rek_pokok: nosbb.no_pokok.On_Us.nmsbb_db,
                                    nama_rek_fee: nosbb.no_fee.On_Us.nmsbb_db
                                }
                                data_cr = {
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.no_pokok.On_Us.nosbb_cr,
                                    no_rek_fee: nosbb.no_fee.On_Us.nosbb_cr,
                                    nama_rek_pokok: nosbb.no_pokok.On_Us.nmsbb_cr,
                                    nama_rek_fee: nosbb.no_fee.On_Us.nmsbb_cr
                                }
                            } else if (keterangan === "issuer") {
                                data_db = {
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code: "1000",
                                    no_rek_pokok: nosbb.no_pokok.On_Us.nosbb_db,
                                    no_rek_fee: nosbb.no_fee.On_Us.nosbb_db,
                                    nama_rek_pokok: nosbb.no_pokok.On_Us.nmsbb_db,
                                    nama_rek_fee: nosbb.no_fee.On_Us.nmsbb_db
                                }
                                data_cr = {
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.tagihan.nosbb_cr,
                                    no_rek_fee: nosbb.tagihan.nosbb_cr,
                                    nama_rek_pokok: nosbb.tagihan.nmsbb_cr,
                                    nama_rek_fee: nosbb.tagihan.nmsbb_cr
                                }
                            } else if (keterangan === "acquirer") {
                                data_db = {
                                    amount,
                                    trans_fee,
                                    bpr_id: acq_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.no_pokok.Acquirer.nosbb_db,
                                    no_rek_fee: nosbb.no_fee.Acquirer.nosbb_db,
                                    nama_rek_pokok: nosbb.no_pokok.Acquirer.nmsbb_db,
                                    nama_rek_fee: nosbb.no_fee.Acquirer.nmsbb_db
                                }
                                data_cr = {
                                    amount,
                                    trans_fee,
                                    bpr_id: acq_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.no_pokok.Acquirer.nosbb_cr,
                                    no_rek_fee: nosbb.no_fee.Acquirer.nosbb_cr,
                                    nama_rek_pokok: nosbb.no_pokok.Acquirer.nmsbb_cr,
                                    nama_rek_fee: nosbb.no_fee.Acquirer.nmsbb_cr
                                }
                            }
                            await update_gl_oy_db_cr(data_db, data_cr, detail_trans)
                            request.data['terminal_id'] = terminal_id
                            //--berhasil dapat list product update atau insert ke db --//
                            console.log("Success");
                            // if (keterangan === "acquirer" && acq_id === "602640") {
                            //     console.log("GW TARIK TUNAI ACQUIRER Timeout");
                            // } else if (keterangan === "issuer" && bpr_id === "600641") {
                            //     console.log("GW TARIK TUNAI ISSUER Timeout");
                            // } else if (keterangan === "on_us" && bpr_id === "600998") {
                            //     console.log("GW TARIK TUNAI ON_US Timeout");
                            // } else {
                                res.status(200).send({
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: request.data,
                                });
                            // }
                        }
                    }
                } else if (trx_type === "REV") {
                    console.log("TARIK TUNAI ATM REV");
                    let status_core = await db.sequelize.query(
                        `SELECT * FROM status_core WHERE bpr_id = ?`,
                        {
                            replacements: [bpr_id],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (keterangan == "on_us") {
                        on_us = {
                            gl_rek_db_1: nosbb.no_pokok.On_Us.nosbb_cr,
                            gl_jns_db_1: nosbb.no_pokok.On_Us.jns_sbb_cr,
                            gl_amount_db_1: amount,
                            gl_rek_db_2: nosbb.no_fee.On_Us.nosbb_cr,
                            gl_jns_db_2: nosbb.no_fee.On_Us.jns_sbb_cr,
                            gl_amount_db_2: trans_fee,
                            gl_rek_cr_1: no_rek,
                            // gl_jns_cr_1: nosbb.no_pokok.On_Us.jns_sbb_db,
                            gl_jns_cr_1: "2",
                            gl_amount_cr_1: amount,
                            gl_rek_cr_2: no_rek,
                            // gl_jns_cr_2: nosbb.no_fee.On_Us.jns_sbb_db,
                            gl_jns_cr_2: "2",
                            gl_amount_cr_2: trans_fee,
                        }
                    } else if (keterangan == "issuer") {
                        issuer = {
                            gl_rek_db_1: nosbb.tagihan.nosbb_cr,
                            gl_jns_db_1: nosbb.tagihan.jns_sbb_cr,
                            gl_amount_db_1: amount,
                            gl_rek_db_2: nosbb.tagihan.nosbb_cr,
                            gl_jns_db_2: nosbb.tagihan.jns_sbb_cr,
                            gl_amount_db_2: trans_fee,
                            gl_rek_cr_1: nosbb.no_pokok.On_Us.nosbb_db,
                            gl_jns_cr_1: nosbb.no_pokok.On_Us.jns_sbb_db,
                            gl_amount_cr_1: amount,
                            gl_rek_cr_2: nosbb.no_fee.On_Us.nosbb_db,
                            gl_jns_cr_2: nosbb.no_fee.On_Us.jns_sbb_db,
                            gl_amount_cr_2: trans_fee,
                        }
                    } else if (keterangan == "acquirer") {
                        acquirer = {
                            gl_rek_db_1: nosbb.no_pokok.Acquirer.nosbb_cr,
                            // gl_jns_db_1: nosbb.no_pokok.Acquirer.jns_sbb_cr,
                            gl_jns_db_1: "2",
                            gl_amount_db_1: amount,
                            gl_rek_db_2: nosbb.no_fee.Acquirer.nosbb_cr,
                            // gl_jns_db_2: nosbb.no_fee.Acquirer.jns_sbb_cr,
                            gl_jns_db_2: "2",
                            gl_amount_db_2: trans_fee,
                            gl_rek_cr_1: nosbb.no_pokok.Acquirer.nosbb_db,
                            gl_jns_cr_1: nosbb.no_pokok.Acquirer.jns_sbb_db,
                            gl_amount_cr_1: amount,
                            gl_rek_cr_2: nosbb.no_pokok.Acquirer.nosbb_db,
                            gl_jns_cr_2: nosbb.no_pokok.Acquirer.jns_sbb_db,
                            gl_amount_cr_2: trans_fee,
                        }
                    }
                    // const data_gateway = {no_hp, bpr_id, no_rek:data_nasabah.data.nama_rek, trx_code, trx_type, amount, trans_fee, token, keterangan, terminal_id, lokasi, tgl_trans, tgl_transmis, rrn}
                    const data_core = {
                        no_hp,
                        bpr_id,
                        no_rek,
                        trx_code: "1100",
                        trx_type,
                        amount,
                        trans_fee,
                        acq_id,
                        terminal_id,
                        token,
                        keterangan,
                        lokasi,
                        tgl_trans,
                        tgl_transmis: moment().format('YYMMDDHHmmss'),
                        rrn,
                        data: {
                            on_us,
                            issuer,
                            acquirer,
                        }
                    }
                    if (status_core.status == "0") {
                        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
                            `INSERT INTO hold_transaction (data) VALUES (?)`,
                            {
                                replacements: [
                                    JSON.stringify(data_core),
                                ],
                            }
                        );
                        console.log("Success");
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            data: req.body,
                        });
                    } else {
                        const request = await connect_axios(url, "tariktunai", data_core)
                        let [results, metadata] = await db.sequelize.query(
                            `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                            {
                                replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                            }
                        );
                        if (request.code !== "000") {
                            console.log(request);
                            res.status(200).send(request);
                        } else {
                            const detail_trans = {
                                no_rek,
                                nama_rek,
                                keterangan,
                                tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                trx_type,
                                status: "R",
                                tcode: "000",
                                noreff: request.data.noreff,
                                rrn
                            }
                            let nosbb = await split_sbb(get_nosbb, trx_code)
                            let data_db, data_cr = {}
                            if (keterangan === "on_us") {
                                await update_gl_oy_debet(
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    nosbb.no_pokok.On_Us.nosbb_cr,
                                    nosbb.no_fee.On_Us.nosbb_cr,
                                    nosbb.no_pokok.On_Us.nmsbb_cr,
                                    nosbb.no_fee.On_Us.nmsbb_cr,
                                    detail_trans
                                )
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET tariktunai = tariktunai - ? - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                    }
                                );
                                if (!metadata) {
                                    console.log({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                    res.status(200).send({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                } else {
                                    request.data['terminal_id'] = terminal_id
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    res.status(200).send({
                                        code: "000",
                                        status: "ok",
                                        message: "Success",
                                        data: request.data,
                                    });
                                }
                            } else if (keterangan === "issuer") {
                                await update_gl_oy_debet(
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    nosbb.tagihan.nosbb_cr,
                                    nosbb.tagihan.nosbb_cr,
                                    nosbb.tagihan.nmsbb_cr,
                                    nosbb.tagihan.nmsbb_cr,
                                    detail_trans
                                )
                                request.data['terminal_id'] = terminal_id
                                //--berhasil dapat list product update atau insert ke db --//
                                console.log("Success");
                                res.status(200).send({
                                    code: "000",
                                    status: "ok",
                                    message: "Success",
                                    data: request,
                                });
                            } else if (keterangan === "acquirer") {
                                data_cr = {
                                    amount,
                                    trans_fee,
                                    bpr_id: acq_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.no_pokok.Acquirer.nosbb_db,
                                    no_rek_fee: nosbb.no_fee.Acquirer.nosbb_db,
                                    nama_rek_pokok: nosbb.no_pokok.Acquirer.nmsbb_db,
                                    nama_rek_fee: nosbb.no_fee.Acquirer.nmsbb_db
                                }
                                data_db = {
                                    amount,
                                    trans_fee,
                                    bpr_id: acq_id,
                                    trx_code,
                                    no_rek_pokok: nosbb.no_pokok.Acquirer.nosbb_cr,
                                    no_rek_fee: nosbb.no_fee.Acquirer.nosbb_cr,
                                    nama_rek_pokok: nosbb.no_pokok.Acquirer.nmsbb_cr,
                                    nama_rek_fee: nosbb.no_fee.Acquirer.nmsbb_cr
                                }
                                await update_gl_oy_db_cr(data_db, data_cr, detail_trans)
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET tariktunai = tariktunai - ? - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                    }
                                );
                                if (!metadata) {
                                    console.log({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                    res.status(200).send({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                } else {
                                    request.data['terminal_id'] = terminal_id
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    res.status(200).send({
                                        code: "000",
                                        status: "ok",
                                        message: "Success",
                                        data: request.data,
                                    });
                                }
                            }
                        }
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
            message: "INVALID DATA!!!",
            data: error,
        })
    }
};

// API untuk PPOB
const ppob = async (req, res) => {
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
        let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
            `INSERT INTO log_core(no_hp,bpr_id,no_rek,amount,trans_fee,trx_code,trx_type,tgl_trans,tgl_transmis,keterangan,rrn) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            {
                replacements: [
                    no_hp, bpr_id, no_rek, amount, trans_fee, trx_code, trx_type, tgl_trans, moment().format('YYMMDDHHmmss'), product_name, rrn,
                ],
            }
        );
        let acct = await db.sequelize.query(
            `SELECT * FROM cms_acct_ebpr WHERE bpr_id = ? AND no_hp = ? AND no_rek = ? AND status != '6'`,
            {
                replacements: [bpr_id, no_hp, no_rek],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!acct.length) {
            res.status(200).send({
                code: "003",
                status: "Failed",
                message: "Gagal, Akun Belum Terdaftar",
                data: null,
            });
        } else {
            if (acct[0].status == "1") {
                let get_nosbb = await db.sequelize.query(
                    `SELECT * FROM gl_trans WHERE tcode = ? AND bpr_id = ?`,
                    {
                        replacements: [trx_code, bpr_id],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );
                if (!get_nosbb.length) {
                    res.status(200).send({
                        code: "004",
                        status: "Failed",
                        message: "Gagal, Terjadi Kesalahan Pencarian Ledger!!!",
                        data: null,
                    });
                } else {
                    if (trx_type === "TRX") {
                        let status_core = await db.sequelize.query(
                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                            {
                                replacements: [bpr_id],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (status_core.status == "0") {
                            res.status(200).send({
                                code: "099",
                                status: "Failed",
                                message: "Gagal, Core SIGN OFF!!!",
                                data: null,
                            });
                        } else {
                            const nosbb = await split_sbb(get_nosbb, trx_code)
                            const data_core = {
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
                                rrn,
                                data: {
                                    gl_rek_db_1: no_rek,
                                    gl_jns_db_1: "2",
                                    gl_amount_db_1: amount,
                                    gl_rek_db_2: no_rek,
                                    gl_jns_db_2: "2",
                                    gl_amount_db_2: trans_fee,
                                    gl_rek_cr_1: nosbb.no_pokok.nosbb_cr,
                                    gl_jns_cr_1: nosbb.no_pokok.jns_sbb_cr,
                                    gl_amount_cr_1: amount,
                                    gl_rek_cr_2: nosbb.no_fee.nosbb_cr,
                                    gl_jns_cr_2: nosbb.no_fee.jns_sbb_cr,
                                    gl_amount_cr_2: trans_fee,
                                }
                            }
                            const request = await connect_axios(url, "ppob", data_core)
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                {
                                    replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                }
                            );
                            if (request.code !== "000") {
                                console.log(request);
                                // if (bpr_id === "600998") {
                                //     console.log("GW PPOB Timeout");
                                // } else {
                                    res.status(200).send(request);
                                // }
                            } else {
                                const detail_trans = {
                                    no_rek,
                                    nama_rek: acct[0].nama_rek,
                                    no_hp,
                                    keterangan: product_name,
                                    tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                    trx_type,
                                    status: "1",
                                    tcode: "000",
                                    noreff: request.data.noreff,
                                    rrn
                                }
                                await update_gl_oy_kredit(
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    nosbb.no_pokok.nosbb_cr,
                                    nosbb.no_fee.nosbb_cr,
                                    nosbb.no_pokok.nmsbb_cr,
                                    nosbb.no_fee.nmsbb_cr,
                                    detail_trans
                                )
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET ppob = ppob + ? + ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                    }
                                );
                                if (!metadata) {
                                    res.status(200).send({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                } else {
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    if (bpr_id === "600998") {
                                        console.log("GW PPOB Timeout");
                                    } else {
                                        res.status(200).send({
                                            code: "000",
                                            status: "ok",
                                            message: "Success",
                                            data: request.data,
                                        });   
                                    }
                                }
                            }
                        }
                    } else if (trx_type === "REV") {
                        let status_core = await db.sequelize.query(
                            `SELECT * FROM status_core WHERE bpr_id = ?`,
                            {
                                replacements: [bpr_id],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        const nosbb = await split_sbb(get_nosbb, trx_code)
                        const data_core = {
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
                            rrn,
                            data: {
                                gl_rek_db_1: nosbb.no_pokok.nosbb_cr,
                                gl_jns_db_1: nosbb.no_pokok.jns_sbb_cr,
                                gl_amount_db_1: amount,
                                gl_rek_db_2: nosbb.no_fee.nosbb_cr,
                                gl_jns_db_2: nosbb.no_fee.jns_sbb_cr,
                                gl_amount_db_2: trans_fee,
                                gl_rek_cr_1: no_rek,
                                gl_jns_cr_1: "2",
                                gl_amount_cr_1: amount,
                                gl_rek_cr_2: no_rek,
                                gl_jns_cr_2: "2",
                                gl_amount_cr_2: trans_fee,
                            }
                        }
                        if (status_core.status == "0") {
                            let [res_log_pokok, meta_log_pokok] = await db.sequelize.query(
                                `INSERT INTO hold_transaction (data) VALUES (?)`,
                                {
                                    replacements: [
                                        JSON.stringify(data_core),
                                    ],
                                }
                            );
                            console.log("Success");
                            res.status(200).send({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                data: req.body,
                            });
                        } else {
                            const request = await connect_axios(url, "ppob", data_core)
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE log_core SET rcode = ?, messages = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND amount = ? AND trans_fee = ? AND tgl_trans = ? AND rrn = ?`,
                                {
                                    replacements: [request.code, request.message, no_rek, no_hp, bpr_id, amount, trans_fee, tgl_trans, rrn],
                                }
                            );
                            console.log(request);
                            if (request.code !== "000") {
                                console.log(request);
                                res.status(200).send(request);
                            } else {
                                const detail_trans = {
                                    no_rek,
                                    nama_rek: acct[0].nama_rek,
                                    no_hp,
                                    keterangan: product_name,
                                    tgl_trans: moment().format('YYYY-MM-DD HH:mm:ss'),
                                    trx_type,
                                    status: "R",
                                    tcode: "000",
                                    noreff: request.data.noreff,
                                    rrn
                                }
                                await update_gl_oy_debet(
                                    amount,
                                    trans_fee,
                                    bpr_id,
                                    trx_code,
                                    nosbb.no_pokok.nosbb_cr,
                                    nosbb.no_fee.nosbb_cr,
                                    nosbb.no_pokok.nmsbb_cr,
                                    nosbb.no_fee.nmsbb_cr,
                                    detail_trans
                                )
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET ppob = ppob - ? - ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [amount, trans_fee, no_rek, no_hp, bpr_id],
                                    }
                                );
                                if (!metadata) {
                                    res.status(200).send({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Update Counter Transaksi!!!",
                                        data: null,
                                    });
                                } else {
                                    // let response = {
                                    //     no_hp,
                                    //     bpr_id,
                                    //     no_rek,
                                    //     nama_rek: check_saldo[0].nama_rek,
                                    //     product_name,
                                    //     amount,
                                    //     trans_fee,
                                    //     trx_code,
                                    //     trx_type,
                                    //     reff: check_transaksi[0].reff,
                                    //     token: token_mpin,
                                    //     reference_number: check_transaksi[0].reference_number,
                                    //     tgl_trans: check_transaksi[0].tgl_trans,
                                    //     tgl_transmis : moment().format('YYMMDDHHmmss'),
                                    //     rrn
                                    // }
                                    //--berhasil dapat list product update atau insert ke db --//
                                    console.log("Success");
                                    res.status(200).send({
                                        code: "000",
                                        status: "ok",
                                        message: "Success",
                                        data: request.data,
                                    });
                                }
                            }
                        }
                    }
                }
            } else {
                res.status(200).send({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                    data: null,
                })
            }
        }
    } catch (error) {
        //--error server--//
        console.log("error inquiry", error);
        res.status(200).send({
            code: "099",
            status: "error",
            message: error.message,
            data: null,
        });
    }
};

//API untuk validasi mpin
const mpin = async (req, res) => {
    let { no_rek, no_hp, bpr_id, pin, amount, trans_fee, tgl_trans, trx_code, rrn } = req.body;
    try {
        console.log("REQ BODY MPIN");
        console.log(req.body);
        pin = `${((parseInt(pin) + 111111 - 999999) / 2)}`
        pin = `${pin}${no_hp.substring(no_hp.length - 4, no_hp.length)}`
        let mpin = encryptStringWithRsaPublicKey(pin, "./utility/privateKey.pem");

        let counter = await db.sequelize.query(
            `SELECT * FROM cms_acct_ebpr WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
            {
                replacements: [no_rek, no_hp, bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!counter.length) {
            res.status(200).send({
                code: "004",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Pencarian Rekening!!!",
                rrn: rrn,
                data: null,
            });
        } else {
            let mpin_salah = parseInt(counter[0].mpin_salah)

            if (mpin_salah != 3 && counter[0].status == 1) {
                const data_core = {
                    // no_hp:rekening[0].no_hp,
                    bpr_id,
                    no_rek,
                    gl_jns: "2",
                    trx_code: "0200",
                    trx_type: "TRX",
                    tgl_trans,
                    rrn,
                }
                const check_rek = await connect_axios(url, "Inquiry", data_core)
                if (check_rek.code !== "000") {
                    console.log(check_rek);
                    res.status(200).send(check_rek);
                } else {
                    console.log(check_rek.data);
                    if (check_rek.data.status_rek == "AKTIF") {
                        let Auth = await db.sequelize.query(
                            `SELECT * FROM cms_acct_ebpr WHERE mpin = ? AND no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                            {
                                replacements: [mpin, no_rek, no_hp, bpr_id],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (!Auth.length) {
                            mpin_salah = mpin_salah + 1
                            if (mpin_salah == 3) {
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET mpin_salah = ?, status = '2' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [mpin_salah, no_rek, no_hp, bpr_id]
                                    }
                                );
                                res.status(200).send({
                                    code: "007",
                                    status: "Failed",
                                    message: "Gagal, mPIN Terblokir!!!",
                                    data: null,
                                });
                            } else {
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE cms_acct_ebpr SET mpin_salah = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                    {
                                        replacements: [mpin_salah, no_rek, no_hp, bpr_id]
                                    }
                                );
                                res.status(200).send({
                                    code: "006",
                                    status: "Failed",
                                    message: "Gagal, Terjadi Kesalahan Validasi mPIN!!!",
                                    data: null,
                                });
                            }
                        } else {
                            mpin_salah = 0
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE cms_acct_ebpr SET mpin_salah = ?, status = '1' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ?`,
                                {
                                    replacements: [mpin_salah, no_rek, no_hp, bpr_id]
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
                                let check_limit = await db.sequelize.query(
                                    `SELECT * FROM cms_accttype WHERE acct_type = ?`,
                                    {
                                        replacements: [Auth[0].acct_type],
                                        type: db.sequelize.QueryTypes.SELECT,
                                    }
                                );
                                if (!check_limit.length) {
                                    res.status(200).send({
                                        code: "001",
                                        status: "Failed",
                                        message: "Gagal, Terjadi Kesalahan Pencarian Tipe Kartu!!!",
                                        data: null,
                                    });
                                } else {
                                    let limit_trx, limit_harian, counter_transaksi
                                    // let trx_amount, trx_trans_fee = 0
                                    if (trx_code == "1000") {
                                        limit_trx = parseInt(check_limit[0].trk_tunai_trx)
                                        limit_harian = parseInt(check_limit[0].trk_tunai_harian)
                                        counter_transaksi = parseInt(Auth[0].tariktunai)
                                    } else if (trx_code == "5000") {
                                        limit_trx = parseInt(check_limit[0].ppob_trx)
                                        limit_harian = parseInt(check_limit[0].ppob_harian)
                                        counter_transaksi = parseInt(Auth[0].ppob)
                                    } else {
                                        limit_trx = parseInt(check_limit[0].trf_trx)
                                        limit_harian = parseInt(check_limit[0].trf_harian)
                                        counter_transaksi = parseInt(Auth[0].transfer)
                                    }
                                    if (amount == undefined) amount = 0
                                    if (trans_fee == undefined) trans_fee = 0
                                    const total = parseInt(trans_fee) + parseInt(amount)
                                    if (total <= limit_trx) {
                                        if (counter_transaksi + total <= limit_harian) {
                                            let token_mpin = generateString(20);
                                            res.status(200).send({
                                                code: "000",
                                                status: "Success",
                                                message: "Transaksi anda berhasil diproses",
                                                data: {
                                                    no_hp,
                                                    bpr_id,
                                                    no_rek,
                                                    nama_rek: Auth[0].nama_rek,
                                                    token_mpin,
                                                    tgl_trans
                                                },
                                            });
                                        } else {
                                            res.status(200).send({
                                                code: "009",
                                                status: "Failed",
                                                message: "Gagal, Transaksi Sudah Melebihi Limit Harian!!!",
                                                data: null,
                                            });
                                        }
                                    } else {
                                        res.status(200).send({
                                            code: "009",
                                            status: "Failed",
                                            message: "Gagal, Nominal Melebihi Limit Transaksi!!!",
                                            data: null,
                                        });
                                    }
                                }
                            }
                        }
                    } else {
                        res.status(200).send({
                            code: "008",
                            status: "Failed",
                            message: check_rek.data.status_rek,
                            rrn: rrn,
                            data: null,
                        });
                    }
                }
            } else if (mpin_salah == 3 && counter[0].status == 2) {
                res.status(200).send({
                    code: "007",
                    status: "Failed",
                    message: "Gagal, mPIN Terblokir!!!",
                    data: null,
                });
            } else if (mpin_salah !== 3 && counter[0].status == 2) {
                res.status(200).send({
                    code: "007",
                    status: "Failed",
                    message: "Gagal, Akun Anda Telah diBlokir!!!",
                    data: null,
                });
            } else {
                res.status(200).send({
                    code: "003",
                    status: "Failed",
                    message: "Gagal, Akun Tidak Dapat Digunakan!!!",
                    data: null,
                });
            }
        }
    } catch (error) {
        //--error server--//
        console.log("erro get product", error);
        res.status(200).send({
            code: "099",
            status: "Failed",
            message: "INVALID DATA!!!",
            data: error,
        })
    }
};

//API untuk Sign In Sign Off
const sign_in_off = async (req, res) => {
    let { bpr_id, status, tgl_trans } = req.body;
    try {
        if (status == "1") {
            let [results, metadata] = await db.sequelize.query(
                `UPDATE status_core SET status = ?, tgl_sign_in = ? WHERE bpr_id = ?`,
                {
                    replacements: [status, tgl_trans, bpr_id],
                }
            );
            if (!metadata) {
                console.log({
                    code: "001",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Update Status Core!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "001",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Update Status Core!!!",
                    data: null,
                });
            } else {
                console.log({
                    code: "000",
                    status: "Success",
                    message: "Success!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "000",
                    status: "Success",
                    message: "Success!!!",
                    data: null,
                });
            }
        } else if (status == "0") {
            let [results, metadata] = await db.sequelize.query(
                `UPDATE status_core SET status = ?, tgl_sign_off = ? WHERE bpr_id = ?`,
                {
                    replacements: [status, tgl_trans, bpr_id],
                }
            );
            if (!metadata) {
                console.log({
                    code: "001",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Update Status Core!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "001",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Update Status Core!!!",
                    data: null,
                });
            } else {
                console.log({
                    code: "000",
                    status: "Success",
                    message: "Success!!!",
                    data: null,
                });
                res.status(200).send({
                    code: "000",
                    status: "Success",
                    message: "Success!!!",
                    data: null,
                });
            }
        }

    } catch (error) {
        //--error server--//
        console.log("erro get product", error);
        res.send(error);
    }
}

module.exports = {
    inquiry_account,
    sign_in_off,
    transfer,
    withdrawal,
    ppob,
    mpin
};
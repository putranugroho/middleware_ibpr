const axios = require("axios").default;
const {
    error_response,
    send_log,
} = require("../response");
const db = require("../../connection");
const db1 = require("../../connection/ibprdev");
const moment = require("moment");
var https = require('https');
moment.locale("id");
const hmacSHA256 = require('crypto-js/hmac-sha256');
const Base64 = require("crypto-js/enc-base64");
const {
    update_gl_oy_db_cr,
    update_gl_oy_debet,
    update_gl_oy_kredit,
    split_sbb
} = require("../../utility/ledger");

const api_crm = "https://integration-dev.oyindonesia.com/"

// Generate random ref number
function generateString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
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
            if (error.code == 'ECONNABORTED') {
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

        case "R":
            withdrawal_status = "REVERSE"
            withdrawal_status_notes = "Withdrawal has been Reversed"
            break;

        default:
            withdrawal_status = "SUCCESS",
                withdrawal_status_notes = "Withdrawal success and has been completed"
            break;
    }

    return { withdrawal_status, withdrawal_status_notes }
}

const formatRibuan = (angka) => {
    var number_string = angka.toString().replace(/[^,\d]/g, ''),
        split = number_string.split(','),
        sisa = split[0].length % 3,
        angka_hasil = split[0].substr(0, sisa),
        ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    // tambahkan titik jika yang di input sudah menjadi angka ribuan
    if (ribuan) {
        separator = sisa ? '.' : '';
        angka_hasil += separator + ribuan.join('.');
    }

    angka_hasil = split[1] != undefined ? angka_hasil + ',' + split[1] : angka_hasil;
    return angka_hasil;
}

// API untuk Request Transaction
const request_withdrawal = async (req, res) => {
    let {
        no_hp,
        bpr_id,
        no_rek,
        amount,
        trans_fee,
        token_mpin,
        trx_code,
        trx_type,
        tgl_trans,
        tgl_transmis,
        rrn } = req.body;
    try {
        console.log("REQ BODY REQUEST");
        console.log(req.body);
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?`,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
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
                        "Tarik Tunai",
                        "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
                        "",
                        amount,
                        trans_fee,
                        tgl_trans,
                        "",
                        rrn,
                        "002"
                    ],
                }
            );
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
                    if (trx_type === "TRX") {
                        const keterangan = `TOKEN ${amount} ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                        const data = { no_hp, bpr_id, no_rek, amount, trans_fee, trx_code, trx_type, keterangan, acq_id: "", terminal_id: "", token: "", lokasi: "", tgl_trans, tgl_transmis, rrn }
                        const request = await connect_axios(bpr[0].gateway, "gateway_bpr/withdrawal", data)
                        if (request.code !== "000") {
                            console.log("request");
                            console.log(request);
                            let [results, metadata] = await db.sequelize.query(
                                `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                                {
                                    replacements: [
                                        no_hp,
                                        bpr_id,
                                        no_rek,
                                        "",
                                        trx_code,
                                        "Token",
                                        keterangan,
                                        "",
                                        amount,
                                        trans_fee,
                                        tgl_trans,
                                        "",
                                        rrn,
                                        request.code,
                                        request.message,
                                    ],
                                }
                            );
                            // if (bpr_id === "600998") {
                            //     console.log("MDW Token Timeout");
                            // } else {
                            res.status(200).send(request);
                            // }
                        } else {
                            console.log("request.data");
                            console.log(request.data);
                            let [results, metadata] = await db.sequelize.query(
                                `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
                                {
                                    replacements: [
                                        no_hp,
                                        bpr_id,
                                        no_rek,
                                        request.data.nama,
                                        trx_code,
                                        "Token",
                                        keterangan,
                                        request.data.noreff,
                                        amount,
                                        trans_fee,
                                        tgl_trans,
                                        "",
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
                            // if (bpr_id === "600998") {
                            //     console.log("MDW Token Timeout");
                            // } else {
                            res.status(200).send({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                rrn: rrn,
                                data: request.data,
                            });
                            // }
                        }
                    } else if (trx_type === "REV") {
                        const keterangan = `Token ${amount} ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                        const data = { no_hp, bpr_id, no_rek, amount, trans_fee, trx_code, trx_type, keterangan, acq_id: "", terminal_id: "", token: "", lokasi: "", tgl_trans, tgl_transmis, rrn }
                        const request = await connect_axios(bpr[0].gateway, "gateway_bpr/withdrawal", data)
                        if (request.code !== "000") {
                            console.log("request");
                            console.log(request);
                            let [results, metadata] = await db.sequelize.query(
                                `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                                {
                                    replacements: [
                                        no_hp,
                                        bpr_id,
                                        no_rek,
                                        "",
                                        trx_code,
                                        "Token",
                                        keterangan,
                                        "",
                                        amount,
                                        trans_fee,
                                        tgl_trans,
                                        "",
                                        rrn,
                                        request.code,
                                        request.message,
                                    ],
                                }
                            );
                            res.status(200).send(request);
                        } else {
                            console.log("request.data");
                            console.log(request.data);
                            let [results2, metadata2] = await db.sequelize.query(
                                `UPDATE dummy_transaksi SET status_rek = 'R' WHERE no_hp = ? AND bpr_id = ? AND no_rek = ? AND tcode = ? AND amount = ? AND rrn = ? AND status_rek = '1'`,
                                {
                                    replacements: [
                                        no_hp,
                                        bpr_id,
                                        no_rek,
                                        "1000",
                                        amount,
                                        rrn
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

// API untuk Release Transaction
const release_withdrawal = async (req, res) => {
    let data = req.body;
    try {
        console.log("REQ BODY RELEASE");
        console.log(data);

        let no_hp = data.NOKARTU.substring(6, data.NOKARTU.length)
        let bpr_id = data.NOKARTU.substring(0, 6)
        let jumlah_tx = data.JUMLAHTX
        let trx_code = "1100"
        let trx_type = data.JENISTX
        let terminal_id = data.TERMINALID
        let token = data.OTP
        let tgl_trans = data.WAKTU
        let tgl_transmis = moment().format('YYMMDDHHmmss')
        let rrn = data.TID.substring(data.TID.length - 6, data.TID.length)
        let response = {}

        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ? AND status ='1'`,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!bpr.length) {
            // console.log({
            //     code: "002",
            //     status: "Failed",
            //     message: "Gagal, Terjadi Kesalahan Pencarian BPR!!!",
            //     rrn: rrn,
            //     data: null,
            // });
            response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "Gagal, BPR Tidak Terdaftar!!!", null, null, null, null, null, null, null, null, null, null, null, null, null, "14", "GAGAL INQUIRY TARIK TUNAI")
            // await send_log(data,response)
            console.log(response);
            res.status(200).send(
                response,
            );
        } else {
            let get_atm = await db.sequelize.query(
                `SELECT * FROM kd_atm AS atm INNER JOIN kd_bpr AS bpr ON atm.bpr_id = bpr.bpr_id WHERE atm.atm_id LIKE ? AND bpr.status ='1'`,
                {
                    replacements: [`%${terminal_id}`],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!get_atm.length) {
                // console.log({
                //     code: "002",
                //     status: "Failed",
                //     message: ,
                //     rrn: rrn,
                //     data: null,
                // });
                response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "Gagal, ATM Tidak Terdaftar!!!", null, null, null, null, null, null, null, null, null, null, null, null, null, "14", "GAGAL INQUIRY TARIK TUNAI")
                // await send_log(data,response)
                console.log(response);
                res.status(200).send(
                    response,
                );
            } else {
                let keterangan
                if (bpr_id === get_atm[0].bpr_id) {
                    keterangan = "on_us"
                } else if (bpr_id !== get_atm[0].bpr_id) {
                    keterangan = "issuer"
                }
                let check_bpr = await db.sequelize.query(
                    `SELECT bpr_id, nama_bpr FROM kd_bpr WHERE bpr_id = ?`,
                    {
                        replacements: [bpr_id],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );
                if (!check_bpr.length) {
                    response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "KODE BPR ATAU NO HANDPHONE SALAH", null, null, null, null, null, null, null, null, null, null, null, null, null, "14", "Kartu Tidak Ditemukan")
                    await send_log(data, response)
                    console.log(response);
                    res.status(200).send(
                        response,
                    );
                } else {
                    let kartu = await db1.sequelize.query(
                        `SELECT * FROM acct_ebpr WHERE no_hp = ? AND bpr_id = ?`,
                        {
                            replacements: [
                                no_hp,
                                bpr_id
                            ],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (!kartu.length) {
                        response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "KODE BPR ATAU NO HANDPHONE SALAH", null, null, null, null, null, null, null, null, null, null, null, null, null, "14", "Kartu Tidak Ditemukan")
                        await send_log(data, response)
                        console.log(response);
                        res.status(200).send(
                            response,
                        );
                    } else {
                        if (data.KODETRX.substring(0, 2) == "01") {
                            const data_nasabah = { no_rek: "", no_hp, bpr_id, trx_code: "0500", status: "", tgl_trans, tgl_transmis: moment().format('YYMMDDHHmmss'), rrn }
                            console.log("data_nasabah");
                            console.log(data_nasabah);
                            const nasabah = await connect_axios(bpr[0].gateway, "gateway_bpr/inquiry_account", data_nasabah)
                            console.log("Inquiry account");
                            console.log(nasabah);
                            if (nasabah.code !== "000") {
                                response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", nasabah.message, null, null, null, null, null, null, null, null, null, null, null, null, null, "99", "INVALID TRANSACTION")
                                await send_log(data, response)
                                console.log(response);
                                res.status(200).send(
                                    response,
                                );
                            } else {
                                let cek_hold_dana = await db1.sequelize.query(
                                    `SELECT * FROM dummy_hold_dana WHERE token = ? AND no_rek = ?`,
                                    {
                                        replacements: [
                                            data.OTP,
                                            nasabah.data.no_rek
                                        ],
                                        type: db1.sequelize.QueryTypes.SELECT,
                                    }
                                );
                                if (!cek_hold_dana.length) {
                                    response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "TRANSAKSI TIDAK DITEMUKAN", null, null, null, null, null, null, null, null, null, null, null, null, null, "14", "Kartu Tidak Ditemukan")
                                    await send_log(data, response)
                                    console.log(response);
                                    res.status(200).send(
                                        response,
                                    );
                                } else {
                                    if (data.JENISTX == "TRX") {
                                        let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                        let nilai = formatRibuan(cek_hold_dana[0].amount)
                                        let amount = cek_hold_dana[0].amount
                                        nominal = nominal.substring(nominal.length - 12, nominal.length)
                                        const data_request = { no_hp, bpr_id: bpr_id, no_rek: nasabah.data.no_rek, nama_rek: nasabah.data.nama_rek, amount, trans_fee: cek_hold_dana[0].admin_fee, trx_code: "1100", trx_type, keterangan: "on_us", terminal_id, lokasi: get_atm[0].lokasi, token, acq_id: get_atm[0].bpr_id, tgl_trans, rrn }
                                        console.log("data_request Transaksi");
                                        console.log(data_request);
                                        request = await connect_axios(bpr[0].gateway, "gateway_bpr/withdrawal", data_request)
                                        console.log("request tartun");
                                        console.log(request);
                                        if (request.code !== "000") {
                                            response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", request.message, null, null, null, null, null, null, null, null, null, null, null, null, null, "99", "INVALID TRANSACTION")
                                            await send_log(data, response)
                                            console.log(response);
                                            res.status(200).send(
                                                response,
                                            );
                                        } else {
                                            const data_token = {
                                                keterangan,
                                                token: "715f8ab555438f985b579844ea227767",
                                                no_hp: no_hp,
                                                no_rek: nasabah.data.no_rek,
                                                bpr_id: bpr_id,
                                                amount: amount,
                                                trans_fee: cek_hold_dana[0].admin_fee,
                                                tgl_trans,
                                                reff: cek_hold_dana[0].reff
                                              }
                                            console.log("data token");
                                            console.log(data_token);
                                            let status_token = await connect_axios("https://core.metimes.id/", "completed-token", data_token)
                                            console.log("status token");
                                            console.log(status_token);
                                            let [results, metadata] = await db1.sequelize.query(
                                                `UPDATE token SET status = '1' WHERE no_rek = ? AND token = ? AND rrn = ? AND status = '0'`,
                                                {
                                                    replacements: [
                                                        cek_hold_dana[0].no_rek,
                                                        cek_hold_dana[0].token,
                                                        cek_hold_dana[0].rrn
                                                    ],
                                                }
                                            );
                                            if (!metadata) {
                                                response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "TOKEN TIDAK DITEMUKAN", null, null, null, null, null, null, null, null, null, null, null, null, null, "81", "Token Tidak Ditemukan")
                                                await send_log(data, response)
                                                console.log(response);
                                                res.status(200).send(
                                                    response,
                                                );
                                            } else {
                                                let [results, metadata] = await db1.sequelize.query(
                                                    `UPDATE dummy_hold_dana SET status = '1' WHERE no_rek = ? AND token = ? AND rrn = ? AND status = '0'`,
                                                    {
                                                        replacements: [
                                                            cek_hold_dana[0].no_rek,
                                                            cek_hold_dana[0].token,
                                                            cek_hold_dana[0].rrn
                                                        ],
                                                    }
                                                );
                                                let [results2, metadata2] = await db1.sequelize.query(
                                                    `UPDATE dummy_transaksi SET status_rek = '1' WHERE reff = ? AND no_rek = ? AND amount = ? AND rrn = ? AND status_rek = '0'`,
                                                    {
                                                        replacements: [
                                                            cek_hold_dana[0].reff,
                                                            cek_hold_dana[0].no_rek,
                                                            amount,
                                                            cek_hold_dana[0].rrn
                                                        ],
                                                    }
                                                );
                                                // response = await error_response(data,response,nominal,get_atm[0].nama_bpr,get_atm[0].nama_atm,moment().format('DD-MM-YYYY HH:mm:ss'),"PENARIKAN TUNAI",`NOMER RESI :${data.TID}`,`NILAI = Rp. ${nilai}`,"00","Transaksi Berhasil")
                                                response = await error_response(
                                                    data,
                                                    response,
                                                    nominal,
                                                    "ATM iBPR KEEPING",
                                                    bpr[0].nama_bpr,
                                                    get_atm[0].atm_id,
                                                    moment().format('DD-MM-YYYY HH:mm:ss'),
                                                    "",
                                                    `TRACE ${data.TID}`,
                                                    "",
                                                    "TARIK TUNAI TANPA KARTU",
                                                    "",
                                                    `NAMA ${nasabah.data.nama_rek}`,
                                                    `NOMER HP ${no_hp.substring(9, no_hp.length)}`,
                                                    `NILAI Rp. ${nilai}`,
                                                    `TOKEN ${data.OTP}`,
                                                    "",
                                                    "TERIMA KASIH",
                                                    "00",
                                                    "Transaksi Berhasil"
                                                )
                                                await send_log(data, response)
                                                console.log(response);
                                                res.status(200).send(
                                                    response
                                                );
                                            }
                                        }
                                    } else if (data.JENISTX == "REV") {
                                        let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                        let nilai = formatRibuan(cek_hold_dana[0].amount)
                                        let amount = cek_hold_dana[0].amount
                                        nominal = nominal.substring(nominal.length - 12, nominal.length)
                                        const data_request = { no_hp, bpr_id, no_rek: nasabah.data.no_rek, nama_rek: nasabah.data.nama_rek, amount, trans_fee: 0, trx_code: "1100", trx_type, keterangan: "on_us", terminal_id, lokasi: get_atm[0].lokasi, token, acq_id: get_atm[0].bpr_id, tgl_trans, rrn }
                                        console.log("data_request Reversal");
                                        console.log(data_request);
                                        request = await connect_axios(bpr[0].gateway, "gateway_bpr/withdrawal", data_request)
                                        console.log("request");
                                        console.log(request);
                                        if (request.code !== "000") {
                                            response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", request.message, null, null, null, null, null, null, null, null, null, null, null, null, null, "99", "INVALID TRANSACTION")
                                            await send_log(data, response)
                                            console.log(response);
                                            res.status(200).send(
                                                response,
                                            );
                                        } else {
                                            const keterangan = `Reversal Token ${amount} ${moment().format(
                                            "YYYY-MM-DD HH:mm:ss"
                                            )}`;

                                            const data = {
                                            no_hp,
                                            bpr_id,
                                            no_rek: nasabah.data.no_rek,
                                            amount,
                                            trans_fee: 0,
                                            trx_code: "1000",
                                            trx_type,
                                            keterangan,
                                            acq_id: "",
                                            terminal_id: "",
                                            token: "",
                                            lokasi: "",
                                            tgl_trans: cek_hold_dana[0].tgl_trans,
                                            tgl_transmis: cek_hold_dana[0].tgl_trans,
                                            rrn: cek_hold_dana[0].rrn,
                                            };

                                            const request = await connect_axios(
                                            bpr[0].gateway,
                                            "gateway_bpr/withdrawal",
                                            data
                                            );

                                            if (request.code !== "000") {
                                                console.log("request");
                                                console.log(request);
                                                res.status(200).send(request);
                                            } else {
                                                console.log("request.data");
                                                console.log(request.data);
                                                let [results2, metadata2] = await db.sequelize.query(
                                                    `UPDATE dummy_transaksi SET status_rek = 'R' WHERE bpr_id= ? AND no_rek = ? AND tcode = ? AND amount = ? AND rrn = ? AND status_rek = '1'`,
                                                    {
                                                    replacements: [
                                                        bpr_id,
                                                        nasabah.data.no_rek,
                                                        "1000",
                                                        amount,
                                                        cek_hold_dana[0].rrn,
                                                    ],
                                                    }
                                                );
                                                let [results, metadata] = await db1.sequelize.query(
                                                    `UPDATE token SET status = 'R' WHERE no_rek = ? AND token = ? AND rrn = ? AND status = '1'`,
                                                    {
                                                        replacements: [
                                                            cek_hold_dana[0].no_rek,
                                                            cek_hold_dana[0].token,
                                                            cek_hold_dana[0].rrn
                                                        ],
                                                    }
                                                );
                                                if (!metadata) {
                                                    response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", "TOKEN TIDAK DITEMUKAN", null, null, null, null, null, null, null, null, null, null, null, null, null, "81", "Token Tidak Ditemukan")
                                                    await send_log(data, response)
                                                    console.log(response);
                                                    res.status(200).send(
                                                        response,
                                                    );
                                                } else {
                                                    let [results, metadata] = await db1.sequelize.query(
                                                        `UPDATE dummy_hold_dana SET status = 'R' WHERE no_rek = ? AND token = ? AND rrn = ? AND status = '1'`,
                                                        {
                                                            replacements: [
                                                                cek_hold_dana[0].no_rek,
                                                                cek_hold_dana[0].token,
                                                                cek_hold_dana[0].rrn
                                                            ],
                                                        }
                                                    );
                                                    let [results2, metadata2] = await db1.sequelize.query(
                                                        `UPDATE dummy_transaksi SET status_rek = 'R' WHERE reff = ? AND no_rek = ? AND amount = ? AND rrn = ? AND status_rek = '1'`,
                                                        {
                                                            replacements: [
                                                                cek_hold_dana[0].reff,
                                                                cek_hold_dana[0].no_rek,
                                                                amount,
                                                                cek_hold_dana[0].rrn
                                                            ],
                                                        }
                                                    );
                                                    response["jumlahtx"] = nominal.substring(nominal.length - 12, nominal.length)
                                                    response["kodetrx"] = data.KODETRX
                                                    response["nokartu"] = data.NOKARTU
                                                    response["tid"] = data.TID
                                                    response["text1"] = null
                                                    response["text2"] = `NAMA ${nasabah.data.nama_rek}`
                                                    response["text3"] = `NILAI Rp. ${nilai}`
                                                    response["text4"] = null
                                                    response["text5"] = null
                                                    response["text6"] = null
                                                    response["text7"] = null
                                                    response["text8"] = null
                                                    response["text9"] = null
                                                    response["text10"] = null
                                                    response["text11"] = null
                                                    response["text12"] = null
                                                    response["text13"] = null
                                                    response["text14"] = null
                                                    response["text15"] = null
                                                    response["text16"] = null
                                                    response["text17"] = null
                                                    response["text18"] = null
                                                    response["text19"] = null
                                                    response["text20"] = null
                                                    response['rcode'] = "00"
                                                    response['message'] = "REVERSAL SUKSES"
                                                    //--berhasil dapat list product update atau insert ke db --//
                                                    await send_log(data, response)
                                                    console.log(response);
                                                    res.status(200).send(
                                                        response
                                                    );
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else if (data.KODETRX.substring(0, 2) == "88") {
                            let cek_hold_dana = await db1.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE token = ?`,
                                {
                                    replacements: [
                                        data.OTP
                                    ],
                                    type: db1.sequelize.QueryTypes.SELECT,
                                }
                            );
                            if (cek_hold_dana[0].status == 2) {
                                response = await error_response(data, response, "", "TOKEN TELAH EXPIRED", "TOKEN TELAH EXPIRED", null, null, null, null, null, null, null, null, null, null, null, null, null, "81", "TOKEN TELAH EXPIRED")
                                await send_log(data, response)
                                console.log(response);
                                res.status(200).send(
                                    response,
                                );
                            } else if (cek_hold_dana[0].status == 1) {
                                response = await error_response(data, response, "", "TOKEN TELAH DIGUNAKAN", "TOKEN TELAH DIGUNAKAN", null, null, null, null, null, null, null, null, null, null, null, null, null, "81", "TOKEN TELAH DIGUNAKAN")
                                await send_log(data, response)
                                console.log(response);
                                res.status(200).send(
                                    response,
                                );
                            } else if (cek_hold_dana[0].status == 0) {
                                let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                let nilai = formatRibuan(cek_hold_dana[0].amount)
                                nominal = nominal.substring(nominal.length - 12, nominal.length)
                                const data_nasabah = { no_rek: "", no_hp, bpr_id, trx_code: "0500", status: "", tgl_trans, tgl_transmis: moment().format('YYMMDDHHmmss'), rrn }
                                const nasabah = await connect_axios(bpr[0].gateway, "gateway_bpr/inquiry_account", data_nasabah)
                                console.log("Inquiry account");
                                console.log(nasabah)
                                if (nasabah.code !== "000") {
                                    response = await error_response(data, response, "", "TRANSAKSI DI TOLAK", nasabah.message, null, null, null, null, null, null, null, null, null, null, null, null, null, "99", "INVALID TRANSACTION")
                                    await send_log(data, response)
                                    console.log(response);
                                    res.status(200).send(
                                        response,
                                    );
                                } else {
                                    // response = await error_response(data,response,nominal,null,`NAMA  = ${kartu[0].nama_rek}`,`NILAI = Rp. ${nilai}`,null,null,null,"00","Transaksi Berhasil")
                                    response = await error_response(
                                        data,
                                        response,
                                        nominal,
                                        null,
                                        `NAMA ${nasabah.data.nama_rek}`,
                                        `NILAI Rp. ${nilai}`,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        "00",
                                        "Transaksi Berhasil")
                                    await send_log(data, response)
                                    console.log(response);
                                    res.status(200).send(
                                        response
                                    );
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
            rrn: data.TID,
            message: error.message
        });
    }
};

// API untuk Check Status Withdrawal
const check_status_token = async (req, res) => {
    let {
        no_hp,
        no_rek,
        bpr_id,
        trx_code,
        trx_type,
        tgl_trans,
        tgl_transmis,
        rrn
    } = req.body;
    try {
        console.log("REQ BODY STATUS TOKEN");
        console.log(req.body);
        let transaksi = await db.sequelize.query(
            `SELECT * FROM dummy_transaksi WHERE no_hp = ? AND bpr_id = ? AND no_rek = ? AND tcode = ? AND tgl_trans = ? AND rrn = ?`,
            {
                replacements: [
                    no_hp,
                    bpr_id,
                    no_rek,
                    trx_code,
                    tgl_trans,
                    rrn
                ],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!transaksi.length) {
            console.log({
                code: "009",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Pencarian RRN!!!",
                rrn: rrn,
                data: null,
            });
            res.status(200).send({
                code: "009",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Pencarian RRN!!!",
                rrn: rrn,
                data: null,
            });
        } else {
            let status, status_message
            if (transaksi[0].code === "000" && transaksi[0].status_rek == "1") {
                status_message = "SUCCESS"
            } else if (transaksi[0].status_rek == "R") {
                status_message = "REVERSE"
            } else if (transaksi[0].code == "088" && transaksi[0].status_rek !== "1") {
                status_message = "TRANSACTION TIME OUT"
            } else {
                status_message = "FAILED"
            }
            let response = {
                no_hp: transaksi[0].no_hp,
                no_rek: transaksi[0].no_rek,
                bpr_id: transaksi[0].bpr_id,
                amount: transaksi[0].amount,
                trans_fee: transaksi[0].admin_fee,
                Keterangan: transaksi[0].ket_trans,
                trx_code: transaksi[0].tcode,
                trx_type,
                reff: transaksi[0].reff,
                tgl_trans: transaksi[0].tgl_trans,
                tgl_transmis: moment().format('YYMMDDHHmmss'),
                rrn,
                status: transaksi[0].status_rek,
                status_message,
                code: transaksi[0].code,
                message: transaksi[0].message,
            }
            //--berhasil dapat list product update atau insert ke db --//
            console.log("Success");
            console.log(response);
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
            rrn: rrn,
            message: error.message
        });
    }
};

// API untuk Check Status Withdrawal
const check_status_withdrawal = async (req, res) => {
    let {
        reference_number,
        request_timestamp } = req.body;
    try {
        console.log("REQ BODY STATUS TARTUN");
        console.log(req.body);
        if (reference_number) {
            let transaksi = await db.sequelize.query(
                `SELECT token.*, dt.nama_rek FROM token AS token INNER JOIN dummy_transaksi AS dt ON token.reference_number = dt.reference_number WHERE token.reference_number = ?`,
                {
                    replacements: [
                        reference_number
                    ],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!transaksi.length) {
                console.log({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian reference_number!!!",
                    rrn: reference_number,
                    data: null,
                });
                res.status(200).send({
                    code: "009",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Pencarian reference_number!!!",
                    rrn: reference_number,
                    data: null,
                });
            } else {
                console.log(transaksi[0]);
                let trans_fee = 0
                if (transaksi[0].admin_fee !== undefined) {
                    trans_fee = transaksi[0].trans_fee
                }
                let response_message = await message_status(transaksi[0].status)
                let response = {
                    "withdrawal_status": response_message.withdrawal_status,
                    "withdrawal_status_notes": response_message.withdrawal_status_notes,
                    "amount": {
                        "value": transaksi[0].amount,
                        "currency": "IDR"
                    },
                    "fee": {
                        "value": trans_fee,
                        "currency": "IDR"
                    },
                    "invoice_number": reference_number,
                    "customer": {
                        "name": transaksi[0].nama_rek,
                        "account_number": transaksi[0].no_hp
                    }
                }
                //--berhasil dapat list product update atau insert ke db --//
                console.log("Success");
                console.log(response);
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    rrn: reference_number,
                    data: response,
                });
            }

        } else {
            console.log({
                code: "099",
                status: "Failed, Request Is not Valid!!!",
                rrn: null,
                message: null
            });
            res.status(200).send({
                code: "099",
                status: "Failed, Request Is not Valid!!!",
                rrn: reference_number,
                message: null
            });
        }
    } catch (error) {
        //--error server--//
        console.log("erro get product", error);
        res.status(200).send({
            code: "099",
            status: "Failed",
            rrn: reference_number,
            message: error.message
        });
    }
};

// API untuk Reversal Withdrawal
const reversal_withdrawal = async (req, res) => {
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
        rrn } = req.body;
    try {
        console.log("REQ BODY REV TOKEN");
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
                data: null,
            });
        } else {
            let check_transaksi = await db.sequelize.query(
                `SELECT * FROM dummy_transaksi WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND admin_fee = ? AND rrn = ?`,
                {
                    replacements: [no_rek, no_hp, bpr_id, trx_code, amount, trans_fee, rrn],
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
                    const keterangan = `Token ${amount} ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                    const data = { no_hp, bpr_id, no_rek, amount, trans_fee, trx_code, trx_type, keterangan, acq_id: "", acq_id: "", terminal_id: "", token: "", lokasi: "", tgl_trans, tgl_transmis, rrn }
                    const request = await connect_axios(bpr[0].gateway, "gateway_bpr/withdrawal", data)
                    if (request.code !== "000") {
                        console.log("request");
                        console.log(request);
                        let [results, metadata] = await db.sequelize.query(
                            `INSERT INTO dummy_transaksi(no_hp, bpr_id, no_rek, nama_rek, tcode, produk_id, ket_trans, reff, amount, admin_fee, tgl_trans, token, rrn, code, message, status_rek) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'0')`,
                            {
                                replacements: [
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    "",
                                    trx_code,
                                    "Tarik Tunai",
                                    keterangan,
                                    "",
                                    amount,
                                    trans_fee,
                                    tgl_trans,
                                    "",
                                    rrn,
                                    request.code,
                                    request.message,
                                ],
                            }
                        );
                        res.status(200).send(request);
                    } else {
                        console.log("request.data");
                        console.log(request.data);
                        let [results2, metadata2] = await db.sequelize.query(
                            `UPDATE dummy_transaksi SET status_rek = 'R' WHERE no_hp = ? AND bpr_id = ? AND no_rek = ? AND tcode = ? AND amount = ? AND rrn = ? AND status_rek = '1'`,
                            {
                                replacements: [
                                    no_hp,
                                    bpr_id,
                                    no_rek,
                                    "1000",
                                    amount,
                                    rrn
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
        res.status(200).send({
            code: "099",
            status: "Failed",
            rrn: rrn,
            message: error.message
        });
    }
};

module.exports = {
    request_withdrawal,
    release_withdrawal,
    // validate_token,
    check_status_withdrawal,
    check_status_token,
    reversal_withdrawal
}
const db = require("../connection");
const axios = require("axios").default;
const moment = require("moment");
moment.locale("id");

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

const connect_axios = async (url, route, data) => {
    try {
        let Result = ""
        console.log(`${url}${route}`);
        await axios({
            method: 'post',
            url: `${url}${route}`,
            timeout: 25000, //milisecond
            data
        }).then(res => {
            Result = res.data
        }).catch(error => {
            Result = error
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

// API untuk Inquiry bpr
const list_bpr = async (req, res) => {
    // let {no_hp, no_rek, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        let request = await db.sequelize.query(
            `SELECT * FROM kd_bpr` ,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal Inquiry BPR",
                data: [],
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: request,
            });
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

// API untuk Inquiry rek bpr
const get_gl = async (req, res) => {
    let {bpr_id} = req.query;
    try {
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?` ,
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
            const data = {bpr_id, trx_code:"0300", trx_type:"TRX", tgl_trans:moment().format('YYMMDDHHmmss'),rrn:"999999"}
            const request = await connect_axios(bpr[0].gateway,"gateway_bpr/inquiry_account",data)
            if (request.code !== "000") {
                console.log(request);
                res.status(200).send(request);
            } else {
                console.log("success");
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    nama: bpr[0].nama_bpr,
                    data: request.data,
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

// API untuk Inquiry transaksi bpr
const get_trans = async (req, res) => {
    let {bpr_id, nosbb, status, fr, to, page} = req.query;
    try {
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR",
                data: null,
            });
        } else {
            page = (parseInt(page)-1)*10
            if (nosbb == "all" || status == "all") {
                if (nosbb == "all" && status != "all") {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND status = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC LIMIT 10 OFFSET ?` ,
                        {
                            replacements: [bpr_id, status, fr, to, page],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            total: request[0].numrows,
                            rek: "All",
                            data: request,
                        });
                    }
                } else if (nosbb != "all" && status == "all") {
                    let rek = await db.sequelize.query(
                        `SELECT * FROM master_kd_acct WHERE no_rek = ?` ,
                        {
                            replacements: [nosbb],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!rek.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            message: "Gagal, Nama Rekening Tidak Ditemukan",
                            data: [],
                        });
                    } else {
                        let request = await db.sequelize.query(
                            `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND nosbb = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC LIMIT 10 OFFSET ?` ,
                            {
                                replacements: [bpr_id, nosbb, fr, to, page],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        )
                        if (!request.length) {
                            res.status(200).send({
                                code: "009",
                                status: "Failed",
                                bpr: bpr[0].nama_bpr,
                                rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                                message: "Inquiry History Transaction Tidak Ada",
                                data: [],
                            });
                        } else {
                            res.status(200).send({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                bpr: bpr[0].nama_bpr,
                                total: request[0].numrows,
                                rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                                data: request,
                            });
                        }
                    }
                } else if (nosbb == "all" && status == "all") {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC LIMIT 10 OFFSET ?` ,
                        {
                            replacements: [bpr_id, fr, to, page],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            total: request[0].numrows,
                            rek: "All",
                            data: request,
                        });
                    }
                }
            } else {
                let rek = await db.sequelize.query(
                    `SELECT * FROM master_kd_acct WHERE no_rek = ?` ,
                    {
                        replacements: [nosbb],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!rek.length) {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        message: "Gagal, Nama Rekening Tidak Ditemukan",
                        data: [],
                    });
                } else {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND nosbb = ? AND status = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC LIMIT 10 OFFSET ?` ,
                        {
                            replacements: [bpr_id, nosbb, status, fr, to, page],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            total: request[0].numrows,
                            rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                            data: request,
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
            message: error.message
        });
    }
};

// API untuk Inquiry transaksi bpr
const all_trans = async (req, res) => {
    let {bpr_id, nosbb, status, fr, to} = req.query;
    try {
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?` ,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR",
                data: null,
            });
        } else {
            if (nosbb == "all" || status == "all") {
                if (nosbb == "all" && status != "all") {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND status = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC` ,
                        {
                            replacements: [bpr_id, status, fr, to],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            data: request,
                        });
                    }
                } else if (nosbb != "all" && status == "all") {
                    let rek = await db.sequelize.query(
                        `SELECT * FROM master_kd_acct WHERE no_rek = ?` ,
                        {
                            replacements: [nosbb],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!rek.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            message: "Gagal, Nama Rekening Tidak Ditemukan",
                            data: [],
                        });
                    } else {
                        let request = await db.sequelize.query(
                            `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND nosbb = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC` ,
                            {
                                replacements: [bpr_id, nosbb, fr, to],
                                type: db.sequelize.QueryTypes.SELECT,
                            }
                        )
                        if (!request.length) {
                            res.status(200).send({
                                code: "009",
                                status: "Failed",
                                bpr: bpr[0].nama_bpr,
                                rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                                message: "Inquiry History Transaction Tidak Ada",
                                data: [],
                            });
                        } else {
                            res.status(200).send({
                                code: "000",
                                status: "ok",
                                message: "Success",
                                bpr: bpr[0].nama_bpr,
                                rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                                data: request,
                            });
                        }
                    }
                } else if (nosbb == "all" && status == "all") {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC` ,
                        {
                            replacements: [bpr_id, fr, to],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            rek: "All",
                            data: request,
                        });
                    }
                }
            } else {
                let rek = await db.sequelize.query(
                    `SELECT * FROM master_kd_acct WHERE no_rek = ?` ,
                    {
                        replacements: [nosbb],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!rek.length) {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        message: "Gagal, Nama Rekening Tidak Ditemukan",
                        data: [],
                    });
                } else {
                    let request = await db.sequelize.query(
                        `SELECT *, count(*) over() as numrows FROM log_gateway WHERE bpr_id = ? AND nosbb = ? AND status = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC` ,
                        {
                            replacements: [bpr_id, nosbb, status, fr, to],
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    if (!request.length) {
                        res.status(200).send({
                            code: "009",
                            status: "Failed",
                            bpr: bpr[0].nama_bpr,
                            rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                            message: "Inquiry History Transaction Tidak Ada",
                            data: [],
                        });
                    } else {
                        res.status(200).send({
                            code: "000",
                            status: "ok",
                            message: "Success",
                            bpr: bpr[0].nama_bpr,
                            rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                            data: request,
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
            message: error.message
        });
    }
};

// API untuk Inquiry transaksi bpr
const get_konsol = async (req, res) => {
    let {trx} = req.query;
    try {
        let bpr = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?` ,
            {
                replacements: ["600998"],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!bpr.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal, Inquiry BPR",
                data: null,
            });
        } else {
            // let request = await db.sequelize.query(
            //     `SELECT * FROM log_gateway WHERE bpr_id = ? AND nosbb = ? AND status = ? AND tgl_trans BETWEEN ? AND ? order by tgl_trans DESC` ,
            //     {
            //         replacements: [bpr_id, nosbb, status, fr, to],
            //         type: db.sequelize.QueryTypes.SELECT,
            //     }
            // )
            console.log(trx);
            if (trx == "tariktunai") {
                console.log(trx);
                let request = await db.sequelize.query(
                    `SELECT mka.keterangan, SUM(lg.amount_db) AS total_db, SUM(lg.amount_cr) AS total_cr, SUM(lg.amount_cr) - SUM(lg.amount_db) AS total_selisih FROM log_gateway AS lg INNER JOIN master_kd_acct AS mka ON lg.nosbb = mka.no_rek WHERE bpr_id = '600998' AND trx_code IN ('1100', '1000') GROUP BY mka.keterangan`,
                    {
                        // replacements: ["600998", "1000", "1100"],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!request.length) {
                    console.log({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        message: "Inquiry History Transaction Tidak Ada",
                        data: [],
                    });
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        message: "Inquiry History Transaction Tidak Ada",
                        data: [],
                    });
                } else {
                    console.log({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        data: request,
                    });
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        data: request,
                    });
                }
            } else if (trx == "transfer") {
                let request = await db.sequelize.query(
                    `SELECT mka.keterangan, SUM(lg.amount_db) AS total_db, SUM(lg.amount_cr) AS total_cr, SUM(lg.amount_cr) - SUM(lg.amount_db) AS total_selisih FROM log_gateway AS lg INNER JOIN master_kd_acct AS mka ON lg.nosbb = mka.no_rek WHERE bpr_id = '600998' AND trx_code IN ('2100', '2200', '2300') GROUP BY mka.keterangan`,
                    {
                        // replacements: ["600998", "2100", "2200", "2300"],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!request.length) {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        message: "Inquiry History Transaction Tidak Ada",
                        data: [],
                    });
                } else {
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        data: request,
                    });
                }
            } else if (trx == "ppob") {
                let request = await db.sequelize.query(
                    `SELECT mka.keterangan, SUM(lg.amount_db) AS total_db, SUM(lg.amount_cr) AS total_cr, SUM(lg.amount_cr) - SUM(lg.amount_db) AS total_selisih FROM log_gateway AS lg INNER JOIN master_kd_acct AS mka ON lg.nosbb = mka.no_rek WHERE bpr_id = '600998' AND trx_code = '5000' GROUP BY mka.keterangan`,
                    {
                        // replacements: ["600998", "5000"],
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                if (!request.length) {
                    res.status(200).send({
                        code: "009",
                        status: "Failed",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        message: "Inquiry History Transaction Tidak Ada",
                        data: [],
                    });
                } else {
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success",
                        bpr: bpr[0].nama_bpr,
                        // rek: `${rek[0].no_rek} ${rek[0].keterangan}`,
                        data: request,
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
            message: error.message
        });
    }
};

// API untuk Mengupdate Status ATM
const release_status = async (req, res) => {
    let {terminalid, waktu, lokasi, status} = req.body;
    console.log("Request Release Status");
    console.log(req.body);
    try {
        let atm = await db.sequelize.query(
            `SELECT * FROM kd_atm WHERE atm_id LIKE ?` ,
            {
                replacements: [`%${terminalid}`],
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!atm.length) {
            res.status(200).send({
                rcode: "99",
                status: "Failed",
                message: "Gagal, Inquiry ATM",
            });
        } else {
            let [results, metadata] = await db.sequelize.query(
                `UPDATE kd_atm SET status = ? WHERE atm_id LIKE ?`,
                {
                    replacements: [status, `%${terminalid}`],
                }
            );
            if (!metadata) {
                res.status(200).send({
                    rcode: "99",
                    status: "Failed",
                    message: "Gagal, Terjadi Kesalahan Update Status ATM!!!",
                });
            } else {
                res.status(200).send({
                    rcode: "00",
                    command: atm[0].command,
                    message: "Tidak ada command",
                });
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Inquiry bpr
const list_atm = async (req, res) => {
    // let {no_hp, no_rek, bpr_id, tgl_trans, tgl_transmis, rrn} = req.body;
    try {
        let request = await db.sequelize.query(
            `SELECT kb.bpr_id, nama_bpr, alamat_bpr, atm_id, nama_atm, lokasi, kota, ka.status FROM kd_atm AS ka INNER JOIN kd_bpr AS kb ON ka.bpr_id = kb.bpr_id ` ,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        )
        if (!request.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal Inquiry BPR",
                data: [],
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: request,
            });
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

module.exports = {
    list_bpr,
    get_gl,
    get_trans,
    all_trans,
    get_konsol,
    list_atm,
    release_status
}
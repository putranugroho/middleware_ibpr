const axios = require("axios").default;
const {
    error_response,
    send_log,
  } = require("./response");
const db = require("../connection");
const moment = require("moment");
var https = require('https');
moment.locale("id");
const hmacSHA256 = require('crypto-js/hmac-sha256');
const Base64 = require("crypto-js/enc-base64");
const { log } = require("console");

const api_crm = "https://integration-dev.oyindonesia.com"

const agent = new https.Agent({  
    rejectUnauthorized: false
  });

var cek_terminal = async (data) => {
    // const val_term = `SELECT * FROM log WHERE id = 7`
    // const log_atm = `INSERT INTO log(nama, saldo, date, message) VALUES (?,?,?,?)`
    // let flag

    // let output = syncSql.mysql(config,val_term).data.rows
    // if (!output[0]) {
    //     conn.query(log_atm, [data.nama, data.saldo, data.date, "TERMINAL NOT FOUND"], (err, result) => {
    //     })
    //     flag = true
    // } else {
        flag = false
    // }

    return flag
}

var cek_bin = (data) => {
    // const val_bin = `SELECT * FROM log WHERE bpr_id = ? AND no_hp = ?`
    // const log_atm = `INSERT INTO log(nama, saldo, date, message) VALUES (?,?,?,?)`
    // let flag

    // let output = syncSql.mysql(config,val_bin).data.rows
    // if (!output[0]) {
    //     conn.query(log_atm, [data.nama, data.saldo, data.date, "BIN NOT FOUND"], (err, result) => {})
    //     flag = true
    // } else {
        flag = false
    // }

    // return flag
}

var formatRibuan = (angka) => {
    var number_string = angka.toString().replace(/[^,\d]/g, ''),
    split           = number_string.split(','),
    sisa            = split[0].length % 3,
    angka_hasil     = split[0].substr(0, sisa),
    ribuan          = split[0].substr(sisa).match(/\d{3}/gi);

    // tambahkan titik jika yang di input sudah menjadi angka ribuan
    if(ribuan){
        separator = sisa ? '.' : '';
        angka_hasil += separator + ribuan.join('.');
    }

    angka_hasil = split[1] != undefined ? angka_hasil + ',' + split[1] : angka_hasil;
    return angka_hasil;
}

const tarik_tunai = async (req, res) => {
  try {
    const data = req.body
    let response = {}
    console.log("REQ BODY");
    console.log(data);
    let no_hp = data.NOKARTU.substring(4,data.NOKARTU.length)
    let bpr_id = data.NOKARTU.substring(0,4)
    let [results, metadata] = await db.sequelize.query(
        `INSERT INTO log_transaksi(nokartu, waktu, kodetrx, jumlahtx, otp, pin, tid, terminalid, jenistx, message_type, status) VALUES (?,?,?,?,?,?,?,?,?,'REQUEST','0')`,
        {
          replacements: [
            data.NOKARTU, 
            data.WAKTU, 
            data.KODETRX, 
            data.JUMLAHTX, 
            data.OTP, 
            data.PIN, 
            data.TID, 
            data.TERMINALID, 
            data.JENISTX,
          ],
        }
    );
    // const salah_pin = `UPDATE cms_kartu SET retry = ? WHERE no_kartu = ${data.NOKARTU}`

    let amount = parseInt(data.JUMLAHTX.substring(0,10))

    // Validasi Terminal (ATM)
    const terminal = await cek_terminal(data)
    if (terminal) {

       response['norek'] = ""
       response['rcode'] = "96"
       response['message'] = 'TERMINAL NOT FOUND'
        
        res.send(data)
    } else {

        // Validasi BIN
        const bin = await cek_bin(data)
        if (bin) {

       response['norek'] = ""
       response['rcode'] = "56"
       response['message'] = 'BIN NOT FOUND'
        
        res.send(data)
        } else {
            let kartu = await db.sequelize.query(
                `SELECT rek.*, bpr.nama_bpr  FROM dummy_rek_tabungan AS rek INNER JOIN kd_bpr AS bpr ON rek.bpr_id = bpr.bpr_id WHERE rek.no_hp = ? AND rek.bpr_id = ?`,
                {
                replacements: [
                    no_hp,
                    bpr_id
                ],
                type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!kartu.length) {
                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","KODE BPR ATAU NO HANDPHONE SALAH",null,null,null,null,null,null,null,null,null,null,null,null,null,"14","Kartu Tidak Ditemukan")
                await send_log(data,response)
                console.log(response); 
                res.status(200).send(
                   response,
                );
            } else {
                if (data.KODETRX.substring(0,2) == "01") {
                    if (data.JENISTX == "REV") {
                        let cek_hold_dana = await db.sequelize.query(
                            `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND status != '2' order by tgl_trans DESC`,
                            {
                            replacements: [
                                kartu[0].no_rek,
                                "1000",
                                data.OTP,
                                amount
                            ],
                            type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (!cek_hold_dana.length) {
                            response['rcode'] = "99"
                            response['message'] = "Hold Dana Tidak Ditemukan"
            
                            res.status(200).send(
                                response,
                            );
                        } else {
                            let tgl_trans = moment(cek_hold_dana[0].tgl_trans).format('YYYY-MM-DD HH:mm:ss')
                            let [results, metadata] = await db.sequelize.query(
                            `UPDATE dummy_hold_dana SET status = '0' WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND tgl_trans = ? AND status = '1'`,
                            {
                                replacements: [
                                    kartu[0].no_rek,
                                    "1000",
                                    data.OTP,
                                    amount,
                                    tgl_trans
                                ],
                                }
                            );
                            if (!metadata) {
                                response['rcode'] = "99"
                                response['message'] = "Gagal Merubah Status Hold Dana"
                
                                res.status(200).send(
                                    response,
                                );
                            } else {
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE dummy_transaksi SET status_rek = '0' WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND tgl_trans = ? AND status_rek = '1'`,
                                {
                                    replacements: [
                                        kartu[0].no_rek,
                                        kartu[0].nama_rek,
                                        amount,
                                        tgl_trans
                                    ],
                                }
                                );
                                if (!metadata) {
                                response['rcode'] = "99"
                                response['message'] = "Gagal Merubah Status Transaksi"
                
                                res.status(200).send(
                                    response,
                                );
                                } else {
                                    let [results, metadata] = await db.sequelize.query(
                                        `UPDATE token SET status = '0' WHERE token = ? AND no_rek = ? AND status = '1'`,
                                        {
                                        replacements: [
                                            data.OTP,
                                            kartu[0].no_rek
                                        ],
                                        }
                                    );
                                    if (!metadata) {
                                        response['rcode'] = "99"
                                        response['message'] = "Gagal Merubah Status Token"
                        
                                        res.status(200).send(
                                            response,
                                        );
                                    } else {
                                        let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                        let nilai = formatRibuan(cek_hold_dana[0].amount)
                                        response["jumlahtx"] = nominal.substring(nominal.length-12, nominal.length)
                                        response["kodetrx"] = data.KODETRX
                                        response["nokartu"] = data.NOKARTU
                                        response["tid"] = data.TID
                                        response["text1"] = null
                                        response["text2"] = `NAMA  = ${kartu[0].nama_rek}`
                                        response["text3"] = `NILAI = Rp. ${nilai}`
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
                                        console.log(response);
                                        res.status(200).send(
                                            response
                                        );
                                    }
                                }
                            }
                        }
                    } else {
                        let cek_token = await db.sequelize.query(
                            `SELECT * FROM token WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND status = '1' order by tgl_trans DESC`,
                            {
                            replacements: [
                                kartu[0].no_rek,
                                no_hp,
                                bpr_id
                            ],
                            type: db.sequelize.QueryTypes.SELECT,
                            }
                        );
                        if (!cek_token.length) {
                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","TOKEN AKSES TIDAK DITEMUKAN",null,null,null,null,null,null,null,null,null,null,null,null,null,"81","Token Tidak Ditemukan")
                            await send_log(data,response)
                            console.log(response); 
                            res.status(200).send(
                                response,
                            );
                        } else {
                            let tgl_inquiry = cek_token[0].tgl_trans
                            let cek_hold_dana = await db.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND tgl_inquiry = ? AND status = '0' order by tgl_trans DESC`,
                                {
                                replacements: [
                                    kartu[0].no_rek,
                                    no_hp,
                                    bpr_id,
                                    "1000",
                                    amount,
                                    tgl_inquiry
                                ],
                                type: db.sequelize.QueryTypes.SELECT,
                                }
                            );
                            if (!cek_hold_dana.length) {
                                response['rcode'] = "99"
                                response['message'] = "Hold Dana Tidak Ditemukan"
                
                                res.status(200).send(
                                    response,
                                );
                            } else {
                                let [results, metadata] = await db.sequelize.query(
                                // `UPDATE dummy_hold_dana SET status = '1' WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND tgl_trans = ? AND status = '0'`,
                                `UPDATE dummy_hold_dana SET status = '1' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND tgl_inquiry = ? AND status = '0'`,
                                {
                                    replacements: [
                                        kartu[0].no_rek,
                                        no_hp,
                                        bpr_id,
                                        "1000",
                                        amount,
                                        tgl_inquiry
                                    ],
                                    }
                                );
                                if (!metadata) {
                                    response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"81","Token Tidak Ditemukan")
                                    await send_log(data,response)
                                    console.log(response); 
                                    res.status(200).send(
                                        response,
                                    );
                                } else {
                                    let get_atm = await db.sequelize.query(
                                        `SELECT atm.atm_id, atm.nama_atm, bpr.nama_bpr FROM kd_atm AS atm INNER JOIN kd_bpr AS bpr ON atm.bpr_id = bpr.bpr_id WHERE atm_id LIKE ?`,
                                    {
                                        replacements: [
                                            `%${data.TERMINALID}`,
                                        ],
                                        type: db.sequelize.QueryTypes.SELECT,
                                    }
                                    );
                                    if (!get_atm.length) {
                                        response['rcode'] = "99"
                                        response['message'] = "ATM Tidak Ditemukan"
                        
                                        res.status(200).send(
                                            response,
                                        );
                                    } else {
                                        let [results, metadata] = await db.sequelize.query(
                                            `UPDATE dummy_transaksi SET status_rek = '1', reference_number = ? WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND reff = ? AND tgl_trans = ? AND status_rek = '0'`,
                                            {
                                                replacements: [
                                                    cek_token[0].reference_number,
                                                    kartu[0].no_rek,
                                                    kartu[0].nama_rek,
                                                    amount,
                                                    cek_hold_dana[0].reff,
                                                    cek_hold_dana[0].tgl_trans
                                                ],
                                            }
                                        );
                                        if (!metadata) {
                                        response['rcode'] = "99"
                                        response['message'] = "Gagal Merubah Status Transaksi"
                        
                                        res.status(200).send(
                                            response,
                                        );
                                        } else {
                                            let requestData = {
                                                "partner_id": "mtd",
                                                "request_timestamp": tgl_inquiry,
                                                "token_access": cek_token[0].token_access,
                                                "reference_number": cek_token[0].reference_number,
                                                "terminal": {
                                                    "id": "1234",
                                                    "name_location": "location"
                                                },
                                                "customer_account_number": no_hp,
                                                "customer_token": data.OTP
                                            }
                                            let paramToCombine = [
                                                "POST", 
                                                "/internal-middleware/v2/withdrawal/request",
                                                tgl_inquiry,
                                                JSON.stringify(requestData)
                                            ]
                                            paramToCombine = paramToCombine.join(":").replace(/\s*|\t|\r|\n/gm, "");
                                            const rawSignature = hmacSHA256(paramToCombine,process.env.SHA_KEY)
                                            const Signature = Base64.stringify(rawSignature)
                                            console.log(JSON.stringify(requestData));
                                    
                                            let request_withdrawal = await axios({
                                                method: 'post',
                                                url: `${api_crm}/internal-middleware/v2/withdrawal/request`,
                                                httpsAgent: agent,
                                                headers: {
                                                    "Content-Type": "application/json",
                                                    "Signature": Signature
                                                },
                                                data: requestData
                                            }).then(res => {
                                                console.log("response");
                                                let response = {
                                                    status : res.data.response_status,
                                                    error : res.data.error,
                                                    data : res.data
                                                }
                                                return response
                                            }).catch(error => {
                                                console.log("error");
                                                return error
                                            });
                                            console.log(request_withdrawal);
                                            if (request_withdrawal.status == "SUCCESS") {
                                                let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                                let nilai = formatRibuan(cek_hold_dana[0].amount)
                                                nominal = nominal.substring(nominal.length-12, nominal.length)
                                                let [results, metadata] = await db.sequelize.query(
                                                    `UPDATE token SET status = '2' WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tgl_trans = ? AND status = '1'`,
                                                    {
                                                    replacements: [
                                                        kartu[0].no_rek,
                                                        no_hp,
                                                        bpr_id,
                                                        tgl_inquiry
                                                    ],
                                                    }
                                                );
                                                // response = await error_response(data,response,nominal,get_atm[0].nama_bpr,get_atm[0].nama_atm,moment().format('DD-MM-YYYY HH:mm:ss'),"PENARIKAN TUNAI",`NOMER RESI :${data.TID}`,`NILAI = Rp. ${nilai}`,"00","Transaksi Berhasil")
                                                response = await error_response(
                                                    data,
                                                    response,
                                                    nominal,
                                                    get_atm[0].nama_bpr,
                                                    get_atm[0].nama_atm,
                                                    get_atm[0].atm_id,
                                                    moment().format('DD-MM-YYYY HH:mm:ss'),
                                                    "",
                                                    `TRACE : ${data.TID}`,
                                                    "",
                                                    "*** TARIK TUNAI TANPA KARTU ***",
                                                    "",
                                                    `NAMA     = ${kartu[0].nama_rek}`,
                                                    `NOMER HP = #########${no_hp.substring(9,no_hp.length)}`,
                                                    `NILAI    = Rp. ${nilai}`,
                                                    `TOKEN    = ${data.OTP}`,
                                                    "",
                                                    "TERIMA KASIH",
                                                    "00",
                                                    "Transaksi Berhasil"
                                                    )
                                                await send_log(data,response)
                                                console.log(response); 
                                                res.status(200).send(
                                                    response
                                                );
                                            } else {
                                                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","GAGAL INQUIRY TARIK TUNAI",null,null,null,null,null,null,null,null,null,null,null,null,null,"14","GAGAL INQUIRY TARIK TUNAI")
                                                await send_log(data,response)
                                                console.log(response); 
                                                res.status(200).send(
                                                    response,
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // }
                } else if (data.KODETRX.substring(0,2) == "88") {
                    let tgl_trans = moment().format('YYMMDDHHmmss')
                    let requestData = {
                        "partner_id": "mtd",
                        "request_timestamp": tgl_trans
                    }
                    let paramToCombine = [
                        "POST", 
                        "/internal-middleware/v2/generate-token",
                        tgl_trans,
                        JSON.stringify(requestData)
                    ]
                    paramToCombine = paramToCombine.join(":").replace(/\s*|\t|\r|\n/gm, "");
                    const rawSignature = hmacSHA256(paramToCombine,process.env.SHA_KEY)
                    const Signature = Base64.stringify(rawSignature)
                    console.log(JSON.stringify(requestData));
            
                    let token_access = await axios({
                        method: 'post',
                        url: `${api_crm}/internal-middleware/v2/generate-token`,
                        httpsAgent: agent,
                        headers: {
                            "Content-Type": "application/json",
                            "Signature": Signature
                        },
                        data: requestData
                    }).then(res => {
                        let response = {
                            code : "success",
                            token : res.data.token_access
                        }
                        return response
                    }).catch(error => {
                        let err = {
                            code : error.response.status,
                            message : error.response.statusText,
                            token : ""
                        }
                        return err
                    });
                    console.log(token_access);
                    if (token_access.code == "success" && token_access.token) {
                        let reference_number = `${data.TID.substring(data.TID.length-6,data.TID.length)}${bpr_id}${no_hp}`
                        let requestData = {
                            "partner_id": "mtd",
                            "request_timestamp": tgl_trans,
                            "token_access": token_access.token,
                            "reference_number": reference_number,
                            "terminal": {
                                "id": "1234",
                                "name_location": "location"
                            },
                            "customer_account_number": no_hp,
                            "customer_token": data.OTP
                        }
                        let paramToCombine = [
                            "POST", 
                            "/internal-middleware/v2/withdrawal/inquiry",
                            tgl_trans,
                            JSON.stringify(requestData)
                        ]
                        paramToCombine = paramToCombine.join(":").replace(/\s*|\t|\r|\n/gm, "");
                        const rawSignature = hmacSHA256(paramToCombine,process.env.SHA_KEY)
                        const Signature = Base64.stringify(rawSignature)
                        console.log(JSON.stringify(requestData));
                
                        let inquiry_withdrawal = await axios({
                            method: 'post',
                            url: `${api_crm}/internal-middleware/v2/withdrawal/inquiry`,
                            httpsAgent: agent,
                            headers: {
                                "Content-Type": "application/json",
                                "Signature": Signature
                            },
                            data: requestData
                        }).then(res => {
                            console.log("response");
                            let response = {
                                status : res.data.response_status,
                                error : res.data.error,
                                data : res.data
                            }
                            return response
                        }).catch(error => {
                            console.log("error");
                            return error
                        });
                        console.log(inquiry_withdrawal);
                        if (inquiry_withdrawal.status == "SUCCESS") {
                            let amount = inquiry_withdrawal.data.data.amount.value
                            let nominal = `00000000000${amount}00`
                            let nilai = formatRibuan(amount)
                            nominal = nominal.substring(nominal.length-12, nominal.length)
                            let [results, metadata] = await db.sequelize.query(
                                `INSERT INTO token(no_hp, bpr_id, no_rek, tgl_trans, status, token_access) VALUES (?,?,?,?,'0',?)`,
                                {
                                replacements: [
                                    no_hp,
                                    bpr_id,
                                    kartu[0].no_rek,
                                    tgl_trans,
                                    token_access.token
                                ],
                                }
                            );
                            let cek_hold_dana = await db.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND token = ? AND status = '0'`,
                                {
                                replacements: [
                                    kartu[0].no_rek,
                                    no_hp,
                                    bpr_id,
                                    "1000",
                                    amount,
                                    data.OTP
                                ],
                                type: db.sequelize.QueryTypes.SELECT,
                                }
                            );
                            if (!cek_hold_dana.length) {
                                let select_hold_dana = await db.sequelize.query(
                                    `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND tcode = ? AND amount = ? AND status = '0' AND token = 'NULL' AND reference_number = 'NULL' order by tgl_trans DESC`,
                                    {
                                    replacements: [
                                        kartu[0].no_rek,
                                        no_hp,
                                        bpr_id,
                                        "1000",
                                        amount
                                    ],
                                    type: db.sequelize.QueryTypes.SELECT,
                                    }
                                );
                                if (!select_hold_dana.length) {
                                    response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"99","Hold Dana Tidak Ditemukan")
                                    await send_log(data,response)
                                    console.log(response);
                                    res.status(200).send(
                                        response,
                                    );
                                } else { 
                                    let [results, metadata] = await db.sequelize.query(
                                        `UPDATE dummy_hold_dana SET tgl_inquiry = ?, reference_number = ?, token = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND reff = ? AND tcode = '1000' AND amount = ? AND status = '0' AND token = 'NULL' AND reference_number = 'NULL'`,
                                        {
                                        replacements: [
                                            tgl_trans,
                                            reference_number,
                                            data.OTP,
                                            kartu[0].no_rek,
                                            no_hp,
                                            bpr_id,
                                            select_hold_dana[0].reff,
                                            amount
                                        ],
                                        }
                                    );
                                    if (!metadata) {
                                        response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"99","Hold Dana Tidak Ditemukan")
                                        await send_log(data,response)
                                        console.log(response);
                                        res.status(200).send(
                                            response,
                                        );
                                    } else {
                                        let [results, metadata] = await db.sequelize.query(
                                            `UPDATE dummy_transaksi SET reference_number = ? WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND reff = ? AND tgl_trans = ? AND status_rek = '0'`,
                                            {
                                                replacements: [
                                                    cek_token[0].reference_number,
                                                    kartu[0].no_rek,
                                                    kartu[0].nama_rek,
                                                    amount,
                                                    select_hold_dana[0].reff,
                                                    select_hold_dana[0].tgl_trans
                                                ],
                                            }
                                        );
                                        if (!metadata) {
                                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"99","Hold Dana Tidak Ditemukan")
                                            await send_log(data,response)
                                            console.log(response);
                                            res.status(200).send(
                                                response,
                                            );
                                        } else {
                                            let [results, metadata] = await db.sequelize.query(
                                                `UPDATE token SET status = '1', reference_number = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND status = '0'`,
                                                {
                                                replacements: [
                                                    reference_number,
                                                    kartu[0].no_rek,
                                                    no_hp,
                                                    bpr_id
                                                ],
                                                }
                                            );
                                            // response = await error_response(data,response,nominal,null,`NAMA  = ${kartu[0].nama_rek}`,`NILAI = Rp. ${nilai}`,null,null,null,"00","Transaksi Berhasil")
                                            response = await error_response(
                                                data,
                                                response,
                                                nominal,
                                                null,
                                                `NAMA = ${kartu[0].nama_rek}`,
                                                `NILAI = Rp. ${nilai}`,
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
                                            await send_log(data,response)
                                            console.log(response); 
                                            res.status(200).send(
                                                response
                                            );
                                        }
                                    }
                                }
                            } else {
                                let [results, metadata] = await db.sequelize.query(
                                    `UPDATE dummy_hold_dana SET tgl_inquiry = ?, reference_number = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND reference_number = ? AND token = ? AND tcode = '1000' AND amount = ? AND status = '0'`,
                                    {
                                    replacements: [
                                        tgl_trans,
                                        reference_number,
                                        kartu[0].no_rek,
                                        no_hp,
                                        bpr_id,
                                        cek_hold_dana[0].reference_number,
                                        data.OTP,
                                        amount
                                    ],
                                    }
                                );
                                if (!metadata) {
                                    response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"99","Hold Dana Tidak Ditemukan")
                                    await send_log(data,response)
                                    console.log(response);
                                    res.status(200).send(
                                        response,
                                    );
                                } else {
                                    let [results, metadata] = await db.sequelize.query(
                                        `UPDATE dummy_transaksi SET reference_number = ? WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND reff = ? AND tgl_trans = ? AND status_rek = '0'`,
                                        {
                                            replacements: [
                                                cek_token[0].reference_number,
                                                kartu[0].no_rek,
                                                kartu[0].nama_rek,
                                                amount,
                                                cek_hold_dana[0].reff,
                                                cek_hold_dana[0].tgl_trans
                                            ],
                                        }
                                    );
                                    if (!metadata) {
                                        response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"99","Hold Dana Tidak Ditemukan")
                                        await send_log(data,response)
                                        console.log(response);
                                        res.status(200).send(
                                            response,
                                        );
                                    } else {
                                        let [results, metadata] = await db.sequelize.query(
                                            `UPDATE token SET status = '1', reference_number = ? WHERE no_rek = ? AND no_hp = ? AND bpr_id = ? AND status = '0'`,
                                            {
                                            replacements: [
                                                reference_number,
                                                kartu[0].no_rek,
                                                no_hp,
                                                bpr_id
                                            ],
                                            }
                                        );
                                    // response = await error_response(data,response,nominal,null,`NAMA  = ${kartu[0].nama_rek}`,`NILAI = Rp. ${nilai}`,null,null,null,"00","Transaksi Berhasil")
                                        response = await error_response(
                                            data,
                                            response,
                                            nominal,
                                            null,
                                            `NAMA = ${kartu[0].nama_rek}`,
                                            `NILAI = Rp. ${nilai}`,
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
                                        await send_log(data,response)
                                        console.log(response); 
                                        res.status(200).send(
                                            response
                                        );
                                    }
                                }
                            }
                        } else {
                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","INVALID TRANSACTION",null,null,null,null,null,null,null,null,null,null,null,null,null,"14","GAGAL INQUIRY TARIK TUNAI")
                            await send_log(data,response)
                            console.log(response); 
                            res.status(200).send(
                                response,
                            );
                        }
                    } else {
                        response = await error_response(data,response,"","TRANSAKSI DI TOLAK","GAGAL INQUIRY TARIK TUNAI",null,null,null,null,null,null,null,null,null,null,null,null,null,"14","GAGAL INQUIRY TARIK TUNAI")
                        await send_log(data,response)
                        console.log(response); 
                        res.status(200).send(
                            response,
                        );
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

module.exports = {
    tarik_tunai
};
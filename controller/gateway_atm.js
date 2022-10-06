// const axios = require("../Services/API");
const {
    error_response,
    send_log,
  } = require("./response");
const db = require("../connection");
const moment = require("moment");
moment.locale("id");

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
                `SELECT * FROM dummy_rek_tabungan WHERE no_kartu = ?`,
                {
                replacements: [
                    data.NOKARTU
                ],
                type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!kartu.length) {
                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","KODE BPR ATAU NO HANDPHONE SALAH",null,null,null,null,"14","Kartu Tidak Ditemukan")
                await send_log(data,response)
                console.log(response); 
                res.status(200).send(
                   response,
                );
            } else {
                if (data.KODETRX.substring(0,2) == "01") {
                    let check_pin = await db.sequelize.query(
                        `SELECT * FROM dummy_rek_tabungan WHERE no_kartu = ? AND crypto = ? AND status_rek = '1'`,
                        {
                        replacements: [
                            data.NOKARTU,
                            data.PIN
                        ],
                        type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (!check_pin.length) {
                        let pin_salah = parseInt(kartu[0].pin_salah)+1
                        if (pin_salah == 3) {
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE dummy_rek_tabungan SET status_rek = '4' WHERE no_kartu = ? AND status_rek != '4'`,
                                {
                                    replacements: [
                                        data.NOKARTU
                                    ],
                                }
                            );
                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","PIN BLOCKED",null,null,null,null,"75","Pin Blocked")
                            await send_log(data,response)
                            console.log(response); 
                            res.status(200).send(
                               response,
                            );
                        } else if (kartu[0].pin_salah == "3" || kartu[0].status_rek == "4") {
                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","PIN BLOCKED",null,null,null,null,"75","Pin Blocked")
                            await send_log(data,response)
                            console.log(response); 
                            res.status(200).send(
                               response,
                            );
                        } else {
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE dummy_rek_tabungan SET pin_salah = '${pin_salah}' WHERE no_kartu = ? AND status_rek != '4'`,
                                {
                                    replacements: [
                                        data.NOKARTU
                                    ],
                                }
                            );
                            response = await error_response(data,response,"","TRANSAKSI DI TOLAK","PIN SALAH",null,null,null,null,"55","Pin Salah")
                            await send_log(data,response)
                            console.log(response); 
                            res.status(200).send(
                            response,
                            );
                        }
                    } else {
                        if (data.JENISTX == "REV") {
                            let cek_hold_dana = await db.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND status != '2'`,
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
                                        `UPDATE dummy_transaksi SET status_rek = '0' WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND tgljam_trans = ? AND status_rek = '1'`,
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
                            let cek_hold_dana = await db.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND status = '0'`,
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
                                `UPDATE dummy_hold_dana SET status = '1' WHERE no_rek = ? AND tcode = ? AND token = ? AND amount = ? AND tgl_trans = ? AND status = '0'`,
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
                                        `UPDATE dummy_transaksi SET status_rek = '1' WHERE no_rek = ? AND nama_rek = ? AND tcode = '1000' AND produk_id = 'tariktunai' AND amount = ? AND tgljam_trans = ? AND status_rek = '0'`,
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
                                        let get_atm = await db.sequelize.query(
                                            `SELECT atm.nama_atm, bpr.nama_bpr FROM kd_atm AS atm INNER JOIN kd_bpr AS bpr ON atm.bpr_id = bpr.bpr_id WHERE atm_id LIKE ?`,
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
                                                `UPDATE token SET status = '1' WHERE token = ? AND no_rek = ? AND status = '0'`,
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
                                                nominal = nominal.substring(nominal.length-12, nominal.length)
                                                response = await error_response(data,response,nominal,get_atm[0].nama_bpr,get_atm[0].nama_atm,moment().format('DD-MM-YYYY HH:mm:ss'),"PENARIKAN TUNAI",`NOMER RESI :${data.TID}`,`NILAI = Rp. ${nilai}`,"00","Transaksi Berhasil")
                                                await send_log(data,response)
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
                } else if (data.KODETRX.substring(0,2) == "88") {
                    let cek_token = await db.sequelize.query(
                        `SELECT * FROM token WHERE token = ? AND no_rek = ? AND status = '0'`,
                        {
                        replacements: [
                            data.OTP,
                            kartu[0].no_rek
                        ],
                        type: db.sequelize.QueryTypes.SELECT,
                        }
                    );
                    if (!cek_token.length) {
                        response = await error_response(data,response,"","TRANSAKSI DI TOLAK","TOKEN TIDAK DITEMUKAN",null,null,null,null,"81","Token Tidak Ditemukan")
                        await send_log(data,response)
                        console.log(response); 
                        res.status(200).send(
                           response,
                        );
                    } else {
                        let date = moment(cek_token[0].tgl_expired).format('MMDDHHmmss');
                        let expired = (parseInt(date.substring(4,6))*3600)+(parseInt(date.substring(6,8))*60)+parseInt(date.substring(8,10))
                        let transaction = (parseInt(data.WAKTU.substring(4,6))*3600)+(parseInt(data.WAKTU.substring(6,8))*60)+parseInt(data.WAKTU.substring(8,10))
                        console.log(expired);
                        console.log(transaction);
                        if (expired>transaction) {
                            let tgl_trans = moment(cek_token[0].tgl_trans).format('YYYY-MM-DD HH:mm:ss')
                            let cek_hold_dana = await db.sequelize.query(
                                `SELECT * FROM dummy_hold_dana WHERE no_rek = ? AND tcode = '1000' AND token = ? AND tgl_trans = ? AND status = '0'`,
                                {
                                replacements: [
                                    kartu[0].no_rek,
                                    data.OTP,
                                    tgl_trans
                                ],
                                type: db.sequelize.QueryTypes.SELECT,
                                }
                            );
                            if (!cek_hold_dana.length) {
                                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","TOKEN TIDAK DITEMUKAN",null,null,null,null,"81","Hold Dana Tidak Ditemukan")
                                await send_log(data,response)
                                console.log(response);
                                res.status(200).send(
                                   response,
                                );
                            } else {
                                let nominal = `00000000000${cek_hold_dana[0].amount}00`
                                let nilai = formatRibuan(cek_hold_dana[0].amount)
                                nominal = nominal.substring(nominal.length-12, nominal.length)
                                response = await error_response(data,response,nominal,null,`NAMA  = ${kartu[0].nama_rek}`,`NILAI = Rp. ${nilai}`,null,null,null,"00","Transaksi Berhasil")
                                await send_log(data,response)
                                console.log(response); 
                                res.status(200).send(
                                    response
                                );
                            }
                        } else {
                            let [results, metadata] = await db.sequelize.query(
                                `UPDATE token SET status = '2' WHERE token = ? AND no_rek = ? AND status = '0'`,
                                {
                                replacements: [
                                    data.OTP,
                                    kartu[0].no_rek
                                ],
                                }
                            );
                            if (!metadata) {
                                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","GAGAL UPDATE TOKEN",null,null,null,null,"99","Gagal Merubah Status Token")
                                await send_log(data,response)
                                console.log(response); 
                                res.status(200).send(
                                   response,
                                );
                            } else {
                                response = await error_response(data,response,"","TRANSAKSI DI TOLAK","TOKEN EXPIRED",null,null,null,null,"81","Token Expired")
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
            // Cek Token (bpr_id, no_hp, expired, nominal)

            // jika ada > ke Core Banking untuk (trans type KAS seperti tcode 40000)

            // kirim req tartun ke CMW

            // release token (status = 1)

            // hit API Middleware Tarik tunai notif

            // kirim response ke ATM
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
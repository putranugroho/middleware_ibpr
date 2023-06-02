// const axios = require("../Services/API");
const router = require('express').Router()
const {
    encryptStringWithRsaPublicKey,
    decryptStringWithRsaPrivateKey,
  } = require("../utility/encrypt");
const db = require("../connection");
const db1 = require("../connection/ibprdev");
const moment = require("moment");
const jwt = require('jsonwebtoken');
const { timeStamp } = require('console');
moment.locale("id");

const make_uniqueid = () => {
    var uniqueid = ""
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
    for (var i = 0; i < 6; i++)
    uniqueid += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return uniqueid;
}

const make_mpin = () => {
    var mpin = ""
    var possible = "0123456789";
  
    for (var i = 0; i < 6; i++)
    mpin += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return mpin;
}

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

const token_access = async (req,res) => {
    const id = req.body.id
    const key1 = req.body.timestamp.substring(2,4)
    const key2 = req.body.timestamp.substring(4,6)
    const key3 = req.body.timestamp.substring(10,12)
    // const key4 = process.env.BPR_ID.substring(4,6)
    const key4 = "0000"
    const combKey = parseInt(key1) + parseInt(key2) + parseInt(key3) + parseInt(key4)
    const token = require('crypto').randomBytes(combKey).toString('hex')
    console.log(token);
    const accessToken = jwt.sign(id,token)
    let [results, metadata] = await db.sequelize.query(
        `UPDATE token_access SET token_access = ? WHERE id = ?`,
        {
            replacements: [
                token,
                id,
            ],
        }
    );
    if (metadata.rowCount == 0) {
        res.status(200).send({
            code: "009",
            status: "Failed",
            message: "Gagal, ID yang dimasukan Salah",
            data: null,
        });
    } else {
        res.status(200).send({
            code: "000",
            status: "Success",
            message: "Berhasil Membuat token",
            data: { 
                id: id,
                accessToken: accessToken
            },
        });
    }
}

const masuk = async (req,res) => {
    res.send("Masuk");
}

// Login Admin
const login = async (req, res) => {
    let {user_id, password} = req.body;
    try {
        let Password = encryptStringWithRsaPublicKey(
            password,
            "./utility/privateKey.pem"
        );
        let response = await db.sequelize.query(
            `SELECT * FROM cms_acct_ebpr WHERE user_id = ? AND password = ? AND status != '6'`,
            {
                replacements: [
                    user_id,
                    Password
                ],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!response.length) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Login",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: response,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// Login Admin
const encrypt = async (req, res) => {
    let {password} = req.body;
    try {
        let Password = await encryptStringWithRsaPublicKey(
            password,
            "./utility/privateKey.pem"
        );
        res.status(200).send({
            code: "000",
            status: "ok",
            message: "Success",
            data: Password,
        });
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk tarik product
const get_product = async (req, res) => {
    try {
        let list_produk = await db.sequelize.query(
            `SELECT A.produk_id, A.tipe_produk, A.urut_produk, A.nama_produk, B.produk_prov, B.admin_fee, B.denom, B.prioritas FROM kd_produk AS A INNER JOIN master_produk AS B ON A.produk_id = B.produk_id INNER JOIN produk_owner as C ON C.id_owner = A.id_owner WHERE A.status = '1'`,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!list_produk.length) {
            res.status(200).send({
                code: "011",
                status: "Failed",
                message: "Gagal Menarik Produk",
                data: null,
            });
        } else {
            let pembayaran = []
            let pembelian = []
            for (let i = 0; i < list_produk.length; i++) {
                if (list_produk[i].tipe_produk == "001") {
                    pembayaran.push(list_produk[i])
                } else if (list_produk[i].tipe_produk == "002") {
                    pembelian.push(list_produk[i])
                }
            }
            const payload = {
                pembayaran,
                pembelian
            }
            return res.send(payload)
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk membuat account admin
const register_admin = async (req, res) => {
    let {user_id, bpr_id, user_fullname, password, grup, level, akses} = req.body;
    try {
        let Password = encryptStringWithRsaPublicKey(
            password,
            "./utility/privateKey.pem"
        );
        const pw_expry = moment().add(1, "years").format('YYYYMMDD');
        let [results, metadata] = await db.sequelize.query(
            `INSERT INTO kd_user (user_id, bpr_id, user_fullname, password, pw_expry, grup, level, akses, status) VALUES (?,?,?,?,?,?,?,?,1)`,
            {
                replacements: [
                    user_id, 
                    bpr_id, 
                    user_fullname, 
                    Password,
                    pw_expry,
                    grup, 
                    level, 
                    akses
                ],
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Membuat Akun",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success Membuat Akun",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk blokir account
const block_acct = async (req, res) => {
    let {no_hp, bpr_id} = req.body;
    try {
        let [results, metadata] = await db.sequelize.query(
            `UPDATE acct_ebpr SET 'status_blokir' = '1' WHERE no_hp = ? AND bpr_id = ? AND status = '1'`,
            {
                replacements: [no_hp, bpr_id]
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Memblokir Account eBpr",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success Memblokir Account eBpr",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk buka blokir account
const unlock_acct = async (req, res) => {
    let {no_hp, bpr_id} = req.body;
    try {
        let [results, metadata] = await db.sequelize.query(
            `UPDATE acct_ebpr SET 'status_blokir' = '0', pw_salah = '0', mpin_salah = '0' WHERE no_hp = ? AND bpr_id = ? AND status = '1' AND 'status_blokir' != '0'`,
            {
                replacements: [no_hp, bpr_id],
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Merubah Status Account eBpr",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success Merubah Status Account eBpr",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk create new account eBPR
const registrasi = async (req, res) => {
    let {bpr_id,no_hp,user_id,type_acct,no_ktp,nama,no_rek,nama_rek,email,foto_id,foto_diri} = req.body;
    try {
        let cek_no_hp = await db.sequelize.query(
            `SELECT * FROM acct_ebpr WHERE (no_hp = ? AND bpr_id = ?) AND status != '6'`,
            {
                replacements: [no_hp, bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (cek_no_hp.length > 0) {
            res.status(200).send({
              code: "005",
              status: "Failed",
              message: "No Handphone Sudah Digunakan",
              data: null,
            });
        } else {
            let cek_user_id = await db.sequelize.query(
                `SELECT * FROM acct_ebpr WHERE user_id = ? AND status != '6'`,
                {
                    replacements: [user_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (cek_user_id.length > 0) {
                res.status(200).send({
                code: "005",
                status: "Failed",
                message: "User ID Sudah Terdaftar",
                data: null,
                });
            } else {
                const pw_cetak = make_uniqueid()
                const mpin_cetak = make_mpin()
                let unique_id = moment().format('DDMMYY');
                let cek_unique_id = await db.sequelize.query(
                    `SELECT * FROM acct_ebpr WHERE unique_id LIKE '%${unique_id}%'`,{
                        type: db.sequelize.QueryTypes.SELECT,
                    });
                let run_number = `000${cek_unique_id.length+1}`
                unique_id = `${bpr_id}${unique_id}${run_number.substring(run_number.length-4,run_number.length)}`
                let [results, metadata] = await db.sequelize.query(
                    `INSERT INTO acct_ebpr (unique_id, bpr_id, no_hp, user_id, pw_cetak, mpin_cetak, type_acct, no_ktp, nama, no_rek, nama_rek, email, foto_id, foto_diri, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
                    {
                        replacements: [unique_id, bpr_id, no_hp, user_id, pw_cetak, mpin_cetak, type_acct, no_ktp, nama, no_rek, nama_rek, email, foto_id, foto_diri],
                    }
                );
                if (!metadata) {
                    res.status(200).send({
                    code: "001",
                    status: "Failed",
                    message: "Gagal Mendaftarkan Akun",
                    data: null,
                    });
                } else {
                    res.status(200).send({
                        code: "000",
                        status: "ok",
                        message: "Success Mendaftarkan Akun",
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

// API untuk Print Mailer
const print_mailer = async (req, res) => {
    let {no_hp, bpr_id} = req.body;
    try {
        let response = await db1.sequelize.query(
            `SELECT mpin_cetak, pw_cetak FROM acct_ebpr WHERE no_hp = ? AND bpr_id = ? AND status != '6'`,
            {
                replacements: [user_id, bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!response.length) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Mencetak Mailer",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success Cetak Mailer",
                data: response,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk hapus data setelah berhasil cetak Mailer
const delete_mailer = async (req, res) => {
    let {no_hp, bpr_id} = req.body;
    try {
        let [results, metadata] = await db.sequelize.query(
            `UPDATE acct_ebpr SET mpin_cetak = '', pw_cetak = '' WHERE no_hp = ? AND bpr_id = ? AND status != '6'`,
            {
                replacements: [no_hp, bpr_id],
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal Menghapus Account eBpr",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Sukses Hapus Mailer",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk list BPR
const list_bpr = async (req, res) => {
    try {
        let response = await db.sequelize.query(
            `SELECT * FROM kd_bpr`,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!response.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal Mencari List BPR",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: response,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Mencari ID ATM
const get_atm = async (req, res) => {
    let {terminal_id, bpr_id} = req.body;
    try {
        let response = await db.sequelize.query(
            `SELECT * FROM kd_bpr WHERE bpr_id = ?`,
            {
                replacements: [bpr_id],
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!response.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal Mencari List BPR",
                data: null,
            });
        } else {
            let get_atm = await db.sequelize.query(
                `SELECT atm.bpr_id, nama_bpr, atm_id, nama_atm, lokasi FROM kd_atm AS atm INNER JOIN kd_bpr AS bpr ON atm.bpr_id = bpr.bpr_id WHERE atm_id LIKE ? AND atm.bpr_id = ? AND bpr.status ='1'`,
                {
                    replacements: [`%${terminal_id}`, bpr_id],
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );
            if (!get_atm.length) {
                res.status(200).send({
                    code: "002",
                    status: "Failed",
                    message: "Gagal Mencari ATM",
                    data: null,
                });
            } else {
                res.status(200).send({
                    code: "000",
                    status: "ok",
                    message: "Success",
                    data: get_atm[0],
                });
            }
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Mencari KD Account
const get_kd_acct = async (req, res) => {
    try {
        let response = await db.sequelize.query(
            `SELECT * FROM master_kd_acct`,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!response.length) {
            res.status(200).send({
                code: "002",
                status: "Failed",
                message: "Gagal Mencari KD Account",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: response,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Mengupdate KD Account
const update_kd_acct = async (req, res) => {
    let {keterangan, no_rek, kd_acct} = req.body;
    try {
        let [results, metadata] = await db.sequelize.query(
            `UPDATE master_kd_acct SET keterangan = ?, no_rek = ? WHERE kd_acct = ?`,
            {
                replacements: [keterangan, no_rek, kd_acct],
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Update Master KD Account!!!",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

// API untuk Menambah KD Account
const insert_kd_acct = async (req, res) => {
    let {keterangan, no_rek, kd_acct} = req.body;
    try {
        let [results, metadata] = await db.sequelize.query(
            `INSERT INTO master_kd_acct (keterangan, no_rek, kd_acct, gl_jns) VALUES (?,?,?,2)`,
            {
                replacements: [keterangan, no_rek, kd_acct],
            }
        );
        if (!metadata) {
            res.status(200).send({
                code: "001",
                status: "Failed",
                message: "Gagal, Terjadi Kesalahan Update Master KD Account!!!",
                data: null,
            });
        } else {
            res.status(200).send({
                code: "000",
                status: "ok",
                message: "Success",
                data: null,
            });
        }
    } catch (error) {
      //--error server--//
      console.log("erro get product", error);
      res.send(error);
    }
};

module.exports = {
    token_access,
    masuk,
    login,
    encrypt,
    register_admin,
    block_acct,
    unlock_acct,
    registrasi,
    print_mailer,
    delete_mailer,
    get_product,
    list_bpr,
    get_atm,
    get_kd_acct,
    update_kd_acct,
    insert_kd_acct,
};
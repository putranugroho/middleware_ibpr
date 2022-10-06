const express = require("express");
const { login,
    register_admin,
    block_acct,
    unlock_acct,
    registrasi,
    print_mailer,
    delete_mailer,
    list_bpr,
    get_product } = require("../controller/middleware");
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router();
const db = require("../connection"); 

// __dirname: alamat folder file userRouter.js
const rootdir = path.join(__dirname,'/..')
const photosuser = path.join(rootdir, '/images/bpr')

const folder = multer.diskStorage(
    {
        destination: function (req, file, cb){
            cb(null, photosuser)
        },
        filename: function (req, file, cb){
            // Waktu upload, nama field, extension file
            cb(null, Date.now() + file.fieldname + path.extname(file.originalname))
        }
    }
)

const upstore = multer(
    {
        storage: folder,
        limits: {
            fileSize: 1000000 // Byte , default 1MB
        },
        fileFilter(req, file, cb) {
            if(!file.originalname.match(/\.(jpg|jpeg|png)$/)){ // will be error if the extension name is not one of these
                return cb(new Error('Please upload image file (jpg, jpeg, or png)')) 
            }
    
            cb(undefined, true)
        }
    }
)

router.post("/login", login);
router.post("/register/admin", register_admin);
router.post("/block", block_acct);
router.post("/unlock", unlock_acct);
router.post("/registrasi/ebpr", registrasi);
router.post("/print", print_mailer);
router.get("/product", get_product)
router.get("/list_bpr", list_bpr);
// router.post("/delete_mailer", delete_mailer);

router.post('/upload', upstore.single('logo'), async (req, res) => {
    let filename =`https://gw-dev.medtrans.id/mdw/view/${req.file.filename}`
    
    
    let [results, metadata] = await db.sequelize.query(
        `UPDATE kd_bpr SET bpr_logo = ? WHERE bpr_id = '${req.body.bpr_id}'`,
        {
            replacements: [filename]
        }
    );
    if (!metadata) {
        res.status(200).send({
            code: "003",
            status: "ok",
            message: "Gagal Mengupload Logo",
            data: null,
        });
    } else {
        res.send({
            message: 'Upload berhasil',
            filename
        })
    }
})

router.get('/view/:logo', (req, res) => {
    const options = {
        root: photosuser
    }

    const fileName = req.params.logo

    res.sendFile(fileName, options, function(err){
        if(err) return res.send(err)

    })

})

// API untuk mencari BPR
router.get("/bpr/:bpr_id", async (req,res)=>{
    let {bpr_id} = req.params
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
                code: "001",
                status: "ok",
                message: "Gagal BPR Tidak Ditemukan",
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
})

module.exports = router;
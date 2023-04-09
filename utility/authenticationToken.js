let jwt = require("jsonwebtoken");
const db = require("../connection");

const VerifyToken = async (req, res, next) => {
    try {
        if (!req.get("Authorization"))
        return res.status(200).send({
            code: "E97",
            status: "error",
            message: "No token provided!",
            data: null,
        });

        let token_access = await db.sequelize.query(
            `SELECT * FROM token_access WHERE id = 'oy'`,
            {
                type: db.sequelize.QueryTypes.SELECT,
            }
        );
        if (!token_access.length) {
            res.status(200).send({
                code: "009",
                status: "Failed",
                message: "Gagal, Middleware Accces Token Tidak Ditemukan",
                data: null,
            });
        } else {
            const token = req.get("Authorization").split(" ")[1];
            let FindKey = [req.body, req.query];
            // console.log(token, "756be516");
            jwt.verify(token, token_access[0].token_access, async (err, payload) => {
                try {
                    if (err) {
                        //--Error JWT--//
                        console.log("Errro JWT Verify Access Token", err.message);
            
                        res.status(200).send({
                        code: "E98",
                        status: "error",
                        message: "Unauthorized!",
                        data: null,
                        });
                        //----//
                    } else {
                        console.log("payload");
                        console.log(payload);
                        next();
                    }
                } catch (error) {
                    console.log("error verify", error);
                    res.status(200).send({
                    code: "E99",
                    status: "error",
                    message: "failed",
                    data: null,
                    });
                }
            })
        }
    } catch (error) {
        console.log("Error Middleware AcccesToken", error.message);
        res.status(200).send({
        code: "E99",
        status: "error",
        message: "failed",
        data: error.message,
        });
    }
    
};

module.exports = {
    VerifyToken,
};

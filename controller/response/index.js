const db = require("../../connection");

const send_log = async (data, response) => {
        let text = `
        text1 = ${response.text1}
        text2 = ${response.text2}
        text3 = ${response.text3}
        text4 = ${response.text4}
        text5 = ${response.text5}
        text6 = ${response.text6}
        text7 = ${response.text7}
        text8 = ${response.text8}
        text9 = ${response.text9}
        text10 = ${response.text10}
        text11 = ${response.text11}
        text12 = ${response.text12}
        text13 = ${response.text13}
        text14 = ${response.text14}
        text15 = ${response.text15}
        text16 = ${response.text16}
        text17 = ${response.text17}
        text18 = ${response.text18}
        text19 = ${response.text19}
        text20 = ${response.text20}`
        console.log(text);
        let [results, metadata] = await db.sequelize.query(
            `INSERT INTO log_transaksi(nokartu, waktu, kodetrx, jumlahtx, otp, pin, tid, terminalid, jenistx, jumlah_tx, kode_trx, no_kartu, tid_, rcode, message, text1, message_type, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'${text}','RESPONSE','0')`,
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
                response.jumlahtx,
                response.kodetrx,
                response.nokartu,
                response.tid,
                response.rcode,
                response.message
              ],
            }
        );
    // }
}

const error_response = async (data, response, jumlahtx, text1, text2, text3, text4, text5, text6, text7, text8, text9, text10, text11, text12, text13, text14, rcode, message) => {
    response["jumlahtx"] = jumlahtx
    response["kodetrx"] = data.KODETRX
    response["nokartu"] = data.NOKARTU
    response["tid"] = data.TID
    response["text1"] = text1
    response["text2"] = text2
    response["text3"] = text3
    response["text4"] = text4
    response["text5"] = text5
    response["text6"] = text6
    response["text7"] = text7
    response["text8"] = text8
    response["text9"] = text9
    response["text10"] = text10
    response["text11"] = text11
    response["text12"] = text12
    response["text13"] = text13
    response["text14"] = text14
    response["text15"] = null
    response["text16"] = null
    response["text17"] = null
    response["text18"] = null
    response["text19"] = null
    response["text20"] = null
    response['rcode'] = rcode
    response['message'] = message

    return response
}

module.exports = {
    send_log,
    error_response,
};
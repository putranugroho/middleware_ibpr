const db = require("../connection");

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
      data_trans = `${detail_trans.nama_rek} ${detail_trans.no_hp}`
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
  let [res_pokok, meta_pokok] = await db.sequelize.query(
      `UPDATE gl_trans_core SET gl_debet = gl_debet + ?, saldo_akhir = saldo_akhir - ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
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
      `UPDATE gl_trans_core SET gl_debet = gl_debet + ?, saldo_akhir = saldo_akhir - ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
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
  let nominal = amount + trans_fee
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
          `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
          nominal,
          0,
          detail_trans.rrn,
          detail_trans.status,
          detail_trans.tcode
      ],
      }
  );
  if (meta_pokok && meta_fee) {
      return true
  } else {
      return false
  }
}

async function update_gl_oy_db_cr(data_db,data_cr,detail_trans) {
  let [res_pokok_db, meta_pokok_db] = await db.sequelize.query(
      `UPDATE gl_trans_core SET gl_debet = gl_debet + ?, saldo_akhir = saldo_akhir - ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
      {
      replacements: [
          data_db.amount,
          data_db.amount,
          data_db.bpr_id,
          data_db.trx_code,
          data_db.no_rek_pokok,
          data_db.nama_rek_pokok
      ],
      }
  );
  let [res_fee_db, meta_fee_db] = await db.sequelize.query(
      `UPDATE gl_trans_core SET gl_debet = gl_debet + ?, saldo_akhir = saldo_akhir - ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
      {
      replacements: [
          data_db.trans_fee,
          data_db.trans_fee,
          data_db.bpr_id,
          data_db.trx_code,
          data_db.no_rek_fee,
          data_db.nama_rek_fee
      ],
      }
  );
  let [res_pokok_cr, meta_pokok_cr] = await db.sequelize.query(
      `UPDATE gl_trans_core SET gl_kredit = gl_kredit + ?, saldo_akhir = saldo_akhir + ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
      {
      replacements: [
          data_cr.amount,
          data_cr.amount,
          data_cr.bpr_id,
          data_cr.trx_code,
          data_cr.no_rek_pokok,
          data_cr.nama_rek_pokok
      ],
      }
  );
  let [res_fee_cr, meta_fee_cr] = await db.sequelize.query(
      `UPDATE gl_trans_core SET gl_kredit = gl_kredit + ?, saldo_akhir = saldo_akhir + ? WHERE bpr_id = ? AND tcode = ? AND nosbb = ? AND nmsbb = ?`,
      {
      replacements: [
          data_cr.trans_fee,
          data_cr.trans_fee,
          data_cr.bpr_id,
          data_cr.trx_code,
          data_cr.no_rek_fee,
          data_cr.nama_rek_fee
      ],
      }
  );
  if (detail_trans.trans_type == "On-Us" || detail_trans.trans_type == "Issuer" ) {
    let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
        `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        {
        replacements: [
            data_db.no_rek_pokok,
            data_db.bpr_id,
            data_db.trx_code,
            detail_trans.trx_type,
            detail_trans.tgl_trans,
            detail_trans.keterangan,
            `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
            data_db.amount,
            0,
            detail_trans.rrn,
            detail_trans.status,
            detail_trans.tcode
        ],
        }
    );
    if (data_db.trans_fee !== 0) {
        let [res_log_fee_db, meta_log_fee_db] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                data_db.no_rek_fee,
                data_db.bpr_id,
                data_db.trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
                data_db.trans_fee,
                0,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
    let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
        `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        {
        replacements: [
            data_cr.no_rek_pokok,
            data_cr.bpr_id,
            data_cr.trx_code,
            detail_trans.trx_type,
            detail_trans.tgl_trans,
            detail_trans.keterangan,
            `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
            0,
            data_cr.amount,
            detail_trans.rrn,
            detail_trans.status,
            detail_trans.tcode
        ],
        }
    );
    if (data_cr.trans_fee !== 0) {
        let [res_log_fee_cr, meta_log_fee_cr] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                data_cr.no_rek_fee,
                data_cr.bpr_id,
                data_cr.trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
                0,
                data_cr.trans_fee,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
  } else if (detail_trans.trans_type == "Acquirer" ) {
      let data_trans
      if (detail_trans.status == "R") {
          data_trans = `${detail_trans.nama_rek} ${detail_trans.bpr_id}-${detail_trans.no_hp}`
      } else {
          data_trans = `${detail_trans.nama_rek} ${data_db.bpr_id}-${detail_trans.no_hp}`
      }
    let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
        `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        {
        replacements: [
            data_db.no_rek_pokok,
            data_db.bpr_id,
            data_db.trx_code,
            detail_trans.trx_type,
            detail_trans.tgl_trans,
            detail_trans.keterangan,
            data_trans,
            data_db.amount,
            0,
            detail_trans.rrn,
            detail_trans.status,
            detail_trans.tcode
        ],
        }
    );
    if (data_db.trans_fee !== 0) {
        let [res_log_fee_db, meta_log_fee_db] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                data_db.no_rek_fee,
                data_db.bpr_id,
                data_db.trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                data_trans,
                data_db.trans_fee,
                0,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
    let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
        `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        {
        replacements: [
            data_cr.no_rek_pokok,
            data_cr.bpr_id,
            data_cr.trx_code,
            detail_trans.trx_type,
            detail_trans.tgl_trans,
            detail_trans.keterangan,
            data_trans,
            0,
            data_cr.amount,
            detail_trans.rrn,
            detail_trans.status,
            detail_trans.tcode
        ],
        }
    );
    if (data_cr.trans_fee !== 0) {
        let [res_log_fee_cr, meta_log_fee_cr] = await db.sequelize.query(
            `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            {
            replacements: [
                data_cr.no_rek_fee,
                data_cr.bpr_id,
                data_cr.trx_code,
                detail_trans.trx_type,
                detail_trans.tgl_trans,
                detail_trans.keterangan,
                data_trans,
                0,
                data_cr.trans_fee,
                detail_trans.rrn,
                detail_trans.status,
                detail_trans.tcode
            ],
            }
        );
    }
  }
//   if (data_db.no_rek_pokok === "101208") {
//       const nominal = data_db.amount + data_db.trans_fee
//       let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
//           `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           {
//           replacements: [
//               data_db.no_rek_pokok,
//               data_db.bpr_id,
//               data_db.trx_code,
//               detail_trans.trx_type,
//               detail_trans.tgl_trans,
//               detail_trans.keterangan,
//               `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
//               nominal,
//               0,
//               detail_trans.rrn,
//               detail_trans.status,
//               detail_trans.tcode
//           ],
//           }
//       );
//   } else {
//       let [res_log_pokok_db, meta_log_pokok_db] = await db.sequelize.query(
//           `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           {
//           replacements: [
//               data_db.no_rek_pokok,
//               data_db.bpr_id,
//               data_db.trx_code,
//               detail_trans.trx_type,
//               detail_trans.tgl_trans,
//               detail_trans.keterangan,
//               `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
//               data_db.amount,
//               0,
//               detail_trans.rrn,
//               detail_trans.status,
//               detail_trans.tcode
//           ],
//           }
//       );
//       if (data_db.trans_fee !== 0) {
//           let [res_log_fee_db, meta_log_fee_db] = await db.sequelize.query(
//               `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//               {
//               replacements: [
//                   data_db.no_rek_fee,
//                   data_db.bpr_id,
//                   data_db.trx_code,
//                   detail_trans.trx_type,
//                   detail_trans.tgl_trans,
//                   detail_trans.keterangan,
//                   `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
//                   data_db.trans_fee,
//                   0,
//                   detail_trans.rrn,
//                   detail_trans.status,
//                   detail_trans.tcode
//               ],
//               }
//           );
//       }
//   }
//   if (data_cr.no_rek_pokok === "101209") {
//       const nominal = data_cr.amount + data_cr.trans_fee
//       let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
//           `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           {
//           replacements: [
//               data_cr.no_rek_pokok,
//               data_cr.bpr_id,
//               data_cr.trx_code,
//               detail_trans.trx_type,
//               detail_trans.tgl_trans,
//               detail_trans.keterangan,
//               `${detail_trans.nama_rek} ${detail_trans.no_hp}`,
//               0,
//               nominal,
//               detail_trans.rrn,
//               detail_trans.status,
//               detail_trans.tcode
//           ],
//           }
//       );
//   } else {
//       let [res_log_pokok_cr, meta_log_pokok_cr] = await db.sequelize.query(
//           `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           {
//           replacements: [
//               data_cr.no_rek_pokok,
//               data_cr.bpr_id,
//               data_cr.trx_code,
//               detail_trans.trx_type,
//               detail_trans.tgl_trans,
//               detail_trans.keterangan,
//               `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`,
//               0,
//               data_cr.amount,
//               detail_trans.rrn,
//               detail_trans.status,
//               detail_trans.tcode
//           ],
//           }
//       );
//       if (data_cr.trans_fee !== 0) {
//           let [res_log_fee_cr, meta_log_fee_cr] = await db.sequelize.query(
//               `INSERT INTO log_gateway(nosbb,bpr_id,trx_code,trx_type,tgl_trans,ket_trans,data_trans,amount_db,amount_cr,rrn,status,rcode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//               {
//               replacements: [
//                   data_cr.no_rek_fee,
//                   data_cr.bpr_id,
//                   data_cr.trx_code,
//                   detail_trans.trx_type,
//                   detail_trans.tgl_trans,
//                   detail_trans.keterangan,
//                   `${detail_trans.nama_tujuan} ${detail_trans.rek_tujuan}`,
//                   0,
//                   data_cr.trans_fee,
//                   detail_trans.rrn,
//                   detail_trans.status,
//                   detail_trans.tcode
//               ],
//               }
//           );
//       }
//   }
  if (meta_pokok_db && meta_fee_db && meta_pokok_cr && meta_fee_cr) {
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

module.exports = {
  update_gl_oy_kredit,
  update_gl_oy_debet,
  update_gl_oy_db_cr,
  split_sbb,
};

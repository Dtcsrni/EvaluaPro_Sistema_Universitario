/**
 * tmp-query-templates
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
const mongoose = require("mongoose");
(async () => {
  const uris = [
    "mongodb://127.0.0.1:27017/mern_app",
    "mongodb://localhost:27017/mern_app",
    "mongodb://mongo_local:27017/mern_app"
  ];
  let connected = false;
  for (const uri of uris) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
      console.log("CONNECTED=" + uri);
      connected = true;
      break;
    } catch (e) {
      console.log("FAIL=" + uri + " -> " + (e && e.message ? e.message : e));
    }
  }
  if (!connected) return;
  const coll = mongoose.connection.db.collection("examenesPlantilla");
  const total = await coll.countDocuments({});
  console.log("TOTAL=" + total);
  const sample = await coll.find({}, { projection: { _id: 1, titulo: 1, docenteId: 1, updatedAt: 1 } }).sort({updatedAt:-1}).limit(12).toArray();
  console.log("SAMPLE=" + JSON.stringify(sample));
  const byIdPrefix = await coll.find({ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: "^eabe5272", options: "i" } } }, { projection: { _id:1,titulo:1,docenteId:1,updatedAt:1 } }).toArray();
  console.log("MATCH_ID_PREFIX=" + JSON.stringify(byIdPrefix));
  await mongoose.disconnect();
})();

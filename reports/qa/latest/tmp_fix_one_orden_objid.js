const id = ObjectId('69a6f935c2c6e9f7684be0cc');
const dbx = db.getSiblingDB('mern_app_prod');
const d = dbx.examenesGenerados.findOne({ _id: id }, { preguntasIds: 1 });
if (!d) {
  printjson({ ok: false, error: 'NOT_FOUND' });
} else {
  const r = dbx.examenesGenerados.updateOne(
    { _id: id },
    { $set: { 'mapaVariante.ordenPreguntas': d.preguntasIds } }
  );
  printjson({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
}

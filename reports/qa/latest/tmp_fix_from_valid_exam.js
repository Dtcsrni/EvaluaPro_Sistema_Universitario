const plantillaId = '69a6f849c2c6e9f7684bdfd8';
const assignments = [{"id":"69a6f935c2c6e9f7684be0cc","folio":"07BE7982"},{"id":"69a6f939c2c6e9f7684be0cf","folio":"0E994CBA"},{"id":"69a6f93cc2c6e9f7684be0d2","folio":"503CF7FA"},{"id":"69a6f93fc2c6e9f7684be0d5","folio":"54BC4954"},{"id":"69a6f941c2c6e9f7684be0d8","folio":"5EA00A22"},{"id":"69a6f945c2c6e9f7684be0db","folio":"66BB5FBD"},{"id":"69a6f948c2c6e9f7684be0de","folio":"6A98D91E"},{"id":"69a6f94bc2c6e9f7684be0e1","folio":"75D5292B"},{"id":"69a6f94ec2c6e9f7684be0e4","folio":"A327335F"},{"id":"69a6f951c2c6e9f7684be0ef","folio":"A93D8EFA"},{"id":"69a6f954c2c6e9f7684be0f2","folio":"B0FB153C"},{"id":"69a6f957c2c6e9f7684be0f5","folio":"B8A27B0B"},{"id":"69a6f95bc2c6e9f7684be0f8","folio":"D9881CAA"},{"id":"69a6f95ec2c6e9f7684be0fb","folio":"ECF3E587"},{"id":"69a6f964c2c6e9f7684be0fe","folio":"EEB4EB38"}];
const dbx = db.getSiblingDB('mern_app_prod');

const pool = dbx.examenesGenerados.find({ plantillaId: ObjectId(plantillaId), archivadoEn: null }).toArray();
const source = pool.find((e) => Array.isArray(e.preguntasIds) && e.preguntasIds.length === 50 && e.preguntasIds.every((x) => x && ObjectId.isValid(String(x))));
if (!source) {
  printjson({ ok: false, error: 'NO_SOURCE_CANONICO' });
  quit(2);
}

const canonicalObj = source.preguntasIds.map((x) => ObjectId(String(x)));
const canonicalStr = canonicalObj.map((x) => String(x));

let updated = 0;
for (const a of assignments) {
  const r = dbx.examenesGenerados.updateOne(
    { _id: ObjectId(a.id), plantillaId: ObjectId(plantillaId) },
    {
      $set: {
        folio: String(a.folio).toUpperCase(),
        preguntasIds: canonicalObj,
        'mapaVariante.ordenPreguntas': canonicalStr
      }
    }
  );
  if (r && r.matchedCount === 1) updated += 1;
}

printjson({ ok: true, updated, total: assignments.length, canonical: canonicalStr.length, sourceId: String(source._id) });

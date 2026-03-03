const canonical = ["69a6f92bc2c6e9f7684be05d","69a6f984c2c6e9f7684be115","69a6f984c2c6e9f7684be119","69a6f984c2c6e9f7684be11d","69a6f984c2c6e9f7684be121","69a6f984c2c6e9f7684be125","69a6f984c2c6e9f7684be129","69a6f984c2c6e9f7684be12d","69a6f985c2c6e9f7684be131","69a6f985c2c6e9f7684be135","69a6f985c2c6e9f7684be139","69a6f985c2c6e9f7684be13d","69a6f985c2c6e9f7684be141","69a6f985c2c6e9f7684be145","69a6f985c2c6e9f7684be149","69a6f985c2c6e9f7684be14d","69a6f985c2c6e9f7684be151","69a6f985c2c6e9f7684be155","69a6f985c2c6e9f7684be159","69a6f986c2c6e9f7684be15d","69a6f986c2c6e9f7684be161","69a6f986c2c6e9f7684be165","69a6f986c2c6e9f7684be169","69a6f986c2c6e9f7684be16d","69a6f986c2c6e9f7684be171","69a6f986c2c6e9f7684be175","69a6f986c2c6e9f7684be179","69a6f987c2c6e9f7684be17d","69a6f987c2c6e9f7684be181","69a6f987c2c6e9f7684be185","69a6f987c2c6e9f7684be189","69a6f987c2c6e9f7684be18d","69a6f987c2c6e9f7684be191","69a6f988c2c6e9f7684be195","69a6f988c2c6e9f7684be199","69a6f988c2c6e9f7684be19d","69a6f988c2c6e9f7684be1a1","69a6f988c2c6e9f7684be1a5","69a6f988c2c6e9f7684be1a9","69a6f989c2c6e9f7684be1ad","69a6f989c2c6e9f7684be1b1","69a6f989c2c6e9f7684be1b5","69a6f989c2c6e9f7684be1b9","69a6f989c2c6e9f7684be1bd","69a6f989c2c6e9f7684be1c1","69a6f98ac2c6e9f7684be1c5","69a6f98ac2c6e9f7684be1c9","69a6f98ac2c6e9f7684be1cd","69a6f98ac2c6e9f7684be1d1","69a6f98ac2c6e9f7684be1d5"];
const assignments = [{"id":"69a6f935c2c6e9f7684be0cc","folio":"07BE7982"},{"id":"69a6f939c2c6e9f7684be0cf","folio":"0E994CBA"},{"id":"69a6f93cc2c6e9f7684be0d2","folio":"503CF7FA"},{"id":"69a6f93fc2c6e9f7684be0d5","folio":"54BC4954"},{"id":"69a6f941c2c6e9f7684be0d8","folio":"5EA00A22"},{"id":"69a6f945c2c6e9f7684be0db","folio":"66BB5FBD"},{"id":"69a6f948c2c6e9f7684be0de","folio":"6A98D91E"},{"id":"69a6f94bc2c6e9f7684be0e1","folio":"75D5292B"},{"id":"69a6f94ec2c6e9f7684be0e4","folio":"A327335F"},{"id":"69a6f951c2c6e9f7684be0ef","folio":"A93D8EFA"},{"id":"69a6f954c2c6e9f7684be0f2","folio":"B0FB153C"},{"id":"69a6f957c2c6e9f7684be0f5","folio":"B8A27B0B"},{"id":"69a6f95bc2c6e9f7684be0f8","folio":"D9881CAA"},{"id":"69a6f95ec2c6e9f7684be0fb","folio":"ECF3E587"},{"id":"69a6f964c2c6e9f7684be0fe","folio":"EEB4EB38"}];
const dbx = db.getSiblingDB('mern_app_prod');
let updated = 0;
for (const a of assignments) {
  const result = dbx.examenesGenerados.updateOne(
    { _id: ObjectId(a.id) },
    {
      $set: {
        folio: String(a.folio).toUpperCase(),
        preguntasIds: canonical.map((id) => ObjectId(id)),
        'mapaVariante.ordenPreguntas': canonical
      }
    }
  );
  if (result && result.matchedCount === 1) updated += 1;
}
printjson({ updated, total: assignments.length, canonical: canonical.length });

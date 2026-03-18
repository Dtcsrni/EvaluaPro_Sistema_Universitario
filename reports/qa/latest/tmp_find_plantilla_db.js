const dbs = ['mern_app_prod','mern_app_dev'];
for (const name of dbs) {
  const dbx = db.getSiblingDB(name);
  const total = dbx.getCollectionNames().includes('examenesPlantilla') ? dbx.examenesPlantilla.countDocuments({ _id: ObjectId('69a6f849c2c6e9f7684bdfd8') }) : -1;
  printjson({ db: name, plantillaExists: total });
}

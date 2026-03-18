const dbs = ['mern_app_prod','mern_app_dev','admin'];
for (const name of dbs) {
  const dbx = db.getSiblingDB(name);
  const total = dbx.getCollectionNames().includes('examenesGenerados') ? dbx.examenesGenerados.countDocuments({ folio: { $in: ['D9881CAA','07BE7982','EEB4EB38'] } }) : -1;
  printjson({ db: name, examenesGeneradosMatchingFolios: total });
}

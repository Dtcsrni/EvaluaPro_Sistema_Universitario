const lote = 'A050929D';
const dbx = db.getSiblingDB('mern_app_prod');
const docs = dbx.examenesGenerados.find({ loteId: lote }).toArray();
print(EJSON.stringify(docs));

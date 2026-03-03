const lote = 'OMRTV3FM26';
const dbx = db.getSiblingDB('mern_app_prod');
const docs = dbx.examenesGenerados.find({ loteId: lote }).toArray();
print(EJSON.stringify(docs));

const dbx = db.getSiblingDB('mern_app_prod');
printjson(dbx.getCollectionNames());

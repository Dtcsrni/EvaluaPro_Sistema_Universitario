const dbx = db.getSiblingDB('mern_app_prod');
printjson(dbx.getCollectionInfos().map((c) => ({ name: c.name, type: c.type })));

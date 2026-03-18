printjson(db.adminCommand({ listDatabases: 1 }).databases.map((d) => d.name));

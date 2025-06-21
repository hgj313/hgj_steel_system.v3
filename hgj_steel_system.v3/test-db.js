const db = require('./database/Database');
(async () => {
  const ok = await db.init();
  console.log('Init result:', ok);
  console.log('DB stats:', db.getStats());
})(); 
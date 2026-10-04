// Using memoryStorage to get the file as a Buffer and upload it directly 
// to Supabase Storage, avoiding temporary files on local disk or Render
const multer = require('multer');

const MAX_FILE_SIZE = 50 * 1024 * 1024; //supabase free

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

module.exports = upload;


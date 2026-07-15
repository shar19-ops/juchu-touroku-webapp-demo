const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5174;

app.use(express.static(path.join(__dirname, 'docs')));

app.listen(PORT, () => {
  console.log(`受注登録メモアプリ起動: http://localhost:${PORT}`);
});

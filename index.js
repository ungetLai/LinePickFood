module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<h1>站台目前正常運行 ✅</h1>`);
  res.status(400).send(`<h1>站台目前運行異常 ❌</h1>`);
};

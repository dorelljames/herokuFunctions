var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var axios      = require("axios");
var app = express();

app.use(bodyParser.json());

app.post('/', function(req, res) {
  const { APP_TOKEN_LIVE } = req.webtaskContext.secrets;

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ name: "Name is required!" });
  }

  axios({
    url: "https://api.heroku.com/apps",
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APP_TOKEN
    },
    data: { name }
  })
    .then(function (response) {
      res.status(201).json(response.data);
    })
    .catch(function (error) {
      res.status(500).json(error);
    });
});

module.exports = Webtask.fromExpress(app);

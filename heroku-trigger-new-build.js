var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var axios      = require("axios");
var app = express();

app.use(bodyParser.json());

app.post('/', function(req, res) {
  const { APP_TOKEN_LIVE } = req.webtaskContext.secrets;

  const { app_id } = req.body;
  if (!app_id) {
    return res.status(400).json({ name: "App ID is required!" });
  }

  axios({
    url: `https://kolkrabbi.heroku.com/apps/${app_id}/github/push`,
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APP_TOKEN
    },
    data: {
      branch: "master"
    }
  })
    .then(function (response) {
      res.status(200).json(response.data);
    })
    .catch(function (error) {
      res.status(500).json(error);
    });
});

module.exports = Webtask.fromExpress(app);

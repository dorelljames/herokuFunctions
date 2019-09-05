var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var axios      = require("axios");
var app = express();

app.use(bodyParser.json());

app.get('/', function(req, res) {
  const { APP_TOKEN_LIVE } = req.webtaskContext.secrets;
  const { app_id } = req.query;
  if (!app_id) {
    return res.status(400).json({ message: "App ID is required to get config variables!" });
  }

  axios({
    url: `https://api.heroku.com/apps/${app_id}/config-vars`,
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APP_TOKEN_LIVE
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

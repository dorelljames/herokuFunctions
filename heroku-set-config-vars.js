var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var axios      = require("axios");
var app = express();

app.use(bodyParser.json());

app.post('/', function(req, res) {
  const { APP_TOKEN } = req.webtaskContext.secrets;
  const { app_id, config_vars } = req.body
  if (!req.body) {
    return res.status(400).json({ name: "Name is required!" });
  }

  axios({
    url: `https://api.heroku.com/apps/${app_id}/config-vars`,
    method: 'PATCH',
    headers: {
      'Accept': 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APP_TOKEN
    },
    data: config_vars
  })
    .then(function (response) {
      res.status(200).json(response.data);
    })
    .catch(function (error) {
      res.status(500).json(error);
    });
});

module.exports = Webtask.fromExpress(app);

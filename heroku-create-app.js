var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var axios      = require("axios");
var app = express();

app.use(bodyParser.json());

app.post('/', function (req, res) {
  const { APP_TOKEN } = req.webtaskContext.secrets;
  const { name } = req.body;

  axios({
    url: "https://api.heroku.com/apps",
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APP_TOKEN
    },
    data: { name }
  })
    .then(function (response) {
      console.log(response);
      res.sendStatus(200);
    })
    .catch(function (error) {
      console.log(error);
      res.sendStatus(500);
    });
});

module.exports = Webtask.fromExpress(app);

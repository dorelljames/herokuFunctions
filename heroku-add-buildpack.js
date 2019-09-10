var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var axios = require('axios');
var app = express();

app.use(bodyParser.json());

function addBuildpacks({ req, res, APP_TOKEN }) {
  const { app_id, buildpack } = req.body;
  if (!app_id) {
    return res
      .status(400)
      .json({ name: 'App ID is required to enable addon!' });
  }

  return axios({
    url: `https://api.heroku.com/apps/${app_id}/buildpack-installations`,
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + APP_TOKEN,
    },
    data: {
      updates: buildpack,
    },
  })
    .then(response => res.status(201).json(response.data))
    .catch(err => res.status(500).json(err));
}

app.post('/', async function(req, res) {
  const { APP_TOKEN } = req.webtaskContext.secrets;

  await addBuildpacks({ req, res, APP_TOKEN });
});

app.post('/LIVE', async function(req, res) {
  const { APP_TOKEN_LIVE: APP_TOKEN } = req.webtaskContext.secrets;

  await addBuildpacks({ req, res, APP_TOKEN });
});

module.exports = Webtask.fromExpress(app);

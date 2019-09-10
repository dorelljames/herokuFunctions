var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var axios = require('axios');
var app = express();

app.use(bodyParser.json());

function addWebhook({ req, res, APP_TOKEN }) {
  const { app_id, url } = req.body;
  if (!app_id || !url) {
    return res
      .status(400)
      .json({ name: 'App ID and URL is required to set webhooks!' });
  }

  return axios({
    url: `https://api.heroku.com/apps/${app_id}/webhooks`,
    method: 'POST',
    headers: {
      Accept: 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + APP_TOKEN,
    },
    data: {
      level: 'sync',
      name: 'notify-webriq-app-for-release',
      include: ['api:release', 'api:build'],
      url,
    },
  })
    .then(response => res.status(201).json(response.data))
    .catch(err => res.status(500).json(err));
}

app.post('/', async function(req, res) {
  const { APP_TOKEN } = req.webtaskContext.secrets;

  await addWebhook({ req, res, APP_TOKEN });
});

app.post('/LIVE', async function(req, res) {
  const { APP_TOKEN_LIVE: APP_TOKEN } = req.webtaskContext.secrets;

  await addWebhook({ req, res, APP_TOKEN });
});

module.exports = Webtask.fromExpress(app);

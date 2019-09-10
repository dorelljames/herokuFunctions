var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var axios = require('axios');
var app = express();

app.use(bodyParser.json());

function connectToGitHub({ req, res, APP_TOKEN }) {
  const { repo_path, app_id } = req.body;
  if (!repo_path || !app_id) {
    return res
      .status(400)
      .json({ name: 'App ID and repo owner with name is required!' });
  }

  return axios({
    url: `https://kolkrabbi.heroku.com/apps/${app_id}/github`,
    method: 'POST',
    headers: {
      Accept: 'application/vnd.heroku+json; version=3',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + APP_TOKEN,
    },
    data: { repo: repo_path },
  })
    .then(response => res.status(200).json(response.data))
    .catch(err => res.status(500).json(err));
}

app.post('/', async function(req, res) {
  const { APP_TOKEN } = req.webtaskContext.secrets;

  await connectToGitHub({ req, res, APP_TOKEN });
});

app.post('/LIVE', async function(req, res) {
  const { APP_TOKEN_LIVE: APP_TOKEN } = req.webtaskContext.secrets;

  await connectToGitHub({ req, res, APP_TOKEN });
});

module.exports = Webtask.fromExpress(app);

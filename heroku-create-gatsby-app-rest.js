var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var axios = require('axios');
var app = express();

app.use(bodyParser.json());

const environment = {
  production: false,
};

const setEnvironment = env => {
  if (env === 'production') {
    return (environment.production = true);
  }
};

async function makeRequest({
  url,
  method = 'POST',
  data,
  delay = 0,
  description = null,
  isLIVE = environment.production,
}) {
  if (delay !== 0) {
    await setTimeout(function() {
      console.log(`Delaying for ${delay} ms`);
    }, delay);
  }

  const requestURL = isLIVE ? url + '/LIVE' : url;
  console.log(requestURL);

  return axios({
    url: requestURL,
    method,
    data,
  })
    .then(response => {
      if (description) {
        console.log(`[INFO]: ${description}`);
      }

      return response;
    })
    .catch(err => {
      if (description) {
        console.log(`[ERROR]: ${description}`);
      }

      return err;
    });
}

async function processRestOfGatsbyHerokuApp({ req, res }) {
  const {
    SET_BUILDPACK_URL,
    SET_ENV_VARS_URL,
    SET_BUILD_WEBHOOKS_URL,
    CONNECT_TO_GITHUB_URL,
    ENABLE_AUTODEPLOYS,
    TRIGGER_NEW_BUILD_URL,
  } = req.webtaskContext.secrets;

  const {
    name,
    repo_path,
    webhook_url,
    config_vars = {},
    heroku_app,
  } = req.body;

  if (!name || !webhook_url || !repo_path || !heroku_app) {
    return res.status(400).json({
      message:
        'App name, webhook_url, repo_path, heroku_app is required to create new Strapi app!',
    });
  }

  // Set environment variables for database
  const heroku_app_set_env_vars = makeRequest({
    url: SET_ENV_VARS_URL,
    data: {
      app_id: heroku_app.id,
      config_vars: {
        ...{
          NODE_ENV: 'development',
          PROCFILE: 'web/Procfile',
        },
        ...config_vars,
      },
    },
    description: `Set environment vaariables for Heroku App ID: ${heroku_app.id}`,
  });

  // Set Buildpacks
  const heroku_app_set_buildpacks = makeRequest({
    url: SET_BUILDPACK_URL,
    data: {
      app_id: heroku_app.id,
      buildpack: [
        {
          buildpack: 'heroku/nodejs',
          ordinal: 0,
        },
        {
          buildpack:
            'https://github.com/heroku/heroku-buildpack-multi-procfile',
        },
      ],
    },
    description: `Set buildpacks needed for Heroku App ID: ${heroku_app.id}`,
  });

  // Add webhook to notify WebriQ App successful build
  const heroku_app_set_webhooks = makeRequest({
    url: SET_BUILD_WEBHOOKS_URL,
    data: {
      app_id: heroku_app.id,
      url: webhook_url,
    },
    description: `Set webhooks needed for Heroku App ID: ${heroku_app.id} to notify WebriQ app for build status`,
  });

  const heroku_app_connect_to_github = makeRequest({
    url: CONNECT_TO_GITHUB_URL,
    data: {
      app_id: heroku_app.id,
      repo_path,
    },
    description: `Connect repository ${repo_path} for continuous deployment of Heroku app`,
    delay: 2500,
  });

  const results = await Promise.all([
    heroku_app_set_env_vars,
    heroku_app_set_webhooks,
    heroku_app_set_buildpacks,
    heroku_app_connect_to_github,
  ]);

  // Set automatic deploy
  const heroku_app_enable_autodeploys = makeRequest({
    url: ENABLE_AUTODEPLOYS,
    data: {
      app_id: heroku_app.id,
    },
    description: `Enable automatic deployment of ${repo_path} for new commits pushed to repository`,
  });

  // Begin deploy master branch
  const heroku_trigger_new_build = makeRequest({
    url: TRIGGER_NEW_BUILD_URL,
    data: {
      app_id: heroku_app.id,
    },
    description: `Trigger new build for Heroku App ID: ${heroku_app.id} `,
  });

  return res.status(201).json({
    message:
      'Successfully processed necessary configurations for  Gatsby app on Heroku to build!',
    data: heroku_app.data,
  });
}

app.post('/LIVE', async function(req, res) {
  setEnvironment('production');
  await processRestOfGatsbyHerokuApp({ req, res });
});

app.post('/', async function(req, res) {
  await processRestOfGatsbyHerokuApp({ req, res });
});

module.exports = Webtask.fromExpress(app);

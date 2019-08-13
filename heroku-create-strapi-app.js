var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var axios = require('axios');
var app = express();

app.use(bodyParser.json());

app.post('/', async function(req, res) {
  const {
    CREATE_APP_URL,
    ENABLE_ADDON_URL,
    SET_ENV_VARS_URL,
    GET_ENV_VARS_URL,
    SET_BUILD_WEBHOOKS_URL,
    CONNECT_TO_GITHUB_URL,
    ENABLE_AUTODEPLOYS,
    TRIGGER_NEW_BUILD_URL,
  } = req.webtaskContext.secrets;
  const { name, repo_path } = req.body;
  if (!name || !repo_path) {
    return res
      .status(400)
      .json({ name: 'App name and repo_path are required to create new Strapi app!' });
  }

  let heroku_app,
    heroku_app_get_env_vars,
    heroku_app_set_env_vars,
    heroku_app_set_webhooks,
    heroku_app_connect_to_github,
    heroku_app_enable_autodeploys;

  // Create new web app on Heroku
  try {
    heroku_app = await axios({
      url: CREATE_APP_URL,
      method: 'POST',
      data: {
        name,
      },
    });
  } catch (err) {
    return res.status(500).json(err);
  }

  // Add mLab addon for database
  try {
    await axios({
      url: ENABLE_ADDON_URL,
      method: 'POST',
      data: {
        app_id: heroku_app.data.id,
      },
    });
  } catch (err) {
    return res.status(500).json(err);
  }
  // heroku_app = {
  //   data: {
  //     id: 'b418a9e7-19a7-40c1-aad7-964e81aaa072',
  //   },
  // };

  // Get environment variables
  try {
    heroku_app_get_env_vars = await axios.get(GET_ENV_VARS_URL, {
      params: {
        app_id: heroku_app.data.id,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Unable to get environment variables', error: err });
  }

  // Set environment variables for database
  try {
    heroku_app_set_env_vars = axios({
      url: SET_ENV_VARS_URL,
      method: 'POST',
      data: {
        app_id: heroku_app.data.id,
        config_vars: {
          DATABASE_AUTHENTICATION_DATABASE: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')
            .pop(),
          DATABASE_HOST: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')[2]
            .split('@')
            .pop()
            .split(':')[0],
          DATABASE_NAME: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')
            .pop(),
          DATABASE_PASSWORD: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')[2]
            .split('@')[0]
            .split(':')
            .pop(),
          DATABASE_PORT: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')[2]
            .split('@')
            .pop()
            .split(':')
            .pop(),
          DATABASE_USERNAME: heroku_app_get_env_vars.data.MONGODB_URI
            .split('/')[2]
            .split('@')[0]
            .split(':')[0],
        },
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Unable to set environment variables', error: err });
  }

  // Add webhook to notify WebriQ App successful build
  try {
    heroku_app_set_webhooks = axios({
      url: SET_BUILD_WEBHOOKS_URL,
      method: 'POST',
      data: {
        app_id: heroku_app.data.id,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Unable to set webhooks for build result',
      error: err,
    });
  }

  // App connect to GitHub
  try {
    heroku_app_connect_to_github = axios({
      url: CONNECT_TO_GITHUB_URL,
      method: 'POST',
      data: {
        app_id: heroku_app.data.id,
        repo_path,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Unable to connect to GitHub for app',
      error: err,
    });
  }

  Promise.all([
    heroku_app_set_env_vars,
    heroku_app_set_webhooks,
    heroku_app_connect_to_github,
  ]).then(async results => {
    // Set automatic deploy
    try {
      heroku_app_enable_autodeploys = await axios({
        url: ENABLE_AUTODEPLOYS,
        method: 'POST',
        data: {
          app_id: heroku_app.data.id,
        },
      });
    } catch (err) {
      return res.status(500).json({
        message: 'Unable to connect to enable autodeploys',
        error: err,
      });
    }

    // Begin deploy master branch
    try {
      heroku_app_enable_autodeploys = await axios({
        url: TRIGGER_NEW_BUILD_URL,
        method: 'POST',
        data: {
          app_id: heroku_app.data.id,
        },
      });
    } catch (err) {
      return res.status(500).json({
        message: 'Unable to connect to trigger new build',
        error: err,
      });
    }

    return res.json({ message: 'Successfully created Strapi app!' });
  });
});

module.exports = Webtask.fromExpress(app);

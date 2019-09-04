var express = require("express");
var Webtask = require("webtask-tools");
var bodyParser = require("body-parser");
var Promise = require("bluebird");
var axios = require("axios");
var app = express();

app.use(bodyParser.json());

app.post("/", async function(req, res) {
  const {
    CREATE_APP_URL,
    ENABLE_ADDON_URL,
    SET_BUILDPACK_URL,
    SET_ENV_VARS_URL,
    SET_BUILD_WEBHOOKS_URL,
    CONNECT_TO_GITHUB_URL,
    ENABLE_AUTODEPLOYS,
    TRIGGER_NEW_BUILD_URL,
    CLONE_REPO_TEMPLATE_URL,
    CLONE_REPO_TEMPLATE_OWNER,
    CLONE_REPO_TEMPLATE_REPO_PATH
  } = req.webtaskContext.secrets;

  const { name, webhook_url, config_vars = {} } = req.body;
  if (!name || !webhook_url || !config_vars) {
    return res.status(400).json({
      message:
        "App name, webhook_url, config_vars is required to create new Strapi app!"
    });
  }

  try {
    cloned_github_repo = await axios({
      url: CLONE_REPO_TEMPLATE_URL,
      method: "POST",
      data: {
        new_repo_name: req.body.name,
        new_repo_owner: CLONE_REPO_TEMPLATE_OWNER,
        repo_template_path: CLONE_REPO_TEMPLATE_REPO_PATH
      }
    });
  } catch (err) {
    return res.status(500).json(err);
  }

  // Create new web app on Heroku
  try {
    heroku_app = await axios({
      url: CREATE_APP_URL,
      method: "POST",
      data: {
        name
      }
    });
  } catch (err) {
    return res.status(500).json(err);
  }

  // heroku_app = {
  //   data: {
  //     id: 'b418a9e7-19a7-40c1-aad7-964e81aaa072',
  //   },
  // };

  // Set environment variables for database
  try {
    heroku_app_set_env_vars = axios({
      url: SET_ENV_VARS_URL,
      method: "POST",
      data: {
        app_id: heroku_app.data.id,
        config_vars: {
          ...{
            NODE_ENV: "development",
            PROCFILE: "web/Procfile"
          },
          ...config_vars
        }
      }
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Unable to set environment variables", error: err });
  }

  // Set Buildpacks
  try {
    heroku_app_set_buildpacks = axios({
      url: SET_BUILDPACK_URL,
      method: "POST",
      data: {
        app_id: heroku_app.data.id,
        buildpack: [
          {
            buildpack: "heroku/nodejs",
            ordinal: 0
          },
          {
            buildpack: "https://github.com/heroku/heroku-buildpack-multi-procfile"
          }
        ]
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: "Unable to set buildpack needed for this app!",
      error: err
    });
  }

  // Add webhook to notify WebriQ App successful build
  try {
    heroku_app_set_webhooks = axios({
      url: SET_BUILD_WEBHOOKS_URL,
      method: "POST",
      data: {
        app_id: heroku_app.data.id,
        url: webhook_url
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: "Unable to set webhooks for build result",
      error: err
    });
  }

  // App connect to GitHub
  try {
    heroku_app_connect_to_github = new Promise((resolve, reject) => {
      let data;
      try {
        data = {
          app_id: heroku_app.data.id,
          repo_path:
            cloned_github_repo.data.data.cloneTemplateRepository.repository
              .nameWithOwner
        };
      } catch (err) {
        console.log("Something went wrong preparing data!", err);
      }

      setTimeout(function() {
        axios({
          url: CONNECT_TO_GITHUB_URL,
          method: "POST",
          data
        })
          .then(response => resolve(response))
          .catch(err => reject(err));
      }, 2500);
    });
  } catch (err) {
    return res.status(500).json({
      message: "Unable to connect to GitHub for app",
      error: err
    });
  }

  Promise.all([
    heroku_app_set_env_vars,
    heroku_app_set_webhooks,
    heroku_app_set_buildpacks,
    heroku_app_connect_to_github
  ]).then(async results => {
    // Set automatic deploy
    try {
      heroku_app_enable_autodeploys = await axios({
        url: ENABLE_AUTODEPLOYS,
        method: "POST",
        data: {
          app_id: heroku_app.data.id
        }
      });
    } catch (err) {
      return res.status(500).json({
        message: "Unable to connect to enable autodeploys",
        error: err
      });
    }

    // Begin deploy master branch
    try {
      heroku_app_enable_autodeploys = await axios({
        url: TRIGGER_NEW_BUILD_URL,
        method: "POST",
        data: {
          app_id: heroku_app.data.id
        }
      });
    } catch (err) {
      return res.status(500).json({
        message: "Unable to trigger new build",
        error: err
      });
    }

    return res.status(201).json({
      message: "Successfully created Gatsby app on Heroku!",
      data: heroku_app.data
    });
  });
});

module.exports = Webtask.fromExpress(app);

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
    console.log('[INFO] Running in production mode...');
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
        console.log(`[ERROR_RESULT]: ${err}`);
      }

      return err;
    });
}

async function createHerokuAppEntry({ req, res }) {
  const {
    CREATE_APP_URL,
    PROCESS_REST_OF_HEROKU_GATSBY_APP_URL,
  } = req.webtaskContext.secrets;

  const { name, repo_path, webhook_url } = req.body;
  if (!name || !webhook_url || !repo_path) {
    return res.status(400).json({
      message:
        'App name, webhook_url, repo_path is required to create new Strapi app!',
    });
  }

  // Create new web app on Heroku
  const heroku_app = await makeRequest({
    url: CREATE_APP_URL,
    method: 'POST',
    data: {
      name,
    },
    description: 'Creating Heroku app',
  }).catch(err => {
    res.status(500).json({ err, message: 'Unable to create Heroku app!' })
    return;
  });

  console.log('heroku_app', heroku_app);

  // Send request to process app
  makeRequest({
    url: PROCESS_REST_OF_HEROKU_GATSBY_APP_URL,
    data: {
      ...req.body,
      heroku_app: heroku_app.data,
    },
  })
    .then(result => console.log('done successfully!'))
    .catch(err => console.log(err));

  return res.status(201).json({
    message: 'Successfully created Gatsby app on Heroku!',
    data: heroku_app && heroku_app.data,
  });
}

app.post('/LIVE', async function(req, res) {
  setEnvironment('production');
  await createHerokuAppEntry({ req, res });
});

app.post('/', async function(req, res) {
  await createHerokuAppEntry({ req, res });
});

module.exports = Webtask.fromExpress(app);

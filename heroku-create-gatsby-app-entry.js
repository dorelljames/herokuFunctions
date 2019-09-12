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
  label,
  description = null,
  isLIVE = environment.production,
}) {
  if (delay !== 0) {
    await setTimeout(function() {
      console.log(`Delaying for ${delay} ms`);
    }, delay);
  }

  const requestURL = isLIVE ? url + '/LIVE' : url;
  const { sandbox_request, webriq_sandbox_webhook_url } = data;

  return axios({
    url: requestURL,
    method,
    data,
  })
    .then(response => {
      if (description) {
        console.log(`[INFO]: ${description}`);
      }

      if (webriq_sandbox_id && webriq_sandbox_webhook_url) {
        axios
          .post(webriq_sandbox_webhook_url, {
            source: 'webtask',
            type: 'sandbox_creation',
            webriq_sandbox_id: data && data.webriq_sandbox_id,
            label,
            description,
            provider: 'heroku',
            request: {
              url: requestURL,
              method,
              data,
              result: 'success',
              log: '',
            },
          })
          .then(response => console.log('Successfuly sent request log!'))
          .catch(err =>
            console.log('Something went wrong sending successful request log!')
          );
      }

      return response;
    })
    .catch(err => {
      if (description) {
        console.log(`[ERROR]: ${description}`);
      }

      if (webriq_sandbox_id && webriq_sandbox_webhook_url) {
        axios
          .post(webriq_sandbox_webhook_url, {
            source: 'webtask',
            type: 'sandbox_creation',
            webriq_sandbox_id: data && data.webriq_sandbox_id,
            label,
            description,
            provider: 'heroku',
            request: {
              url: requestURL,
              method,
              data,
              result: 'error',
              log: '',
            },
          })
          .then(response => console.log('Successfuly sent error request log!'))
          .catch(err =>
            console.log('Something went wrong sending error request log!')
          );
      }

      return err;
    });
}

async function createHerokuAppEntry({ req, res }) {
  const {
    CREATE_APP_URL,
    PROCESS_REST_OF_HEROKU_GATSBY_APP_URL,
  } = req.webtaskContext.secrets;

  const { name, repo_path, webhook_url, webriq_sandbox_id } = req.body;
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
      webriq_sandbox_id,
    },
    label: "HEROKU_CREATE_NEW_APP",
    description: 'Creating Heroku app',
  });

  // Send request to process app
  makeRequest({
    url: PROCESS_REST_OF_HEROKU_GATSBY_APP_URL,
    data: {
      ...req.body,
      heroku_app: heroku_app.data,
    },
    label: "PROCESS_REST_OF_HEROKU_GATSBY_APP"
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

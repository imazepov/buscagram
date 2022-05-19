import AWS from 'aws-sdk';
import { TELEGRAM_CREDS } from 'common';
import DynamoDBStore from 'dynamodb-store';
import express from 'express';
import session from 'express-session';
import serverless from 'serverless-http';
import { tl } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CurrentUserRequest, CurrentUserResponse, SendCodeRequest, SendCodeResponse, SignInRequest, SignInResponse } from 'web-common';
import { wrapHandler } from './api';
import { channelRoutes } from './channels';
import { DAO } from './dao';
import { UserSession } from './types';
import { connectTelegram, errorResponse } from './util';

const app = express();

const dynamoDbClient = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://home-pc:8066',
});
const dao = new DAO(dynamoDbClient);

app.use(express.json());

app.use(session({
  secret: 'blahblah',
  saveUninitialized: true,
  cookie: {
    maxAge: 86400000,
    httpOnly: false,
    secure: false // for normal http connection if https is there we have to set it to true
  },
  resave: false,
  store: new DynamoDBStore({
    table: {
      name: 'HttpSessions',
    },
    dynamoConfig: {
      accessKeyId: 'Fake',
      secretAccessKey: 'Fake',
      region: 'us-east1',
      endpoint: 'http://home-pc:8066',
    },
  }),
}));

app.get('/', async (req, res) => {
  // TBD
  res.status(201);
});

app.get('/current_user', wrapHandler<CurrentUserRequest, CurrentUserResponse>(CurrentUserRequest, async req => {
  console.log(`Cookies: ${JSON.stringify(req.headers.cookie)}`)
  const loggedOutResponse = {
    code: 200,
    response: {
      loggedIn: false,
    },
  };
  if (!req.sessionID) {
    console.log('No session');
    return loggedOutResponse;
  }

  try {
    const userSession = await dao.getUserSessionById(req.sessionID);
    if (!userSession) {
      console.log('Session not found in DDB');
      return loggedOutResponse;
    }
    const session = new StringSession(userSession.tgSession);
    console.log('Session: ' + JSON.stringify(session));
    const client = await connectTelegram(session);
    const user = await client.getMe() as tl.Api.User;
    if (!user) {
      console.log('User null');
      return loggedOutResponse;
    }

    return {
      code: 200,
      response: {
        loggedIn: true,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  } catch (e: any) {
    console.log(`Failed to get current user: ${e}`);
    return errorResponse(e);
  }
}));

app.post('/send_code', wrapHandler<SendCodeRequest, SendCodeResponse>(SendCodeRequest, async req => {
  try {
    const session = new StringSession();
    const client = await connectTelegram(session);
    const result = await client.sendCode(TELEGRAM_CREDS, req.body.phoneNumber);

    const response: SendCodeResponse = {
      isCodeInApp: result.isCodeViaApp,
      phoneCodeHash: result.phoneCodeHash,
      session: session.save(),
    };
    return {
      code: 200,
      response: response,
    };
  } catch (e) {
    console.log(`Failed to send code to ${req.body.phoneNumber}: ${JSON.stringify(e)}`);
    return errorResponse(e);
  }
}));

app.post('/sign_in', wrapHandler<SignInRequest, SignInResponse>(SignInRequest, async req => {
  let user: tl.Api.User;
  const session = new StringSession(req.body.session);
  try {
    const client = await connectTelegram(session);
    const result = await client.invoke(new tl.Api.auth.SignIn({
      phoneNumber: req.body.phoneNumber,
      phoneCodeHash: req.body.phoneCodeHash,
      phoneCode: req.body.phoneCode,
    }));
    if (result instanceof tl.Api.auth.AuthorizationSignUpRequired ||
      result.user instanceof tl.Api.UserEmpty) {
      return {
        code: 401,
        response: { error: 'Phone not signed up for Telegram' },
      };
    }
    user = result.user;
  } catch (e) {
    console.log(`Failed to sign in for ${req.body.phoneNumber}: ${JSON.stringify(e)}`);
    return errorResponse(e);
  }

  const userSession: UserSession = {
    phoneNumber: req.body.phoneNumber,
    sessionId: req.sessionID,
    tgSession: session.save(),
  };

  try {
    await dao.writeUserSession(userSession);
  } catch (e) {
    console.log(`Failed to save session ${req.sessionID}: ${e}`);
    return {
      code: 500,
      response: { error: 'Error saving session' },
    };
  }

  return {
    code: 200,
    response: {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    },
  };
}));

channelRoutes(app, dao);

app.use((req, res, next) => {
  return res.status(404).json({
    error: 'Not Found',
  });
});


module.exports.handler = serverless(app);

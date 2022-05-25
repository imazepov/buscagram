import React, { useState, useEffect } from 'react';
import './App.css';
import { Alert, Button, TextField } from '@mui/material';
import { Box } from '@mui/system';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import axios, { AxiosError } from 'axios';
import { CurrentUserResponse, ErrorResponse, SendCodeRequest, SendCodeResponse, SignInRequest, GetMyChannelsResponse, ChannelViewModel, IndexChannelRequest } from 'web-common';

axios.defaults.withCredentials = true;

enum State {
  START,
  CODE_REQUESTED,
  LOGGED_IN,
}

function App() {
  const [state, setState] = useState(State.START);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [channels, setChannels] = useState([] as ChannelViewModel[]);
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [tgSession, setTgSession] = useState('');

  async function getUserAndChannels() {
    const r1 = await axios.get('/current_user');
    const curUserResp = r1.data as CurrentUserResponse;
    if (curUserResp.loggedIn) {
      setFirstName(curUserResp.firstName!);
      setState(State.LOGGED_IN);

      const r2 = await axios.get('/my_channels');
      const channelsResp = r2.data as GetMyChannelsResponse;
      setChannels(channelsResp.channels);
    }
  }

  useEffect(() => {
    getUserAndChannels()
      .catch(e => console.log('Failed to get current user and channels: ' + e));
  }, []);

  function handleError(e: any) {
    const msg = e instanceof AxiosError && e.response
      ? (e.response.data as ErrorResponse).error
      : e.toString();
    setRemoteError(msg);
  }

  async function sendCode() {
    if (!phoneNumber) {
      setPhoneError('Phone number cannot be empty');
      return;
    }

    const request = new SendCodeRequest();
    request.phoneNumber = phoneNumber;
    const errors = await request.validate();
    if (errors.length > 0) {
      setPhoneError(errors[0]);
      return;
    }
    setPhoneError('');

    setRemoteError('');
    try {
      const r = await axios.post('/send_code', request);
      const response = r.data as SendCodeResponse;
      setPhoneCodeHash(response.phoneCodeHash);
      setTgSession(response.session);

      setState(State.CODE_REQUESTED);
    } catch (e: any) {
      handleError(e);
    }
  }

  async function signIn() {
    if (!phoneCode) {
      setCodeError('Code cannot be empty');
      return;
    }
    setCodeError('');

    const request = new SignInRequest();
    request.phoneNumber = phoneNumber;
    request.phoneCodeHash = phoneCodeHash;
    request.phoneCode = phoneCode;
    request.session = tgSession;

    setRemoteError('');
    try {
      await axios.post('/sign_in', request);
      await getUserAndChannels();
    } catch (e: any) {
      handleError(e);
    }
  }

  async function indexChannel(channel: ChannelViewModel) {
    const request = new IndexChannelRequest();
    request.id = channel.id;
    try {
      await axios.post('/index_channel', request);
      await getUserAndChannels();
    } catch (e: any) {
      handleError(e);
    }
  }

  const form = state === State.LOGGED_IN
    ? <div className="App">
      <div className="App-header">Hello, {firstName}!</div>
      <div className="App-body">
        <p>Your channels:</p>
        <ol>
          {channels.map(c => {
            const indexed = c.isIndexed
              ? 'indexed'
              : <a href="#" onClick={() => indexChannel(c)}>index</a>;
            return <li>{c.name} ({indexed})</li>;
          })}
        </ol>
      </div>
    </div>
    : <div className="App-header">
      <TextField label="Phone" value={phoneNumber}
        disabled={state === State.CODE_REQUESTED}
        error={!!phoneError}
        helperText={phoneError}
        onChange={ev => setPhoneNumber(ev.target.value)} />
      {state === State.CODE_REQUESTED &&
        <TextField label="Code" value={phoneCode}
          error={!!codeError}
          helperText={codeError}
          onChange={ev => setPhoneCode(ev.target.value)} />}
      <Button onClick={state === State.START ? sendCode : signIn}
        variant="contained">
        {state === State.START ? 'Send code' : 'Sign in'}
      </Button>
      {remoteError && <Alert severity="error">{remoteError}</Alert>}
    </div>;

  return (
    <div className="App">
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <Box component="form">
          {form}
        </Box>
      </ThemeProvider>
    </div>
  );
}

export default App;

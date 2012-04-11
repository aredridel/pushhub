# PushHub

A github inspired interface to browse your Git repositories, built on top of [Express](http://github.com/visionmedia/express) and [Pushover](http://github.com/substack/pushover).

## Installation

    npm install pushhub

or

    git clone http://github.com/shinuza/pushhub.git
    cd pushhub
    npm link

## Features

- Github like presentation of your repositories
- Simple and quick set-up
- Automatic remote folder creation
- Command-line setup
- Javascript API
- Git http interface

## Requirements

- Git 1.7.x
- Node.js

## Usage

Pushhub is a pluggable [Express](http://expressjs.com) app, therefore the set-up is very flexible

### A) CLI: using the built-in binary

Pushhub comes with a binary, probably the simplest way to serve your Git repositories
To get the `pushhub` command, make sure to install with the `-g` flag:

    npm install pushhub -g

And then

    pushhub --port 3000 --host localhost --directory ~/repos

point your browser to [http://localhost:3000/](http://localhost:3000/) to see your repositories.

**Note**: PushHub is compatible with [forever](http://github.com/nodejitsu/forever)

### B) JS API:

First run

    npm install pushhub

Then in `app.js`

```js
var pushhub = require('pushhub');
pushhub.set('git root', __dirname); // You will find a list of available settings below
pushhub.listen(3000);
```

And then

    node app.js


**Note**: PushHub is compatible with [up](http://github.com/LearnBoost/up)

### C) JS API: With an existing `Express` app

You can also use PushHub in an existing Express app. Let's say you already have a website at `http://localhost` and blog at `http://localhost/blog/`, you can mount PushHub to `http:/localhost/git` by doing the following.

In `app.js`

```js
var express = require('express');
var pushhub = require('pushhub');
var app = express.createServer();

// ...

app.use('/git', pushhub);
app.listen(3000);
```

And then

    node app.js


## Settings

### A) CLI

**Usage: pushhub [options]**

The `pushhub` command accepts the following options:

- `-p`/`--port`

  - the port to listen on.
  - Defaults to `3000`.

- `-h`/`--host`

  - the host to listen on.
  - Defaults to `localhost`.

- `-d`/`--directory`

  - the directory containing your git repositories.
  - Defaults to `cwd`. **The node process needs read/write access to this directory**

### B) JS API

PushHub being an Express application, it can be configured with [app.set(name[, val])](http://expressjs.com/guide.html#app.set\(\))

Here is a list of the relevant options:

- `git root`

  - the directory containing your git repositories.
  - Defaults to `process.cwd()`.

- `history by page`

  - the number of commits to display on a commit history page
  - Defaults to `10`.

-  `views`

  - The directory where express will look for the views, can be used to custom the templates (no recommended).
  - Defaults to `/path/to/node_modules/pushhub`. **The node process needs read/write access to this directory**

## Authentication

PushHub doesn't come with built-in authentication. It's otherwise very easy to set-up authentication in front
of it. Basic Auth works well with both `http` and `git` interfaces.

## Known Issues

- Pushover doesn't emit a `create` event, I've proposed a patch but in the meantime I use pushover as a dependency

## Roadmap

- Readme
- HTTPS
- Diffs
- Look'n'feel

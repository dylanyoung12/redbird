// Express Setup
const express = require('express');
const bodyParser = require('body-parser');
//const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('public'));

//app.use(cors({credentials: true, origin: true}));

// Knex Setup
const env = process.env.NODE_ENV || 'development';
const config = require('./knexfile')[env];
const knex = require('knex')(config);

// bcrypt Setup
let bcrypt = require('bcrypt');
const saltRounds = 10;


// Login
app.post('/api/login', (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).send();
  }
  knex('users').where('email', req.body.email).first().then(user => {
    if (user === undefined) {
      res.status(403).send("Invalid credentials");
      throw new Error('abort');
    }
    return [bcrypt.compare(req.body.password, user.hash), user];
  }).spread((result, user) => {
    if (result) res.status(200).json({ user:user });
    else res.status(403).send("Invalid credentials");
    return;
  }).catch(error => {
    if (error.message !== 'abort') {
      console.log(error);
      res.status(500).json({ error });
    }
  });
});

// Register
app.post('/api/users', (req, res) => {
  console.log(req);
  if (!req.body.email || !req.body.password || !req.body.username || !req.body.name) {
    return res.status(400).send();
  }
  knex('users').where('email', req.body.email).first().then(user => {
    if (user !== undefined) {
      res.status(403).send("Email address already exists");
      throw new Error('abort');
    }
    return knex('users').where('username', req.body.username).first();
  }).then(user => {
    if (user !== undefined) {
      res.status(409).send("User name already exists");
      throw new Error('abort');
    }
    return bcrypt.hash(req.body.password, saltRounds);
  }).then(hash => {
    return knex('users').insert({ email:req.body.email, hash:hash, username:req.body.username, name:req.body.name, role:'user' });
  }).then(ids => {
    return knex('users').where('id',ids[0]).first();
  }).then(user => {
    res.status(200).json({ user:user });
    return;
  }).catch(error => {
    if (error.message !== 'abort') {
      console.log(error);
      res.status(500).json({ error });
    }
  });
});

// Get Tweets
app.get('/api/users/:id/tweets', (req, res) => {
  let id = parseInt(req.params.id);
  knex('users').join('tweets', 'users.id', 'tweets.user_id')
  .where('users.id',id)
  .orderBy('created','desc')
  .select('tweet', 'username', 'name', 'created').then(tweets => {
    res.status(200).json({ tweets:tweets });
  }).catch(error => {
    res.status(500).json({ error });
  });
});

// Create Tweet
app.post('/api/users/:id/tweets', (req, res) => {
  let id = parseInt(req.params.id);
  knex('users').where('id',id).first().then(user => {
    return knex('tweets').insert({ user_id:id, tweet:req.body.tweet, created: new Date() });
  }).then(ids => {
    return knex('tweets').where('id',ids[0]).first();
  }).then(tweet => {
    res.status(200).json({ tweet:tweet });
    return;
  }).catch(error => {
    console.log(error);
    res.status(500).json({ error });
  });
});

// Search Tweets
app.get('/api/tweets/search', (req, res) => {
  if (!req.query.keywords) return res.status(400).send();
  let offset = 0;
  if (req.query.offset) offset = parseInt(req.query.offset);
  let limit = 50;
  if (req.query.limit) limit = parseInt(req.query.limit);
  knex('users').join('tweets','users.id','tweets.user_id')
  .whereRaw("MATCH (tweet) AGAINST('" + req.query.keywords + "')")
  .orderBy('created','desc')
  .limit(limit)
  .offset(offset)
  .select('tweet','username','name','created').then(tweets => {
    res.status(200).json({tweets:tweets});
  }).catch(error => {
    res.status(500).json({ error });
  });
});

// Hashtags
app.get('/api/tweets/hash/:hashtag', (req, res) => {
  let offset = 0;
  if (req.query.offset) offset = parseInt(req.query.offset);
  let limit = 50;
  if (req.query.limit) limit = parseInt(req.query.limit);
  knex('users').join('tweets', 'users.id', 'tweets.user_id')
  .whereRaw("tweet REGEXP '^#" + req.params.hashtag + "' OR tweet REGEXP ' #" + req.params.hashtag + "'")
  .orderBy('created', 'desc')
  .limit(limit)
  .offset(offset)
  .select('tweet', 'username', 'name', 'created').then(tweets => {
    res.status(200).json({tweets:tweets});
  }).catch(error => {
    res.status(500).json({ error });
  });
});


app.listen(3001, () => console.log('Server listening on port 3001!'));

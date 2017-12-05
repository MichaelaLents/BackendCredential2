const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

let db = new Sequelize('../db/database.db', 'username', '', {
  dialect: 'sqlite',
  storage: './db/database.db'
  });

let genres = db.define('genres', {
  name: Sequelize.STRING
  },
  {
    timestamps: false
  });

let films = db.define('films', {
  title: Sequelize.STRING,
  release_date: Sequelize.DATE,
  genre_id: Sequelize.STRING
  },
    {
      timestamps: false
  });

db.sync();

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  res.status(500).send('Not Implemented');
}

module.exports = app;

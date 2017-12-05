const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

const db = new Sequelize('../db/database.db', 'username', '', {
  dialect: 'sqlite',
  storage: './db/database.db'
  });

const genres = db.define('genres', {
  name: Sequelize.STRING
  },
  {
    timestamps: false
  });

const films = db.define('films', {
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
function getFilmRecommendations(req, res, next) {
  let err;
  if(isNaN(req.params.id) ){
    err = new Error('Invalid route');
    err.status = 422;
    return next(err);
  }

  let limit = req.query.limit;
  let offset = req.query.offset;

  if( (limit && isNaN(limit) ) ||
    (offset && isNaN(offset)) ){
      err = new Error('Invalid limit');
      err.status = 422;
      return next(err);
  }

  // let recommendations = [];

  films.findById(req.params.id)
    .then(function(film){

      const date = new Date(film.dataValues.release_date);
      const year = date.getFullYear();
      const day = date.getDate()+1;
      const month = date.getMonth()+1;

      const tempMax = month+'-'+day+'-'+(year+15);
      const tempMin = month+'-'+day+'-'+(year-15);

      const maxDate = new Date(tempMax);
      const minDate = new Date(tempMin);

      genres.findById(film.genre_id)
        .then(function(genre){

          const genreName = genre.name;

          films.findAll({
            where: {
              genre_id: film.genre_id,
              id:{
                $ne: film.id
              },
              release_date: {
                $between: [minDate, maxDate]
              }
            }
          })
            .then(function(films){

              let results = [];
              const filmIDs = [];

              films.forEach(function(film){
                filmIDs.push(film.id);
              });

              request(`http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${filmIDs}`, function(error, result, body){
                if(error){
                  console.log('error with request: ', error)
                  return next(error);
                }

                /*
                  Reviews now contains all the reviews for every film that met
                  our requirements
                */
                const reviews = JSON.parse(body);

                reviews.forEach(function(reviewSet){

                  /*
                    Each reviewSet contains the current film id
                    and all the reviews for that particular film
                  */
                  if(reviewSet.reviews.length >= 5){
                    results = collectSignificantReviews(reviewSet, results, films, genreName);
                  }

                });  // end of   reviews.forEach

                prepareAndSendResult(results, limit, offset, res);

              }); // end of request

          })
          .catch(function(err){
            console.log('Error occured trying to get all films that match our criteria. Err: ',err);
            if(err) return next(err);
          });

      })
      .catch(function(genErr){
        console.log('An error occured trying to get the genre by id. Err: ', genErr);
        if(genErr) return next(genErr);
      });
  })
  .catch(function(err){
    console.log('Error occured searching for a film by id. Err: ', err );
    if(err) return next(err);
  });

}

function prepareAndSendResult(results, limit, offset, res){
  results.sort(function(a, b){
    return a.id - b.id;
  });

  if(isNaN(limit)){
    limit = 10;
  }else{
    limit = +limit;
  }

  if(isNaN(offset)){
    offset = 0;
  }else{
    offset = +offset;
  }

  const actualResults = [];
  let max;
  if(results.length < (limit+offset)){
    max = results.length;
  }else{
    max = limit+offset;
  }
  for(let i = offset; i < max; i++){
    actualResults.push(results[i]);
  }

  res.status(200).json({
    recommendations: actualResults,
     meta: {
       limit: limit,
       offset: offset
     }
  });
}

function collectSignificantReviews(reviewSet, results, films, genreName){
  let sum = 0;
  let average = 0;
  let count = reviewSet.reviews.length;

  reviewSet.reviews.forEach(function(review){
    sum += review.rating;
  });

  average = sum / count;
  average = parseFloat(average).toFixed(2);

  if(average >= 4.0){

    let currFilm = films.find(function(film){
      return reviewSet.film_id == film.id;
    });

    let resultFilm ={
      id: reviewSet.film_id,
      title: currFilm.title,
      releaseDate: currFilm.release_date,
      genre: genreName,
      averageRating: average,
      reviews: count
    }
    results.push(resultFilm);
  }

  return results;
}

/*
  Handles missing routes
*/
app.get('*', function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
 });

// error handler
app.use(function(err, req, res, next) {

  let status = err.status || 500;

  res.status(status).json({
    status: status,
    message: err.message
  });
});

module.exports = app;

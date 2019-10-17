// Import dependencies
const express = require('express'),
    //errorHandler = require('express-error-handler'),
    path = require('path'),
    PORT = process.env.PORT || 5000,
    body_parser = require('body-parser'),
    session = require('client-sessions'),
    db = require('./helpers/db_controllers/services/db'),
    router = require("./routers/router"),
    con_validator = require('./middlewares/validate_connection');


// Setup server
let app = express()

    .use(express.static(path.join(__dirname, 'public')))

    .use(session({
        cookieName: 'session',
        secret: 'd28d6:9;\'\'d"vnjdsvcnjnck&I*(O[\'-[9_){_+5161}#f4rt5f%$g4})"5g64"&^h76kj6&Jj677h#@1hg8489@#$G34t45g54%$y450-{0-P)(P)(*()7865g54409=[gofvg[[ggfry',
        duration: 30 * 60 * 1000,
        activeDuration: 5 * 60 * 1000,
        httpOnly: true,
        secure: true,
        ephemeral: true
    }))

    .use(body_parser.urlencoded({ extended: false }))

    .use(body_parser.json())

    .set('views', path.join(__dirname, 'views'))

    .set('view engine', 'ejs');


// Setup routes
app
    // .use(con_validator.test_session_connection)

    /*.all("*self*", con_validator.require_login, (req, res, next) => {
        let route = req.originalUrl;
        route = route.replace("self", req.user.id);
        if (req.method === "POST") {
            res.redirect(307, route); // redirect to new route with POST request
        } else {
            res.redirect(route); // redirect to new route with GET request
        }
    })*/

    .use("/", router);

// Initialize application
db.initDB(() => {
    app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
});

// Setup errors
//The 404 Route
app.get('/*', function(req, res){
    res.render("errors/404")
});
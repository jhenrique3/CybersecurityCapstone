const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const User = require('./models/user');
const sqlite3 = require('sqlite3');
const Cryptr = require('cryptr');

// Connect to database
const db = new sqlite3.Database('database.sqlite', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        throw err;
    }
});

// invoke an instance of express application.
const app = express();

// set our application port
app.set('port', 9000);

// set morgan to log info about our requests for development use.
app.use(morgan('dev'));

// initialize body-parser to parse incoming parameters requests to req.body
app.use(bodyParser.urlencoded({ extended: true }));

// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: 'OTczNDcxOTg2ZjNkN2Q4MDdjZjg2YTBlNzE3ZjVmNDgK',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 6000000
    }
}));


// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');        
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }    
};


// route for Home-Page
app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});


// route for user signup
app.route('/signup')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/public/signup.html');
    })
    .post((req, res) => {
        User.create({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password
        })
        .then(user => {
            req.session.user = user.dataValues;
            res.redirect('/dashboard');
        })
        .catch(error => {
            res.redirect('/signup');
        });
    });


// route for user Login
app.route('/login')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/public/login.html');
    })
    .post((req, res) => {
        let username = req.body.username;
        let password = req.body.password;

        User.findOne({ where: { username: username } }).then(function (user) {
            if (!user) {
                res.redirect('/login');
            } else if (!user.validPassword(password)) {
                res.redirect('/login');
            } else {
                req.session.user = user.dataValues;
                console.log(req.session.user);
                res.redirect('/dashboard');
            }
        });
    });


// route for fetch user's messages

app.get('/messages', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
//            const cryptr = new Cryptr(req.session.user.password);
            let sql = `SELECT m.msgId, u.username AS sender, m.subject, m.createdAt FROM messages m INNER JOIN users u ON u.id = m.senderId WHERE m.receiverId = ? ORDER BY m.createdAt DESC`;
            db.all(sql, req.session.user.id, (err, rows) => {
                if (err) {
                  throw err;
                }
                console.log(rows);
                res.status(200).send(rows);
            });
        } else {
        res.redirect('/login');
        }
});

app.get('/message/:msgid', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
            const cryptr = new Cryptr(req.session.user.password);
            let sql = `SELECT u.username AS sender, m.subject, m.message, m.createdAt FROM messages m INNER JOIN users u ON u.id = m.senderId WHERE m.receiverId = ? AND m.msgId = ?`;
            console.log(req.params.msgid);
            db.get(sql, [ req.session.user.id, req.params.msgid] , (err, row) => {
                if (err) {
                  throw err;
                }
                if (row) {
// Logs for Debug purposes only - remove from final commit
                    row.message = cryptr.decrypt(row.message);
                }
                console.log(row);
                res.status(200).send(row);
            });
        } else {
        res.redirect('/login');
        }
});


// route for user's dashboard
app.get('/dashboard', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.sendFile(__dirname + '/public/dashboard.html');
    } else {
        res.redirect('/login');
    }
});


// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});


// route for handling 404 requests(unavailable routes)
app.use(function (req, res, next) {
  res.status(404).send("Page not found")
});

// start the express server
app.listen(app.get('port'), () => console.log(`App started on port ${app.get('port')}`));
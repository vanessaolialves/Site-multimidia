const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

function initialize(passport) {
    const autheticateUser = (email, password, done) => {
        pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [email],
            (err, results) => {
                if (err) { throw err; }
                if (results.rows.length > 0) {
                    const user = results.rows[0];
                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if (err) { throw err; }
                        if (isMatch) {
                            return done(null, user);
                        } else {
                            return done(null, false, {message: "Password não está correta."});
                        }
                    })
                } else {
                    return done(null, false, {message: "Email não registrado!"});
                }
            }
        );
    };

    passport.use(
        new LocalStrategy(
            {
                usernameField: "email",
                passwordField: "password"
            },
            autheticateUser
        )
    );
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) => {
        pool.query(
            `SELECT * FROM users WHERE ID = $1`, [id], (err, results) => {
                if (err) { throw err; }
                return done(null, results.rows[0]);
            }
        );
    });
}

module.exports = initialize;


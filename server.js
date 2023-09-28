const express = require('express');
const app = express();
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const fs = require("fs");
require("dotenv").config();

const PORT = process.env.PORT || 4000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

let video = undefined;


app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());



app.get('/', (req, res) => {
    res.render("index");
    video = undefined;
});

app.get('/users/register', checkAuthenticated, (req, res) => {
    res.render("register");
    video = undefined;
});

app.get('/users/login', checkAuthenticated, (req, res) => {
    res.render("login");
    video = undefined;
});

app.get('/users/dashboard', checkNotAuthenticated, async (req, res) => {
    
    let cardVideo = [];
    video = undefined;
    pool.query(
        `SELECT *FROM videos;`, (err, results) => {
            if (err) {
                throw err
            }
            console.log("cheguei aqui");
            cardVideo = results.rows;
            console.log(cardVideo);
            res.render("dashboard", { user: req.user.name, cardVideo: cardVideo});
        }
    );
});

app.get('/users/video', checkNotAuthenticated, async (req, res) => {
    if (typeof video === 'undefined') {
        res.render("error");
    } else {
        pool.query(
            `SELECT *FROM videos
            WHERE id = $1`,[video.id], 
            (err, results) => {
                if (err) {
                    throw err
                }
                ans = results.rows[0]
                video.videoPath = ans.videopath;
                console.log(results.rows);
                res.render("video", { user: req.user.name, title: ans.title, description: ans.description });
            }
        );
    }
    
});

app.get("/playvideo", checkNotAuthenticated, (req, res) => {
    // Ensure there is a range given for the video
    const range = req.headers.range;
    if (!range) {
        res.render("error");
    }
    console.log(range);
    console.log(video);
    // get video stats (about 61MB)
    let pathVideo = video.videoPath + ".mp4";
    const videoPath = pathVideo;
    const videoSize = fs.statSync(pathVideo).size;

    // Parse Range
    // Example: "bytes=32324-"
    const CHUNK_SIZE = 1 * 1e6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    // Create headers
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });

    // Stream the video chunk to the client
    videoStream.pipe(res);
});


app.get("/users/logout", (req, res) => {
    req.logOut((err) => {
        if (err) { return next(err); }
        req.flash("sucess_msg", "Você saiu da sua conta.");
        res.redirect("/users/login");
    });
    video = undefined;
});

app.post('/users/register', async (req, res) => {
    console.log(req.body);
    let { name, email, password, password2 } = req.body;
    let errors = [];

    if (!name || !email || !password || !password2) {
        errors.push({ message: "Por favor digite todos os campos!" });
    }
    if (password.length < 6) {
        errors.push({ message: "Senha tem que ter pelo menos 6 caracteres!"});
    }
    if (password !== password2) {
        errors.push({ message: "As senhas não são iguais!"});
    }
    if (errors.length > 0) {
        res.render("register", { errors });
    } else {

        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);
        pool.query(
            `SELECT *FROM users
            WHERE email = $1`, [email], (err, results) => {
                if (err) {
                    throw err
                }
                console.log("cheguei aqui");
                console.log(results.rows);

                if (results.rows.length > 0) {
                    errors.push({ message: "Email já registrado!"});
                    res.render("register", { errors });
                } else {
                    pool.query(
                        `INSERT INTO users (name, email, password)
                        VALUES ($1, $2, $3)
                        RETURNING id, password`,
                        [name, email, hashedPassword],
                        (err, results) => {
                            if (err) {
                                throw err;
                            }
                            console.log(results.rows);
                            req.flash('sucess_msg', "Você criou uma conta. Agora basta fazer log in.");
                            res.redirect("/users/login");
                        }
                    );
                }
            }
        );
    }
    video = undefined;
});

app.post("/users/login", passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
}));

app.post("/users/dashboard", checkNotAuthenticated, (req, res) => {
    video = req.body;
    res.redirect("/users/video"); 
});

function checkAuthenticated(req, res, next){
    if (req.isAuthenticated()) {
        return res.redirect("/users/dashboard");
    }
    next();
}

function checkNotAuthenticated(req, res, next){
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/users/login");
    video = {};
}

app.listen(PORT, () => {
    console.log(`Server runing on port ${PORT}`);
});





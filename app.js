if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}
const express = require('express'); 
const app = express();
const port = 3000;
const routes = require("./routes");
const Sentry = require("@sentry/node");
const{ Server } = require("socket.io");
const session = require('express-session');
const crypto = require('crypto');
const sessionKey = crypto.randomBytes(32).toString('hex');
// console.log('Session Secret Key:', sessionKey);


require("./libs/instrument.js");

app.use(session({
    secret: sessionKey, 
    resave: false, 
    saveUninitialized: false, 
    cookie: {
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000, 
    },
}));

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');
app.use("/", routes)
app.use((err, req, res, next) => {
    Sentry.captureException(err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || "Internal Server Error"
        }
    })
})

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
const io = new Server(server);

const socketIdStore = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('notification', (message) => {
        console.log(message);  
        alert(message); 
    });
    socket.emit('notification', 'Welcome to the app!');
    
    socket.on('register-session', (userId) => {
        socketIdStore[userId] = socket.id;
        console.log(`User ${userId} registered with socket ID: ${socket.id}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (let userId in socketIdStore) {
            if (socketIdStore[userId] === socket.id) {
                delete socketIdStore[userId];
                break;
            }
        }
    });
});
module.exports = app;
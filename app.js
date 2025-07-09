const express = require('express')
const app = express()
const router = require('./router')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked')
const sanitizeHtml = require('sanitize-html')
const csurf = require('csurf')

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))

let sessionOptions = session({
    secret: 'adada', //? fix
    store: MongoStore.create({ client: require('./db')}),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: "strict" }
})
app.use(sessionOptions)

app.use(flash())
app.use(function(req, res, next) {
    res.locals.filterUserHtml = function(content) {
        return sanitizeHtml(markdown.parse(content), {allowedTags: ['p', 'br', 'ol', 'ul', 'li', 'strong', 'bold', 'em', 'i', 'h1', 'h2', 'h3', 'h4'], allowedAttributes: {} })
    }

    // make all error and success messages available to the whole app
    res.locals.errors = req.flash('errors')
    res.locals.success = req.flash('success')

    if (req.session.user) req.visitorId = req.session.user._id 
    else req.visitorId = 0 
    res.locals.user = req.session.user
    next()
})

app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(csurf())
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken()
    next()
})

app.use((err, req, res, next) => {
    if (err) {
        if (err.code === 'EBADCSRFTOKEN') {
            req.flash('errors', 'Bad vibes detected.')
            req.session.save(() => res.redirect('/'))
        } else {
            res.locals.csrfToken = ''
            res.status(500).render('404')
        }
    } else {
        next()
    }
})
app.use('/', router)
    
const server = require('http').createServer(app)
const io = require('socket.io')(server)

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)
io.use(wrap(sessionOptions))

io.on('connection', socket => {
    if (socket.request.session.user) {
        let user = socket.request.session.user

        socket.emit('welcome', {
            username: user.username,
            avatar: user.avatar
        })

        socket.on('ChatMessagesFromBrowser', data => {
            socket.broadcast.emit('ChatMessagesFromServer', {
                message: sanitizeHtml(data.message, { allowedTags: [], allowedAttributes: []}),
                username: user.username,
                avatar: user.avatar
            })
        })
    }
})

module.exports = server
const Post = require('../models/Post')
const User = require('../models/User')
const Follow = require('../models/Follow')
const jwt = require('jsonwebtoken')

exports.doesUsernameExist = function(req, res) {
    User.findByUsername(req.body.username).then(() => {
        res.json(true)
    }).catch(() => {
        res.json(false)
    })
}

exports.doesEmailExist = async function(req, res) {
    let emailBoolean = await User.doesEmailExist(req.body.email)

    res.json(emailBoolean)
}

exports.apiGetPostsByUsername = async function(req, res) {
    try {
        let authorDoc = await User.findByUsername(req.params.username)

        let posts = await Post.findByAuthorId(authorDoc._id)

        res.json(posts)
    } catch (err) {
        res.json('Invalid user requested')
    }
}

exports.apiMustBeLoggedIn = function(req, res, next) {
    try {
        req.apiUser = jwt.verify(req.body.token, process.env.JWT_SECRET)

        next()
    } catch(err) {
        res.json('Sorry, Wrong Token.')
    }
}

exports.mustBeLoggedIn = function(req, res, next) {
    if (req.session.user) {
        next()
    } else {
        req.flash('errors', 'You must log in first to perform that action')
        req.session.save(() => {
            res.redirect('/')
        })
    }
}

exports.sharedProfileData = async function(req, res, next) {
    let isVisitorsProfile = false
    let isFollowing = false
    if (req.session.user) {
        isVisitorsProfile = req.profileUser._id.equals(req.session.user._id)
        isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, req.visitorId)
    }

    req.isVisitorsProfile = isVisitorsProfile
    req.isFollowing = isFollowing

    let postCountPromise = Post.countPostsByAuthor(req.profileUser._id)
    let followerCountPromise = Follow.countFollowersById(req.profileUser._id)
    let followingCountPromise = Follow.countFollowingById(req.profileUser._id)

    let results = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise])
    let [postCount, followerCount, followingCount] = results

    req.postCount = postCount
    req.followerCount = followerCount
    req.followingCount = followingCount

    next()
}

exports.login = function(req, res) {
    let user = new User(req.body)
    user.login().then(function(result) {
        req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id }
        req.session.save(function() {
            res.redirect('/')
        })
    }).catch(function(err) {
        req.flash('errors', err)
        req.session.save(function() {
            res.redirect('/')
        })
    })
}

exports.apiLogin = function(req, res) {
    let user = new User(req.body)
    user.login().then(function(result) {
        res.json(jwt.sign(
            { _id: user.data._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        ))
    }).catch(function(err) {
        res.json('Cringe')
    })
}

exports.logout = function(req, res) {
    req.session.destroy(function() {
        res.redirect('/')
    })
    
}

exports.register = function(req, res) {
    let user = new User(req.body)
    user.register().then(() => {
        req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id }
        req.session.save(() => {
            res.redirect('/')
        })
    }).catch((regErrors) => {
        regErrors.forEach((err) => {
            req.flash('regErrors', err)
        })
        req.session.save(() => {
            res.redirect('/')
        })
    })

}

exports.home = async function(req, res) {
    if (req.session.user) {
        let posts = await Post.getFeed(req.session.user._id)
        res.render('home-dashboard', { posts: posts })
    } else {
        res.render('home-guest', { regErrors: req.flash('regErrors') })
    }
}

exports.ifUserExists = function(req, res, next) {
    User.findByUsername(req.params.username).then((userDocument) => {
        req.profileUser = userDocument
        next()
    }).catch(() => res.render('404'))
} 

exports.profilePostsScreen = function(req, res) {
    Post.findByAuthorId(req.profileUser._id).then((posts) => {
        res.render('profile_posts', { 
            title: `Profile for ${req.profileUser.username}`,
            posts: posts,
            profileUsername: req.profileUser.username,
            profileAvatar: req.profileUser.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            currentPage: 'posts',
            counts: {
                postCount: req.postCount, 
                followerCount: req.followerCount, 
                followingCount: req.followingCount
            }
        })
    }).catch(() => res.render('404'))
}

exports.profileFollowersScreen = async function(req, res) {
    let followers = await Follow.getFollowersById(req.profileUser._id)
    try {
        res.render('profile_followers', {
            followers: followers,
            profileUsername: req.profileUser.username,
            profileAvatar: req.profileUser.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            currentPage: 'followers',
            counts: {
                postCount: req.postCount, 
                followerCount: req.followerCount, 
                followingCount: req.followingCount
            }
        })
    } catch {
        res.render('404')
    }   

}

exports.profileFollowingsScreen = async function(req, res) {
    let followings = await Follow.getFollowingsById(req.profileUser._id)
    try {
        res.render('profile_following', {
            followings: followings,
            profileUsername: req.profileUser.username,
            profileAvatar: req.profileUser.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            currentPage: 'following',
            counts: {
                postCount: req.postCount, 
                followerCount: req.followerCount, 
                followingCount: req.followingCount
            }
        })
    } catch {
        res.render('404')
    }  
} 

const Post = require('../models/Post')

exports.viewCreateScreen = function(req, res) {
    res.render('create-post')
}

exports.apiCreatePost = function(req, res) {
    let post = new Post(req.body, req.apiUser._id)

    post.createPost().then((newId) => {
        res.json('Congrats, new Post.')
    }).catch((errors) => {
        res.json(errors)
    })
}

exports.createPost = function(req, res) {
    let post = new Post(req.body, req.session.user._id)

    post.createPost().then((newId) => {
        req.flash('success', 'New post created')
        req.session.save(() => res.redirect(`/post/${newId}`))
    }).catch((errors) => {
        errors.forEach((error) => req.flash('errors', error))
        req.session.save(() => res.redirect(`/create-post`))
    })
}

exports.viewSingle = async function(req, res) {
    try {
        let post = await Post.findSingleById(req.params.id, req.visitorId)  
        res.render('single-post', { post: post, title: post.title })
    } catch (err) {
        res.render('404')
    }
}

exports.viewEditScreen = async function (req, res) {
    try {
        let post = await Post.findSingleById(req.params.id, req.visitorId)
        if (post.isVisitorOwner) {
            res.render('edit-post', { post: post })
        } else {
            req.flash('errors', 'You do not have permission to perform that action')
            req.session.save(() => res.redirect('/'))
        }
    } catch {
        res.render('404')
    }
}

exports.edit = function(req, res) {
    let post = new Post(req.body, req.visitorId, req.params.id)
    post.update().then((status) => {
        if (status === 'success') {
            req.flash('success', 'Post successfully updated')

            req.session.save(function() {
                res.redirect(`/post/${req.params.id}/edit`)
            })
        } else {
            post.errors.forEach(error => {
                req.flash('errors', error)
            })

            req.session.save(function() {
                res.redirect(`/post/${req.params.id}/edit`)
            })
        }
    }).catch(() => {
        req.flash('errors', 'You do not have permission to perform that action')
        req.session.save(() => res.redirect(`/`))
    })

}

exports.apiDeletePost = function(req, res) {
    Post.delete(req.params.id, req.apiUser._id).then(() => {
       res.json('Post Deleted.')
    }).catch(() => {
       res.json('No permission')
    })
}

exports.delete = function(req, res) {
    Post.delete(req.params.id, req.visitorId).then(() => {
        req.flash('success', 'Post successfully deleted')
        req.session.save(() => res.redirect(`/profile/${req.session.user.username}`))
    }).catch(() => {
        req.flash('errors', 'You do not have permission to perform that action')
        req.session.save(() => res.redirect(`/`))
    })
}

exports.search = function(req, res) {
    Post.search(req.body.searchTerm).then(posts => {
        res.json(posts)
    }).catch(() => {
        res.json([])
    }) 
}
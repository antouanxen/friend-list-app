const { ObjectId } = require('mongodb')
const User = require('./User')
const { sendEmail } = require('../mail')

const usersCollection = require('../db').db().collection('users')
const followsCollection = require('../db').db().collection('follows')

let Follow = function(followedUsername, authorId) {
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function() {
    if (typeof(this.followedUsername) !== 'string' ) this.followedUsername = ''
}

Follow.prototype.validate = async function(action) {
    let followedAccount = await usersCollection.findOne({
        username: this.followedUsername
    })

    if (followedAccount) {
        this.followedId = followedAccount._id
    } else {
        this.errors.push('You cannot follow a user account that does not exist')
    }

    let doesFollowAlreadyExist = await followsCollection.findOne({
        followedId: this.followedId,
        authorId: new ObjectId(this.authorId)
    })

    if (action === 'create') {
        if (doesFollowAlreadyExist) this.errors.push('You are already following this user')
    } 

    if (action === 'delete') {
        if (!doesFollowAlreadyExist) this.errors.push('You cannot stop following some one you do not already follow')
    } 

    if (this.followedId.equals(this.authorId)) this.errors.push('You cannot follow yourself numbnuts')
}

Follow.prototype.create = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('create')

        if (!this.errors.length) {
            await followsCollection.insertOne({
                followedId: this.followedId,
                authorId: new ObjectId(this.authorId)
            })

            const follower = await usersCollection.findOne({ _id: new ObjectId(this.authorId) })
            const followed = await usersCollection.findOne({ _id: new ObjectId(this.followedId) })

            if (follower && followed) {
                const subject = `New Follower Alert`
                const message = `User ${follower.username} has started following you.`

                try {
                    await sendEmail(followed.email, subject, message)
                } catch (e) {
                    console.error("Email error:", e)
                }
            }
            
            resolve()
        } else {
            reject(this.errors)
        }
    })
}

Follow.prototype.delete = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('delete')

        if (!this.errors.length) {
            await followsCollection.deleteOne({
                followedId: this.followedId,
                authorId: new ObjectId(this.authorId)
            })
            
            resolve()
        } else {
            reject(this.errors)
        }
    })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
    let followDoc = await followsCollection.findOne({
        followedId: followedId,
        authorId: new ObjectId(visitorId)
    })

    if (followDoc) {
        return true
    } else {
        return false
    }
}

Follow.getFollowersById = function(id) {
    return new Promise(async (resolve, reject) => {
        try {
            let followers = await followsCollection.aggregate([
                { $match: { followedId: id } },
                { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'userDoc' } },
                { $project: { 
                    username: { $arrayElemAt: ['$userDoc.username', 0] }, 
                    email: { $arrayElemAt: ['$userDoc.email', 0] }, 
                } }
            ]).toArray()

            followers = followers.map(follower => {
                let user = new User(follower, true)

                return {
                    username: follower.username,
                    avatar: user.avatar
                }
            })
            resolve(followers)
        } catch (err) {
            console.log(err)
            reject()
        }
    })
}

Follow.getFollowingsById = function(id) {
    return new Promise(async (resolve, reject) => {
        try {
            let followings = await followsCollection.aggregate([
                { $match: { authorId: id } },
                { $lookup: { from: 'users', localField: 'followedId', foreignField: '_id', as: 'userDoc' } },
                { $project: { 
                    username: { $arrayElemAt: ['$userDoc.username', 0] }, 
                    email: { $arrayElemAt: ['$userDoc.email', 0] }, 
                } }
            ]).toArray()

            followings = followings.map(following => {
                let user = new User(following, true)

                return {
                    username: following.username,
                    avatar: user.avatar
                }
            })
            resolve(followings)
        } catch (err) {
            console.log(err)
            reject()
        }
    })
}

Follow.countFollowersById = function(id) {
    return new Promise(async (resolve, reject) => {
        let followerCount = await followsCollection.countDocuments({
            followedId: id
        })

        resolve(followerCount)
    })
}

Follow.countFollowingById = function(id) {
    return new Promise(async (resolve, reject) => {
        let followingCount = await followsCollection.countDocuments({
            authorId: id
        })

        resolve(followingCount)
    })
}

module.exports = Follow
const { db } = require("../util/admin");
const { auth } = require("../util/firebaseConfig");
const {createUserWithEmailAndPassword} = require("firebase/auth");
const {signInWithEmailAndPassword} = require("firebase/auth");
const { validateSignupData, validateLoginData } = require("../util/validation");

exports.signup = (req, res) => {
    let newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        userHandle: req.body.userHandle
    };

    let { errors, valid } = validateSignupData(newUser);

    if (!valid) return res.status(400).json(errors);

    db.collection("users")
        .doc(newUser.userHandle)
        .get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({
                    other: {
                        message: "signing up user fail",
                        errMessage: "userhandle already taken"
                    }
                });
            } else {
                createUserWithEmailAndPassword(auth, newUser.email, newUser.password)
                    .then(usersnapshot => {
                        let newUserDatabaseCredentials = {
                            userId: usersnapshot.user.uid,
                            createdAt: new Date().toISOString(),
                            email: newUser.email,
                            friends: [],
                            friendRequestsRecieved: [],
                            friendRequestsSent: [],
                            userHandle: newUser.userHandle,
                            searchUserHandle: newUser.userHandle.toLowerCase(),
                            bio: null,
                            location: null,
                            website: null,
                            profilePictureUrl: `https://firebasestorage.googleapis.com/v0/b/socialmediaapp-53549.appspot.com/o/no-profile-picture.png?alt=media`
                        };

                        db.collection("users")
                            .doc(newUser.userHandle)
                            .set(newUserDatabaseCredentials)
                            .then(snapshot => {
                                return usersnapshot.user.getIdToken();
                            })
                            .then(token => {
                                return res.json({ token });
                            })
                            .catch(err => {
                                return res.status(500).json({
                                    other: {
                                        message: "signing up user, adding data to database fail",
                                        errMessage: err.message,
                                        errorCode: err.code
                                    }
                                });
                            });
                    })
                    .catch(err => {
                        return res.status(500).json({
                            other: {
                                message: "signing up user fail",
                                errMessage: err.message,
                                errorCode: err.code
                            }
                        });
                    });
            }
        })
        .catch(err => {
            return res.status(500).json({
                other: {
                    message: "signing up user, checking availability for userHandle fail",
                    errMessage: err.message,
                    errorCode: err.code
                }
            });
        });
};

exports.login = (req, res) => {
    console.log(req)
    let user = {
        email: req.body.email,
        password: req.body.password
    };


    let { errors, valid } = validateLoginData(user);

    if (!valid) return res.status(400).json(errors);

    signInWithEmailAndPassword(auth, user.email, user.password)
        .then(snapshot => {
            return snapshot.user.getIdToken();
        })
        .then(token => {
            return res.json({ token });
        })
        .catch(err => {
            if (err.code == 'auth/wrong-password' && err.code == 'auth/user-not-found') {
                return res.status(500).json({
                    general: {
                        message: "loging user fail",
                        errMessage: err.message,
                        errorCode: err.code,
                    }
                });
            } else {
                return res.status(500).json({
                    other: {
                        message: "loging user fail",
                        errMessage: err.message,
                        errorCode: err.code,
                    }
                });
            }
        });
};
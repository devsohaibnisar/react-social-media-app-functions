const Busboy = require("busboy");
const { db, admin } = require("../util/admin");
const { validateUserDetails } = require("../util/validation");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

exports.getAuthenticUserData = (req, res) => {
  let userData = {
    credentials: req.userData,
  };
  db.collection("notifications")
    .where("postUserHandle", "==", req.userData.userHandle)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get()
    .then((querySnapshot) => {
      let notifications = [];
      querySnapshot.forEach((doc) => {
        notifications.push({ ...doc.data(), notificationId: doc.id });
      });
      userData.notifications = notifications;
      return db
        .collection("likes")
        .where("userHandle", "==", req.userData.userHandle)
        .get();
    })
    .then((querySnapshot) => {
      let likes = [];
      querySnapshot.forEach((doc) => {
        likes.push({ ...doc.data(), likeId: doc.id });
      });
      return res.json({ ...userData, likes });
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ errorMessage: err.message, errorCode: err.code, err });
    });
};

exports.getUserData = (req, res) => {
  const userHandle = req.params.userHandle;
  if (userHandle && userHandle != "undefined" && userHandle != "null") {
    let userData = {};
    db.doc(`users/${userHandle}`)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ message: "no such user found" });
        } else {
          userData.credentials = doc.data();
          return db
            .collection("posts")
            .where("userHandle", "==", userHandle)
            .get();
        }
      })
      .then((querySnapshot) => {
        userData.posts = [];
        querySnapshot.forEach((doc) => {
          userData.posts.push({ ...doc.data(), id: doc.id });
        });
        userData.posts.sort((a, b) => -a.createdAt.localeCompare(b.createdAt));
        return res.json(userData);
      })
      .catch((err) => {
        return res.status(500).json({ errMessage: err.message, err });
      });
  } else {
    return res.status(404).json({ message: "userHandle is not defined" });
  }
};

exports.editProfile = (req, res) => {
  const busboy = Busboy({ headers: req.headers });

  let imageData = {};
  let formData = {};

  let media = false;

  busboy.on("field", (fieldname, val) => {
    formData[fieldname] = val;
  });
  busboy.on("file", (name, file, info) => {
    media = true;
    // if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
    // res.status(400).json({ error: 'wrong file type' })
    // }
    let imageExtension =
      info.filename.split(".")[info.filename.split(".").length - 1];
    let imageFileName = `${crypto
      .randomBytes(11)
      .toString("hex")}${new Date().valueOf()}.${imageExtension}`;
    let filepath = path.join(os.tmpdir(), imageFileName);
    file.pipe(fs.createWriteStream(filepath));
    imageData = {
      imageFileName,
      filepath,
      mimetype: info.mimetype,
    };
    file.resume();
  });

  busboy.on("finish", function () {
    let userDetails = validateUserDetails(formData);

    if (media === true) {
      let uuid = uuidv4();
      admin
        .storage()
        .bucket()
        .upload(imageData.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageData.mimetype,
              firebaseStorageDownloadTokens: uuid,
            },
          },
        })
        .then(() => {
          const profilePictureUrl = `https://firebasestorage.googleapis.com/v0/b/socialmediaapp-53549.appspot.com/o/${imageData.imageFileName}?alt=media&token=${uuid}`;
          db.collection("users")
            .doc(req.userData.userHandle)
            .update({
              profilePictureUrl: profilePictureUrl,
              profilePictureUrlPath: imageData.imageFileName,
              location: userDetails.location,
              bio: userDetails.bio,
              website: userDetails.website,
            })
            .then(() => {
              return res.json({ message: "profile successfuly updated" });
            })
            .catch((err) => {
              return res.status(500).json({
                message: "updating user profile data and picture fail",
                errMessage: err.message,
                errorCode: err.code,
              });
            });
        })
        .catch((err) => {
          return res.status(500).json({
            message: "uploading user profile picture to storage fail",
            errMessage: err.message,
            errorCode: err.code,
          });
        });
    } else {
      db.collection("users")
        .doc(`${req.userData.userHandle}`)
        .update({
          location: userDetails.location,
          bio: userDetails.bio,
          website: userDetails.website,
        })
        .then((snapshot) => {
          return res.status(200).json({
            message: `user details added successfully`,
          });
        })
        .catch((err) => {
          return res.status(500).json({
            message: "adding user details fail",
            errMessage: err.message,
            errorCode: err.code,
            error: err,
          });
        });
    }
  });
  req.pipe(busboy);
};

exports.markNotificationRead = (req, res) => {
  let userHandle = req.userData.userHandle;
  let batch = db.batch();
  db.collection("notifications")
    .where("postUserHandle", "==", userHandle)
    .where("read", "==", false)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        res.status(404).json({ message: "no notification found" });
      } else {
        querySnapshot.forEach((doc) => {
          batch.update(db.doc(`notifications/${doc.id}`), { read: true });
        });
        batch
          .commit()
          .then(() => {
            res.json({ message: "notification marked read" });
          })
          .catch((err) => {
            res.status(500).json({ errMessage: err.message, err });
          });
      }
    })
    .catch((err) => {
      res.status(500).json({ errMessage: err.message, err });
    });
};

exports.addFriend = (req, res) => {
  const toUserHandle = req.params.userHandle;
  if (toUserHandle === req.userData.userHandle) {
    return res.json({ meassage: "can not send freind request to own" });
  }

  let checkSender = () => {
    let friends = req.userData.friends;
    let friendRequestsSent = req.userData.friendRequestsSent;

    let alredyFriends = false;
    let alreadyfriendRequestsSent = false;

    if (!friends) {
      friends = [];
    }
    if (!friendRequestsSent) {
      friendRequestsSent = [];
    }

    if (friends) {
      alredyFriends = friends.some(
        (friend) => friend.userHandle == toUserHandle
      );
    }
    if (friendRequestsSent) {
      alreadyfriendRequestsSent = friendRequestsSent.some(
        (request) => request.userHandle == toUserHandle
      );
    }

    if (alredyFriends) {
      return res.status(400).json({ message: "already friends" });
    } else if (alreadyfriendRequestsSent) {
      return res.status(400).json({ message: "already friend request sended" });
    } else {
      return true;
    }
  };

  let checkReciever = (doc) => {
    let friends = doc.data().friends;
    let friendRequestsRecieved = doc.data().friendRequestsRecieved;

    if (!friends) {
      friends = [];
    }
    if (!friendRequestsRecieved) {
      friendRequestsRecieved = [];
    }

    let alredyFriends = false;
    let alredyfriendRequestsRecieved = false;

    if (friends) {
      alredyFriends = friends.some(
        (friend) => friend.userHandle == req.userData.userHandle
      );
    }
    if (friendRequestsRecieved) {
      alredyfriendRequestsRecieved = friendRequestsRecieved.some(
        (request) => request.userHandle == req.userData.userHandle
      );
    }

    if (alredyFriends) {
      return res.status(400).json({ message: "already friends" });
    } else {
      return true;
    }
  };

  let returnUserData;

  db.doc(`users/${toUserHandle}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res
          .status(404)
          .json({ other: { message: "no such user found" } });
      } else if (checkSender() && checkReciever(doc)) {
        let friendRequestsRecieved1 = req.userData.friendRequestsRecieved;
        let friendRequestsRecieved2 = doc.data().friendRequestsRecieved;
        let friendRequestsSent1 = req.userData.friendRequestsSent;
        let friendRequestsSent2 = doc.data().friendRequestsSent;

        if (!friendRequestsRecieved1) {
          friendRequestsRecieved1 = [];
        }
        if (!friendRequestsRecieved2) {
          friendRequestsRecieved2 = [];
        }
        if (!friendRequestsSent1) {
          friendRequestsSent1 = [];
        }
        if (!friendRequestsSent2) {
          friendRequestsSent2 = [];
        }

        let filterdFriendRequestsRecieved1 = friendRequestsRecieved1.filter(
          (request) => request.userHandle !== toUserHandle
        );
        let filterdFriendRequestsSent1 = friendRequestsSent1.filter(
          (request) => request.userHandle !== toUserHandle
        );
        let filterdFriendRequestsRecieved2 = friendRequestsRecieved2.filter(
          (request) => request.userHandle !== req.userData.userHandle
        );
        let filterdFriendRequestsSent2 = friendRequestsSent2.filter(
          (request) => request.userHandle !== req.userData.userHandle
        );

        let updatedfriendfriendRequestsSent = filterdFriendRequestsSent1;
        let updatedfriendRequestsRecieved = filterdFriendRequestsRecieved2;

        updatedfriendfriendRequestsSent.push({
          userHandle: doc.data().userHandle,
          profilePictureUrl: doc.data().profilePictureUrl,
          createdAt: doc.data().createdAt,
        });

        updatedfriendRequestsRecieved.push({
          userHandle: req.userData.userHandle,
          profilePictureUrl: req.userData.profilePictureUrl,
          createdAt: req.userData.createdAt,
        });

        let batch = db.batch();

        batch.update(db.doc(`users/${toUserHandle}`), {
          friendRequestsRecieved: updatedfriendRequestsRecieved,
        });
        batch.update(db.doc(`users/${toUserHandle}`), {
          friendRequestsSent: filterdFriendRequestsSent2,
        });
        batch.update(db.doc(`users/${req.userData.userHandle}`), {
          friendRequestsRecieved: filterdFriendRequestsRecieved1,
        });
        batch.update(db.doc(`users/${req.userData.userHandle}`), {
          friendRequestsSent: updatedfriendfriendRequestsSent,
        });

        returnUserData = {
          userHandle: doc.data().userHandle,
          profilePictureUrl: doc.data().profilePictureUrl,
          createdAt: doc.data().createdAt,
        };

        return batch.commit();
      } else {
        return res
          .status(404)
          .json({
            other: {
              message: "something went wrong while sending friend request",
            },
          });
      }
    })
    .then(() => {
      return res.status(200).json(returnUserData);
    })
    .catch((err) =>
      res.status(500).json({
        message: "sending friend request fail",
        errMessage: err.message,
        errCode: err.code,
        err,
      })
    );
};

exports.confirmRequest = (req, res) => {
  let userHandle = req.userData.userHandle;
  let confirmUserHandle = req.params.userHandle;

  db.doc(`users/${confirmUserHandle}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        res.status(404).json({ other: { message: "no such user found" } });
      } else {
        let friendRequestsRecieved1 = req.userData.friendRequestsRecieved;
        let friendRequestsSent2 = doc.data().friendRequestsSent;
        let freinds1 = req.userData.friends;
        let freinds2 = doc.data().friends;

        if (!friendRequestsRecieved1) {
          friendRequestsRecieved1 = [];
        }
        if (!friendRequestsSent2) {
          friendRequestsSent2 = [];
        }

        if (!freinds1) {
          freinds1 = [];
        }
        if (!freinds2) {
          freinds2 = [];
        }

        let filteredFriendRequestsRecieved1 = friendRequestsRecieved1.filter(
          (request) => request.userHandle !== confirmUserHandle
        );
        let filteredFriendRequestsSent2 = friendRequestsSent2.filter(
          (request) => request.userHandle !== userHandle
        );

        let newFreinds1 = freinds1;
        let newFreinds2 = freinds2;

        newFreinds1.push({
          createdAt: doc.data().createdAt,
          profilePictureUrl: doc.data().profilePictureUrl,
          userHandle: doc.data().userHandle,
        });
        newFreinds2.push({
          createdAt: req.userData.createdAt,
          profilePictureUrl: req.userData.profilePictureUrl,
          userHandle: req.userData.userHandle,
        });

        let batch = db.batch();

        batch.update(db.doc(`users/${userHandle}`), {
          friendRequestsRecieved: filteredFriendRequestsRecieved1,
          friends: newFreinds1,
        });
        batch.update(db.doc(`users/${confirmUserHandle}`), {
          friendRequestsSent: filteredFriendRequestsSent2,
          friends: newFreinds2,
        });

        batch
          .commit()
          .then(() => {
            res.json({ message: "request confirmed" });
          })
          .catch((err) =>
            res.status(500).json({
              message: "updating user for friend request fail",
              errMessage: err.message,
              errCode: err.code,
              err,
            })
          );
      }
    })
    .catch((err) =>
      res.status(500).json({
        message: "finding user for friend request fail",
        errMessage: err.message,
        errCode: err.code,
        err,
      })
    );
};

exports.deleteRequest = (req, res) => {
  let userHandle = req.userData.userHandle;
  let deleteUserHandle = req.params.userHandle;
  let batch = db.batch();

  db.doc(`users/${deleteUserHandle}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res
          .status(404)
          .json({ other: { message: "no such user found" } });
      } else {
        let friendRequestsRecieved1 = req.userData.friendRequestsRecieved;
        let friendRequestsSent1 = req.userData.friendRequestsSent;
        let friendRequestsRecieved2 = doc.data().friendRequestsRecieved;
        let friendRequestsSent2 = doc.data().friendRequestsSent;

        if (!friendRequestsRecieved1) {
          friendRequestsRecieved1 = [];
        }
        if (!friendRequestsSent1) {
          friendRequestsSent1 = [];
        }
        if (!friendRequestsRecieved2) {
          friendRequestsRecieved2 = [];
        }
        if (!friendRequestsSent2) {
          friendRequestsSent2 = [];
        }

        let filterdFriendRequestsRecieved1 = friendRequestsRecieved1.filter(
          (req) => req.userHandle !== deleteUserHandle
        );
        let filterdFriendRequestsSent1 = friendRequestsSent1.filter(
          (req) => req.userHandle !== deleteUserHandle
        );
        let filterdFriendRequestsRecieved2 = friendRequestsRecieved2.filter(
          (req) => req.userHandle !== userHandle
        );
        let filterdFriendRequestsSent2 = friendRequestsSent2.filter(
          (req) => req.userHandle !== userHandle
        );

        batch.update(db.doc(`users/${userHandle}`), {
          friendRequestsRecieved: filterdFriendRequestsRecieved1,
        });
        batch.update(db.doc(`users/${userHandle}`), {
          friendRequestsSent: filterdFriendRequestsSent1,
        });
        batch.update(db.doc(`users/${deleteUserHandle}`), {
          friendRequestsRecieved: filterdFriendRequestsRecieved2,
        });
        batch.update(db.doc(`users/${deleteUserHandle}`), {
          friendRequestsSent: filterdFriendRequestsSent2,
        });
        return batch.commit();
      }
    })
    .then(() => {
      res.json({ message: "request deleted" });
    })
    .catch((err) =>
      res.status(500).json({
        message: "deleting friend request fail",
        errMessage: err.message,
        errCode: err.code,
        err,
      })
    );
};

exports.unFriend = (req, res) => {
  let batch = db.batch();
  let unFriendUserHandle = req.params.userHandle;

  let friends1 = req.userData.friends;
  let filterfriends1 = friends1.filter(
    (friend) => friend.userHandle != unFriendUserHandle
  );

  if (!friends1) {
    friends1 = [];
  }

  db.doc(`users/${unFriendUserHandle}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        batch.update(db.doc(`users/${req.userData.userHandle}`), {
          friends: filterfriends1,
        });
      } else {
        let friends2 = doc.data().friends;

        if (!friends2) {
          friends2 = [];
        }

        let filterfriends1 = friends1.filter(
          (friend) => friend.userHandle != unFriendUserHandle
        );
        let filterfriends2 = friends2.filter(
          (friend) => friend.userHandle != req.userData.userHandle
        );

        batch.update(db.doc(`users/${req.userData.userHandle}`), {
          friends: filterfriends1,
        });
        batch.update(db.doc(`users/${unFriendUserHandle}`), {
          friends: filterfriends2,
        });
      }
      return batch.commit();
    })
    .then(() => {
      res.json({ message: "friend removed" });
    })
    .catch((err) =>
      res.status(500).json({
        message: "removing friend fail",
        errMessage: err.message,
        errCode: err.code,
        err: err,
      })
    );
};

exports.allUsers = (req, res) => {
  let friends = req.userData.friends;
  let requestsSent = req.userData.friendRequestsSent;
  let requestsRecieved = req.userData.friendRequestsRecieved;

  if (!friends) friends = [];
  if (!requestsSent) requestsSent = [];
  if (!requestsRecieved) requestsRecieved = [];

  let noFreiends = () => {
    db.collection("users")
      .orderBy("createdAt")
      .get()
      .then((querySnapshot) => {
        if (!querySnapshot.empty) {
          let sugestedFriends = [];
          querySnapshot.forEach((doc) => {
            sugestedFriends.push({
              userHandle: doc.data().userHandle,
              createdAt: doc.data().createdAt,
              profilePictureUrl: doc.data().profilePictureUrl,
            });
          });
          let filteredSugestedFriends = sugestedFriends.filter((friend) => {
            if (
              friend.userHandle !== req.userData.userHandle &&
              !friends.some((item) => item.userHandle === friend.userHandle) &&
              !requestsSent.some(
                (item) => item.userHandle === friend.userHandle
              ) &&
              !requestsRecieved.some(
                (item) => item.userHandle === friend.userHandle
              )
            ) {
              return true;
            } else {
              return false;
            }
          });

          return res.json(filteredSugestedFriends);
        } else {
          return res.json([]);
        }
      })
      .catch((err) =>
        res.status(500).json({
          message: "getting next friend sugestions failed",
          errMessage: err.message,
          errCode: err.code,
          err: err,
        })
      );
  };

  if (friends) {
    if (friends.length > 5) {
      let promises = [];
      friends.forEach((friend) => {
        if (friend.userHandle != req.userData.userHandle) {
          let promise = db.doc(`users/${friend.userHandle}`).get();
          promises.push(promise);
        }
      });
      Promise.all(promises)
        .then((querySnapshot) => {
          let sugestedFriends = [];
          querySnapshot.forEach((doc) => {
            sugestedFriends.push(...doc.data().friends);
          });
          let filteredSugestedFriends = sugestedFriends.filter((friend) => {
            if (
              friend.userHandle !== req.userData.userHandle &&
              !requestsSent.some(
                (item) => item.userHandle === friend.userHandle
              ) &&
              !requestsRecieved.some(
                (item) => item.userHandle === friend.userHandle
              )
            ) {
              return true;
            } else {
              return false;
            }
          });
          if (filteredSugestedFriends.length > 40) {
            return res.json(filteredSugestedFriends);
          } else {
            noFreiends();
          }
        })
        .catch((err) =>
          res.status(500).json({
            message: "getting next friend sugestions failed",
            errMessage: err.message,
            errCode: err.code,
            err: err,
          })
        );
    } else {
      noFreiends();
    }
  } else {
    noFreiends();
  }
};

exports.searchFriend = (req, res) => {
  db.collection("users")
    .where("searchUserHanlde", ">=", req.params.text.toLowerCase())
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        res.json("nothing");
      } else {
        let data = [];
        querySnapshot.forEach((doc) => {
          data.push(doc.data());
        });
        res.json(data);
      }
    })
    .catch((err) => {
      res.json({ message: err.message });
    });
};

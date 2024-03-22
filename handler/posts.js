const Busboy = require("busboy");
const { db, admin } = require("../util/admin");
const { FieldValue } = require("firebase-admin/firestore");
const { validatePostBody } = require("../util/validation");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

exports.getAllPost = (req, res) => {
  db.collection("posts")
    .where(`toShow.${req.userData.userHandle}`, "==", true)
    .get()
    .then((querySnapshot) => {
      let posts = [];
      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          posts.push({ id: doc.id, ...doc.data() });
        });
        posts.sort((a, b) => -a.createdAt.localeCompare(b.createdAt));
      }
      return res.status(200).json(posts);
    })
    .catch((err) => {
      return res.status(500).json({
        message: "getting posts fail",
        errMessage: err.message,
        errorCode: err.code,
        err: err,
      });
    });
};

exports.uploadOnePost = (req, res) => {
  let friends = req.userData.friends;
  let toShow = {};

  toShow[req.userData.userHandle] = true;

  friends.forEach((friend) => {
    toShow[friend.userHandle] = true;
  });

  let newPost = {
    body: null,
    userHandle: req.userData.userHandle,
    createdAt: new Date().toISOString(),
    profilePicture: req.userData.profilePictureUrl,
    postMedia: null,
    likesCount: 0,
    commentsCount: 0,
    toShow,
  };

  let busboy = Busboy({ headers: req.headers });
  let imageData = {};
  let formData = {};
  let media = false;
  busboy.on("field", (fieldname, val) => {
    formData[fieldname] = val;
  });

  busboy.on("file", (name, file, info) => {
    media = true;
    // if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
    //   res.status(400).json({ other: { error: 'wrong file type' } })
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
    let { errors, valid } = validatePostBody(formData);
    if (!valid) return res.status(400).json(errors);
    newPost.body = formData.body;

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
          const postMediaUrl = `https://firebasestorage.googleapis.com/v0/b/socialmediaapp-53549.appspot.com/o/${imageData.imageFileName}?alt=media&token=${uuid}`;
          newPost.postMediaPath = imageData.imageFileName;
          newPost.postMedia = postMediaUrl;
          db.collection("posts")
            .add(newPost)
            .then((snapshot) => {
              return res.status(200).json({ id: snapshot.id, ...newPost });
            })
            .catch((err) => {
              return res.status(500).json({
                uploadPost: {
                  message: "adding post media fail",
                  errMessage: err.message,
                  errorCode: err.code,
                  err,
                },
              });
            });
        })
        .catch((err) => {
          return res.status(500).json({
            uploadPost: {
              message: "adding post fail",
              errMessage: err.message,
              errorCode: err.code,
              err,
            },
          });
        });
    } else {
      db.collection("posts")
        .add(newPost)
        .then((snapshot) => {
          return res.status(200).json({ id: snapshot.id, ...newPost });
        })
        .catch((err) => {
          return res.status(500).json({
            uploadPost: {
              message: "adding post fail",
              errMessage: err.message,
              errorCode: err.code,
              err,
            },
          });
        });
    }
  });
  req.pipe(busboy);
};

exports.commentPost = (req, res) => {
  if (req.body.body.trim() == "" || req.body.body == null)
    return res.status(400).json({ comment: "Must not be empty" });

  const postId = req.params.postId;

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    userHandle: req.userData.userHandle,
    profilePictureUrl: req.userData.profilePictureUrl,
    postId: postId,
  };

  db.doc(`posts/${postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(400).json({ message: "post not found" });
      } else {
        db.collection("comments")
          .add({
            ...newComment,
            postUserHandle: doc.data().userHandle,
          })
          .then(() => {
            return db.doc(`posts/${postId}`).update({
              commentsCount: FieldValue.increment(1),
            });
          })
          .then(() => {
            return res.status(200).json(newComment);
          })
          .catch((err) => {
            return res.status(500).json({
              message: "adding comment fail",
              errMessage: err.message,
              errorCode: err.code,
              err: err,
            });
          });
      }
    })
    .catch((err) => {
      return res.status(500).json({
        message: "checking post fail",
        errMessage: err.message,
        errorCode: err.code,
        err: err,
      });
    });
};

exports.getPost = (req, res) => {
  let postData = {};
  db.doc(`/posts/${req.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Post not found" });
      }
      postData = doc.data();
      postData.id = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("postId", "==", req.params.postId)
        .get();
    })
    .then((data) => {
      postData.comments = [];
      data.forEach((doc) => {
        postData.comments.push(doc.data());
      });
      return res.json(postData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.likePost = (req, res) => {
  let postId = req.params.postId;
  let userHandle = req.userData.userHandle;

  db.doc(`posts/${postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        res.status(404).json({ err: "post not found" });
      } else {
        db.collection("likes")
          .where("userHandle", "==", userHandle)
          .where("postId", "==", postId)
          .get()
          .then((snapshot) => {
            if (!snapshot.empty) {
              res.json({ mesage: "already liked" });
            } else {
              db.collection("likes")
                .add({
                  postId: postId,
                  postUserHandle: doc.data().userHandle,
                  userHandle: userHandle,
                })
                .then(() => {
                  console.log("Hellooooo");
                  return db.doc(`posts/${postId}`).update({
                    likesCount: FieldValue.increment(1),
                  });
                })
                .then(() => {
                  res.json({ message: "post liked" });
                })
                .catch((err) => {
                  return res.status(500).json({
                    message: "adding like fail",
                    errMessage: err.message,
                    errorCode: err.code,
                    err: err,
                  });
                });
            }
          })
          .catch((err) => {
            return res.status(500).json({
              message: "checking for like doc fail",
              errMessage: err.message,
              errorCode: err.code,
              err: err,
            });
          });
      }
    })
    .catch((err) => {
      return res.status(500).json({
        message: "checking for post to be liked fail",
        errMessage: err.message,
        errorCode: err.code,
        err: err,
      });
    });
};

exports.unlikePost = (req, res) => {
  let postId = req.params.postId;
  let userHandle = req.userData.userHandle;

  db.doc(`posts/${postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        res.status(403).json({ err: "post not found" });
      } else {
        db.collection("likes")
          .where("userHandle", "==", userHandle)
          .where("postId", "==", postId)
          .limit(0)
          .get()
          .then((snapshot) => {
            if (snapshot.empty) {
              res.json({ mesage: "already not liked" });
            } else {
              db.collection("likes")
                .doc(snapshot.docs[0].id)
                .delete()
                .then(() => {
                  console.log("cOMMETTTTTTT");
                  return db.doc(`posts/${postId}`).update({
                    likesCount: FieldValue.increment(-1),
                  });
                })
                .then(() => {
                  res.json({ message: "post unliked" });
                })
                .catch((err) => {
                  return res.status(500).json({
                    message: "unlikng post fail",
                    errMessage: err.message,
                    errorCode: err.code,
                    err: err,
                  });
                });
            }
          })
          .catch((err) => {
            return res.status(500).json({
              message: "checking for unlike doc fail",
              errMessage: err.message,
              errorCode: err.code,
              err: err,
            });
          });
      }
    })
    .catch((err) => {
      return res.status(500).json({
        message: "checking for post to be unliked fail",
        errMessage: err.message,
        errorCode: err.code,
        err: err,
      });
    });
};

exports.deletePost = (req, res) => {
  let postId = req.params.postId;
  db.doc(`posts/${postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        res.status(404).json({ message: "post not found" });
      } else {
        if (req.userData.userHandle === doc.data().userHandle) {
          db.doc(`posts/${postId}`)
            .delete()
            .then(() => {
              res.json({ message: "post deleted successfully" });
            })
            .catch((err) => {
              res.status(500).json({
                message: "deleting post failed",
                errMessage: err.message,
                errCode: err.code,
                err,
              });
            });
        } else {
          res.status(405).json({
            message: "deleting post failed",
            errMessage: "can not delete others post",
          });
        }
      }
    })
    .catch((err) => {
      res.status(500).json({
        message: "checking for post to be deleted failed",
        errMessage: eerr.message,
        errCode: err.code,
        err,
      });
    });
};

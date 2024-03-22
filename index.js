const {
  getAllPost,
  uploadOnePost,
  commentPost,
  getPost,
  likePost,
  unlikePost,
  deletePost,
} = require("./handler/posts");
const { signup, login } = require("./handler/auth");
const {
  getAuthenticUserData,
  getUserData,
  allUsers,
  searchFriend,
  editProfile,
  markNotificationRead,
  addFriend,
  confirmRequest,
  deleteRequest,
  unFriend,
} = require("./handler/users");
const { FBAuth } = require("./util/fbAuth");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const port = process.env.PORT || 4001;

const app = express();
app.use(cors({ origin: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// auth
app.post("/signup", signup); //checked
app.post("/login", login); //checked

// user
app.get("/authenticUser", FBAuth, getAuthenticUserData); //checked
app.get("/user/:userHandle", getUserData); //checked
app.get("/searchUser/:text", searchFriend);
app.post("/user/editProfile", FBAuth, editProfile); //checked
app.post("/notifications", FBAuth, markNotificationRead);

// friends
app.get("/allUsers", FBAuth, allUsers); //checked
app.post("/friendRequest/:userHandle", FBAuth, addFriend); //checked
app.post("/confirmFriendRequest/:userHandle", FBAuth, confirmRequest); //checked
app.delete("/friendRequest/:userHandle", FBAuth, deleteRequest); //checked
app.delete("/unFriend/:userHandle", FBAuth, unFriend); //checked

// posts
app.get("/posts", FBAuth, getAllPost); //checked
app.get("/post/:postId/", getPost); //checked
app.post("/post", FBAuth, uploadOnePost); //checked
app.post("/post/:postId/like", FBAuth, likePost); //checked
app.post("/post/:postId/unlike", FBAuth, unlikePost); //checked
app.post("/post/:postId/comment", FBAuth, commentPost); //checked
app.delete("/post/:postId", FBAuth, deletePost); //checked

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});

const { admin, db } = require("./admin");

exports.FBAuth = (req, res, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      let id = decodedToken.uid;
      db.collection("users")
        .where("userId", "==", id)
        .limit(1)
        .get()
        .then((snapshot) => {
          if (!snapshot.empty) {
            let doc = snapshot.docs[0];
            let data = doc.data();
            req.userData = data;
            return next();
          } else {
            return res.status(403).json({
              message: "verifying token fail",
              errMessage: "user doc not found",
            });
          }
        });
    })
    .catch((err) => {
      return res.status(403).json({
        message: "verifying token fail",
        errMessage: err.message,
        errorCode: err.code,
      });
    });
};

let isEmpty = (string) => {
  if (string === null) return true
  else if (string === undefined) return true
  else if (string === "null") return true
  else if (string === "undefined") return true
  else if (string.trim() === "") return true
  else return false;
};

let isEmail = (email) => {
  let regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regex)) return true;
  else return false;
};

exports.validateSignupData = (data) => {
  let errors = {};

  if (isEmpty(data.email)) {
    errors.email = "Must not be empty";
  } else if (!isEmail(data.email)) {
    errors.email = "Must be a valid email";
  }

  if (isEmpty(data.password)) errors.password = "Must not be empty";
  if (data.password !== data.confirmPassword)
    errors.confirmPassword = "Passwords must match";
  if (isEmpty(data.userHandle)) errors.userHandle = "Must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateLoginData = (data) => {
  let errors = {};

  if (isEmpty(data.email)) errors.email = "Must not be empty";
  else if (!isEmail(data.email)) errors.email = "Must be a valid email";
  if (isEmpty(data.password)) errors.password = "Must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validatePostBody = (data) => {
  let errors = {};

  if (isEmpty(data.body)) errors.postBody = "Must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateUserDetails = (data) => {
  let userDetails = {};
  if (!isEmpty(data.bio)) userDetails.bio = data.bio;
  else userDetails.bio = null;
  if (!isEmpty(data.location)) userDetails.location = data.location;
  else userDetails.location = null;
  if (!isEmpty(data.website)) {
    if (data.website.trim().substring(0, 4) !== 'http') {
      userDetails.website = `http://${data.website}`
    } else {
      userDetails.website = data.website;
    }
  }
  else userDetails.website = null;

  return userDetails;
}
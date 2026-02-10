// formMappings.js
module.exports = {
  "https://gov-portal.com/schemeX": {
    name: "#fullName",
    email: "#emailField",
    phone: "#phoneInput",
    address: "#addr",
    complaint: "#details",
    submit: "#submitBtn"
  },
  "https://ngo-form.org/report": {
    name: "input[name='user_name']",
    email: "input[name='user_email']",
    complaint: "textarea[name='description']",
    submit: "button[type='submit']"
  }
};

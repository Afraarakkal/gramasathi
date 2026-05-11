// formMappings.js

const BASE_URL = "http://localhost:3000/forms";

module.exports = {

  // ---------------- EXTERNAL (keep as-is) ----------------
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
  },

  // ---------------- LOCAL FORMS ----------------

  [`${BASE_URL}/dummyForm.html`]: {
    name: "#fullName",
    email: "#emailField",
    phone: "#phoneInput",
    address: "#addr",
    complaint: "#details",
    submit: "#submitBtn"
  },

  [`${BASE_URL}/form.html`]: {
    name: "#name",
    aadhaar_number: "#aadhaar_number",
    phone: "#phone",
    submit: "button[type='submit']"
  },

  [`${BASE_URL}/incomeform.html`]: {
    name: "#name",
    father_name: "#father_name",
    dob: "#dob",
    gender: "#gender",
    aadhaar_number: "#aadhaar_number",
    house_number: "#house_number",
    village: "#village",
    tehsil: "#tehsil",
    district: "#district",
    state: "#state",
    pin_code: "#pin_code",
    phone: "#phone",
    email: "#email",
    purpose: "#purpose",
    reason: "#reason",
    income: "#income",
    financial_year: "#financial_year",
    bank_name: "#bank_name",
    college: "#college",
    course: "#course",
    duration: "#duration",
    session: "#session",
    declaration: "#declaration",
    date: "#date",
    place: "#place",
    signature: "#signature",
    submit: "#submit"
  }

};
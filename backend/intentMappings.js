// intentMappings.js

const BASE_URL = "http://localhost:3000/forms";

module.exports = {

  // ---------------- CIVIC COMPLAINTS ----------------
  water_complaint: `${BASE_URL}/complaintForm.html`,
  streetlight_issue: `${BASE_URL}/complaintForm.html`,
  road_damage: `${BASE_URL}/complaintForm.html`,
  drainage_issue: `${BASE_URL}/complaintForm.html`,
  waste_collection: `${BASE_URL}/complaintForm.html`,
  electricity_issue: `${BASE_URL}/complaintForm.html`,
  public_toilet_issue: `${BASE_URL}/complaintForm.html`,
  bus_stop_issue: `${BASE_URL}/complaintForm.html`,
  cemetery_issue: `${BASE_URL}/complaintForm.html`,
  complaint_general: `${BASE_URL}/complaintForm.html`,

  // ---------------- PENSIONS ----------------
  pension_query: `${BASE_URL}/form.html`,
  widow_pension: `${BASE_URL}/form.html`,
  disability_pension: `${BASE_URL}/form.html`,
  old_age_pension: `${BASE_URL}/form.html`,

  // ---------------- CERTIFICATES ----------------
  birth_certificate_request: `${BASE_URL}/birthForm.html`,
  death_certificate_request: `${BASE_URL}/deathForm.html`,
  marriage_certificate_request: `${BASE_URL}/marriageForm.html`,

  income_certificate_request: `${BASE_URL}/incomeform.html`,
  caste_certificate_request: `${BASE_URL}/aadhaarCertificateForm.html`,
  residence_certificate_request: `${BASE_URL}/aadhaarCertificateForm.html`,

  // ---------------- TAX & PROPERTY ----------------
  property_tax_query: `${BASE_URL}/propertyTaxForm.html`,
  property_tax_payment: `${BASE_URL}/propertyTaxForm.html`,
  land_tax_query: `${BASE_URL}/landTaxForm.html`,

  // ---------------- LICENSES ----------------
  trade_license_request: `${BASE_URL}/tradeLicenseForm.html`,
  trade_license_renewal: `${BASE_URL}/tradeLicenseForm.html`,

  // ---------------- BUILDING ----------------
  building_permit_query: `${BASE_URL}/buildingPermitForm.html`,
  building_permit_status: `${BASE_URL}/statusForm.html`,

  // ---------------- UTILITIES ----------------
  water_connection_request: `${BASE_URL}/connectionForm.html`,
  sewer_connection_request: `${BASE_URL}/connectionForm.html`,

  // ---------------- SOCIAL SERVICES ----------------
  ration_card_issue: `${BASE_URL}/rationForm.html`,
  ration_card_new: `${BASE_URL}/rationForm.html`,

  health_card_query: `${BASE_URL}/aadhaarQueryForm.html`,
  school_scholarship_query: `${BASE_URL}/scholarshipForm.html`,
  farm_subsidy_query: `${BASE_URL}/farmForm.html`,

  self_help_group_query: `${BASE_URL}/shgForm.html`,
  anganwadi_query: `${BASE_URL}/anganwadiForm.html`,

  // ---------------- MISC ----------------
  tree_cutting_permission: `${BASE_URL}/permissionForm.html`,
  street_name_request: `${BASE_URL}/municipalRequestForm.html`,

  employment_registration: `${BASE_URL}/employmentForm.html`,
  job_card_query: `${BASE_URL}/jobCardForm.html`,

  document_status_query: `${BASE_URL}/statusForm.html`
};
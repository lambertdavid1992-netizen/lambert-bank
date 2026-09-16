"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Image from "next/image";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const COUNTRY_DIAL_CODES = [
  { code: "+93", country: "Afghanistan" },
  { code: "+355", country: "Albania" },
  { code: "+213", country: "Algeria" },
  { code: "+376", country: "Andorra" },
  { code: "+244", country: "Angola" },
  { code: "+1-268", country: "Antigua and Barbuda" },
  { code: "+54", country: "Argentina" },
  { code: "+374", country: "Armenia" },
  { code: "+61", country: "Australia" },
  { code: "+43", country: "Austria" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+1-242", country: "Bahamas" },
  { code: "+973", country: "Bahrain" },
  { code: "+880", country: "Bangladesh" },
  { code: "+1-246", country: "Barbados" },
  { code: "+375", country: "Belarus" },
  { code: "+32", country: "Belgium" },
  { code: "+501", country: "Belize" },
  { code: "+229", country: "Benin" },
  { code: "+975", country: "Bhutan" },
  { code: "+591", country: "Bolivia" },
  { code: "+387", country: "Bosnia and Herzegovina" },
  { code: "+267", country: "Botswana" },
  { code: "+55", country: "Brazil" },
  { code: "+673", country: "Brunei" },
  { code: "+359", country: "Bulgaria" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+257", country: "Burundi" },
  { code: "+238", country: "Cabo Verde" },
  { code: "+855", country: "Cambodia" },
  { code: "+237", country: "Cameroon" },
  { code: "+1", country: "Canada" },
  { code: "+236", country: "Central African Republic" },
  { code: "+235", country: "Chad" },
  { code: "+56", country: "Chile" },
  { code: "+86", country: "China" },
  { code: "+57", country: "Colombia" },
  { code: "+269", country: "Comoros" },
  { code: "+242", country: "Congo" },
  { code: "+506", country: "Costa Rica" },
  { code: "+385", country: "Croatia" },
  { code: "+53", country: "Cuba" },
  { code: "+357", country: "Cyprus" },
  { code: "+420", country: "Czechia" },
  { code: "+45", country: "Denmark" },
  { code: "+253", country: "Djibouti" },
  { code: "+1-767", country: "Dominica" },
  { code: "+1-809", country: "Dominican Republic" },
  { code: "+593", country: "Ecuador" },
  { code: "+20", country: "Egypt" },
  { code: "+503", country: "El Salvador" },
  { code: "+240", country: "Equatorial Guinea" },
  { code: "+291", country: "Eritrea" },
  { code: "+372", country: "Estonia" },
  { code: "+268", country: "Eswatini" },
  { code: "+251", country: "Ethiopia" },
  { code: "+679", country: "Fiji" },
  { code: "+358", country: "Finland" },
  { code: "+33", country: "France" },
  { code: "+241", country: "Gabon" },
  { code: "+220", country: "Gambia" },
  { code: "+995", country: "Georgia" },
  { code: "+49", country: "Germany" },
  { code: "+233", country: "Ghana" },
  { code: "+30", country: "Greece" },
  { code: "+1-473", country: "Grenada" },
  { code: "+502", country: "Guatemala" },
  { code: "+224", country: "Guinea" },
  { code: "+245", country: "Guinea-Bissau" },
  { code: "+592", country: "Guyana" },
  { code: "+509", country: "Haiti" },
  { code: "+504", country: "Honduras" },
  { code: "+36", country: "Hungary" },
  { code: "+354", country: "Iceland" },
  { code: "+91", country: "India" },
  { code: "+62", country: "Indonesia" },
  { code: "+98", country: "Iran" },
  { code: "+964", country: "Iraq" },
  { code: "+353", country: "Ireland" },
  { code: "+972", country: "Israel" },
  { code: "+39", country: "Italy" },
  { code: "+1-876", country: "Jamaica" },
  { code: "+81", country: "Japan" },
  { code: "+962", country: "Jordan" },
  { code: "+7", country: "Kazakhstan" },
  { code: "+254", country: "Kenya" },
  { code: "+686", country: "Kiribati" },
  { code: "+850", country: "Korea, North" },
  { code: "+82", country: "Korea, South" },
  { code: "+965", country: "Kuwait" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+856", country: "Laos" },
  { code: "+371", country: "Latvia" },
  { code: "+961", country: "Lebanon" },
  { code: "+266", country: "Lesotho" },
  { code: "+231", country: "Liberia" },
  { code: "+218", country: "Libya" },
  { code: "+423", country: "Liechtenstein" },
  { code: "+370", country: "Lithuania" },
  { code: "+352", country: "Luxembourg" },
  { code: "+261", country: "Madagascar" },
  { code: "+265", country: "Malawi" },
  { code: "+60", country: "Malaysia" },
  { code: "+960", country: "Maldives" },
  { code: "+223", country: "Mali" },
  { code: "+356", country: "Malta" },
  { code: "+692", country: "Marshall Islands" },
  { code: "+222", country: "Mauritania" },
  { code: "+230", country: "Mauritius" },
  { code: "+52", country: "Mexico" },
  { code: "+691", country: "Micronesia" },
  { code: "+373", country: "Moldova" },
  { code: "+377", country: "Monaco" },
  { code: "+976", country: "Mongolia" },
  { code: "+382", country: "Montenegro" },
  { code: "+212", country: "Morocco" },
  { code: "+258", country: "Mozambique" },
  { code: "+95", country: "Myanmar" },
  { code: "+264", country: "Namibia" },
  { code: "+674", country: "Nauru" },
  { code: "+977", country: "Nepal" },
  { code: "+31", country: "Netherlands" },
  { code: "+64", country: "New Zealand" },
  { code: "+505", country: "Nicaragua" },
  { code: "+227", country: "Niger" },
  { code: "+234", country: "Nigeria" },
  { code: "+389", country: "North Macedonia" },
  { code: "+47", country: "Norway" },
  { code: "+968", country: "Oman" },
  { code: "+92", country: "Pakistan" },
  { code: "+680", country: "Palau" },
  { code: "+970", country: "Palestine" },
  { code: "+507", country: "Panama" },
  { code: "+675", country: "Papua New Guinea" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Peru" },
  { code: "+63", country: "Philippines" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+974", country: "Qatar" },
  { code: "+40", country: "Romania" },
  { code: "+7", country: "Russia" },
  { code: "+250", country: "Rwanda" },
  { code: "+1-869", country: "Saint Kitts and Nevis" },
  { code: "+1-758", country: "Saint Lucia" },
  { code: "+1-784", country: "Saint Vincent and the Grenadines" },
  { code: "+685", country: "Samoa" },
  { code: "+378", country: "San Marino" },
  { code: "+239", country: "Sao Tome and Principe" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+221", country: "Senegal" },
  { code: "+381", country: "Serbia" },
  { code: "+248", country: "Seychelles" },
  { code: "+232", country: "Sierra Leone" },
  { code: "+65", country: "Singapore" },
  { code: "+421", country: "Slovakia" },
  { code: "+386", country: "Slovenia" },
  { code: "+677", country: "Solomon Islands" },
  { code: "+252", country: "Somalia" },
  { code: "+27", country: "South Africa" },
  { code: "+211", country: "South Sudan" },
  { code: "+34", country: "Spain" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+249", country: "Sudan" },
  { code: "+597", country: "Suriname" },
  { code: "+46", country: "Sweden" },
  { code: "+41", country: "Switzerland" },
  { code: "+963", country: "Syria" },
  { code: "+886", country: "Taiwan" },
  { code: "+992", country: "Tajikistan" },
  { code: "+255", country: "Tanzania" },
  { code: "+66", country: "Thailand" },
  { code: "+670", country: "Timor-Leste" },
  { code: "+228", country: "Togo" },
  { code: "+676", country: "Tonga" },
  { code: "+1-868", country: "Trinidad and Tobago" },
  { code: "+216", country: "Tunisia" },
  { code: "+90", country: "Turkey" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+688", country: "Tuvalu" },
  { code: "+256", country: "Uganda" },
  { code: "+380", country: "Ukraine" },
  { code: "+971", country: "United Arab Emirates" },
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States" },
  { code: "+598", country: "Uruguay" },
  { code: "+998", country: "Uzbekistan" },
  { code: "+678", country: "Vanuatu" },
  { code: "+379", country: "Vatican City" },
  { code: "+58", country: "Venezuela" },
  { code: "+84", country: "Vietnam" },
  { code: "+967", country: "Yemen" },
  { code: "+260", country: "Zambia" },
  { code: "+263", country: "Zimbabwe" }
];

const RELIGIONS = [
  "Born Again",
  "Messianic",
  "Pentecostal",
  "Protestant",
  "Catholic",
  "Jewish",
  "Buddhist",
  "Muslim",
  "Agnostic",
  "Atheist/None",
  "Confused",
  "Open-Minded",
  "Other"
];

const RESERVED_USERNAMES = [
  "kingdavid",
  "admin",
  "system",
  "support",
  "bank",
  "socialtime",
  "social",
  "davidlambert",
  "lambert1992",
  "lambert",
  "administrator",
  "socialtimeadmin",
  "superadmin",
  "superuser",
  "root",
  "officialsocial",
  "socialtimesupport"
];

const MONTHS = [
  { value: "01", name: "January" },
  { value: "02", name: "February" },
  { value: "03", name: "March" },
  { value: "04", name: "April" },
  { value: "05", name: "May" },
  { value: "06", name: "June" },
  { value: "07", name: "July" },
  { value: "08", name: "August" },
  { value: "09", name: "September" },
  { value: "10", name: "October" },
  { value: "11", name: "November" },
  { value: "12", name: "December" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [view, setView] = useState<"SIGNIN" | "SIGNUP">("SIGNIN");
  const [loginStep, setLoginStep] = useState<"CREDENTIALS" | "PIN_VERIFY">("CREDENTIALS");
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState(""); 
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  
  const [phoneCode, setPhoneCode] = useState("+61");
  const [mobileNumber, setMobileNumber] = useState("");
  const [gender, setGender] = useState("");
  const [religion, setReligion] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [streetAddress1, setStreetAddress1] = useState("");
  const [streetAddress2, setStreetAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("Australia");

  const [error, setError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pinError, setPinError] = useState("");
  const [dobError, setDobError] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cascading Field Unlocking Conditions
  const isFirstNameDisabled = !photoFile;
  const isLastNameDisabled = isFirstNameDisabled || !firstName.trim() || Boolean(firstNameError);
  const isDobDayDisabled = isLastNameDisabled || !lastName.trim() || Boolean(lastNameError);
  const isDobMonthDisabled = isDobDayDisabled || !dobDay;
  const isDobYearDisabled = isDobMonthDisabled || !dobMonth;
  const isGenderDisabled = isDobYearDisabled || !dobYear || Boolean(dobError);
  const isReligionDisabled = isGenderDisabled || !gender;
  const isEmploymentDisabled = isReligionDisabled || !religion;
  const isPhoneCodeDisabled = isEmploymentDisabled || !employmentStatus;
  const isMobileNumberDisabled = isPhoneCodeDisabled;
  const isStreet1Disabled = isEmploymentDisabled || !employmentStatus;
  const isStreet2Disabled = isStreet1Disabled || !streetAddress1.trim();
  const isCityDisabled = isStreet1Disabled || !streetAddress1.trim();
  const isStateDisabled = isCityDisabled || !city.trim();
  const isPostcodeDisabled = isStateDisabled || !stateProvince.trim();
  const isCountryDisabled = isPostcodeDisabled || !postcode.trim();
  const isUsernameDisabled = isCountryDisabled || !country;
  
  // 1. Email unlocks after Username is valid and not in use
  const isEmailDisabled = isUsernameDisabled || !username.trim() || Boolean(usernameError);
  
  // 2. Password & Confirm Password unlock together after Email is valid
  const isPasswordDisabled = isEmailDisabled || !email.trim() || Boolean(emailError);
  const isConfirmPasswordDisabled = isPasswordDisabled;

  // 3. Pin & Confirm Pin unlock together after Password fields are completed
  const isPinDisabled = isConfirmPasswordDisabled || !password || !confirmPassword || Boolean(passwordError);
  const isConfirmPinDisabled = isPinDisabled;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => String(currentYear - i));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  // Helper to clear all other field errors except the currently active one
  const clearErrorsExcept = (activeField: string) => {
    if (activeField !== "firstName") setFirstNameError("");
    if (activeField !== "lastName") setLastNameError("");
    if (activeField !== "dob") setDobError("");
    if (activeField !== "username") setUsernameError("");
    if (activeField !== "email") setEmailError("");
    if (activeField !== "password") setPasswordError("");
    if (activeField !== "pin") setPinError("");
  };

  // Complete clean slate form wiper
  const resetFormState = () => {
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPin("");
    setConfirmPin("");
    setFirstName("");
    setLastName("");
    setUsername("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
    setPhoneCode("+61");
    setMobileNumber("");
    setGender("");
    setReligion("");
    setEmploymentStatus("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setStreetAddress1("");
    setStreetAddress2("");
    setCity("");
    setStateProvince("");
    setPostcode("");
    setCountry("Australia");
    setFirstNameError("");
    setLastNameError("");
    setUsernameError("");
    setEmailError("");
    setPasswordError("");
    setPinError("");
    setDobError("");
    setPhotoError(false);
    setLoginStep("CREDENTIALS");
    setTempUserId(null);
  };

  const getCombinedDob = () => {
    if (!dobDay || !dobMonth || !dobYear) return "";
    return `${dobYear}-${dobMonth}-${dobDay}`;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoError(false);
    }
  };

  // Instant blur & character checkers with single-warning isolation
  const checkFirstName = () => {
    const nameRegex = /[^a-zA-Z\s'-]/;
    if (!firstName.trim()) {
      setFirstNameError("First name is required.");
    } else if (nameRegex.test(firstName)) {
      setFirstNameError("Not Legal");
    } else {
      setFirstNameError("");
    }
    clearErrorsExcept("firstName");
  };

  const checkLastName = () => {
    const nameRegex = /[^a-zA-Z\s'-]/;
    if (!lastName.trim()) {
      setLastNameError("Last name is required.");
    } else if (nameRegex.test(lastName)) {
      setLastNameError("Not Legal");
    } else {
      setLastNameError("");
    }
    clearErrorsExcept("lastName");
  };

  const checkDobLive = (day: string, month: string, year: string) => {
    if (!day || !month || !year) {
      setDobError("Date of birth is incomplete.");
      clearErrorsExcept("dob");
      return;
    }
    const combined = `${year}-${month}-${day}`;
    const selectedDate = new Date(combined);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      setDobError("Cannot be in the future.");
    } else {
      setDobError("");
    }
    clearErrorsExcept("dob");
  };

  const checkEmail = async (currentVal?: string) => {
    const val = (currentVal !== undefined ? currentVal : email).trim();
    if (!val) {
      setEmailError(view === "SIGNUP" ? "Email is required." : "Email or username is required.");
      clearErrorsExcept("email");
      return;
    }
    
    // Only require @ symbol validation for SIGNUP. SIGNIN can accept usernames without @.
    if (view === "SIGNUP" && !val.includes("@")) {
      setEmailError("Must contain @");
      clearErrorsExcept("email");
      return;
    }

    if (view === "SIGNUP") {
      const cleanEmail = val.toLowerCase();
      const { data: existingEmail } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingEmail) {
        setEmailError("Already registered.");
      } else {
        setEmailError("");
      }
    } else {
      setEmailError("");
    }
    clearErrorsExcept("email");
  };

  const checkPasswordsLive = (pwd: string, confirmPwd: string) => {
    setPassword(pwd);
    setConfirmPassword(confirmPwd);
    if (confirmPwd && pwd !== confirmPwd) {
      setPasswordError("Passwords do not match.");
    } else {
      setPasswordError("");
    }
    clearErrorsExcept("password");
  };

  const checkPinLive = (p: string, confirmP: string) => {
    setPin(p);
    setConfirmPin(confirmP);
    const pinRegex = /\D/;
    if (confirmP && pinRegex.test(confirmP)) {
      setPinError("Digits only required.");
    } else if (confirmP && confirmP.length > 6) {
      setPinError("Must be exactly 6 digits.");
    } else if (confirmP && p !== confirmP) {
      setPinError("PINs do not match.");
    } else {
      setPinError("");
    }
    clearErrorsExcept("pin");
  };

  const checkPin = () => {
    const pinRegex = /\D/;
    if (!pin) {
      setPinError("PIN is required.");
    } else if (pinRegex.test(pin)) {
      setPinError("Digits only required.");
    } else if (pin.length !== 6) {
      setPinError("Must be exactly 6 digits.");
    } else {
      setPinError("");
    }
    clearErrorsExcept("pin");
  };

  const checkUsernameAvailability = async (currentVal?: string) => {
    const cleanUser = (currentVal !== undefined ? currentVal : username).trim().toLowerCase();
    if (!cleanUser) {
      setUsernameError("Username is required.");
      clearErrorsExcept("username");
      return;
    }

    if (cleanUser.length < 5 || cleanUser.length > 20) {
      setUsernameError("Must be 5–20 characters.");
      clearErrorsExcept("username");
      return;
    }

    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(cleanUser)) {
      setUsernameError("Letters and numbers only.");
      clearErrorsExcept("username");
      return;
    }

    if (RESERVED_USERNAMES.includes(cleanUser)) {
      setUsernameError("Username is reserved.");
      clearErrorsExcept("username");
      return;
    }

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", cleanUser)
      .maybeSingle();

    if (existingUsername) {
      setUsernameError("Already taken.");
    } else {
      setUsernameError("");
    }
    clearErrorsExcept("username");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (view === "SIGNUP") {
      if (!photoFile) {
        setError("Profile Identity Photo is mandatory.");
        setPhotoError(true);
        setLoading(false);
        return;
      }

      const finalDob = getCombinedDob();
      if (!firstName.trim() || !lastName.trim() || !username.trim() || !finalDob || !gender || !religion || !employmentStatus || !streetAddress1.trim() || !city.trim() || !stateProvince.trim() || !postcode.trim() || !email.trim() || !password.trim() || !confirmPassword.trim() || !pin.trim() || !confirmPin.trim()) {
        setError("Please fill out all required address, password, and PIN fields.");
        setLoading(false);
        return;
      }

      const selectedDate = new Date(finalDob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        setError("Date of birth cannot be in the future.");
        setDobError("Cannot be in the future.");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setPasswordError("Passwords do not match.");
        setLoading(false);
        return;
      }

      if (pin !== confirmPin) {
        setError("2FA PINs do not match.");
        setPinError("PINs do not match.");
        setLoading(false);
        return;
      }

      const nameRegex = /[^a-zA-Z\s'-]/;
      if (nameRegex.test(firstName) || nameRegex.test(lastName)) {
        setError("Legal First and Last names cannot contain numbers or special symbols.");
        setLoading(false);
        return;
      }

      if (!email.includes("@")) {
        setError("Email address must contain an '@' symbol.");
        setEmailError("Must contain @");
        setLoading(false);
        return;
      }

      const pinRegex = /\D/;
      if (pinRegex.test(pin) || pin.length !== 6) {
        setError("Security 2FA PIN must be exactly 6 digits (numbers only).");
        setPinError("Must be 6 digits.");
        setLoading(false);
        return;
      }

      const cleanUser = username.trim().toLowerCase();
      
      if (cleanUser.length < 5 || cleanUser.length > 20) {
        setError("Username must be between 5 and 20 characters long.");
        setUsernameError("Must be 5–20 characters.");
        setLoading(false);
        return;
      }

      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      if (!alphanumericRegex.test(cleanUser)) {
        setError("Username can only contain letters and numbers (no spaces or special characters).");
        setUsernameError("Letters and numbers only.");
        setLoading(false);
        return;
      }

      if (RESERVED_USERNAMES.includes(cleanUser)) {
        setError("The username is reserved and cannot be registered.");
        setUsernameError("Reserved username.");
        setLoading(false);
        return;
      }

      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", cleanUser)
        .maybeSingle();

      if (existingUsername) {
        setError("This username (Payment ID) is already in use. Please choose another.");
        setUsernameError("Already taken.");
        setLoading(false);
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const { data: existingEmail } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingEmail) {
        setError("This email address is already registered.");
        setEmailError("Already registered.");
        setLoading(false);
        return;
      }

      const fullFormattedAddress = `${streetAddress1.trim()}${streetAddress2 ? `, ${streetAddress2.trim()}` : ""}, ${city.trim()}, ${stateProvince.trim()} ${postcode.trim()}, ${country}`;
      const fullMobile = mobileNumber.trim() ? `${phoneCode} ${mobileNumber.trim()}` : null;

      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("first_name", firstName.trim())
        .eq("last_name", lastName.trim())
        .eq("dob", finalDob)
        .eq("address", fullFormattedAddress);

      if (existingProfiles && existingProfiles.length > 0) {
        setError("An account with this Name, Date of Birth, and Address already exists. Multiple accounts are not permitted.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email: cleanEmail, 
        password: password.trim() 
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        let publicPhotoUrl = null;

        if (photoFile) {
          const fileExt = photoFile.name.split('.').pop();
          const fileName = `${authData.user.id}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, photoFile);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('profile-photos')
              .getPublicUrl(fileName);
            
            publicPhotoUrl = publicUrlData.publicUrl;
          } else {
            console.error("Storage upload failed:", uploadError.message);
            setError("Photo upload failed: " + uploadError.message);
            setLoading(false);
            return;
          }
        }

        const { error: profileError } = await supabase.from("profiles").upsert({
          user_id: authData.user.id,
          username: username.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: finalDob,
          address: fullFormattedAddress,
          email: cleanEmail,
          mobile_phone: fullMobile,
          gender: gender,
          religion: religion,
          employment_status: employmentStatus,
          photo_url: publicPhotoUrl,
          pin: pin.trim(),
          balance_cents: 0,
          is_approved: false,
          accumulated_session_seconds: 0
        });

        if (profileError) {
          setError("Registration failed: " + profileError.message);
        } else {
          const newSessionId = `SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          await supabase
            .from("profiles")
            .update({ active_session_id: newSessionId })
            .eq("user_id", authData.user.id);

          sessionStorage.setItem("socialtime_active_token", newSessionId);

          router.push("/");
          router.refresh();
        }
      }
    } else if (view === "SIGNIN") {
      if (loginStep === "CREDENTIALS") {
        let loginIdentifier = email.trim();
        let targetEmail = loginIdentifier;

        if (!loginIdentifier.includes("@")) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .ilike("username", loginIdentifier)
            .maybeSingle();

          if (profileError || !profileData || !profileData.email) {
            setError("No account found with this username or email.");
            setLoading(false);
            return;
          }
          targetEmail = profileData.email;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: targetEmail, 
          password: password.trim() 
        });
        
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        if (data.session && data.user) {
          setTempUserId(data.user.id);
          setLoginStep("PIN_VERIFY");
          setError("");
        }
      } else if (loginStep === "PIN_VERIFY") {
        if (!tempUserId || pin.length !== 6) {
          setError("Please enter your valid 6-digit 2FA PIN.");
          setLoading(false);
          return;
        }

        const { data: isPinValid, error: rpcError } = await supabase.rpc("verify_user_pin", {
          entered_pin: pin.trim()
        });

        if (rpcError || !isPinValid) {
          setError("Incorrect 2FA PIN. Access denied.");
          setLoading(false);
          return;
        }

        const newSessionId = `SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            active_session_id: newSessionId
          })
          .eq("user_id", tempUserId);

        if (updateError) {
          setError("Session registration failed: " + updateError.message);
          setLoading(false);
          return;
        }

        sessionStorage.setItem("socialtime_active_token", newSessionId);

        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-start pt-0 sm:pt-8 pb-8 px-2 sm:px-4 font-sans overflow-y-auto">
      <div className="bg-black md:bg-zinc-950 rounded-none sm:rounded-2xl shadow-2xl w-full max-w-xl p-4 sm:p-8 space-y-6 text-white mt-0 sm:my-auto">
        
        <div className="flex items-start justify-between pb-4">
          <div className="flex items-start gap-3">
            <div className="relative w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="Logo" fill sizes="40px" className="object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-wider">SOCIAL TIME</h1>
              <p className="text-[10px] text-white block italic mt-0.5">&quot;Spending time, together.&quot;</p>
            </div>
          </div>
          <div className="text-xs font-bold text-white tracking-wide shrink-0 pt-1">
            {loginStep === "PIN_VERIFY" ? "2FA VERIFICATION" : ""}
          </div>
        </div>

        {/* Top Tab Switcher ("Sign In" and "Register") */}
        <div className="flex border-b border-zinc-800">
          <button
            type="button"
            onClick={() => { resetFormState(); setView("SIGNIN"); }}
            className={`flex-1 py-6 text-xl font-black uppercase tracking-wider border-b-8 transition cursor-pointer text-center ${
              view === "SIGNIN" ? "border-[#e7b833] text-[#e7b833]" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { resetFormState(); setView("SIGNUP"); }}
            className={`flex-1 py-6 text-xl font-black uppercase tracking-wider border-b-8 transition cursor-pointer text-center ${
              view === "SIGNUP" ? "border-[#e7b833] text-[#e7b833]" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Register
          </button>
        </div>

        {/* Top Error / Warning Banner */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-300 text-xs p-3 rounded font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {view === "SIGNUP" && (
            <div className="space-y-5">
              {/* Profile Identity Photo Upload Box at the Very Top */}
              <div className="flex flex-col items-center justify-center pb-2">
                <div className="mb-2 text-center">
                  <span className="block text-[11px] font-extrabold text-gray-200 uppercase tracking-wide">Profile Identity Photo (Mandatory)</span>
                </div>
                <label className={`relative w-28 h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer bg-zinc-700 transition overflow-hidden group ${
                  photoError ? "border-rose-500 bg-rose-950/30" : "border-zinc-500 hover:border-[#e7b833] hover:bg-zinc-600"
                }`}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile Identity Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2">
                      <svg className={`w-8 h-8 mx-auto mb-1 transition ${photoError ? "text-rose-400 group-hover:text-rose-500" : "text-gray-300 group-hover:text-[#e7b833]"}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                      <span className={`text-[10px] font-semibold block leading-tight ${photoError ? "text-rose-400" : "text-gray-300"}`}>Upload Photo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <span className="text-[10px] text-gray-400 mt-1">Clear face portrait (JPEG, PNG)</span>
                {!photoFile && (
                  <span className="text-[11px] text-amber-400 font-bold mt-2 text-center animate-pulse">
                    🔒 Please upload a profile photo above to unlock the registration form.
                  </span>
                )}
              </div>

              {/* Personal Information Section */}
              <div className="space-y-3 pt-2">
                <span className="block text-[11px] font-extrabold text-gray-200 uppercase tracking-wide">Personal Information</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-gray-300 uppercase">Legal First Name</label>
                      {firstNameError && (
                        <span className="text-[10px] font-bold text-rose-400">{firstNameError}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={isFirstNameDisabled}
                      value={firstName}
                      onFocus={() => setFirstNameError("")}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (firstNameError) setFirstNameError("");
                      }}
                      onBlur={checkFirstName}
                      placeholder=""
                      className={`w-full border rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                        firstNameError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-gray-300 uppercase">Legal Last Name</label>
                      {lastNameError && (
                        <span className="text-[10px] font-bold text-rose-400">{lastNameError}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={isLastNameDisabled}
                      value={lastName}
                      onFocus={() => setLastNameError("")}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (lastNameError) setLastNameError("");
                      }}
                      onBlur={checkLastName}
                      placeholder=""
                      className={`w-full border rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                        lastNameError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Date of Birth</label>
                    {dobError && (
                      <span className="text-[10px] font-bold text-rose-400">{dobError}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      required
                      disabled={isDobDayDisabled}
                      value={dobDay}
                      onFocus={() => setDobError("")}
                      onChange={(e) => {
                        setDobDay(e.target.value);
                        checkDobLive(e.target.value, dobMonth, dobYear);
                      }}
                      onBlur={() => checkDobLive(dobDay, dobMonth, dobYear)}
                      className="border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Day</option>
                      {days.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    <select
                      required
                      disabled={isDobMonthDisabled}
                      value={dobMonth}
                      onFocus={() => setDobError("")}
                      onChange={(e) => {
                        setDobMonth(e.target.value);
                        checkDobLive(dobDay, e.target.value, dobYear);
                      }}
                      onBlur={() => checkDobLive(dobDay, dobMonth, dobYear)}
                      className="border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>{m.name}</option>
                      ))}
                    </select>

                    <select
                      required
                      disabled={isDobYearDisabled}
                      value={dobYear}
                      onFocus={() => setDobError("")}
                      onChange={(e) => {
                        setDobYear(e.target.value);
                        checkDobLive(dobDay, dobMonth, e.target.value);
                      }}
                      onBlur={() => checkDobLive(dobDay, dobMonth, dobYear)}
                      className="border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Year</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">Gender</label>
                    <select
                      required
                      disabled={isGenderDisabled}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">Religion</label>
                    <select
                      required
                      disabled={isReligionDisabled}
                      value={religion}
                      onChange={(e) => setReligion(e.target.value)}
                      className="w-full border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Religion</option>
                      {RELIGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">Employment Status</label>
                  <select
                    required
                    disabled={isEmploymentDisabled}
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Status</option>
                    <option value="Employed">Employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Student">Student</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">Mobile Phone</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      disabled={isPhoneCodeDisabled}
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {COUNTRY_DIAL_CODES.map((item, index) => (
                        <option key={`${item.code}-${index}`} value={item.code}>
                          {item.code} ({item.country})
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      disabled={isMobileNumberDisabled}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder=""
                      className="col-span-2 border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Standardized International Address Fields */}
              <div className="space-y-3 pt-2">
                <span className="block text-[11px] font-extrabold text-gray-200 uppercase tracking-wide">Residential Address</span>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Street Address / Line 1</label>
                  <input
                    type="text"
                    required
                    disabled={isStreet1Disabled}
                    value={streetAddress1}
                    onChange={(e) => setStreetAddress1(e.target.value)}
                    placeholder=""
                    className="w-full border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Apartment, Suite, Unit, Building (Optional)</label>
                  <input
                    type="text"
                    disabled={isStreet2Disabled}
                    value={streetAddress2}
                    onChange={(e) => setStreetAddress2(e.target.value)}
                    placeholder=""
                    className="w-full border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">City / Town / Suburb</label>
                    <input
                      type="text"
                      required
                      disabled={isCityDisabled}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">State / Province / Region</label>
                    <input
                      type="text"
                      required
                      disabled={isStateDisabled}
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      className="w-full border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Postal Code / ZIP</label>
                    <input
                      type="text"
                      required
                      disabled={isPostcodeDisabled}
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      className="w-full border border-zinc-500 bg-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b833] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Country</label>
                    <select
                      disabled={isCountryDisabled}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full border border-zinc-500 rounded p-2 text-xs text-white bg-zinc-700 focus:outline-none focus:border-[#e7b833] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {COUNTRIES.map((c, index) => (
                        <option key={`${c}-${index}`} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Login Credentials Section */}
              <div className="space-y-3 pt-2">
                <span className="block text-[11px] font-extrabold text-gray-200 uppercase tracking-wide">Login Credentials</span>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Username (Payment ID)</label>
                    {usernameError && (
                      <span className="text-[10px] font-bold text-rose-400">{usernameError}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    disabled={isUsernameDisabled}
                    value={username}
                    onFocus={() => setUsernameError("")}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      checkUsernameAvailability(e.target.value);
                    }}
                    onBlur={() => checkUsernameAvailability(username)}
                    placeholder=""
                    className={`w-full border rounded p-2.5 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                      usernameError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                    }`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Email Address</label>
                    {emailError && (
                      <span className="text-[10px] font-bold text-rose-400">{emailError}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    disabled={isEmailDisabled}
                    value={email}
                    onFocus={() => setEmailError("")}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      checkEmail(e.target.value);
                    }}
                    onBlur={() => checkEmail(email)}
                    placeholder=""
                    className={`w-full border rounded p-2.5 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                      emailError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                    }`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Create Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={isPasswordDisabled}
                      value={password}
                      onFocus={() => setPasswordError("")}
                      onChange={(e) => {
                        checkPasswordsLive(e.target.value, confirmPassword);
                      }}
                      placeholder=""
                      className="w-full border border-zinc-500 bg-zinc-700 rounded p-2.5 pr-10 text-xs text-white focus:outline-none font-medium placeholder:text-zinc-400 focus:border-[#e7b833] disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isPasswordDisabled}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Confirm Password</label>
                    {passwordError && (
                      <span className="text-[10px] font-bold text-rose-400">{passwordError}</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={isConfirmPasswordDisabled}
                      value={confirmPassword}
                      onFocus={() => setPasswordError("")}
                      onChange={(e) => {
                        checkPasswordsLive(password, e.target.value);
                      }}
                      placeholder=""
                      className={`w-full border rounded p-2.5 pr-10 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                        passwordError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isConfirmPasswordDisabled}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Create 2FA Pin (6 Digits)</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      maxLength={6}
                      disabled={isPinDisabled}
                      value={pin}
                      onFocus={() => setPinError("")}
                      onChange={(e) => {
                        checkPinLive(e.target.value, confirmPin);
                      }}
                      placeholder=""
                      className="w-full border border-zinc-500 bg-zinc-700 rounded p-2.5 pr-10 text-xs text-white focus:outline-none font-mono tracking-widest placeholder:text-zinc-400 focus:border-[#e7b833] disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isPinDisabled}
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                    >
                      {showPin ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase">Confirm 2FA Pin</label>
                    {pinError && (
                      <span className="text-[10px] font-bold text-rose-400">{pinError}</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      maxLength={6}
                      disabled={isConfirmPinDisabled}
                      value={confirmPin}
                      onFocus={() => setPinError("")}
                      onChange={(e) => {
                        checkPinLive(pin, e.target.value);
                      }}
                      placeholder=""
                      className={`w-full border rounded p-2.5 pr-10 text-xs text-white bg-zinc-700 focus:outline-none font-mono tracking-widest placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                        pinError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isConfirmPinDisabled}
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                    >
                      {showPin ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Credentials (Email/Username + Password) or Step 2: 2FA PIN Verification */}
          {view === "SIGNIN" && loginStep === "PIN_VERIFY" ? (
            <div className="space-y-4 pt-2">
              <div className="bg-zinc-900 border border-zinc-700 text-amber-300 text-xs p-3 rounded font-medium">
                Please enter your 6-digit security PIN to complete authentication.
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase">6-Digit Security PIN</label>
                  {pinError && (
                    <span className="text-[10px] font-bold text-rose-400">{pinError}</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    required
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (pinError) setPinError("");
                    }}
                    onBlur={checkPin}
                    placeholder=""
                    className="w-full border border-zinc-500 bg-zinc-700 rounded p-3 pr-10 text-center text-white text-lg tracking-widest font-mono focus:outline-none focus:border-[#e7b833]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                  >
                    {showPin ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : view === "SIGNIN" && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase">Email Address / Username</label>
                  {emailError && (
                    <span className="text-[10px] font-bold text-rose-400">{emailError}</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => {
                    checkEmail();
                  }}
                  placeholder=""
                  className={`w-full border rounded p-3 text-xs text-white bg-zinc-700 focus:outline-none font-medium placeholder:text-zinc-400 ${
                    emailError ? "border-rose-500 bg-rose-950/30 focus:border-rose-600" : "border-zinc-500 focus:border-[#e7b833]"
                  }`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase">Password</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="w-full border border-zinc-500 bg-zinc-700 rounded p-3 pr-10 text-xs text-white focus:outline-none font-medium placeholder:text-zinc-400 focus:border-[#e7b833]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (view === "SIGNUP" && !photoFile)}
            className="w-full py-3.5 rounded-xl text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] disabled:opacity-50 text-gray-900 shadow-md transition cursor-pointer uppercase tracking-wider mt-2"
          >
            {loading ? "Processing..." : view === "SIGNUP" ? "Submit Account Application" : loginStep === "PIN_VERIFY" ? "Complete Sign In" : "Sign In to Dashboard"}
          </button>
        </form>

      </div>
    </div>
  );
}
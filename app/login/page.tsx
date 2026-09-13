"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

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
  "lambertbank",
  "lambertsocial",
  "social",
  "davidlambert",
  "lambert1992",
  "lambert",
  "administrator",
  "lambertadministrator",
  "lambertadmin",
  "bankadmin",
  "superuser",
  "root",
  "officiallambert",
  "lambertbankadmin",
  "socialbank",
  "banksupport",
  "banksystem"
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [view, setView] = useState<"WELCOME" | "SIGNIN" | "SIGNUP">("WELCOME");

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  
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
  const [pinError, setPinError] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoError(false);
    }
  };

  const checkFirstName = () => {
    const nameRegex = /[^a-zA-Z\s'-]/;
    if (firstName.trim() && nameRegex.test(firstName)) {
      setFirstNameError("Not Legal");
    } else {
      setFirstNameError("");
    }
  };

  const checkLastName = () => {
    const nameRegex = /[^a-zA-Z\s'-]/;
    if (lastName.trim() && nameRegex.test(lastName)) {
      setLastNameError("Not Legal");
    } else {
      setLastNameError("");
    }
  };

  const checkEmail = () => {
    if (email.trim() && !email.includes("@")) {
      setEmailError("Must contain @");
    } else {
      setEmailError("");
    }
  };

  const checkPin = () => {
    const pinRegex = /\D/;
    if (pin.trim() && pinRegex.test(pin)) {
      setPinError("Digits only required.");
    } else if (pin.trim() && pin.length !== 6) {
      setPinError("Must be exactly 6 digits.");
    } else {
      setPinError("");
    }
  };

  const checkUsernameAvailability = async () => {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setUsernameError("");
      return;
    }

    if (cleanUser.length < 5 || cleanUser.length > 20) {
      setUsernameError("Must be 5–20 characters.");
      return;
    }

    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(cleanUser)) {
      setUsernameError("Letters and numbers only.");
      return;
    }

    if (RESERVED_USERNAMES.includes(cleanUser)) {
      setUsernameError("Username is reserved.");
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
  };

  const checkEmailAvailability = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError("");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setEmailError("Must contain @");
      return;
    }

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

      if (!firstName.trim() || !lastName.trim() || !username.trim() || !dob || !gender || !religion || !employmentStatus || !streetAddress1.trim() || !city.trim() || !stateProvince.trim() || !postcode.trim() || !email.trim() || !pin.trim()) {
        setError("Please fill out all required address and account fields.");
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
        setError("Security PIN must be exactly 6 digits (numbers only).");
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
        .eq("dob", dob)
        .eq("address", fullFormattedAddress);

      if (existingProfiles && existingProfiles.length > 0) {
        setError("An account with this Name, Date of Birth, and Address already exists. Multiple accounts are not permitted.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email: cleanEmail, 
        password: pin 
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
          dob: dob,
          address: fullFormattedAddress,
          email: cleanEmail,
          mobile_phone: fullMobile,
          gender: gender,
          religion: religion,
          employment_status: employmentStatus,
          photo_url: publicPhotoUrl,
          balance_cents: 0,
          is_approved: false,
          accumulated_session_seconds: 0
        });

        if (profileError) {
          setError("Registration failed: " + profileError.message);
        } else {
          alert("Application submitted successfully! Your account is pending review by KingDavid.");
          setView("SIGNIN");
        }
      }
    } else if (view === "SIGNIN") {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: pin 
      });
      
      if (error) {
        setError(error.message);
      } else if (data.session) {
        const newSessionId = `SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            active_session_id: newSessionId
          })
          .eq("user_id", data.session.user.id);

        if (updateError) {
          setError("Session registration failed: " + updateError.message);
          setLoading(false);
          return;
        }

        // FIX: Use sessionStorage to match SessionTimerProvider isolation rules
        sessionStorage.setItem("lambert_active_token", newSessionId);

        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg p-8 space-y-6">
        
        {view === "WELCOME" && (
          <div className="text-center space-y-6 py-6">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center rotate-45 mx-auto shadow-lg mb-4">
              <div className="w-7 h-7 bg-[#1e293b] -rotate-45 rounded-xs" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-wider uppercase">Lambert Bank</h1>
              <p className="text-xs text-gray-500 font-medium">Secure financial ledger and encrypted community platform.</p>
            </div>

            <div className="space-y-4 pt-4">
              <button
                type="button"
                onClick={() => { setError(""); setView("SIGNUP"); }}
                className="w-full py-4 rounded-xl text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>✨ Register New User Account</span>
              </button>

              <button
                type="button"
                onClick={() => { setError(""); setView("SIGNIN"); }}
                className="w-full py-4 rounded-xl text-sm font-black bg-slate-800 hover:bg-slate-900 text-white shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>🔐 Client Login Portal</span>
              </button>
            </div>
          </div>
        )}

        {view !== "WELCOME" && (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h1 className="text-lg font-black text-gray-900 tracking-wider">LAMBERT BANK</h1>
                <p className="text-[11px] text-gray-500 uppercase font-semibold mt-0.5">
                  {view === "SIGNUP" ? "New Account Application" : "Secure Client Portal Login"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setError(""); setView("WELCOME"); }}
                className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                ← Back to Welcome
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {view === "SIGNUP" && (
                <>
                  {/* Profile Identity Photo Upload Box at the Very Top */}
                  <div className="flex flex-col items-center justify-center pb-2 border-b border-gray-100">
                    <div className="mb-2 text-center">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight">PROFILE IDENTITY PHOTO</label>
                    </div>
                    <label className={`relative w-28 h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer bg-gray-50 transition overflow-hidden group ${
                      photoError ? "border-rose-500 bg-rose-50/20" : "border-gray-300 hover:border-blue-500 hover:bg-blue-50/20"
                    }`}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile Identity Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-2">
                          <svg className={`w-8 h-8 mx-auto mb-1 transition ${photoError ? "text-rose-400 group-hover:text-rose-500" : "text-gray-400 group-hover:text-blue-500"}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                          </svg>
                          <span className={`text-[10px] font-semibold block leading-tight ${photoError ? "text-rose-500" : "text-gray-500"}`}>Upload Photo</span>
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase">Legal First Name</label>
                        {firstNameError && (
                          <span className="text-[10px] font-bold text-rose-600">{firstNameError}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          if (firstNameError) setFirstNameError("");
                        }}
                        onBlur={checkFirstName}
                        placeholder="John"
                        className={`w-full border rounded p-2 text-xs text-black focus:outline-none font-medium placeholder:text-gray-300 ${
                          firstNameError ? "border-rose-500 bg-rose-50/30 focus:border-rose-600" : "border-gray-300 focus:border-blue-600"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase">Legal Last Name</label>
                        {lastNameError && (
                          <span className="text-[10px] font-bold text-rose-600">{lastNameError}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          if (lastNameError) setLastNameError("");
                        }}
                        onBlur={checkLastName}
                        placeholder="Smith"
                        className={`w-full border rounded p-2 text-xs text-black focus:outline-none font-medium placeholder:text-gray-300 ${
                          lastNameError ? "border-rose-500 bg-rose-50/30 focus:border-rose-600" : "border-gray-300 focus:border-blue-600"
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase">Username (Payment ID)</label>
                      {usernameError && (
                        <span className="text-[10px] font-bold text-rose-600">{usernameError}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={20}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (usernameError) setUsernameError("");
                      }}
                      onBlur={checkUsernameAvailability}
                      placeholder="johnsmith"
                      className={`w-full border rounded p-2 text-xs text-black focus:outline-none font-medium placeholder:text-gray-300 ${
                        usernameError ? "border-rose-500 bg-rose-50/30 focus:border-rose-600" : "border-gray-300 focus:border-blue-600"
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Gender</label>
                      <select
                        required
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Religion</label>
                      <select
                        required
                        value={religion}
                        onChange={(e) => setReligion(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                      >
                        <option value="">Select Religion</option>
                        {RELIGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Employment Status</label>
                      <select
                        required
                        value={employmentStatus}
                        onChange={(e) => setEmploymentStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                      >
                        <option value="">Select Status</option>
                        <option value="Employed">Employed</option>
                        <option value="Unemployed">Unemployed</option>
                        <option value="Student">Student</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Mobile Phone</label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="border border-gray-300 rounded p-2 text-xs text-black bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                      >
                        {COUNTRY_DIAL_CODES.map((item, index) => (
                          <option key={`${item.code}-${index}`} value={item.code}>
                            {item.code} ({item.country})
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="Number"
                        className="col-span-2 border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  {/* Standardized International Address Fields */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <span className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-wide">Residential Address</span>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Street Address / Line 1</label>
                      <input
                        type="text"
                        required
                        value={streetAddress1}
                        onChange={(e) => setStreetAddress1(e.target.value)}
                        placeholder="Street number and name"
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium placeholder:text-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Apartment, Suite, Unit, Building (Optional)</label>
                      <input
                        type="text"
                        value={streetAddress2}
                        onChange={(e) => setStreetAddress2(e.target.value)}
                        placeholder="Apt, Suite, Floor, etc."
                        className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium placeholder:text-gray-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">City / Town / Suburb</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">State / Province / Region</label>
                        <input
                          type="text"
                          required
                          value={stateProvince}
                          onChange={(e) => setStateProvince(e.target.value)}
                          className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Postal Code / ZIP</label>
                        <input
                          type="text"
                          required
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          className="w-full border border-gray-300 rounded p-2 text-xs text-black focus:outline-none focus:border-blue-600 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Country</label>
                        <select
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full border border-gray-300 rounded p-2 text-xs text-black bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                        >
                          {COUNTRIES.map((c, index) => (
                            <option key={`${c}-${index}`} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase">Email Address</label>
                  {emailError && (
                    <span className="text-[10px] font-bold text-rose-600">{emailError}</span>
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
                    checkEmailAvailability();
                  }}
                  placeholder="john.smith@example.com"
                  className={`w-full border rounded p-2.5 text-xs text-black focus:outline-none font-medium placeholder:text-gray-300 ${
                    emailError ? "border-rose-500 bg-rose-50/30 focus:border-rose-600" : "border-gray-300 focus:border-blue-600"
                  }`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase">Security PIN (6 digits)</label>
                  {pinError && (
                    <span className="text-[10px] font-bold text-rose-600">{pinError}</span>
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
                    placeholder="••••••"
                    className={`w-full border rounded p-2.5 pr-10 text-xs text-black focus:outline-none font-mono tracking-widest placeholder:text-gray-300 ${
                      pinError ? "border-rose-500 bg-rose-50/30 focus:border-rose-600" : "border-gray-300 focus:border-blue-600"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition cursor-pointer uppercase tracking-wider"
              >
                {loading ? "Processing..." : view === "SIGNUP" ? "Submit Account Application" : "Sign In to Dashboard"}
              </button>
            </form>

            <div className="text-center pt-2">
              {view === "SIGNUP" ? (
                <button
                  type="button"
                  onClick={() => { setError(""); setView("SIGNIN"); }}
                  className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                >
                  Already have an account? Sign in here
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setError(""); setView("SIGNUP"); }}
                  className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                >
                  Need an account? Register here
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
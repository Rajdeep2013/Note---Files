const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
const eyeIcon = togglePassword.querySelector(".eye-icon");
const eyeOffIcon = togglePassword.querySelector(".eye-off-icon");

togglePassword.addEventListener("click", (e) => {
  e.preventDefault();
  
  const isPassword = passwordInput.type === "password";
  
  if (isPassword) {
    passwordInput.type = "text";
    eyeIcon.style.display = "none";
    eyeOffIcon.style.display = "block";
  } else {
    passwordInput.type = "password";
    eyeIcon.style.display = "block";
    eyeOffIcon.style.display = "none";
  }
});

signupBtn.addEventListener("click", () => {

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  localStorage.setItem("username", username);
  localStorage.setItem("password", password);

  alert("Account Created!");

});

loginBtn.addEventListener("click", () => {

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const savedUser = localStorage.getItem("username");
  const savedPass = localStorage.getItem("password");

  if (username === savedUser && password === savedPass) {

    alert("Login Successful!");

    window.location.href = "index.html";

  } else {

    alert("Wrong Username or Password");

  }

});
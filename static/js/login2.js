import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, setDoc, doc } from '/static/js/firebase.js'; // Adjust path as necessary

const loginBtn = document.querySelector("#login-btn");
const registerBtn = document.querySelector("#register-btn");

const loginForm = document.querySelector(".login-container");
const registerForm = document.querySelector(".register-container");

const fluid = document.querySelector("#fluid");

// Add login function
function login(event) {
    event.preventDefault(); // Prevent form submission
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        const user = userCredential.user;
        const uid = user.uid; // Get UID from userCredential

        console.log("User logged in with UID:", uid); // Log the UID
        
        window.location.href = '/mybook'; // Redirect to the "mybook" page on success
    })
    .catch((error) => {
        alert("Login failed: " + error.message);
        console.error('Login error:', error); // Log the error
    });
}

// Add registration function
function register(event) {
    event.preventDefault(); // Prevent form submission
    const username = document.getElementById("reg-user").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            // Add user data to Firestore
            return setDoc(doc(db, 'users', user.uid), {
                username: username,
                email: email,
                uid: user.uid
            });
        })
        .then(() => {
            alert("Registration successful!");
            window.location.href = document.referrer;  // Return to the previous page
        })
        .catch((error) => {
            alert("Registration failed: " + error.message);
        });
}

// Switch between login and register forms
function viewLogin() {
    loginForm.style.left = 0;
    registerForm.style.left = "100%";

    loginForm.style.opacity = 1;
    registerForm.style.opacity = 0;

    fluid.classList.add("fluid-animate");
}

function viewRegister() {
    loginForm.style.left = "-100%";
    registerForm.style.left = 0;

    loginForm.style.opacity = 0;
    registerForm.style.opacity = 1;

    fluid.classList.add("fluid-animate");
}

// Attach event listeners for buttons
registerBtn.addEventListener('click', viewRegister);
loginBtn.addEventListener('click', viewLogin);

// Attach event listeners for form submission
document.querySelector(".login-form").addEventListener("submit", login);
document.querySelector(".register-form").addEventListener("submit", register);

// Remove animation class after it ends
fluid.addEventListener('animationend', () => {
    fluid.classList.remove("fluid-animate");
});

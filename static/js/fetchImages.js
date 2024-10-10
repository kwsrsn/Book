import { auth, storage } from '/static/js/firebase.js'; // Adjust path as necessary
import { ref, listAll, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.1.2/firebase-storage.js"; // Import necessary functions

const bookGrid = document.getElementById('book-grid');

// Function to fetch images based on the logged-in user's UID
// Function to fetch images based on the logged-in user's UID
function fetchBookImages() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';  // Show loader while fetching images

    auth.onAuthStateChanged((user) => {
        if (user) {
            const uid = user.uid;  // Get the logged-in user's UID
            console.log('Logged in user UID:', uid); // Log user UID

            const userBooksRef = ref(storage, `${uid}/`);
            listAll(userBooksRef)
                .then((res) => {
                    console.log('Found items:', res.items); // Log found items
                    res.items.forEach((itemRef) => {
                        getDownloadURL(itemRef)
                            .then((url) => {
                                const imgElement = document.createElement('img');
                                imgElement.src = url;
                                imgElement.alt = 'Book Cover';
                                imgElement.classList.add('book');
                                const bookContainer = document.createElement('div');
                                bookContainer.classList.add('book-container');
                                bookContainer.appendChild(imgElement);
                                bookGrid.appendChild(bookContainer);
                            })
                            .catch((error) => {
                                console.error('Error fetching image URL:', error);
                            });
                    });
                })
                .catch((error) => {
                    console.error('Error listing images:', error);
                })
                .finally(() => {
                    loader.style.display = 'none';
                });
        } else {
            console.log('User not logged in');
        }
    });
}


// Call the function to fetch images when the page loads
window.onload = fetchBookImages;

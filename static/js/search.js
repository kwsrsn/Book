import {auth, doc, db, getDoc, collection, query, where, getDocs } from '/static/js/firebase.js';
const dragArea = document.querySelector('.drag-area');
const dragText = document.querySelector('.header');
let button = document.querySelector('.button');
let input = document.querySelector('input[type="file"]');
let file;

// Open file picker when button is clicked
button.onclick = () => {
    input.click();
};

// When a file is selected via the file picker
input.addEventListener('change', function() {
    file = this.files[0];
    if (file) {
        console.log('Selected file:', file); // Log selected file
        dragArea.classList.add('active');
        displayFile();
    }
});

// Handle drag events
dragArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dragText.textContent = 'Release to Upload';
    dragArea.classList.add('active');
});

dragArea.addEventListener('dragleave', () => {
    dragText.textContent = 'Drag & Drop';
    dragArea.classList.remove('active');
});

// When the file is dropped in the drag area
dragArea.addEventListener('drop', (event) => {
    event.preventDefault();
    file = event.dataTransfer.files[0];
    if (file) {
        console.log('Dropped file:', file); // Log dropped file
        displayFile();
    }
});

// Display the selected file
function displayFile() {
    let fileType = file.type;
    let validExtensions = ['image/jpeg', 'image/jpg', 'image/png'];

    if (validExtensions.includes(fileType)) {
        let fileReader = new FileReader();

        fileReader.onload = () => {
            let fileURL = fileReader.result;
            let imgTag = `<img src="${fileURL}" alt="">`;
            dragArea.innerHTML = imgTag;
        };
        fileReader.readAsDataURL(file);
    } else {
        alert('This file is not an Image');
        dragArea.classList.remove('active');
    }
}

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent the default form submission

    // Check if a file has been selected
    if (!file) {
        alert('Please select a file to upload');
        return;
    }

    const formDatasearch = new FormData(form);
    formDatasearch.append('file', file); // Add file to FormData

    // Display "searching" message
    document.getElementById('searchStatus').style.display = 'flex';

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const firestoreDocRef = doc(db, 'users', user.uid);
                const firestoreDoc = await getDoc(firestoreDocRef);

                if (firestoreDoc.exists()) {
                    const firestoreUid = firestoreDoc.data().uid;

                    // Send file to Python back-end for OCR
                    const response = await fetch('/process-image', {
                        method: 'POST',
                        body: formDatasearch
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const ocrResult = data.ocr_result;

                        // Search Firestore for the extracted book title
                        const booksCollectionRef = collection(db, "uploads", firestoreUid, "book");
                        const q = query(booksCollectionRef, where("namebook", "==", ocrResult));
                        const querySnapshot = await getDocs(q);

                        let titles = [];
                        let images = [];

                        querySnapshot.forEach((doc) => {
                            const bookData = doc.data();
                            titles.push(bookData.namebook);
                            images.push(bookData.image_url); // Assuming 'image' field contains the book cover URL
                        });

                        if (titles.length > 0 && images.length > 0) {
                            // Encode data and redirect to results page
                            const titlesParam = encodeURIComponent(JSON.stringify(titles));
                            const imagesParam = encodeURIComponent(JSON.stringify(images));
                            window.location.href = `/results?titles=${titlesParam}&images=${imagesParam}`;
                        } else {
                            alert('No matching book titles found.');
                            window.location.href = '/search';
                        }

                        // Clear drag area and input
                        dragArea.innerHTML = '';
                        input.value = '';
                        file = null;
                    } else {
                        throw new Error('Upload failed');
                    }
                } else {
                    throw new Error('User data not found in Firestore.');
                }
            } catch (error) {
                console.error(error);
                alert('An error occurred: ' + error.message);

                // Redirect to search page on error
                window.location.href = '/search';
            } finally {
                document.getElementById('searchStatus').style.display = 'none'; // Hide the status message
            }
        } else {
            document.getElementById('modalMessage').textContent = 'User not logged in. Please log in to upload files.';
            document.getElementById('myModal').style.display = 'block';
        }
    });
});

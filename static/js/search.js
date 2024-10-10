import {auth, doc, db, getDoc } from '/static/js/firebase.js';
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

    // ตรวจสอบว่ามีไฟล์ถูกเลือกหรือไม่
    if (!file) {
        alert('Please select a file to upload'); // Show alert if no file is selected
        return;
    }

    const formDatasearch = new FormData(form);
    formDatasearch.append('file', file); // Add file to FormData

    // แสดงข้อความ "กำลังค้นหา..." เฉพาะเมื่อมีไฟล์
    document.getElementById('searchStatus').style.display = 'flex';
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const firestoreDocRef = doc(db, 'users', user.uid);
            const firestoreDoc = await getDoc(firestoreDocRef);
            if (firestoreDoc.exists()) {
                const firestoreUid = firestoreDoc.data().uid; // ใช้ firestoreUid
                formDatasearch.append('userId', firestoreUid);
                console.log(firestoreUid)
                
                // Send the upload request
                fetch('/search', {
                    method: 'POST',
                    body: formDatasearch
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Upload failed');
                    }
                    return response.json(); // Parse the JSON response if response is okay
                })
                .then(data => {
                    if (data.titles && data.images) {
                        const titlesParam = encodeURIComponent(JSON.stringify(data.titles));
                        const imagesParam = encodeURIComponent(JSON.stringify(data.images));
                        window.location.href = `/results?titles=${titlesParam}&images=${imagesParam}`; // Redirect to results page
                    } else {
                        alert('No matching book titles found.'); // Show error message if no titles found
                    }
                    // Clear the drag area and input
                    dragArea.innerHTML = '';
                    input.value = '';
                    file = null;
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred during the upload'); // Show error message if there's an error
                })
                .finally(() => {
                    // ซ่อนข้อความสถานะเมื่อเสร็จสิ้นการประมวลผล
                    document.getElementById('searchStatus').style.display = 'none';
                });
            } else {
                console.log('No such user document!');
                modalMessage.textContent = 'User data not found in Firestore.'; // Show message in modal
                modal.style.display = "block"; // Show modal
            }
        } else {
            console.log('User not logged in');
            modalMessage.textContent = 'User not logged in. Please log in to upload files.'; // Show message in modal
            modal.style.display = "block"; // Show modal
        }
    });
});
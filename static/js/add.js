import { auth, doc, db, getDoc, addDoc, storage, ref, getDownloadURL, uploadBytes, collection } from '/static/js/firebase.js';

const dragArea = document.querySelector('.drag-area');
const dragText = document.querySelector('.header');
let button = document.querySelector('.button');
let input = document.querySelector('input[type="file"]');
let file;

// Open file picker when button is clicked
button.onclick = () => input.click();

// When a file is selected via the file picker
input.addEventListener('change', function() {
    file = this.files[0];
    if (file) {
        console.log('Selected file:', file);
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
        console.log('Dropped file:', file);
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
        alert('This file is not an image.');
        dragArea.classList.remove('active');
    }
}

// Form submission logic
const form = document.getElementById('uploadForm');
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!file) {
        document.getElementById('modalMessage').textContent = 'Please select a file to upload';
        document.getElementById('myModal').style.display = 'block';
        return;
    }

    document.getElementById('uploadStatus').style.display = 'flex'; // Show loading status

    // Get authenticated user and Firebase Storage reference
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const firestoreDocRef = doc(db, 'users', user.uid);
                const firestoreDoc = await getDoc(firestoreDocRef);
    
                if (firestoreDoc.exists()) {
                    const firestoreUid = firestoreDoc.data().uid;
                    const storageRef = ref(storage, `${firestoreUid}/${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
    
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    console.log(JSON.stringify({ image_url: downloadURL }));

                    const formData = new FormData(form);
                    formData.append('file', file);
    
                    // Send file URL to Python back-end for OCR
                    const response = await fetch('/process-image', {  // ตรวจสอบ endpoint ที่นี่
                        method: 'POST',
                        body: formData
                    });
                    
                    console.log('Response Status:', response.status); // Log the response status
                    console.log('Response OK:', response.ok); 
    
                    if (response.ok) {
                        const data = await response.json();
                        const ocrResult = data.ocr_result;
    
                        // Save OCR result and image URL to Firestore
                        const uploadData = {
                            image_url: downloadURL,
                            namebook: ocrResult
                        };
                        await addDoc(collection(db, "uploads", firestoreUid, "book"), uploadData);
    
                        // Success message
                        document.getElementById('modalMessage').textContent = 'File uploaded and processed successfully!';
                        document.getElementById('myModal').style.display = 'block';
                    } else {
                        const errorData = await response.json(); // แปลงการตอบกลับข้อผิดพลาด
                        console.error('Error response data:', errorData); // Log the error response data
                        throw new Error('Failed to process the image: ' + errorData.error);
                    }
                } else {
                    throw new Error('User data not found in Firestore.');
                }
            } catch (error) {
                console.error(error);
                document.getElementById('modalMessage').textContent = `Error: ${error.message}`;
                document.getElementById('myModal').style.display = 'block';
            } finally {
                document.getElementById('uploadStatus').style.display = 'none'; // ซ่อนสถานะการอัพโหลด
            }
        } else {
            document.getElementById('modalMessage').textContent = 'User not logged in. Please log in to upload files.';
            document.getElementById('myModal').style.display = 'block';
        }
    });
});

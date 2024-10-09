const dragArea = document.querySelector('.drag-area');
const dragText = document.querySelector('.header');
let button = document.querySelector('.button');
let input = document.querySelector('input');
let file;

// Open file dialog when button is clicked
button.onclick = () => {
    input.click();
};

// When a file is selected
input.addEventListener('change', function() {
    file = this.files[0];
    dragArea.classList.add('active');
    displayFile();
});

// When dragging a file over the drag area
dragArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dragText.textContent = 'Release to Upload';
    dragArea.classList.add('active');
});

// When dragging leaves the drag area
dragArea.addEventListener('dragleave', () => {
    dragText.textContent = 'Drag & Drop';
    dragArea.classList.remove('active');
});

// When a file is dropped in the drag area
dragArea.addEventListener('drop', (event) => {
    event.preventDefault();
    file = event.dataTransfer.files[0];
    displayFile();
});

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
        file = null; // Clear the file variable if not valid
    }
}

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent the default form submission

    if (!file) {
        alert('Please select a file to upload'); // Show alert if no file is selected
        return;
    }

    const formData = new FormData(form);
    formData.append('file', file); // Add file to FormData

    fetch('/search', {
        method: 'POST',
        body: formData
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
    });
});

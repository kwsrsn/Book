function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const titles = JSON.parse(decodeURIComponent(params.get('titles'))) || [];
    const images = JSON.parse(decodeURIComponent(params.get('images'))) || [];
    return { titles, images };
}

// Function to display the results
function displayResults(titles, images) {
    const resultsContainer = document.getElementById('resultsContainer');
    if (titles.length > 0 && images.length > 0) {
        const ul = document.createElement('ul');
        titles.forEach((title, index) => {
            const li = document.createElement('li');

            const img = document.createElement('img');
            img.src = images[index]; // Use the corresponding image URL
            img.alt = title; // Add alt text for accessibility
            img.style.width = '150px'; // Set image width (adjust as needed)
            img.style.height = 'auto'; // Maintain aspect ratio

            const titleElement = document.createElement('h3');
            titleElement.textContent = title;

            li.appendChild(img);
            li.appendChild(titleElement);
            ul.appendChild(li);
        });
        resultsContainer.appendChild(ul);
    } else {
        resultsContainer.innerHTML = '<p>No books found.</p>'; // Display message if no books found
    }
}

// Get query parameters and display results
const { titles, images } = getQueryParams();
displayResults(titles, images);
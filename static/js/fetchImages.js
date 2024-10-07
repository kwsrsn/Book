async function fetchImages() {
    const loader = document.getElementById('loader');

    if (loader) {
        loader.style.display = 'flex'; // แสดง loader
        loader.textContent = 'Please wait...'; // แสดงข้อความ
    }

    // ลบข้อมูลเก่าใน Local Storage ทุกครั้งที่เริ่มโหลดใหม่
    localStorage.removeItem('bookImages');

    try {
        const response = await fetch('/images');
        const data = await response.json(); // โหลดข้อมูลใหม่

        // บันทึกข้อมูลใน Local Storage
        localStorage.setItem('bookImages', JSON.stringify(data));
        displayImages(data);
    } catch (error) {
        console.error('Error fetching images:', error);
    } finally {
        if (loader) loader.style.display = 'none'; // ซ่อน loader เมื่อโหลดเสร็จ
    }
}

function displayImages(data) {
    const bookGrid = document.getElementById('book-grid');
    if (!bookGrid) {
        console.error("Element with id 'book-grid' not found.");
        return; // ออกจากฟังก์ชันหากไม่พบ element
    }

    // ล้างภาพเก่า แต่เก็บปุ่มเพิ่ม
    const addButton = bookGrid.querySelector('.add'); // เก็บปุ่มเพิ่ม
    bookGrid.innerHTML = ''; // ล้างเนื้อหาเก่า
    if (addButton) {
        bookGrid.appendChild(addButton); // เพิ่มปุ่มกลับเข้าไป
    }

    // แสดงภาพใหม่
    data.forEach(url => {
        const bookDiv = document.createElement('div');
        bookDiv.classList.add('book');
        bookDiv.innerHTML = `<img src="${url}" alt="Book Image" loading="lazy">`; // ใช้ lazy loading
        bookGrid.appendChild(bookDiv);
    });
}

// Call the fetchImages function on page load
window.onload = fetchImages;
